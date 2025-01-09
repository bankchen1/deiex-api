import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { TwoFactorService } from '../auth/services/two-factor.service';
import { ConfigService } from '@nestjs/config';
import { createObjectCsvWriter } from 'csv-writer';
import * as ExcelJS from 'exceljs';
import { format } from 'date-fns';
import {
  GetTransactionsDto,
  CreateTransactionDto,
  ExportTransactionsDto,
  TransactionType,
} from './dto/wallet.dto';

@Injectable()
export class WalletService {
  constructor(
    private prisma: PrismaService,
    private twoFactorService: TwoFactorService,
    private configService: ConfigService,
  ) {}

  async getBalance(userId: number) {
    const wallet = await this.prisma.wallet.findUnique({
      where: { userId: userId.toString() },
      include: { balances: true },
    });

    if (!wallet) {
      throw new NotFoundException('钱包不存在');
    }

    return wallet.balances;
  }

  async getTransactions(userId: number, query: GetTransactionsDto) {
    const { page = 1, limit = 20, startDate, endDate, type, status } = query;
    const skip = (page - 1) * limit;

    const where = {
      userId: userId.toString(),
      ...(startDate && { createdAt: { gte: startDate } }),
      ...(endDate && { createdAt: { lte: endDate } }),
      ...(type && { type }),
      ...(status && { status }),
    };

    const [transactions, total] = await Promise.all([
      this.prisma.walletTransaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.walletTransaction.count({ where }),
    ]);

    return {
      data: transactions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async createTransaction(userId: number, dto: CreateTransactionDto) {
    // 检查是否需要 2FA 验证
    if (this.needsVerification(dto.type, dto.amount)) {
      const verified = await this.twoFactorService.verify(userId, dto.code, {
        action: dto.type,
        amount: dto.amount,
        currency: dto.currency,
      });

      if (!verified) {
        throw new BadRequestException('2FA 验证失败');
      }
    }

    // 检查余额是否足够（对于提现和转账）
    if ([TransactionType.WITHDRAW, TransactionType.TRANSFER].includes(dto.type)) {
      const balance = await this.getBalanceByCurrency(userId, dto.currency);
      if (balance < dto.amount) {
        throw new BadRequestException('余额不足');
      }
    }

    const transaction = await this.prisma.walletTransaction.create({
      data: {
        userId: userId.toString(),
        type: dto.type,
        amount: dto.amount,
        currency: dto.currency,
        status: 'pending',
        additionalData: dto.additionalData,
      },
    });

    // 异步处理交易
    this.processTransaction(transaction.id).catch(console.error);

    return transaction;
  }

  async cancelTransaction(userId: number, transactionId: string) {
    const transaction = await this.prisma.walletTransaction.findFirst({
      where: {
        id: transactionId,
        userId: userId.toString(),
      },
    });

    if (!transaction) {
      throw new NotFoundException('交易不存在');
    }

    if (transaction.status !== 'pending') {
      throw new BadRequestException('只能取消待处理的交易');
    }

    await this.prisma.walletTransaction.update({
      where: { id: transactionId },
      data: { status: 'cancelled' },
    });
  }

  async exportTransactions(userId: number, query: ExportTransactionsDto, res: Response) {
    const transactions = await this.prisma.walletTransaction.findMany({
      where: {
        userId: userId.toString(),
        ...(query.startDate && { createdAt: { gte: query.startDate } }),
        ...(query.endDate && { createdAt: { lte: query.endDate } }),
        ...(query.type && { type: query.type }),
        ...(query.status && { status: query.status }),
      },
      orderBy: { createdAt: 'desc' },
    });

    if (query.format === 'csv') {
      await this.exportToCsv(res, transactions);
    } else {
      await this.exportToExcel(res, transactions);
    }
  }

  private async getBalanceByCurrency(userId: number, currency: string): Promise<number> {
    const balance = await this.prisma.walletBalance.findFirst({
      where: {
        wallet: { userId: userId.toString() },
        currency,
      },
    });

    return balance?.amount || 0;
  }

  private needsVerification(type: TransactionType, amount: number): boolean {
    const limits = this.configService.get('transaction.limits');
    switch (type) {
      case TransactionType.WITHDRAW:
      case TransactionType.TRANSFER:
        return amount > limits.WITHDRAW.MAX / 2;
      default:
        return false;
    }
  }

  private async processTransaction(transactionId: string) {
    const transaction = await this.prisma.walletTransaction.findUnique({
      where: { id: transactionId },
    });

    if (!transaction) {
      return;
    }

    try {
      // 根据不同的交易类型处理
      switch (transaction.type) {
        case TransactionType.DEPOSIT:
          await this.processDeposit(transaction);
          break;
        case TransactionType.WITHDRAW:
          await this.processWithdraw(transaction);
          break;
        case TransactionType.TRANSFER:
          await this.processTransfer(transaction);
          break;
      }

      await this.prisma.walletTransaction.update({
        where: { id: transactionId },
        data: { status: 'completed' },
      });
    } catch (error) {
      await this.prisma.walletTransaction.update({
        where: { id: transactionId },
        data: { status: 'failed', additionalData: { error: error.message } },
      });
    }
  }

  private async processDeposit(transaction: any) {
    await this.prisma.walletBalance.upsert({
      where: {
        wallet_currency: {
          walletId: transaction.walletId,
          currency: transaction.currency,
        },
      },
      update: {
        amount: { increment: transaction.amount },
      },
      create: {
        walletId: transaction.walletId,
        currency: transaction.currency,
        amount: transaction.amount,
      },
    });
  }

  private async processWithdraw(transaction: any) {
    await this.prisma.walletBalance.update({
      where: {
        wallet_currency: {
          walletId: transaction.walletId,
          currency: transaction.currency,
        },
      },
      data: {
        amount: { decrement: transaction.amount },
      },
    });
  }

  private async processTransfer(transaction: any) {
    const { fromWalletId, toWalletId } = transaction.additionalData;
    await this.prisma.$transaction([
      this.prisma.walletBalance.update({
        where: {
          wallet_currency: {
            walletId: fromWalletId,
            currency: transaction.currency,
          },
        },
        data: {
          amount: { decrement: transaction.amount },
        },
      }),
      this.prisma.walletBalance.upsert({
        where: {
          wallet_currency: {
            walletId: toWalletId,
            currency: transaction.currency,
          },
        },
        update: {
          amount: { increment: transaction.amount },
        },
        create: {
          walletId: toWalletId,
          currency: transaction.currency,
          amount: transaction.amount,
        },
      }),
    ]);
  }

  private async exportToCsv(res: Response, transactions: any[]) {
    const csvWriter = createObjectCsvWriter({
      path: 'transactions.csv',
      header: [
        { id: 'id', title: 'ID' },
        { id: 'type', title: '类型' },
        { id: 'amount', title: '金额' },
        { id: 'currency', title: '货币' },
        { id: 'status', title: '状态' },
        { id: 'createdAt', title: '创建时间' },
      ],
    });

    await csvWriter.writeRecords(transactions);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=transactions-${format(new Date(), 'yyyy-MM-dd')}.csv`,
    );
    res.download('transactions.csv');
  }

  private async exportToExcel(res: Response, transactions: any[]) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Transactions');

    worksheet.columns = [
      { header: 'ID', key: 'id', width: 20 },
      { header: '类型', key: 'type', width: 15 },
      { header: '金额', key: 'amount', width: 15 },
      { header: '货币', key: 'currency', width: 10 },
      { header: '状态', key: 'status', width: 15 },
      { header: '创建时间', key: 'createdAt', width: 20 },
    ];

    worksheet.addRows(transactions);

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=transactions-${format(new Date(), 'yyyy-MM-dd')}.xlsx`,
    );

    await workbook.xlsx.write(res);
  }
} 