import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrometheusService } from '../../monitoring/services/prometheus.service';
import { ethers } from 'ethers';
import { ChainConfig, CurrencyConfig } from '../types/wallet.types';
import { PrismaService } from '../../prisma/prisma.service';

interface Web3Provider {
  chainId: string;
  provider: ethers.providers.JsonRpcProvider;
  contracts: Map<string, ethers.Contract>;
}

@Injectable()
export class Web3Service {
  private readonly logger = new Logger(Web3Service.name);
  private readonly providers: Map<string, Web3Provider> = new Map();
  private readonly currencyConfigs: Map<string, CurrencyConfig> = new Map();
  private readonly chainConfigs: Map<string, ChainConfig> = new Map();

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly prometheusService: PrometheusService,
  ) {
    this.initializeConfigs();
  }

  private async initializeConfigs() {
    // 加载币种和链的配置
    const currencies = await this.prisma.currencyConfig.findMany();
    const chains = await this.prisma.chainConfig.findMany();

    for (const currency of currencies) {
      this.currencyConfigs.set(currency.symbol, currency);
    }

    for (const chain of chains) {
      this.chainConfigs.set(chain.chainId, chain);
      await this.initializeProvider(chain);
    }
  }

  private async initializeProvider(chainConfig: ChainConfig) {
    try {
      // 创建provider
      const provider = new ethers.providers.JsonRpcProvider(
        chainConfig.rpcUrls[0],
        {
          name: chainConfig.chainName,
          chainId: parseInt(chainConfig.chainId),
        }
      );

      // 初始化合约
      const contracts = new Map<string, ethers.Contract>();
      if (chainConfig.contracts) {
        for (const [symbol, address] of Object.entries(chainConfig.contracts)) {
          const contract = new ethers.Contract(
            address,
            ['function balanceOf(address) view returns (uint256)'],
            provider
          );
          contracts.set(symbol, contract);
        }
      }

      this.providers.set(chainConfig.chainId, {
        chainId: chainConfig.chainId,
        provider,
        contracts,
      });
    } catch (error) {
      this.logger.error(
        `Failed to initialize provider for chain ${chainConfig.chainId}: ${error.message}`
      );
      throw error;
    }
  }

  async generateAddress(chainId: string): Promise<string> {
    const startTime = Date.now();
    try {
      // 生成新的钱包
      const wallet = ethers.Wallet.createRandom();
      
      // 记录性能指标
      this.prometheusService.recordLatency('generate_address', Date.now() - startTime);
      
      return wallet.address;
    } catch (error) {
      this.logger.error(`Failed to generate address: ${error.message}`);
      this.prometheusService.incrementErrors('generate_address_error');
      throw error;
    }
  }

  async getCurrentBlockNumber(chainId: string): Promise<number> {
    const provider = this.getProvider(chainId);
    return await provider.provider.getBlockNumber();
  }

  async scanBlocksForDeposits(
    chainId: string,
    fromBlock: number,
    toBlock: number,
    depositAddresses: Set<string>,
  ): Promise<any[]> {
    const startTime = Date.now();
    try {
      const provider = this.getProvider(chainId);
      const deposits: any[] = [];

      // 获取区块
      const blocks = await Promise.all(
        Array.from(
          { length: toBlock - fromBlock + 1 },
          (_, i) => provider.provider.getBlockWithTransactions(fromBlock + i)
        )
      );

      for (const block of blocks) {
        // 处理区块中的交易
        for (const tx of block.transactions) {
          // 检查交易是否是转账到我们的地址
          if (depositAddresses.has(tx.to?.toLowerCase())) {
            const receipt = await provider.provider.getTransactionReceipt(tx.hash);
            
            // 解析交易信息
            const deposit = await this.parseTransaction(chainId, tx, receipt, block);
            if (deposit) {
              deposits.push(deposit);
            }
          }
        }
      }

      // 记录性能指标
      this.prometheusService.recordLatency('scan_blocks', Date.now() - startTime);

      return deposits;
    } catch (error) {
      this.logger.error(`Failed to scan blocks: ${error.message}`);
      this.prometheusService.incrementErrors('scan_blocks_error');
      throw error;
    }
  }

  private async parseTransaction(
    chainId: string,
    tx: any,
    receipt: any,
    block: any,
  ): Promise<any | null> {
    try {
      const provider = this.getProvider(chainId);
      
      // 判断交易是否成功
      if (!receipt || !receipt.status) {
        return null;
      }

      // 获取币种信息
      const currency = await this.getCurrencyFromTransaction(chainId, tx);
      if (!currency) {
        return null;
      }

      // 获取转账金额
      const amount = await this.getTransactionAmount(chainId, tx, currency);
      if (!amount || amount <= 0) {
        return null;
      }

      return {
        txHash: tx.hash,
        fromAddress: tx.from,
        toAddress: tx.to,
        amount,
        currency,
        chain: chainId,
        confirmations: await provider.provider.getBlockNumber() - block.number + 1,
        blockNumber: block.number,
        timestamp: block.timestamp,
      };
    } catch (error) {
      this.logger.error(`Failed to parse transaction ${tx.hash}: ${error.message}`);
      return null;
    }
  }

  private async getCurrencyFromTransaction(
    chainId: string,
    tx: any,
  ): Promise<string | null> {
    const provider = this.getProvider(chainId);
    
    // 如果是原生币转账
    if (!tx.data || tx.data === '0x') {
      const chainConfig = this.chainConfigs.get(chainId);
      return chainConfig?.nativeCurrency.symbol || null;
    }

    // 如果是代币转账
    for (const [symbol, contract] of provider.contracts.entries()) {
      if (tx.to.toLowerCase() === contract.address.toLowerCase()) {
        return symbol;
      }
    }

    return null;
  }

  private async getTransactionAmount(
    chainId: string,
    tx: any,
    currency: string,
  ): Promise<number> {
    const provider = this.getProvider(chainId);
    const currencyConfig = this.currencyConfigs.get(currency);
    
    if (!currencyConfig) {
      throw new Error(`Currency config not found for ${currency}`);
    }

    // 如果是原生币转账
    if (!tx.data || tx.data === '0x') {
      return parseFloat(ethers.utils.formatUnits(tx.value, currencyConfig.decimals));
    }

    // 如果是代币转账
    const contract = provider.contracts.get(currency);
    if (!contract) {
      throw new Error(`Contract not found for ${currency}`);
    }

    // 解析转账数据
    const iface = new ethers.utils.Interface([
      'function transfer(address to, uint256 amount)',
    ]);
    const decoded = iface.decodeFunctionData('transfer', tx.data);
    return parseFloat(ethers.utils.formatUnits(decoded.amount, currencyConfig.decimals));
  }

  async getTransactionConfirmations(
    currency: string,
    txHash: string,
  ): Promise<number> {
    const currencyConfig = this.currencyConfigs.get(currency);
    if (!currencyConfig) {
      throw new Error(`Currency config not found for ${currency}`);
    }

    // 获取交易所在的链
    const chainId = currencyConfig.chains[0]; // 使用第一条支持的链
    const provider = this.getProvider(chainId);

    // 获取交易收据
    const receipt = await provider.provider.getTransactionReceipt(txHash);
    if (!receipt) {
      return 0;
    }

    // 获取当前区块
    const currentBlock = await provider.provider.getBlockNumber();
    return currentBlock - receipt.blockNumber + 1;
  }

  async getDepositAddress(chain: string, baseAddress: string): Promise<string> {
    // 对于不同的链，可能需要不同的地址格式
    // 这里简单返回基础地址
    return baseAddress;
  }

  isValidAddress(chain: string, address: string): boolean {
    try {
      return ethers.utils.isAddress(address);
    } catch {
      return false;
    }
  }

  private getProvider(chainId: string): Web3Provider {
    const provider = this.providers.get(chainId);
    if (!provider) {
      throw new Error(`Provider not found for chain ${chainId}`);
    }
    return provider;
  }
}
