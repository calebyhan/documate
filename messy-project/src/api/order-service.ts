export interface Order {
  id: string;
  userId: string;
  items: OrderItem[];
  total: number;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  createdAt: Date;
  updatedAt: Date;
}

export interface OrderItem {
  productId: string;
  quantity: number;
  price: number;
}

export class OrderService {
  private orders: Map<string, Order> = new Map();

  async create(data: { userId: string; items: OrderItem[]; total: number }): Promise<Order> {
    const order: Order = {
      id: Math.random().toString(36).substring(7),
      userId: data.userId,
      items: data.items,
      total: data.total,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.orders.set(order.id, order);
    return order;
  }

  async findById(id: string): Promise<Order | null> {
    return this.orders.get(id) || null;
  }

  async updateStatus(id: string, status: Order['status']): Promise<void> {
    const order = this.orders.get(id);
    if (order) {
      order.status = status;
      order.updatedAt = new Date();
    }
  }

  async list(options: { page: number; limit: number; status?: string }): Promise<{ orders: Order[]; total: number }> {
    let filtered = Array.from(this.orders.values());

    if (options.status) {
      filtered = filtered.filter((o) => o.status === options.status);
    }

    const start = (options.page - 1) * options.limit;
    const end = start + options.limit;

    return {
      orders: filtered.slice(start, end),
      total: filtered.length,
    };
  }
}
