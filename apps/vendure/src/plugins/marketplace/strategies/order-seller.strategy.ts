import {
  Channel,
  ChannelService,
  EntityHydrator,
  ID,
  Injector,
  Order,
  OrderLine,
  OrderSellerStrategy,
  OrderService,
  RequestContext,
  ShippingLine,
  SplitOrderContents,
  idsAreEqual,
} from '@vendure/core';

/**
 * PerSellerOrderSellerStrategy
 * - Chooses the seller-owned Channel for each line (prefers any channel with sellerId)
 * - Splits the order per seller channel at checkout
 * - Adds a 10% surcharge to each seller order after split
 *
 * NOTE: This strategy uses DI via `init(injector)`; do NOT pass ctor args.
 */
export class PerSellerOrderSellerStrategy implements OrderSellerStrategy {
  private channelService!: ChannelService;
  private hydrator!: EntityHydrator;
  private orderService!: OrderService;

  init(injector: Injector) {
    this.channelService = injector.get(ChannelService);
    this.hydrator = injector.get(EntityHydrator);
    this.orderService = injector.get(OrderService);
  }

  async setOrderLineSellerChannel(
    ctx: RequestContext,
    orderLine: OrderLine,
  ): Promise<Channel | undefined> {
    await this.hydrator.hydrate(ctx, orderLine, {
      relations: ['productVariant', 'productVariant.channels'],
    });

    const variant = orderLine.productVariant;
    const defaultChannel = await this.channelService.getDefaultChannel(ctx);

    // Prefer a seller-owned channel (has sellerId), otherwise fall back to Default
    const sellerChannel =
      variant.channels.find(c => c.sellerId != null && !idsAreEqual(c.id, defaultChannel.id)) ??
      variant.channels.find(c => idsAreEqual(c.id, defaultChannel.id));

    return sellerChannel;
  }

  async splitOrder(ctx: RequestContext, order: Order): Promise<SplitOrderContents[]> {
    await this.hydrator.hydrate(ctx, order, {
      relations: [
        'lines',
        'lines.productVariant',
        'shippingLines',
        'shippingLines.shippingMethod',
        'shippingLines.shippingMethod.channels',
      ],
    });

    const defaultChannel = await this.channelService.getDefaultChannel(ctx);

    // Group lines by sellerChannelId (or default)
    const bySeller = new Map<string, OrderLine[]>();
    for (const line of order.lines) {
      const key = line.sellerChannelId ? String(line.sellerChannelId) : String(defaultChannel.id);
      const group = bySeller.get(key) ?? [];
      group.push(line);
      bySeller.set(key, group);
    }

    // Keep only shipping lines whose shipping method is assigned to that seller's channel
    const groups: SplitOrderContents[] = [];
    for (const [sellerChannelId, lines] of bySeller.entries()) {
      const shippingLinesForSeller: ShippingLine[] = [];
      for (const sl of order.shippingLines ?? []) {
        const channels = sl.shippingMethod.channels ?? [];
        if (channels.some(c => idsAreEqual(c.id, sellerChannelId as unknown as ID))) {
          shippingLinesForSeller.push(sl);
        }
      }

      groups.push({
        channelId: sellerChannelId as unknown as ID,
        state: order.state,
        lines,
        shippingLines: shippingLinesForSeller,
      });
    }

    return groups;
  }

  async afterSellerOrdersCreated(
    ctx: RequestContext,
    _aggregateOrder: Order,
    sellerOrders: Order[],
  ): Promise<void> {
    for (const sellerOrder of sellerOrders) {
      const fee = Math.round((sellerOrder.totalWithTax ?? 0) * 0.1); // 10%
      if (fee <= 0) continue;

      await this.orderService.addSurchargeToOrder(ctx, sellerOrder.id as ID, {
        description: 'Platform fee (10%)',
        listPrice: fee,
        listPriceIncludesTax: true,
        sku: 'PLATFORM_FEE',
      });
    }
  }
}
