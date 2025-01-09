import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  UseGuards, 
  Query,
  Param,
  ParseUUIDPipe,
  ValidationPipe,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { 
  ApiTags, 
  ApiOperation, 
  ApiResponse, 
  ApiBearerAuth,
  ApiParam,
  ApiQuery 
} from '@nestjs/swagger';
import { AssetService } from './asset.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { 
  AssetDto,
  TransactionDto,
  WithdrawDto, 
  DepositDto,
  TransactionQueryDto,
  BalanceQueryDto
} from './dto/asset.dto';

@ApiTags('Asset')
@Controller('assets')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AssetController {
  constructor(private readonly assetService: AssetService) {}

  @Get('balances')
  @ApiOperation({ summary: 'Get user balances' })
  @ApiResponse({ 
    status: 200, 
    description: 'Returns user balances',
    type: [AssetDto]
  })
  async getUserBalances(
    @CurrentUser('id') userId: string,
    @Query(ValidationPipe) query: BalanceQueryDto
  ): Promise<AssetDto[]> {
    return this.assetService.getUserBalances(userId, query);
  }

  @Get('balance/:currency')
  @ApiOperation({ summary: 'Get user balance for specific currency' })
  @ApiParam({ name: 'currency', description: 'Currency code (e.g., BTC, ETH, USDT)' })
  @ApiResponse({ 
    status: 200, 
    description: 'Returns user balance for the specified currency',
    type: AssetDto
  })
  async getUserBalance(
    @CurrentUser('id') userId: string,
    @Param('currency') currency: string
  ): Promise<AssetDto> {
    return this.assetService.getUserBalance(userId, currency);
  }

  @Post('deposit')
  @ApiOperation({ summary: 'Create deposit' })
  @ApiResponse({ 
    status: 201, 
    description: 'Deposit created successfully',
    type: TransactionDto
  })
  async createDeposit(
    @CurrentUser('id') userId: string,
    @Body(ValidationPipe) depositDto: DepositDto
  ): Promise<TransactionDto> {
    return this.assetService.createDeposit(userId, depositDto);
  }

  @Post('withdraw')
  @ApiOperation({ summary: 'Create withdrawal request' })
  @ApiResponse({ 
    status: 201, 
    description: 'Withdrawal request created successfully',
    type: TransactionDto
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Insufficient balance or invalid withdrawal amount'
  })
  async createWithdrawal(
    @CurrentUser('id') userId: string,
    @Body(ValidationPipe) withdrawDto: WithdrawDto
  ): Promise<TransactionDto> {
    return this.assetService.createWithdrawal(userId, withdrawDto);
  }

  @Get('transactions')
  @ApiOperation({ summary: 'Get transaction history' })
  @ApiResponse({ 
    status: 200, 
    description: 'Returns transaction history',
    type: [TransactionDto]
  })
  async getTransactionHistory(
    @CurrentUser('id') userId: string,
    @Query(ValidationPipe) query: TransactionQueryDto
  ): Promise<TransactionDto[]> {
    return this.assetService.getTransactionHistory(userId, query);
  }

  @Get('transaction/:id')
  @ApiOperation({ summary: 'Get transaction details' })
  @ApiParam({ name: 'id', description: 'Transaction ID' })
  @ApiResponse({ 
    status: 200, 
    description: 'Returns transaction details',
    type: TransactionDto
  })
  async getTransaction(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) transactionId: string
  ): Promise<TransactionDto> {
    const transaction = await this.assetService.getTransaction(transactionId);
    if (transaction.userId !== userId) {
      throw new NotFoundException('Transaction not found');
    }
    return transaction;
  }
}
