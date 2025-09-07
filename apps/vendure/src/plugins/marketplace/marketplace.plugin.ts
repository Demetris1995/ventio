import {
  VendurePlugin,
  PluginCommonModule,
  RuntimeVendureConfig,
  defaultShippingCalculator,
  manualFulfillmentHandler,
} from '@vendure/core';

import { schema } from './api/schema';
import { MarketplaceResolver } from './api/marketplace.resolver';

import { PerSellerOrderSellerStrategy } from './strategies/order-seller.strategy';
import { PerSellerShippingLineAssignmentStrategy } from './strategies/shipping-line-assignment.strategy';
import { sellerOnlyEligibilityChecker } from './shipping/seller-only-eligibility-checker';

/**
 * MarketplacePlugin
 * - Registers Admin API extension (registerSeller)
 * - Registers our checker, calculators, fulfillment handler
 * - Installs per-seller strategies
 * - Provides a static .use() for back-compat with vendure-config.ts
 */
@VendurePlugin({
  imports: [PluginCommonModule],
  adminApiExtensions: {
    schema,
    resolvers: [MarketplaceResolver],
  },
  configuration: (config: RuntimeVendureConfig): RuntimeVendureConfig => {
    // Ensure option bags exist (silence "possibly undefined")
    config.orderOptions = config.orderOptions ?? {};
    config.shippingOptions = config.shippingOptions ?? {};

    // Order splitting per seller
    config.orderOptions.orderSellerStrategy = new PerSellerOrderSellerStrategy();

    // Shipping: per-seller assignment
    config.shippingOptions.shippingLineAssignmentStrategy =
      new PerSellerShippingLineAssignmentStrategy();

    // Register our eligibility checker
    config.shippingOptions.shippingEligibilityCheckers = [
      ...(config.shippingOptions.shippingEligibilityCheckers ?? []),
      sellerOnlyEligibilityChecker,
    ];

    // Register built-in calculator (code will match defaultShippingCalculator.code)
    config.shippingOptions.shippingCalculators = [
      ...(config.shippingOptions.shippingCalculators ?? []),
      defaultShippingCalculator,
    ];

    // Register built-in manual fulfillment handler ('manual-fulfillment')
    config.shippingOptions.fulfillmentHandlers = [
      ...(config.shippingOptions.fulfillmentHandlers ?? []),
      manualFulfillmentHandler,
    ];

    return config;
  },
})
export class MarketplacePlugin {
  /** Back-compat so vendure-config.ts can call MarketplacePlugin.use() */
  static use(..._args: unknown[]): typeof MarketplacePlugin {
    return MarketplacePlugin;
  }
}
