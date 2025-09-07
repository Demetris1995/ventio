import { Args, Mutation, Resolver } from '@nestjs/graphql';
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
  ) {}

  private async step<T>(label: string, fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      throw new Error(`[${label}] ${msg}`);
    }
  }

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

    // 2) Defaults from Default Channel (zones may be null on fresh installs)
    const def = await this.step('get default channel', () =>
      this.channels.getDefaultChannel(ctx),
    );

    // 3) Resolve Zone IDs (fallback if defaults are null)
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
        availableCurrencyCodes: (def.availableCurrencyCodes ?? [CurrencyCode.EUR]) as CurrencyCode[] | undefined,
        defaultShippingZoneId: shippingZoneId!,
        defaultTaxZoneId: taxZoneId!,
      }),
    );
    if (isGraphQlErrorResult(created)) {
      throw new Error(`[create channel] ${created.message}`);
    }
    const channel = created as Channel;

    // 4.1) IMPORTANT: grant the CALLER'S roles to the NEW channel
    // Load current Administrator to verify we're an admin user
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

    // Load the active User WITH roles (roles are on User, not Administrator)
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

    // Assign each of the user's roles to the new channel
    for (const r of user.roles) {
      await this.step(`assign caller role "${r.code}" to new channel`, () =>
        this.roles.assignRoleToChannel(ctx, r.id as ID, channel.id),
      );
    }

    // Additionally ensure the global "SuperAdmin" role (if present) is on the channel
    const roleRepo = this.connection.getRepository(ctx, Role);
    const superAdminRole = await roleRepo.findOne({ where: { code: 'SuperAdmin' as any } });
    if (superAdminRole) {
      await this.step('assign SuperAdmin role to new channel', () =>
        this.roles.assignRoleToChannel(ctx, superAdminRole.id as ID, channel.id),
      );
    }

    // 5) Create a seller-scoped Admin Role and assign to the new channel
    const role = await this.step('create role', () =>
      this.roles.create(ctx, {
        code: `seller-admin-${seller.id}`,
        description: `Admin role for ${seller.name}`,
        permissions: [
          Permission.Authenticated,

          // catalog
          Permission.ReadCatalog,
          Permission.CreateCatalog,
          Permission.UpdateCatalog,
          Permission.DeleteCatalog,

          // orders
          Permission.ReadOrder,
          Permission.UpdateOrder,

          // customers
          Permission.ReadCustomer,
          Permission.UpdateCustomer,

          // shipping methods
          Permission.ReadShippingMethod,
          Permission.CreateShippingMethod,
          Permission.UpdateShippingMethod,

          // stock locations
          Permission.ReadStockLocation,
          Permission.CreateStockLocation,
          Permission.UpdateStockLocation,
        ],
      }),
    );
    await this.step('assign role to channel', () =>
      this.roles.assignRoleToChannel(ctx, role.id, channel.id),
    );

    // 6) Seller Administrator (gracefully skip if perms insufficient)
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
      // proceed without creating the admin for now
    }

    // 7) Stock Location + assign to seller channel
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

    // 8) Default ShippingMethod “Standard (Free)” on the seller channel
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
}
