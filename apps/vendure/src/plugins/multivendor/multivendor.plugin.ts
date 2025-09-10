import {
  idsAreEqual,
  RequestContext,
  OrderLine,
  ShippingLine,
  Channel,
  ChannelService,
  EntityHydrator,
  Order,
  OrderService,
  ShippingMethod,
  ShippingEligibilityChecker,
  OrderSellerStrategy,
  ShippingLineAssignmentStrategy,
  LanguageCode,
  Injector,
} from '@vendure/core';

/**
 * We use async init(injector) to grab services.
 */
let _channelService: ChannelService;
let _entityHydrator: EntityHydrator;
let _orderService: OrderService;

/**
 * Assign each added OrderLine to the seller's Channel based on the variant's channels.
 * After split, add a 10% platform fee to each Seller Order.
 */
export class MultivendorSellerStrategy implements OrderSellerStrategy {
  async init(injector: Injector): Promise<void> {
    _channelService = injector.get(ChannelService);
    _entityHydrator = injector.get(EntityHydrator);
    _orderService = injector.get(OrderService);
  }

  async setOrderLineSellerChannel(ctx: RequestContext, line: OrderLine): Promise<Channel | undefined> {
    await _entityHydrator.hydrate(ctx, line.productVariant, { relations: ['channels'] });

    const defaultChannel = await _channelService.getDefaultChannel();
    const channels = line.productVariant.channels ?? [];

    // Expect variants to be assigned to Default + Seller channel
    if (channels.length >= 2) {
      const sellerCh = channels.find(c => !idsAreEqual(c.id, defaultChannel.id));
      if (sellerCh) return sellerCh;
    }
    return undefined;
  }

  async afterSellerOrdersCreated(
    ctx: RequestContext,
    _aggregateOrder: Order,
    sellerOrders: Order[],
  ): Promise<void> {
    const PLATFORM_FEE_PCT = 0.10;

    for (const o of sellerOrders) {
      const baseWithTax = (o.subTotalWithTax ?? 0) + (o.shippingWithTax ?? 0);
      const feeWithTax = Math.round(baseWithTax * PLATFORM_FEE_PCT);

      await _orderService.addSurchargeToOrder(ctx, o.id, {
        description: 'Platform fee',
        sku: 'PLATFORM-FEE',
        listPrice: feeWithTax,
        listPriceIncludesTax: true,
        taxRate: 0, // adjust if fee should be taxed
      });
    }
  }
}

/**
 * Only expose a ShippingMethod if it belongs to the seller channel
 * that actually has lines in the current order.
 *
 * v3.4.1 signature: check(ctx, order, args, method)
 * We still need services → wired via .init(injector).
 */
export const multivendorShippingEligibilityChecker = new ShippingEligibilityChecker<{}>({
  code: 'mv-eligibility',
  description: [{ languageCode: LanguageCode.en, value: 'Eligible only for matching seller channel' }],
  args: {},

  check: async (ctx, order, _args, method): Promise<boolean> => {
    await _entityHydrator.hydrate(ctx, method, { relations: ['channels'] });
    await _entityHydrator.hydrate(ctx, order, { relations: ['lines.sellerChannel'] });

    const methodChannels = method.channels ?? [];
    if (methodChannels.length === 0) return false;

    const defaultChannel = await _channelService.getDefaultChannel();
    const sellerChannelForMethod = methodChannels.find(c => !idsAreEqual(c.id, defaultChannel.id));
    if (!sellerChannelForMethod) return false;

    return order.lines.some(l => idsAreEqual(l.sellerChannelId, sellerChannelForMethod.id));
  },
});

multivendorShippingEligibilityChecker.init = async (injector: Injector): Promise<void> => {
  _channelService = injector.get(ChannelService);
  _entityHydrator = injector.get(EntityHydrator);
};

/**
 * Assign each ShippingLine only to the lines belonging to that method's seller channel.
 */
export class MultivendorShippingLineAssignmentStrategy implements ShippingLineAssignmentStrategy {
  async init(injector: Injector): Promise<void> {
    _channelService = injector.get(ChannelService);
    _entityHydrator = injector.get(EntityHydrator);
  }

  async assignShippingLineToOrderLines(
    ctx: RequestContext,
    shippingLine: ShippingLine,
    order: Order,
  ): Promise<OrderLine[]> {
    const defaultChannel = await _channelService.getDefaultChannel();
    await _entityHydrator.hydrate(ctx, shippingLine, { relations: ['shippingMethod.channels'] });

    const channels = shippingLine.shippingMethod?.channels ?? [];
    if (channels.length >= 2) {
      const sellerCh = channels.find(c => !idsAreEqual(c.id, defaultChannel.id));
      if (sellerCh) {
        return order.lines.filter(l => idsAreEqual(l.sellerChannelId, sellerCh.id));
      }
    }
    return order.lines;
  }
}
