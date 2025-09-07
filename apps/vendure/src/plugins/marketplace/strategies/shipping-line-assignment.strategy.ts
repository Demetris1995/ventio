import {
  ChannelService,
  EntityHydrator,
  ID,
  Injector,
  Order,
  OrderLine,
  RequestContext,
  ShippingLine,
  ShippingLineAssignmentStrategy,
  idsAreEqual,
} from '@vendure/core';

/**
 * PerSellerShippingLineAssignmentStrategy
 * - Assigns each ShippingLine only to OrderLines belonging to the same seller Channel
 *   as the ShippingMethod (method must be assigned to that seller's channel).
 *
 * NOTE: This strategy uses DI via `init(injector)`; do NOT pass ctor args.
 */
export class PerSellerShippingLineAssignmentStrategy implements ShippingLineAssignmentStrategy {
  private channelService!: ChannelService;
  private hydrator!: EntityHydrator;

  init(injector: Injector) {
    this.channelService = injector.get(ChannelService);
    this.hydrator = injector.get(EntityHydrator);
  }

  async assignShippingLineToOrderLines(
    ctx: RequestContext,
    shippingLine: ShippingLine,
    order: Order,
  ): Promise<OrderLine[]> {
    const defaultChannel = await this.channelService.getDefaultChannel(ctx);

    await this.hydrator.hydrate(ctx, shippingLine, {
      relations: ['shippingMethod', 'shippingMethod.channels'],
    });

    const channels = shippingLine.shippingMethod.channels ?? [];
    let sellerChannelId: ID | undefined;

    if (channels.length >= 2) {
      const sellerChannel = channels.find(c => !idsAreEqual(c.id, defaultChannel.id));
      sellerChannelId = sellerChannel?.id;
    } else if (channels.length === 1) {
      sellerChannelId = channels[0].id;
    }

    if (sellerChannelId) {
      return order.lines.filter(
        l => l.sellerChannelId && idsAreEqual(l.sellerChannelId as ID, sellerChannelId as ID),
      );
    }

    // Fallback: assign to all lines if we can't infer the seller channel
    return order.lines;
  }
}
