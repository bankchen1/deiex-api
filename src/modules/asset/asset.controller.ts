import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AssetService } from './asset.service';
import { CreateDepositDto, CreateWithdrawDto, TransactionQueryDto } from './dto/asset.dto';
import { JwtAuthGuard } from '../../modules/auth/guards/jwt-auth.guard';
import { User } from '../../decorators/user.decorator';

@ApiTags('资产')
@Controller('assets')
@UseGuards(JwtAuthGuard)
export class AssetController {
  constructor(private readonly assetService: AssetService) {}

  @Get('balances')
  @ApiOperation({ summary: '获取用户所有资产余额' })
  @ApiResponse({ status: 200, description: '成功获取用户资产余额' })
  async getUserBalances(@User('id') userId: string) {
    return this.assetService.getUserBalances(userId);
  }

  @Get('balances/:currency')
  @ApiOperation({ summary: '获取用户指定币种余额' })
  @ApiResponse({ status: 200, description: '成功获取用户指定币种余额' })
  async getUserBalance(
    @User('id') userId: string,
    @Param('currency') currency: string,
  ) {
    return this.assetService.getUserBalance(userId, currency);
  }

  @Post('deposits')
  @ApiOperation({ summary: '创建充值记录' })
  @ApiResponse({ status: 201, description: '成功创建充值记录' })
  async createDeposit(
    @User('id') userId: string,
    @Body() createDepositDto: CreateDepositDto,
  ) {
    return this.assetService.createDeposit(userId, createDepositDto);
  }

  @Post('withdraws')
  @ApiOperation({ summary: '创建提现记录' })
  @ApiResponse({ status: 201, description: '成功创建提现记录' })
  async createWithdraw(
    @User('id') userId: string,
    @Body() createWithdrawDto: CreateWithdrawDto,
  ) {
    return this.assetService.createWithdraw(userId, createWithdrawDto);
  }

  @Get('transactions')
  @ApiOperation({ summary: '获取交易记录' })
  @ApiResponse({ status: 200, description: '成功获取交易记录' })
  async getTransactions(
    @User('id') userId: string,
    @Query() query: TransactionQueryDto,
  ) {
    return this.assetService.getTransactions(userId, query);
  }
}
