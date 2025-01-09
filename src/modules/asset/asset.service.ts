import { 
  Injectable, 
  NotFoundException, 
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { SupabaseService } from '../../shared/supabase/supabase.service';
import { 
  AssetDto,
  TransactionDto,
  WithdrawDto, 
  DepositDto,
  TransactionQueryDto,
  BalanceQueryDto
} from './dto/asset.dto';
import { TransactionStatus, TransactionType } from './types/asset.types';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AssetService {
  private readonly logger = new Logger(AssetService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly configService: ConfigService,
  ) {}

  async getUserBalance(userId: string, currency: string): Promise<AssetDto> {
    try {
      const { data: asset, error } = await this.supabase
        .from('assets')
        .select('*')
        .eq('userId', userId)
        .eq('currency', currency)
        .single();

      if (error) throw new Error(error.message);
      if (!asset) throw new NotFoundException(`Asset not found for currency ${currency}`);

      return asset;
    } catch (error) {
      this.logger.error(`Failed to get user balance: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to get user balance');
    }
  }

  async getUserBalances(userId: string, query: BalanceQueryDto): Promise<AssetDto[]> {
    try {
      let queryBuilder = this.supabase
        .from('assets')
        .select('*')
        .eq('userId', userId);

      if (query.currency) {
        queryBuilder = queryBuilder.eq('currency', query.currency);
      }

      if (!query.showZero) {
        queryBuilder = queryBuilder.gt('balance', 0);
      }

      const { data: assets, error } = await queryBuilder;

      if (error) throw new Error(error.message);
      return assets || [];
    } catch (error) {
      this.logger.error(`Failed to get user balances: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to get user balances');
    }
  }

  async createDeposit(userId: string, depositDto: DepositDto): Promise<TransactionDto> {
    try {
      // 检查是否存在相同的交易哈希
      const { data: existingTx } = await this.supabase
        .from('transactions')
        .select('*')
        .eq('txHash', depositDto.txHash)
        .single();

      if (existingTx) {
        throw new BadRequestException('Duplicate transaction hash');
      }

      // 创建充值交易
      const { data: transaction, error } = await this.supabase
        .from('transactions')
        .insert([{
          userId,
          currency: depositDto.currency,
          amount: depositDto.amount,
          type: TransactionType.DEPOSIT,
          status: TransactionStatus.PENDING,
          txHash: depositDto.txHash,
        }])
        .select()
        .single();

      if (error) throw new Error(error.message);
      return transaction;
    } catch (error) {
      this.logger.error(`Failed to create deposit: ${error.message}`, error.stack);
      if (error instanceof BadRequestException) throw error;
      throw new InternalServerErrorException('Failed to create deposit');
    }
  }

  async createWithdrawal(userId: string, withdrawDto: WithdrawDto): Promise<TransactionDto> {
    try {
      // 检查余额
      const asset = await this.getUserBalance(userId, withdrawDto.currency);
      const minBalance = this.getMinWithdrawalAmount(withdrawDto.currency);
      const maxBalance = this.getMaxWithdrawalAmount(withdrawDto.currency);

      if (withdrawDto.amount < minBalance) {
        throw new BadRequestException(`Minimum withdrawal amount is ${minBalance} ${withdrawDto.currency}`);
      }

      if (withdrawDto.amount > maxBalance) {
        throw new BadRequestException(`Maximum withdrawal amount is ${maxBalance} ${withdrawDto.currency}`);
      }

      if (asset.balance < withdrawDto.amount) {
        throw new BadRequestException('Insufficient balance');
      }

      // 创建提现交易
      const { data: transaction, error } = await this.supabase
        .from('transactions')
        .insert([{
          userId,
          currency: withdrawDto.currency,
          amount: withdrawDto.amount,
          type: TransactionType.WITHDRAWAL,
          status: TransactionStatus.PENDING,
          address: withdrawDto.address,
          memo: withdrawDto.memo,
        }])
        .select()
        .single();

      if (error) throw new Error(error.message);

      // 锁定余额
      await this.lockBalance(userId, withdrawDto.currency, withdrawDto.amount);

      return transaction;
    } catch (error) {
      this.logger.error(`Failed to create withdrawal: ${error.message}`, error.stack);
      if (error instanceof BadRequestException) throw error;
      throw new InternalServerErrorException('Failed to create withdrawal');
    }
  }

  async getTransactionHistory(
    userId: string, 
    query: TransactionQueryDto
  ): Promise<TransactionDto[]> {
    try {
      let queryBuilder = this.supabase
        .from('transactions')
        .select('*')
        .eq('userId', userId);

      if (query.type) {
        queryBuilder = queryBuilder.eq('type', query.type);
      }

      if (query.status) {
        queryBuilder = queryBuilder.eq('status', query.status);
      }

      if (query.currency) {
        queryBuilder = queryBuilder.eq('currency', query.currency);
      }

      if (query.startTime) {
        queryBuilder = queryBuilder.gte('createdAt', new Date(query.startTime).toISOString());
      }

      if (query.endTime) {
        queryBuilder = queryBuilder.lte('createdAt', new Date(query.endTime).toISOString());
      }

      queryBuilder = queryBuilder
        .order('createdAt', { ascending: false })
        .range(query.offset, query.offset + query.limit - 1);

      const { data: transactions, error } = await queryBuilder;

      if (error) throw new Error(error.message);
      return transactions || [];
    } catch (error) {
      this.logger.error(`Failed to get transaction history: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to get transaction history');
    }
  }

  async getTransaction(transactionId: string): Promise<TransactionDto> {
    try {
      const { data: transaction, error } = await this.supabase
        .from('transactions')
        .select('*')
        .eq('id', transactionId)
        .single();

      if (error) throw new Error(error.message);
      if (!transaction) throw new NotFoundException('Transaction not found');

      return transaction;
    } catch (error) {
      this.logger.error(`Failed to get transaction: ${error.message}`, error.stack);
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('Failed to get transaction');
    }
  }

  async updateTransactionStatus(
    transactionId: string,
    status: TransactionStatus,
  ): Promise<TransactionDto> {
    try {
      const { data: transaction, error } = await this.supabase
        .from('transactions')
        .update({ status })
        .eq('id', transactionId)
        .select()
        .single();

      if (error) throw new Error(error.message);
      if (!transaction) throw new NotFoundException('Transaction not found');

      // 如果交易完成或失败，解锁余额
      if (
        transaction.type === TransactionType.WITHDRAWAL && 
        (status === TransactionStatus.COMPLETED || status === TransactionStatus.FAILED)
      ) {
        await this.unlockBalance(
          transaction.userId, 
          transaction.currency, 
          transaction.amount
        );
      }

      return transaction;
    } catch (error) {
      this.logger.error(`Failed to update transaction status: ${error.message}`, error.stack);
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('Failed to update transaction status');
    }
  }

  private async lockBalance(
    userId: string,
    currency: string,
    amount: number
  ): Promise<void> {
    const { error } = await this.supabase.rpc('lock_balance', {
      p_user_id: userId,
      p_currency: currency,
      p_amount: amount,
    });

    if (error) {
      throw new Error(`Failed to lock balance: ${error.message}`);
    }
  }

  private async unlockBalance(
    userId: string,
    currency: string,
    amount: number
  ): Promise<void> {
    const { error } = await this.supabase.rpc('unlock_balance', {
      p_user_id: userId,
      p_currency: currency,
      p_amount: amount,
    });

    if (error) {
      throw new Error(`Failed to unlock balance: ${error.message}`);
    }
  }

  private getMinWithdrawalAmount(currency: string): number {
    const minAmounts = this.configService.get<Record<string, number>>('withdrawal.minAmounts');
    return minAmounts?.[currency] || 0;
  }

  private getMaxWithdrawalAmount(currency: string): number {
    const maxAmounts = this.configService.get<Record<string, number>>('withdrawal.maxAmounts');
    return maxAmounts?.[currency] || Infinity;
  }
}
