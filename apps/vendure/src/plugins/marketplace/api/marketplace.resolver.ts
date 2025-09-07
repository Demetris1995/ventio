import { Args, Mutation, Resolver } from '@nestjs/graphql';
import {
  Allow, Ctx, ID, LanguageCode, Permission, RequestContext,
  SellerService, ChannelService, RoleService, AdministratorService,
  ShippingMethodService, RequestContextService, TransactionalConnection,
  defaultShippingCalculator, manualFulfillmentHandler,
} from '@vendure/core';

// Keep it compiling — we’ll fill the body later.
@Resolver()
export class MarketplaceResolver {
  constructor(
    private readonly sellerService: SellerService,
    private readonly channelService: ChannelService,
    private readonly roleService: RoleService,
    private readonly adminService: AdministratorService,
    private readonly shippingMethodService: ShippingMethodService,
    private readonly requestContextService: RequestContextService,
    private readonly connection: TransactionalConnection,
  ) {}

  @Allow(Permission.SuperAdmin)
  @Mutation()
  async registerSeller(
    @Ctx() _ctx: RequestContext,
    @Args('input') _input: any,
  ): Promise<{
    sellerId: ID; channelId: ID; channelToken: string; roleId: ID; adminId: ID;
    adminEmail: string; stockLocationId: ID; shippingMethodId: ID;
  }> {
    throw new Error('Not implemented yet'); // compiles cleanly, no TS errors
  }
}
