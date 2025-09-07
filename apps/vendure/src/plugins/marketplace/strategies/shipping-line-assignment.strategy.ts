import { Injectable } from '@nestjs/common';
import {
  Order, OrderLine, RequestContext,
  ShippingLine, ShippingLineAssignmentStrategy,
} from '@vendure/core';

/**
 * Ensures each ShippingLine applies only to the seller’s own lines.
 * (Implementation later; keep signature correct.)
 */
@Injectable()
export class PerSellerShippingLineAssignmentStrategy implements ShippingLineAssignmentStrategy {
  assignShippingLineToOrderLines(
    _ctx: RequestContext,
    shippingLine: ShippingLine,
    order: Order,
  ): OrderLine[] | Promise<OrderLine[]> {
    // placeholder: return every line so it compiles
    return order.lines;
  }
}
