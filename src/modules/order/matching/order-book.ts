import { OrderSide } from '../dto/order.dto';
import { RBTree } from './rb-tree';

interface Order {
  id: string;
  userId: string;
  price: number;
  quantity: number;
  timestamp: number;
}

interface PriceLevel {
  price: number;
  orders: Order[];
  totalQuantity: number;
}

export class OrderBook {
  private readonly priceTree: RBTree<number>;
  private readonly priceMap: Map<number, PriceLevel>;
  private readonly orderMap: Map<string, Order>;
  private readonly side: OrderSide;

  constructor(side: OrderSide) {
    this.side = side;
    this.priceTree = new RBTree<number>((a, b) => {
      // 买单按价格降序排列，卖单按价格升序排列
      const comparison = a - b;
      return this.side === OrderSide.BUY ? -comparison : comparison;
    });
    this.priceMap = new Map<number, PriceLevel>();
    this.orderMap = new Map<string, Order>();
  }

  addOrder(order: Order): void {
    // 检查订单是否已存在
    if (this.orderMap.has(order.id)) {
      throw new Error('Order already exists');
    }

    // 获取或创建价格级别
    let priceLevel = this.priceMap.get(order.price);
    if (!priceLevel) {
      priceLevel = {
        price: order.price,
        orders: [],
        totalQuantity: 0,
      };
      this.priceMap.set(order.price, priceLevel);
      this.priceTree.insert(order.price);
    }

    // 添加订单到价格级别
    priceLevel.orders.push(order);
    priceLevel.totalQuantity += order.quantity;
    this.orderMap.set(order.id, order);
  }

  removeOrder(orderId: string): boolean {
    const order = this.orderMap.get(orderId);
    if (!order) {
      return false;
    }

    const priceLevel = this.priceMap.get(order.price);
    if (!priceLevel) {
      return false;
    }

    // 从价格级别中移除订单
    const orderIndex = priceLevel.orders.findIndex(o => o.id === orderId);
    if (orderIndex === -1) {
      return false;
    }

    priceLevel.orders.splice(orderIndex, 1);
    priceLevel.totalQuantity -= order.quantity;

    // 如果价格级别为空，则移除该级别
    if (priceLevel.orders.length === 0) {
      this.priceMap.delete(order.price);
      this.priceTree.remove(order.price);
    }

    this.orderMap.delete(orderId);
    return true;
  }

  reduceOrderQuantity(orderId: string, quantity: number): void {
    const order = this.orderMap.get(orderId);
    if (!order) {
      throw new Error('Order not found');
    }

    const priceLevel = this.priceMap.get(order.price);
    if (!priceLevel) {
      throw new Error('Price level not found');
    }

    if (quantity > order.quantity) {
      throw new Error('Insufficient quantity');
    }

    // 更新订单数量
    order.quantity -= quantity;
    priceLevel.totalQuantity -= quantity;

    // 如果订单数量为0，移除订单
    if (order.quantity === 0) {
      this.removeOrder(orderId);
    }
  }

  getBestOrder(): Order | null {
    const bestPrice = this.priceTree.min();
    if (bestPrice === null) {
      return null;
    }

    const priceLevel = this.priceMap.get(bestPrice);
    if (!priceLevel || priceLevel.orders.length === 0) {
      return null;
    }

    return priceLevel.orders[0];
  }

  getNextBestOrder(currentPrice: number): Order | null {
    const nextPrice = this.side === OrderSide.BUY
      ? this.priceTree.prev(currentPrice)
      : this.priceTree.next(currentPrice);

    if (nextPrice === null) {
      return null;
    }

    const priceLevel = this.priceMap.get(nextPrice);
    if (!priceLevel || priceLevel.orders.length === 0) {
      return null;
    }

    return priceLevel.orders[0];
  }

  getSnapshot(depth: number = 100): Array<[number, number, number]> {
    const snapshot: Array<[number, number, number]> = [];
    let currentPrice = this.side === OrderSide.BUY
      ? this.priceTree.max()
      : this.priceTree.min();

    while (currentPrice !== null && snapshot.length < depth) {
      const priceLevel = this.priceMap.get(currentPrice);
      if (priceLevel && priceLevel.totalQuantity > 0) {
        snapshot.push([
          priceLevel.price,
          priceLevel.totalQuantity,
          priceLevel.orders.length,
        ]);
      }

      currentPrice = this.side === OrderSide.BUY
        ? this.priceTree.prev(currentPrice)
        : this.priceTree.next(currentPrice);
    }

    return snapshot;
  }

  clear(): void {
    this.priceTree.clear();
    this.priceMap.clear();
    this.orderMap.clear();
  }
}
