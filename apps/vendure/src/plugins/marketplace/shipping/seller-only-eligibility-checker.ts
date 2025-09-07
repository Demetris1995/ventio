import {
  CheckShippingEligibilityCheckerFn,
  LanguageCode,
  ShippingEligibilityChecker,
  idsAreEqual,
  RequestContext,
  Order,
  ShippingMethod,
} from '@vendure/core';

/**
 * Eligible only if the order contains at least one line from the same seller Channel
 * as the ShippingMethod’s seller-owned Channel. This keeps the eligible list tidy per seller.
 *
 * Docs: Checker signature & purpose. :contentReference[oaicite:4]{index=4}
 */
const check: CheckShippingEligibilityCheckerFn<{}> = async (
  _ctx: RequestContext,
  order: Order,
  _args: {},
  method: ShippingMethod,
) => {
  // Determine the seller-owned channel for this method:
  // pick any channel with a sellerId (non-default). If none, fall back to the first channel.
  const channels = method.channels ?? [];
  const sellerChannel = channels.find(c => c.sellerId != null) ?? channels[0];
  if (!sellerChannel) return false;

  return order.lines.some(l => l.sellerChannelId && idsAreEqual(l.sellerChannelId, sellerChannel.id));
};

export const sellerOnlyEligibilityChecker = new ShippingEligibilityChecker({
  code: 'seller-only-eligibility-checker',
  description: [{ languageCode: LanguageCode.en, value: 'Only orders containing items from this seller are eligible' }],
  args: {},
  check,
});
