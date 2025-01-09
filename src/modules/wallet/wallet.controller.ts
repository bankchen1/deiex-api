import { Controller, Get, Post, Delete, Body, Query, Param, UseGuards, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { WalletService } from './wallet.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { User } from '../auth/decorators/user.decorator';
import {
  GetTransactionsDto,
  CreateTransactionDto,
  ExportTransactionsDto,
} from './dto/wallet.dto';

@ApiTags('钱包')
@Controller('wallet')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get('balance')
  @ApiOperation({ summary: '获取钱包余额' })
  @ApiResponse({ status: 200, description: '获取成功' })
  async getBalance(@User('id') userId: number) {
    return await this.walletService.getBalance(userId);
  }

  @Get('transactions')
  @ApiOperation({ summary: '获取交易记录' })
  @ApiResponse({ status: 200, description: '获取成功' })
  async getTransactions(
    @User('id') userId: number,
    @Query() query: GetTransactionsDto,
  ) {
    return await this.walletService.getTransactions(userId, query);
  }

  @Post('transactions')
  @ApiOperation({ summary: '创建交易' })
  @ApiResponse({ status: 201, description: '创建成功' })
  async createTransaction(
    @User('id') userId: number,
    @Body() dto: CreateTransactionDto,
  ) {
    return await this.walletService.createTransaction(userId, dto);
  }

  @Delete('transactions/:id')
  @ApiOperation({ summary: '取消交易' })
  @ApiResponse({ status: 200, description: '取消成功' })
  async cancelTransaction(
    @User('id') userId: number,
    @Param('id') transactionId: string,
  ) {
    await this.walletService.cancelTransaction(userId, transactionId);
    return { message: '交易已取消' };
  }

  @Get('transactions/export')
  @ApiOperation({ summary: '导出交易记录' })
  @ApiResponse({ status: 200, description: '导出成功' })
  async exportTransactions(
    @User('id') userId: number,
    @Query() query: ExportTransactionsDto,
    @Res() res: Response,
  ) {
    await this.walletService.exportTransactions(userId, query, res);
  }
} 