import { Injectable, OnModuleInit } from '@nestjs/common';
import { EventBus, OrderService, ID } from '@vendure/core';
import { OrderStateTransitionEvent } from '@vendure/core';

@Injectable()
export class PlatformFeePerSellerListener implements OnModuleInit {
  constructor(private readonly events: EventBus, private readonly orders: OrderService) {}

  onModuleInit() {
    this.events.ofType(OrderStateTransitionEvent).subscribe(async (ev) => {
      if (ev.toState !== 'ArrangingPayment') return;
      const { ctx, order } = ev;

      const perSellerNet = new Map<string, number>();
      for (const line of order.lines) {
        const sc = (line as any).sellerChannelId as string | undefined;
        if (!sc) continue;
        const net = line.proratedLinePrice; // excludes tax
        perSellerNet.set(sc, (perSellerNet.get(sc) ?? 0) + net);
      }

      for (const [sellerChannelId, net] of perSellerNet) {
        const fee = Math.floor(net * 0.10);
        if (fee <= 0) continue;

        await this.orders.addSurchargeToOrder(ctx, order.id! as ID, {
          description: 'Platform fee (10%)',
          sku: `PLATFORM-FEE-${sellerChannelId}`,
          listPrice: fee,
          listPriceIncludesTax: false,
          taxRate: 0,
        });
      }
    });
  }
}
