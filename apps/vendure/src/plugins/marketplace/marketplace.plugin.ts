import { VendurePlugin, PluginCommonModule } from '@vendure/core';
import { gql } from 'graphql-tag';
import { adminApiExtensionsSchema } from './api/schema';
import { MarketplaceResolver } from './api/marketplace.resolver';
import { PerSellerOrderSellerStrategy } from './strategies/order-seller.strategy';
import { PerSellerShippingLineAssignmentStrategy } from './strategies/shipping-line-assignment.strategy';
import { sellerOnlyEligibilityChecker } from './shipping/seller-only-eligibility-checker';

@VendurePlugin({
  imports: [PluginCommonModule],
  adminApiExtensions: {
    schema: adminApiExtensionsSchema,
    resolvers: [MarketplaceResolver],
  },
})
export class MarketplacePlugin {
  static use(config: import('@vendure/core').VendureConfig) {
    config.orderOptions = {
      ...config.orderOptions,
      orderSellerStrategy: new PerSellerOrderSellerStrategy(),
    };
    config.shippingOptions = {
      ...config.shippingOptions,
      shippingLineAssignmentStrategy: new PerSellerShippingLineAssignmentStrategy(),
      shippingEligibilityCheckers: [
        ...(config.shippingOptions?.shippingEligibilityCheckers ?? []),
        sellerOnlyEligibilityChecker,
      ],
    };
    return config;
  }
}
