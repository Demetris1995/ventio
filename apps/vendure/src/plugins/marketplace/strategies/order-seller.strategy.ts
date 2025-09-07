import { Injectable } from '@nestjs/common';
import { Channel, OrderLine, OrderSellerStrategy, RequestContext } from '@vendure/core';

/**
 * Splits orders by the seller's channel which owns the variant.
 * (Implementation later; keep signature correct so it compiles.)
 */
@Injectable()
export class PerSellerOrderSellerStrategy implements OrderSellerStrategy {
  readonly code = 'per-seller';
  readonly description = [{ languageCode: 'en', value: 'Split by seller channel' } as any];

  // vendure v3.4 signature:
  setOrderLineSellerChannel(
    _ctx: RequestContext,
    orderLine: OrderLine,
  ): Channel | Promise<Channel | undefined> | undefined {
    return orderLine.productVariant?.channels?.[0]; // placeholder – real logic later
  }
}
