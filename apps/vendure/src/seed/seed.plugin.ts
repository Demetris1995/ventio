// apps/vendure/src/seed/seed.plugin.ts
import { VendurePlugin, PluginCommonModule } from '@vendure/core';
import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { SeedService } from './seed';

@VendurePlugin({
  imports: [PluginCommonModule],
  providers: [SeedService],
})
export class SeedPlugin implements OnApplicationBootstrap {
  constructor(private readonly seedService: SeedService) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.seedService.seed();
  }
}
