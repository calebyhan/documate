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

/**
 * Service for managing orders in the system. Provides methods to create, retrieve, update, and list orders.
 * Orders are stored in-memory using a Map data structure.
 * 
 * @example
 * const orderService = new OrderService();
 * 
 * // Create a new order
 * const order = await orderService.create({
 *   userId: 'user123',
 *   items: [{ productId: 'prod1', quantity: 2, price: 29.99 }],
 *   total: 59.98
 * });
 * 
 * // Find order by ID
 * const found = await orderService.findById(order.id);
 * 
 * // Update order status
 * await orderService.updateStatus(order.id, 'completed');
 * 
 * // List orders with pagination
 * const result = await orderService.list({ page: 1, limit: 10, status: 'pending' });
 */

/**
 * Creates a new order and stores it in the system.
 * Automatically generates a unique ID and sets timestamps.
 * 
 * @param {Object} data - The order creation data
 * @param {string} data.userId - The ID of the user placing the order
 * @param {OrderItem[]} data.items - Array of items in the order
 * @param {number} data.total - The total amount for the order
 * @returns {Promise<Order>} The created order with generated ID and timestamps
 * 
 * @example
 * const order = await orderService.create({
 *   userId: 'user123',
 *   items: [{ productId: 'prod1', quantity: 2, price: 29.99 }],
 *   total: 59.98
 * });
 * console.log(order.id); // Random generated ID
 * console.log(order.status); // 'pending'
 */

/**
 * Retrieves an order by its unique identifier.
 * 
 * @param {string} id - The unique identifier of the order
 * @returns {Promise<Order | null>} The order if found, null otherwise
 * 
 * @example
 * const order = await orderService.findById('abc123');
 * if (order) {
 *   console.log(`Order total: $${order.total}`);
 * } else {
 *   console.log('Order not found');
 * }
 */

/**
 * Updates the status of an existing order.
 * Automatically updates the `updatedAt` timestamp.
 * If the order doesn't exist, the operation silently fails without error.
 * 
 * @param {string} id - The unique identifier of the order to update
 * @param {Order['status']} status - The new status for the order (e.g., 'pending', 'completed', 'cancelled')
 * @returns {Promise<void>}
 * 
 * @example
 * await orderService.updateStatus('abc123', 'completed');
 * 
 * @note This method does not throw an error if the order is not found. Consider checking
 * if the order exists before updating if you need to handle missing orders.
 */

/**
 * Retrieves a paginated list of orders with optional status filtering.
 * 
 * @param {Object} options - The listing options
 * @param {number} options.page - The page number (1-indexed)
 * @param {number} options.limit - The number of orders per page
 * @param {string} [options.status] - Optional status filter (e.g., 'pending', 'completed')
 * @returns {Promise<{orders: Order[], total: number}>} Object containing the paginated orders array and total count of filtered orders
 * 
 * @example
 * // Get first page of pending orders
 * const result = await orderService.list({
 *   page: 1,
 *   limit: 10,
 *   status: 'pending'
 * });
 * console.log(`Showing ${result.orders.length} of ${result.total} pending orders`);
 * 
 * // Get all orders (second page)
 * const allOrders = await orderService.list({ page: 2, limit: 20 });
 * 
 * @note The `total` field represents the total number of filtered orders, not just the current page.
 */
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
