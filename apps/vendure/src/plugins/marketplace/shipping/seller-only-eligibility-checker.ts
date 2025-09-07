import { LanguageCode, ShippingEligibilityChecker } from '@vendure/core';

/**
 * Only allow a seller's methods to apply to that seller's lines.
 * (We’ll fill logic later; keep types valid.)
 */
export const sellerOnlyEligibilityChecker = new ShippingEligibilityChecker({
  code: 'seller-only',
  description: [{ languageCode: LanguageCode.en, value: 'Seller-only methods' }],
  args: {},
  check: async () => true, // placeholder
});
