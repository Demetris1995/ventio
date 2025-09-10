import { Injectable } from '@nestjs/common';
import {
  Channel,
  ChannelService,
  Customer,
  CustomerService,
  ConfigService,
  CurrencyCode,
  ID,
  LanguageCode,
  Logger,
  PaymentMethodService,
  Product,
  ProductService,
  ProductVariantService,
  RequestContext,
  RequestContextService,
  ShippingMethodService,
  StockLocationService,
  SellerService,
  TaxCategoryService,
  TaxRateService,
  TransactionalConnection,
  ZoneService,
  isGraphQlErrorResult 
} from '@vendure/core';

import { ManualPaymentHandler } from '../payment/manual';
const SELLER_ELIGIBILITY_CODE = 'multivendor-seller-only';

type SellerSpec = {
  name: string;
  adminEmailAddress: string;
  adminPassword: string;
  products: Array<{
    name: string;
    slug: string;
    description?: string;
    variants: Array<{
      sku: string;
      price: number; // minor units
      stockOnHand: number;
      name?: string;
    }>;
  }>;
  shipping: { code: string; name: string; rate: number };
  stockLocationName: string;
};

@Injectable()
export class SeedService {
  constructor(
    private readonly requestContextService: RequestContextService,
    private readonly connection: TransactionalConnection,

    private readonly zoneService: ZoneService,
    private readonly taxCategoryService: TaxCategoryService,
    private readonly taxRateService: TaxRateService,
    private readonly channelService: ChannelService,

    private readonly productService: ProductService,
    private readonly productVariantService: ProductVariantService,
    private readonly stockLocationService: StockLocationService,
    private readonly shippingMethodService: ShippingMethodService,
    private readonly paymentMethodService: PaymentMethodService,
    private readonly customerService: CustomerService,
    private readonly configService: ConfigService,
    private readonly sellerService: SellerService,
  ) {}

  async seed(): Promise<void> {
    // Admin ctx on Default Channel
    const defaultChannel = await this.channelService.getDefaultChannel();
    const ctx: RequestContext = await this.requestContextService.create({
      apiType: 'admin',
      channelOrToken: defaultChannel,
      languageCode: LanguageCode.en,
    });

    // Skip if already seeded
    const productCount = await this.connection.getRepository(ctx, Product).count();
    if (productCount > 0) {
      Logger.info('Seed: database already contains data, skipping.');
      return;
    }

    Logger.info('Seed: starting…');

    // 1) Minimal tax setup
    const { zone, taxCategoryId } = await this.ensureTaxSetup(ctx, defaultChannel);

    // 2) Manual payment method on current channel
    await this.ensureManualPaymentMethod(ctx);

    // 3) Sellers spec
    const sellers: SellerSpec[] = [
      {
        name: 'Seller A',
        adminEmailAddress: 'seller.a@example.com',
        adminPassword: 'Password1!',
        stockLocationName: 'Seller A Warehouse',
        shipping: { code: 'seller-a-std', name: 'Seller A Standard', rate: 800 },
        products: [
          {
            name: 'Aegean Olive Oil 500ml',
            slug: 'aegean-olive-oil-500',
            description: 'Cold-pressed extra virgin olive oil from Seller A.',
            variants: [
              { sku: 'A-OLIVE-500', price: 1299, stockOnHand: 50, name: '500ml' },
              { sku: 'A-OLIVE-750', price: 1799, stockOnHand: 30, name: '750ml' },
            ],
          },
          {
            name: 'Halloumi Cheese 250g',
            slug: 'halloumi-250',
            description: 'Traditional Cypriot halloumi.',
            variants: [{ sku: 'A-HALL-250', price: 599, stockOnHand: 100, name: '250g' }],
          },
        ],
      },
      {
        name: 'Seller B',
        adminEmailAddress: 'seller.b@example.com',
        adminPassword: 'Password1!',
        stockLocationName: 'Seller B Depot',
        shipping: { code: 'seller-b-std', name: 'Seller B Standard', rate: 650 },
        products: [
          {
            name: 'Carob Syrup 300ml',
            slug: 'carob-syrup-300',
            description: 'Natural carob syrup from Seller B.',
            variants: [
              { sku: 'B-CAROB-300', price: 899, stockOnHand: 60, name: '300ml' },
              { sku: 'B-CAROB-500', price: 1199, stockOnHand: 40, name: '500ml' },
            ],
          },
          {
            name: 'Lefkara Embroidered Napkin',
            slug: 'lefkara-napkin',
            description: 'Handcrafted napkin with traditional patterns.',
            variants: [{ sku: 'B-LEFK-001', price: 2499, stockOnHand: 15, name: 'One Size' }],
          },
        ],
      },
    ];

    // 4) Create sellers + data
    const sellerChannels: Channel[] = [];
    for (const spec of sellers) {
      const ch = await this.createSellerWithData(ctx, spec, taxCategoryId, zone.id);
      sellerChannels.push(ch);
    }

    // 5) Sample customers
    await this.createCustomers(ctx);

    Logger.info(
      `Seed: done ✅ | Sellers: ${sellerChannels.map((c) => `${c.code} (${c.id})`).join(', ')}`,
    );
  }

  private async ensureTaxSetup(ctx: RequestContext, defaultChannel: Channel) {
    const zone = await this.zoneService.create(ctx, { name: 'Default Tax Zone' });

    await this.channelService.update(ctx, {
      id: defaultChannel.id,
      defaultTaxZoneId: zone.id,
    });

    const categories = await this.taxCategoryService.findAll(ctx);
    let category = categories.items.find((c) => c.name.toLowerCase() === 'standard');
    if (!category) {
      category = await this.taxCategoryService.create(ctx, { name: 'Standard' });
    }

    const rates = await this.taxRateService.findAll(ctx);
    const exists = rates.items.some((r) => r.zone?.id === zone.id && r.category?.id === category!.id);
    if (!exists) {
      await this.taxRateService.create(ctx, {
        name: 'Standard 0%',
        enabled: true,
        value: 0,
        zoneId: zone.id as ID,
        categoryId: category!.id as ID,
      });
    }

    return { zone, taxCategoryId: category!.id as ID };
  }

private async ensureManualPaymentMethod(ctx: RequestContext): Promise<void> {
  const handlerCode = ManualPaymentHandler.code; // same instance/code as in vendure-config

  const existing = await this.paymentMethodService.findAll(ctx);
  const already = existing.items.some(pm => pm.handler?.code === handlerCode);
  if (already) return;

  await this.paymentMethodService.create(ctx, {
    code: 'manual',
    enabled: true,
    translations: [
      {
        languageCode: LanguageCode.en,
        name: 'Manual Payment',
        description: 'Pay offline / cash on delivery (dev)',
      },
    ],
    handler: { code: handlerCode, arguments: [] },
  });
}

private async createSellerWithData(
  ctx: RequestContext,
  spec: SellerSpec,
  taxCategoryId: ID,
  zoneId: ID,
): Promise<Channel> {
  // 1) Create a dedicated Channel for this “seller”
  const code = spec.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const token = `${code}-token`;

  const created = await this.channelService.create(ctx, {
    code,
    token,
    defaultLanguageCode: LanguageCode.en,
    currencyCode: CurrencyCode.EUR,      // use explicit enum
    pricesIncludeTax: false,             // pick what you want in dev
    defaultTaxZoneId: zoneId,
    defaultShippingZoneId: zoneId,
  });

  if (isGraphQlErrorResult(created)) {
    throw new Error(`Failed to create channel for ${spec.name}: ${created.message}`);
  }
  const sellerChannel = created; // now strongly typed Channel

  // 2) Stock location for this channel (simple)
  await this.stockLocationService.create(ctx, {
    name: spec.stockLocationName,
    description: `${spec.name} stock`,
  } as any);

  // 3) ShippingMethod in the seller channel context
  const sellerCtx = await this.requestContextService.create({
    apiType: 'admin',
    channelOrToken: sellerChannel.token,   // pass token or the Channel
    languageCode: LanguageCode.en,
  });

await this.shippingMethodService.create(sellerCtx, {
  code: spec.shipping.code,
  checker: {
    code: 'default-shipping-eligibility-checker', // ✅ built-in checker
    arguments: [],
  },
  calculator: {
    code: 'default-shipping-calculator',
    arguments: [
      { name: 'rate', value: spec.shipping.rate.toString() },
      { name: 'includesTax', value: 'false' },
    ],
  },
  fulfillmentHandler: 'manual-fulfillment',
  translations: [
    {
      languageCode: LanguageCode.en,
      name: spec.shipping.name,
      description: `${spec.name} shipping`,
    },
  ],
});

  // 4) Create products & variants, then assign to seller channel
  for (const p of spec.products) {
    const product = await this.productService.create(ctx, {
      translations: [{
        languageCode: LanguageCode.en,
        name: p.name,
        slug: p.slug,
        description: p.description ?? '',
      }],
    });

    await this.productVariantService.create(ctx, p.variants.map(v => ({
      productId: product.id as ID,
      sku: v.sku,
      price: v.price,
      stockOnHand: v.stockOnHand,
      translations: [{ languageCode: LanguageCode.en, name: v.name ?? p.name }],
      taxCategoryId,
    })));

    const createdVariants = await this.productVariantService.getVariantsByProductId(ctx, product.id as ID);

    await this.productVariantService.assignProductVariantsToChannel(ctx, {
      channelId: sellerChannel.id as ID,
      productVariantIds: createdVariants.items.map(vv => vv.id as ID),
    });
  }

  return sellerChannel;
}
  private async createCustomers(ctx: RequestContext) {
    const customers = [
      { emailAddress: 'buyer1@example.com', firstName: 'Buyer', lastName: 'One' },
      { emailAddress: 'buyer2@example.com', firstName: 'Buyer', lastName: 'Two' },
    ];

    for (const c of customers) {
      const exists = await this.connection.getRepository(ctx, Customer).findOne({
        where: { emailAddress: c.emailAddress },
      });
      if (exists) continue;

      await this.customerService.create(ctx, {
        emailAddress: c.emailAddress,
        firstName: c.firstName,
        lastName: c.lastName,
        phoneNumber: '+3570000000',
      });
    }
  }
}
