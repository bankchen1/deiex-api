import { OrderSide, OrderType, Order, Trade, MatchResult, OrderBook } from '../types/trade.types';

export class OrderMatchingEngine {
  private bids: Map<string, Order[]> = new Map();
  private asks: Map<string, Order[]> = new Map();
  private symbol: string;

  constructor(symbol: string) {
    this.symbol = symbol;
  }

  addOrder(order: Order): void {
    const orders = order.side === OrderSide.BUY ? this.bids : this.asks;
    const priceLevel = orders.get(order.price) || [];
    priceLevel.push(order);
    orders.set(order.price, priceLevel);
  }

  cancelOrder(orderId: string): void {
    this.removeOrder(orderId, this.bids);
    this.removeOrder(orderId, this.asks);
  }

  private removeOrder(orderId: string, orders: Map<string, Order[]>): void {
    for (const [price, priceLevel] of orders.entries()) {
      const index = priceLevel.findIndex(order => order.id === orderId);
      if (index !== -1) {
        priceLevel.splice(index, 1);
        if (priceLevel.length === 0) {
          orders.delete(price);
        }
        break;
      }
    }
  }

  processOrder(order: Order): MatchResult {
    const trades: Trade[] = [];
    let remainingOrder: Order | undefined = order;

    if (order.type === OrderType.LIMIT) {
      const matchingOrders = order.side === OrderSide.BUY ? this.asks : this.bids;
      const sortedPrices = Array.from(matchingOrders.keys())
        .map(price => parseFloat(price))
        .sort(order.side === OrderSide.BUY ? (a, b) => a - b : (a, b) => b - a);

      for (const price of sortedPrices) {
        if (order.side === OrderSide.BUY && price > parseFloat(order.price)) break;
        if (order.side === OrderSide.SELL && price < parseFloat(order.price)) break;

        const priceLevel = matchingOrders.get(price.toString()) || [];
        for (const matchingOrder of priceLevel) {
          if (!remainingOrder) break;

          const tradeAmount = Math.min(
            parseFloat(remainingOrder.quantity),
            parseFloat(matchingOrder.quantity),
          );

          if (tradeAmount > 0) {
            trades.push({
              id: '',
              userId: remainingOrder.userId,
              symbol: this.symbol,
              side: remainingOrder.side,
              amount: tradeAmount.toString(),
              price: matchingOrder.price,
              makerOrderId: matchingOrder.id,
              takerOrderId: remainingOrder.id,
              makerUserId: matchingOrder.userId,
              takerUserId: remainingOrder.userId,
              createdAt: new Date(),
              updatedAt: new Date(),
            });

            const remainingQuantity = parseFloat(remainingOrder.quantity) - tradeAmount;
            if (remainingQuantity > 0) {
              remainingOrder = {
                ...remainingOrder,
                quantity: remainingQuantity.toString(),
              };
            } else {
              remainingOrder = undefined;
            }

            const matchingRemaining = parseFloat(matchingOrder.quantity) - tradeAmount;
            if (matchingRemaining > 0) {
              matchingOrder.quantity = matchingRemaining.toString();
            } else {
              this.removeOrder(matchingOrder.id, matchingOrders);
            }
          }
        }
      }
    }

    if (remainingOrder && remainingOrder.type === OrderType.LIMIT) {
      this.addOrder(remainingOrder);
    }

    return { trades, remainingOrder };
  }

  getOrderBookSnapshot(): OrderBook {
    const bids = Array.from(this.bids.entries()).map(([price, orders]) => ({
      price,
      quantity: orders.reduce((sum, order) => sum + parseFloat(order.quantity), 0).toString(),
      total: orders.length.toString(),
    }));

    const asks = Array.from(this.asks.entries()).map(([price, orders]) => ({
      price,
      quantity: orders.reduce((sum, order) => sum + parseFloat(order.quantity), 0).toString(),
      total: orders.length.toString(),
    }));

    return {
      bids: bids.sort((a, b) => parseFloat(b.price) - parseFloat(a.price)),
      asks: asks.sort((a, b) => parseFloat(a.price) - parseFloat(b.price)),
    };
  }
}
