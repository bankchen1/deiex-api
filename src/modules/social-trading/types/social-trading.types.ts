export interface TraderProfile {
  userId: string;
  nickname: string;
  avatar: string;
  bio: string;
  experience: number; // 交易年限
  tradingStyle: string[];
  riskLevel: 'Conservative' | 'Moderate' | 'Aggressive';
  specialties: string[]; // 擅长的交易品种
  languages: string[];
  timezone: string;
  socialLinks: {
    twitter?: string;
    telegram?: string;
    website?: string;
  };
  verified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface TradingStrategy {
  id: string;
  traderId: string;
  name: string;
  description: string;
  riskLevel: 'Low' | 'Medium' | 'High';
  targetReturn: number;
  maxDrawdown: number;
  timeHorizon: string;
  instruments: string[];
  techniques: string[];
  minimumCapital: number;
  performanceFee: number;
  managementFee: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface TradingPost {
  id: string;
  traderId: string;
  type: 'Analysis' | 'Trade' | 'Update' | 'Education';
  title: string;
  content: string;
  attachments: string[];
  symbols: string[];
  likes: number;
  comments: number;
  shares: number;
  visibility: 'Public' | 'Followers' | 'Private';
  createdAt: Date;
  updatedAt: Date;
}

export interface Comment {
  id: string;
  postId: string;
  userId: string;
  content: string;
  likes: number;
  replyTo?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TraderMetrics {
  traderId: string;
  totalFollowers: number;
  activeFollowers: number;
  totalAUM: number; // Assets Under Management
  totalPnL: number;
  monthlyPnL: number;
  winRate: number;
  averageReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
  profitFactor: number;
  averageTradeDuration: number;
  updatedAt: Date;
}

export interface FollowerMetrics {
  followerId: string;
  traderId: string;
  totalInvestment: number;
  currentValue: number;
  totalPnL: number;
  monthlyPnL: number;
  followingSince: Date;
  copiedTrades: number;
  successfulTrades: number;
  averageReturn: number;
  updatedAt: Date;
}

export interface TraderRanking {
  traderId: string;
  rank: number;
  category: 'PnL' | 'WinRate' | 'Followers' | 'Sharpe' | 'Overall';
  score: number;
  previousRank: number;
  updatedAt: Date;
}

export interface ProfitSharing {
  id: string;
  traderId: string;
  followerId: string;
  amount: number;
  performanceFee: number;
  managementFee: number;
  period: 'Daily' | 'Weekly' | 'Monthly';
  status: 'Pending' | 'Processed' | 'Failed';
  createdAt: Date;
  processedAt?: Date;
}

export interface TraderNotification {
  id: string;
  traderId: string;
  type: 'NewFollower' | 'Comment' | 'Like' | 'Ranking' | 'ProfitShare';
  content: string;
  read: boolean;
  createdAt: Date;
}
