interface Order {
  id: string;
  userId: string;
  symbol: string;
  type: 'SPOT' | 'FUTURES';
  side: 'BUY' | 'SELL';
  price: number;
  amount: number;
  leverage?: number;
  status: 'PENDING' | 'FILLED' | 'CANCELLED';
  isVirtual: boolean;
  createdAt: Date;
} 