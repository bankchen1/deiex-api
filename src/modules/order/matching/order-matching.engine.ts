import { OrderSide, OrderType, TimeInForce, OrderMatchDto } from '../dto/order.dto';
import { OrderBook } from './order-book';

interface Order {
  id: string;
  userId: string;
  symbol: string;
  side: OrderSide;
  type: OrderType;
  price: number;
  quantity: number;
  timeInForce: TimeInForce;
  timestamp: number;
}

interface MarketOrder {
  id: string;
  userId: string;
  symbol: string;
  side: OrderSide;
  quantity: number;
  timestamp: number;
}

export class OrderMatchingEngine {
  private readonly buyOrderBook: OrderBook;
  private readonly sellOrderBook: OrderBook;
  private readonly symbol: string;

  constructor(symbol: string) {
    this.symbol = symbol;
    this.buyOrderBook = new OrderBook(OrderSide.BUY);
    this.sellOrderBook = new OrderBook(OrderSide.SELL);
  }

  addOrder(order: Order): OrderMatchDto[] {
    const matches: OrderMatchDto[] = [];

    if (order.timeInForce === TimeInForce.IOC || order.timeInForce === TimeInForce.FOK) {
      return this.processImmediateOrder(order);
    }

    const oppositeOrderBook = order.side === OrderSide.BUY ? this.sellOrderBook : this.buyOrderBook;
    const sameOrderBook = order.side === OrderSide.BUY ? this.buyOrderBook : this.sellOrderBook;

    // 尝试匹配订单
    let remainingQuantity = order.quantity;
    while (remainingQuantity > 0) {
      const bestOrder = oppositeOrderBook.getBestOrder();
      if (!bestOrder || !this.isPriceMatched(order, bestOrder)) {
        break;
      }

      const matchQuantity = Math.min(remainingQuantity, bestOrder.quantity);
      const matchPrice = bestOrder.price;

      matches.push({
        makerOrderId: bestOrder.id,
        takerOrderId: order.id,
        price: matchPrice,
        quantity: matchQuantity,
        timestamp: new Date(),
      });

      remainingQuantity -= matchQuantity;
      oppositeOrderBook.reduceOrderQuantity(bestOrder.id, matchQuantity);
    }

    // 如果还有剩余数量，将订单添加到订单簿
    if (remainingQuantity > 0) {
      const remainingOrder = { ...order, quantity: remainingQuantity };
      sameOrderBook.addOrder(remainingOrder);
    }

    return matches;
  }

  executeMarketOrder(order: MarketOrder): OrderMatchDto[] {
    const matches: OrderMatchDto[] = [];
    const oppositeOrderBook = order.side === OrderSide.BUY ? this.sellOrderBook : this.buyOrderBook;

    let remainingQuantity = order.quantity;
    while (remainingQuantity > 0) {
      const bestOrder = oppositeOrderBook.getBestOrder();
      if (!bestOrder) {
        throw new Error('Insufficient liquidity for market order');
      }

      const matchQuantity = Math.min(remainingQuantity, bestOrder.quantity);
      const matchPrice = bestOrder.price;

      matches.push({
        makerOrderId: bestOrder.id,
        takerOrderId: order.id,
        price: matchPrice,
        quantity: matchQuantity,
        timestamp: new Date(),
      });

      remainingQuantity -= matchQuantity;
      oppositeOrderBook.reduceOrderQuantity(bestOrder.id, matchQuantity);
    }

    return matches;
  }

  cancelOrder(orderId: string): boolean {
    return (
      this.buyOrderBook.removeOrder(orderId) ||
      this.sellOrderBook.removeOrder(orderId)
    );
  }

  private processImmediateOrder(order: Order): OrderMatchDto[] {
    const matches: OrderMatchDto[] = [];
    const oppositeOrderBook = order.side === OrderSide.BUY ? this.sellOrderBook : this.buyOrderBook;

    let remainingQuantity = order.quantity;
    const tempMatches: OrderMatchDto[] = [];

    // 预先检查是否可以完全成交（FOK）
    if (order.timeInForce === TimeInForce.FOK) {
      let availableQuantity = 0;
      let currentLevel = oppositeOrderBook.getBestOrder();

      while (currentLevel && this.isPriceMatched(order, currentLevel)) {
        availableQuantity += currentLevel.quantity;
        if (availableQuantity >= order.quantity) {
          break;
        }
        currentLevel = oppositeOrderBook.getNextBestOrder(currentLevel.price);
      }

      if (availableQuantity < order.quantity) {
        return []; // FOK订单无法完全成交，返回空
      }
    }

    // 执行匹配
    while (remainingQuantity > 0) {
      const bestOrder = oppositeOrderBook.getBestOrder();
      if (!bestOrder || !this.isPriceMatched(order, bestOrder)) {
        break;
      }

      const matchQuantity = Math.min(remainingQuantity, bestOrder.quantity);
      const matchPrice = bestOrder.price;

      tempMatches.push({
        makerOrderId: bestOrder.id,
        takerOrderId: order.id,
        price: matchPrice,
        quantity: matchQuantity,
        timestamp: new Date(),
      });

      remainingQuantity -= matchQuantity;
      oppositeOrderBook.reduceOrderQuantity(bestOrder.id, matchQuantity);
    }

    // IOC订单可以部分成交
    if (order.timeInForce === TimeInForce.IOC || remainingQuantity === 0) {
      matches.push(...tempMatches);
    }

    return matches;
  }

  private isPriceMatched(order: Order, oppositeOrder: Order): boolean {
    if (order.side === OrderSide.BUY) {
      return order.price >= oppositeOrder.price;
    }
    return order.price <= oppositeOrder.price;
  }

  getOrderBookSnapshot(depth: number = 100) {
    return {
      symbol: this.symbol,
      bids: this.buyOrderBook.getSnapshot(depth),
      asks: this.sellOrderBook.getSnapshot(depth),
      timestamp: Date.now(),
    };
  }
}
