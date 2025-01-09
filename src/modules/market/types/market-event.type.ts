import { OrderBookDto } from '../dto/order-book.dto';
import { KlineDto } from '../dto/kline.dto';
import { TickerDto } from '../dto/ticker.dto';
import { TradeDto } from '../dto/trade.dto';
import { MarketChannel } from './market-channel.type';

export interface MarketEventData {
  type: MarketChannel;
  symbol: string;
  timestamp: number;
  data: OrderBookDto | KlineDto | TickerDto | TradeDto;
  depth?: OrderBookDto;
}
