/* eslint-disable @typescript-eslint/no-explicit-any */
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
  Allow,
  Administrator,
  AdministratorService,
  Channel,
  ChannelService,
  CurrencyCode,
  Ctx,
  ID,
  LanguageCode,
  Permission,
  RequestContext,
  Role,
  RoleService,
  SellerService,
  ShippingMethodService,
  StockLocation,
  Transaction,
  TransactionalConnection,
  User,
  ZoneService,
  defaultShippingCalculator,
  isGraphQlErrorResult,
  Order,
  OrderService,
} from '@vendure/core';

type RegisterSellerInput = {
  name: string;
  adminEmailAddress: string;
  adminPassword: string;
};

type RegisterSellerPayload = {
  sellerId: ID;
  channelId: ID;
  channelToken: string;
  adminEmailAddress: string;
  adminPassword: string;
};

type SellerSelectionInput = {
  sellerChannelId: ID;
  shippingMethodId: ID;
};

@Resolver()
export class MarketplaceResolver {
  constructor(
    private readonly sellers: SellerService,
    private readonly channels: ChannelService,
    private readonly roles: RoleService,
    private readonly admins: AdministratorService,
    private readonly shippingMethods: ShippingMethodService,
    private readonly connection: TransactionalConnection,
    private readonly zones: ZoneService,
    // NEW for eligible/set shipping:
    private readonly orders: OrderService,
  ) {}

  private async step<T>(label: string, fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      throw new Error(`[${label}] ${msg}`);
    }
  }

  // ------------------------------------------------------------------
  // EXISTING: registerSeller (unchanged)
  // ------------------------------------------------------------------
  @Allow(Permission.SuperAdmin)
  @Transaction()
  @Mutation('registerSeller')
  async registerSeller(
    @Ctx() ctx: RequestContext,
    @Args('input') input: RegisterSellerInput,
  ): Promise<RegisterSellerPayload> {
    const { name, adminEmailAddress, adminPassword } = input;

    // 1) Seller
    const seller = await this.step('create seller', () =>
      this.sellers.create(ctx, { name }),
    );

    // 2) Defaults from Default Channel
    const def = await this.step('get default channel', () =>
      this.channels.getDefaultChannel(ctx),
    );

    // 3) Resolve Zone IDs
    let shippingZoneId = def.defaultShippingZone?.id as ID | undefined;
    let taxZoneId = def.defaultTaxZone?.id as ID | undefined;
    if (!shippingZoneId || !taxZoneId) {
      const allZones = await this.step('find zones', () => this.zones.findAll(ctx));
      if (allZones.items.length === 0) {
        throw new Error(
          '[zones] No Zones exist. Create at least one Zone (Settings → Zones) or run seed.',
        );
      }
      const fallback = allZones.items[0].id as ID;
      shippingZoneId = shippingZoneId ?? fallback;
      taxZoneId = taxZoneId ?? fallback;
    }

    // 4) Channel
    const created = await this.step('create channel', () =>
      this.channels.create(ctx, {
        code: `seller-${seller.id}`,
        token: `seller-${seller.id}-${Date.now()}`,
        sellerId: seller.id as ID,
        defaultLanguageCode: (def.defaultLanguageCode ?? LanguageCode.en) as LanguageCode,
        availableLanguageCodes: (def.availableLanguageCodes ?? [LanguageCode.en]) as LanguageCode[] | undefined,
        pricesIncludeTax: def.pricesIncludeTax,
        defaultCurrencyCode: (def.defaultCurrencyCode ?? CurrencyCode.EUR) as CurrencyCode,
        availableCurrencyCodes: def.availableCurrencyCodes ?? [CurrencyCode.EUR],
        defaultShippingZoneId: shippingZoneId!,   // non-null asserted above
        defaultTaxZoneId: taxZoneId!,             // non-null asserted above
      }),
    );
    if (isGraphQlErrorResult(created)) {
      throw new Error(`[create channel] ${created.message}`);
    }
    const channel = created as Channel;

    // 4.1) Grant caller roles to new channel
    const activeUserId = ctx.activeUserId;
    if (!activeUserId) {
      throw new Error('[precheck] No active user on context');
    }
    const admin: Administrator | undefined = await this.step('load current administrator', () =>
      this.admins.findOneByUserId(ctx, activeUserId),
    );
    if (!admin) {
      throw new Error('[precheck] Current user is not an Administrator');
    }

    const userRepo = this.connection.getRepository(ctx, User);
    const user = await this.step('load current user with roles', () =>
      userRepo.findOne({
        where: { id: activeUserId as ID },
        relations: { roles: true },
      }),
    );
    if (!user) {
      throw new Error('[precheck] Active user entity not found');
    }

    for (const r of user.roles) {
      await this.step(`assign caller role "${r.code}" to new channel`, () =>
        this.roles.assignRoleToChannel(ctx, r.id as ID, channel.id),
      );
    }

    const roleRepo = this.connection.getRepository(ctx, Role);
    const superAdminRole = await roleRepo.findOne({ where: { code: 'SuperAdmin' as any } });
    if (superAdminRole) {
      await this.step('assign SuperAdmin role to new channel', () =>
        this.roles.assignRoleToChannel(ctx, superAdminRole.id as ID, channel.id),
      );
    }

    // 5) Seller-scoped Admin Role
    const role = await this.step('create role', () =>
      this.roles.create(ctx, {
        code: `seller-admin-${seller.id}`,
        description: `Admin role for ${seller.name}`,
        permissions: [
          Permission.Authenticated,

          Permission.ReadCatalog,
          Permission.CreateCatalog,
          Permission.UpdateCatalog,
          Permission.DeleteCatalog,

          Permission.ReadOrder,
          Permission.UpdateOrder,

          Permission.ReadCustomer,
          Permission.UpdateCustomer,

          Permission.ReadShippingMethod,
          Permission.CreateShippingMethod,
          Permission.UpdateShippingMethod,

          Permission.ReadStockLocation,
          Permission.CreateStockLocation,
          Permission.UpdateStockLocation,
        ],
      }),
    );
    await this.step('assign role to channel', () =>
      this.roles.assignRoleToChannel(ctx, role.id, channel.id),
    );

    // 6) Seller Administrator (best-effort)
    try {
      await this.step('create administrator', () =>
        this.admins.create(ctx, {
          firstName: seller.name,
          lastName: 'Admin',
          emailAddress: adminEmailAddress,
          password: adminPassword,
          roleIds: [role.id],
        }),
      );
    } catch (e: any) {
      const msg = e?.message ?? '';
      if (!msg.includes('error.active-user-does-not-have-sufficient-permissions')) {
        throw e;
      }
    }

    // 7) Stock Location + assign
    const stockRepo = this.connection.getRepository(ctx, StockLocation);
    const stock = await this.step('create stock location', () =>
      stockRepo.save(
        stockRepo.create({
          name: `${seller.name} Default`,
          description: `Default stock location for ${seller.name}`,
        }),
      ),
    );
    await this.step('assign stock location to channel', () =>
      this.channels.assignToChannels(ctx, StockLocation, stock.id, [channel.id]),
    );

    // 8) Default ShippingMethod on the seller channel
    const sm = await this.step('create shipping method', () =>
      this.shippingMethods.create(ctx, {
        code: `standard-free-${seller.id}`,
        fulfillmentHandler: 'manual-fulfillment',
        checker: { code: 'seller-only-eligibility-checker', arguments: [] },
        calculator: {
          code: defaultShippingCalculator.code,
          arguments: [{ name: 'rate', value: '0' }],
        },
        translations: [
          { languageCode: LanguageCode.en, name: 'Standard (Free)', description: 'Default free shipping' },
        ],
      }),
    );

    await this.step('assign shipping method to channel', () =>
      this.shippingMethods.assignShippingMethodsToChannel(ctx, {
        channelId: channel.id,
        shippingMethodIds: [sm.id],
      }),
    );

    return {
      sellerId: seller.id,
      channelId: channel.id,
      channelToken: channel.token,
      adminEmailAddress,
      adminPassword,
    };
  }

  // ------------------------------------------------------------------
  // NEW: eligibleMethodsBySeller (uses OrderService.getEligibleShippingMethods)
  // ------------------------------------------------------------------
  @Query('eligibleMethodsBySeller')
  async eligibleMethodsBySeller(@Ctx() ctx: RequestContext): Promise<Array<{
    sellerChannelId: string;
    sellerName?: string | null;
    quotes: Array<{ id: string; code: string; name: string; priceWithTax: number; price: number }>;
  }>> {
    const order = await this.orders.getActiveOrderForUser(ctx, ctx.activeUserId! ?? undefined);
    if (!order) return [];

    const sellerIds = await this.discoverSellerChannelIds(ctx, order);
    if (!sellerIds.length) return [];

    // Resolve channel names (guard against undefined)
    const sellersWithName: Array<{ id: string; name: string | null }> = [];
    for (const id of sellerIds) {
      try {
        const ch = await this.channels.findOne(ctx, id as unknown as ID);
        sellersWithName.push({ id, name: ch?.code ?? null });
      } catch {
        sellersWithName.push({ id, name: null });
      }
    }

    // Get eligible quotes for this order (Vendure v3.4.1)
    const quotes = await this.orders.getEligibleShippingMethods(ctx, order.id! as ID);

    // Partition quotes into seller buckets
    const buckets = new Map<string, Array<any>>();
    for (const s of sellerIds) buckets.set(s, []);

    for (const q of quotes) {
      const meta = (q as any).metadata ?? {};
      const metaSellerChannelId: string | undefined = meta.sellerChannelId ?? meta.channelId ?? undefined;

      let targetId: string | undefined;
      if (metaSellerChannelId && buckets.has(metaSellerChannelId)) {
        targetId = metaSellerChannelId;
      } else {
        // Fallback: inspect ShippingMethod.channels to match a seller channel
        const sm = await this.shippingMethods.findOne(ctx, q.id! as unknown as ID);
        const methodChannelIds = (sm?.channels ?? []).map(c => String(c.id));
        targetId = sellerIds.find(id => methodChannelIds.includes(id));
      }

      if (targetId) {
        buckets.get(targetId)!.push({
          id: String(q.id),
          code: q.code,
          name: q.name,
          price: q.price,
          priceWithTax: q.priceWithTax,
        });
      }
    }

    return sellersWithName.map(s => ({
      sellerChannelId: s.id,
      sellerName: s.name,
      quotes: buckets.get(s.id) ?? [],
    }));
  }

  // ------------------------------------------------------------------
  // NEW: setShippingPerSeller (loops setShippingMethod for v3.4.1)
  // ------------------------------------------------------------------
  @Mutation('setShippingPerSeller')
  async setShippingPerSeller(
    @Ctx() ctx: RequestContext,
    @Args('selections') selections: SellerSelectionInput[],
  ): Promise<Order> {
    const order = await this.orders.getActiveOrderForUser(ctx, ctx.activeUserId! ?? undefined);
    if (!order) throw new Error('No active order');

    const requiredSellerIds = await this.discoverSellerChannelIds(ctx, order);
    if (requiredSellerIds.length) {
      const provided = new Set<string>(selections.map(s => String(s.sellerChannelId)));
      for (const id of requiredSellerIds) {
        if (!provided.has(id)) {
          throw new Error(`Missing shipping selection for seller channel ${id}`);
        }
      }
    }

    // Vendure v3.4.1: setShippingMethod(ctx, primaryId, allIds)
    const ids = selections.map(s => s.shippingMethodId);
    if (ids.length === 0) {
      throw new Error('No shippingMethodId provided');
    }
    const updated = await this.orders.setShippingMethod(ctx, ids[0], ids);
    return updated as unknown as Order;  
  }  
  

    // If your project supports an array overload internally, you can do:
    // const ids = selections.map(s => s.shippingMethodId);
    // last = await (this.orders as any).setShippingMethod(ctx, ids);


  // ------------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------------
  private async discoverSellerChannelIds(ctx: RequestContext, order: Order): Promise<string[]> {
    const set = new Set<string>();
    for (const line of order.lines) {
      const anyLine: any = line;
      const fromLine: string | undefined =
        anyLine.sellerChannelId ??
        anyLine.customFields?.sellerChannelId ??
        undefined;
      if (fromLine) {
        set.add(String(fromLine));
        continue;
      }
      const product: any = anyLine.productVariant?.product;
      const vendorChannelId: string | undefined = product?.customFields?.vendorChannelId ?? undefined;
      if (vendorChannelId) {
        set.add(String(vendorChannelId));
      }
    }
    return Array.from(set.values());
  }
}
