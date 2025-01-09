import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Query, 
  Param, 
  UseGuards,
  ValidationPipe,
  ParseIntPipe,
  ParseEnumPipe,
  StreamableFile,
  Response,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { 
  ApiTags, 
  ApiOperation, 
  ApiResponse, 
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { WalletService } from '../services/wallet.service';
import { DepositService } from '../services/deposit.service';
import { WithdrawalService } from '../services/withdrawal.service';
import { TransactionHistoryService } from '../services/transaction-history.service';
import { 
  TransactionType,
  TransactionStatus,
  WalletTransaction,
} from '../types/wallet.types';
import {
  CreateWithdrawalDto,
  WithdrawalHistoryQueryDto,
  WithdrawalFeeDto,
  AddressWhitelistDto,
} from '../dto/withdrawal.dto';
import {
  TransactionHistoryQueryDto,
  TransactionStatsQueryDto,
  TransactionSearchQueryDto,
  TransactionExportQueryDto,
} from '../dto/transaction.dto';
import {
  WalletBalanceResponse,
  TransactionResponse,
  TransactionHistoryResponse,
  TransactionStatsResponse,
  DailyTransactionStatsResponse,
  WithdrawalLimitResponse,
  WithdrawalFeeResponse,
  WhitelistAddressResponse,
} from '../dto/response.dto';
import { Response as ExpressResponse } from 'express';

@ApiTags('钱包')
@Controller('wallet')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class WalletController {
  constructor(
    private readonly walletService: WalletService,
    private readonly depositService: DepositService,
    private readonly withdrawalService: WithdrawalService,
    private readonly transactionHistoryService: TransactionHistoryService,
  ) {}

  // 钱包管理
  @Get('balances')
  @ApiOperation({ summary: '获取所有钱包余额' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: '成功获取钱包余额列表',
    type: [WalletBalanceResponse],
  })
  async getBalances(@CurrentUser() userId: string): Promise<WalletBalanceResponse[]> {
    return await this.walletService.getUserWallets(userId);
  }

  @Get('balance/:currency')
  @ApiOperation({ summary: '获取指定币种余额' })
  @ApiParam({ 
    name: 'currency', 
    description: '币种符号',
    example: 'BTC',
  })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: '成功获取钱包余额',
    type: WalletBalanceResponse,
  })
  @ApiResponse({ 
    status: HttpStatus.NOT_FOUND, 
    description: '钱包不存在',
  })
  async getBalance(
    @CurrentUser() userId: string,
    @Param('currency') currency: string,
  ): Promise<WalletBalanceResponse> {
    const wallet = await this.walletService.getWallet(userId, currency);
    if (!wallet) {
      throw new BadRequestException('Wallet not found');
    }
    return wallet;
  }

  // 充值相关
  @Get('deposit/address/:currency')
  @ApiOperation({ summary: '获取充值地址' })
  @ApiParam({ 
    name: 'currency', 
    description: '币种符号',
    example: 'BTC',
  })
  @ApiQuery({ 
    name: 'chain', 
    description: '区块链网络',
    example: 'BTC',
  })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: '成功获取充值地址',
    type: WalletBalanceResponse,
  })
  async getDepositAddress(
    @CurrentUser() userId: string,
    @Param('currency') currency: string,
    @Query('chain') chain: string,
  ): Promise<WalletBalanceResponse> {
    return await this.depositService.getDepositAddress(userId, currency, chain);
  }

  @Get('deposit/history')
  @ApiOperation({ summary: '获取充值历史' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: '成功获取充值历史',
    type: TransactionHistoryResponse,
  })
  async getDepositHistory(
    @CurrentUser() userId: string,
    @Query(ValidationPipe) query: WithdrawalHistoryQueryDto,
  ): Promise<TransactionHistoryResponse> {
    return await this.depositService.getDepositHistory(
      userId,
      query.currency,
      query.status,
      query.startTime,
      query.endTime,
      query.page,
      query.limit,
    );
  }

  // 提现相关
  @Post('withdraw')
  @ApiOperation({ summary: '创建提现请求' })
  @ApiBody({ type: CreateWithdrawalDto })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: '成功创建提现请求',
    type: TransactionResponse,
  })
  @ApiResponse({ 
    status: HttpStatus.BAD_REQUEST, 
    description: '提现请求参数错误',
  })
  async createWithdrawal(
    @CurrentUser() userId: string,
    @Body(ValidationPipe) withdrawalRequest: CreateWithdrawalDto,
  ): Promise<TransactionResponse> {
    return await this.withdrawalService.createWithdrawal({
      userId,
      ...withdrawalRequest,
    });
  }

  @Get('withdraw/history')
  @ApiOperation({ summary: '获取提现历史' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: '成功获取提现历史',
    type: TransactionHistoryResponse,
  })
  async getWithdrawalHistory(
    @CurrentUser() userId: string,
    @Query(ValidationPipe) query: WithdrawalHistoryQueryDto,
  ): Promise<TransactionHistoryResponse> {
    return await this.withdrawalService.getWithdrawalHistory(
      userId,
      query.currency,
      query.status,
      query.startTime,
      query.endTime,
      query.page,
      query.limit,
    );
  }

  @Get('withdraw/fee')
  @ApiOperation({ summary: '计算提现手续费' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: '成功计算提现手续费',
    type: WithdrawalFeeResponse,
  })
  async getWithdrawalFee(
    @Query(ValidationPipe) query: WithdrawalFeeDto,
  ): Promise<WithdrawalFeeResponse> {
    return await this.withdrawalService.getWithdrawalFee(
      query.currency,
      query.amount,
    );
  }

  @Get('withdraw/limits')
  @ApiOperation({ summary: '获取提现限额' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: '成功获取提现限额',
    type: WithdrawalLimitResponse,
  })
  async getWithdrawalLimits(
    @CurrentUser() userId: string,
    @Query('currency') currency: string,
  ): Promise<WithdrawalLimitResponse> {
    return await this.withdrawalService.getWithdrawalLimits(userId, currency);
  }

  // 地址白名单
  @Post('whitelist/address')
  @ApiOperation({ summary: '添加提现地址白名单' })
  @ApiBody({ type: AddressWhitelistDto })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: '成功添加地址白名单',
    type: WhitelistAddressResponse,
  })
  async addWhitelistAddress(
    @CurrentUser() userId: string,
    @Body(ValidationPipe) whitelistRequest: AddressWhitelistDto,
  ): Promise<WhitelistAddressResponse> {
    return await this.walletService.addWhitelistAddress(
      userId,
      whitelistRequest.currency,
      whitelistRequest.chain,
      whitelistRequest.address,
      whitelistRequest.label,
    );
  }

  @Get('whitelist/addresses')
  @ApiOperation({ summary: '获取提现地址白名单' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: '成功获取地址白名单',
    type: [WhitelistAddressResponse],
  })
  async getWhitelistAddresses(
    @CurrentUser() userId: string,
    @Query('currency') currency?: string,
  ): Promise<WhitelistAddressResponse[]> {
    return await this.walletService.getWhitelistAddresses(userId, currency);
  }

  // 交易历史
  @Get('transactions')
  @ApiOperation({ summary: '获取交易历史' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: '成功获取交易历史',
    type: TransactionHistoryResponse,
  })
  async getTransactionHistory(
    @CurrentUser() userId: string,
    @Query(ValidationPipe) query: TransactionHistoryQueryDto,
  ): Promise<TransactionHistoryResponse> {
    return await this.transactionHistoryService.getTransactionHistory(userId, query);
  }

  @Get('transactions/stats')
  @ApiOperation({ summary: '获取交易统计' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: '成功获取交易统计',
    type: TransactionStatsResponse,
  })
  async getTransactionStats(
    @CurrentUser() userId: string,
    @Query(ValidationPipe) query: TransactionStatsQueryDto,
  ): Promise<TransactionStatsResponse> {
    return await this.transactionHistoryService.getTransactionStats(userId, query);
  }

  @Get('transactions/daily-stats')
  @ApiOperation({ summary: '获取每日交易统计' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: '成功获取每日交易统计',
    type: [DailyTransactionStatsResponse],
  })
  async getDailyTransactionStats(
    @CurrentUser() userId: string,
    @Query(ValidationPipe) query: TransactionStatsQueryDto,
  ): Promise<DailyTransactionStatsResponse[]> {
    return await this.transactionHistoryService.getDailyTransactionStats(userId, query);
  }

  @Get('transactions/export')
  @ApiOperation({ summary: '导出交易历史' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: '成功导出交易历史',
    type: StreamableFile,
  })
  async exportTransactionHistory(
    @CurrentUser() userId: string,
    @Query(ValidationPipe) query: TransactionExportQueryDto,
    @Response() res: ExpressResponse,
  ): Promise<StreamableFile> {
    const buffer = await this.transactionHistoryService.exportTransactionHistory(
      userId,
      query,
    );

    const filename = `transactions_${new Date().toISOString()}.${query.format}`;
    res.set({
      'Content-Type': query.format === 'csv' ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });

    return new StreamableFile(buffer);
  }

  @Get('transactions/:id')
  @ApiOperation({ summary: '获取交易详情' })
  @ApiParam({ 
    name: 'id', 
    description: '交易ID',
  })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: '成功获取交易详情',
    type: TransactionResponse,
  })
  @ApiResponse({ 
    status: HttpStatus.NOT_FOUND, 
    description: '交易不存在',
  })
  async getTransactionDetail(
    @CurrentUser() userId: string,
    @Param('id') transactionId: string,
  ): Promise<TransactionResponse> {
    return await this.transactionHistoryService.getTransactionDetail(
      userId,
      transactionId,
    );
  }

  @Get('transactions/search')
  @ApiOperation({ summary: '搜索交易' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: '成功搜索交易',
    type: TransactionHistoryResponse,
  })
  async searchTransactions(
    @CurrentUser() userId: string,
    @Query(ValidationPipe) query: TransactionSearchQueryDto,
  ): Promise<TransactionHistoryResponse> {
    return await this.transactionHistoryService.searchTransactions(
      userId,
      query.q,
      {
        currency: query.currency,
        type: query.type,
        status: query.status,
        page: query.page,
        limit: query.limit,
      },
    );
  }
}
