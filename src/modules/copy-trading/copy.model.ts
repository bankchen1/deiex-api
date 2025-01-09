interface CopyTrading {
  id: string;
  followerId: string; // 跟随者
  traderId: string;   // 交易员
  copyAmount: number; // 跟单金额
  profitSharing: number; // 分润比例
  status: 'ACTIVE' | 'PAUSED';
  createdAt: Date;
} 