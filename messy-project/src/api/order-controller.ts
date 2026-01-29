import type { Request, Response } from 'express';
import { OrderService } from './order-service.js';
import { validateOrderInput } from '../utils/validators.js';

/**
 * Handles order-related HTTP requests
 */
export class OrderController {
  private orderService: OrderService;

  constructor(orderService: OrderService) {
    this.orderService = orderService;
  }

  /**
   * Creates a new order
   * @param req - Express request
   * @param res - Express response
   *
   * @example
   * // Example shows old API format
   * POST /orders
   * {
   *   "items": ["item1", "item2"],  // Now expects objects, not strings!
   *   "total": 100
   * }
   */
  async createOrder(req: Request, res: Response): Promise<void> {
    try {
      const validation = validateOrderInput(req.body);
      if (!validation.valid) {
        res.status(400).json({ error: validation.error });
        return;
      }

      const order = await this.orderService.create(req.body);
      res.status(201).json(order);
    } catch (err) {
      res.status(500).json({ error: 'Failed to create order' });
    }
  }

  // Missing docs for public method
  async getOrder(req: Request, res: Response): Promise<void> {
    const orderId = req.params.id;
    const order = await this.orderService.findById(orderId);

    if (!order) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }

    res.json(order);
  }

  // No docs
  async updateOrderStatus(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const { status } = req.body;

    if (!['pending', 'processing', 'shipped', 'delivered', 'cancelled'].includes(status)) {
      res.status(400).json({ error: 'Invalid status' });
      return;
    }

    await this.orderService.updateStatus(id, status);
    res.json({ success: true });
  }

  /**
   * Lists orders with pagination
   * @param req - Request
   * @param res - Response
   * @returns List of orders
   */
  async listOrders(req: Request, res: Response): Promise<void> {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const status = req.query.status as string | undefined;

    const result = await this.orderService.list({ page, limit, status });
    res.json(result);
  }
}
