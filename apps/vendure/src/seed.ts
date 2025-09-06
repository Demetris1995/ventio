import 'dotenv/config';
import 'reflect-metadata';
import {
  bootstrap,
  ChannelService,
  LanguageCode,
  RequestContext,
  TaxCategoryService,
  TaxRateService,
  ZoneService,
} from '@vendure/core';
import { config } from './vendure-config';

(async () => {
  const app = await bootstrap(config);

  const channelService = app.get(ChannelService);
  const zoneService = app.get(ZoneService);
  const taxCategoryService = app.get(TaxCategoryService);
  const taxRateService = app.get(TaxRateService);

  const defaultChannel = await channelService.getDefaultChannel();

  const ctx = new RequestContext({
    apiType: 'admin',
    channel: defaultChannel,
    languageCode: LanguageCode.en,
    isAuthorized: true,
    authorizedAsOwnerOnly: false,
  });

  // 1) Ensure Zone exists
  const ZONE_NAME = 'Default Zone';
  let zone = (await zoneService.findAll(ctx)).items.find(z => z.name === ZONE_NAME);
  if (!zone) {
    zone = await zoneService.create(ctx, { name: ZONE_NAME });
    console.log('Created Zone:', zone.name);
  }

  // 2) Ensure Tax Category
  let category = (await taxCategoryService.findAll(ctx)).items.find(c => c.name === 'Standard');
  if (!category) {
    category = await taxCategoryService.create(ctx, { name: 'Standard' });
    console.log('Created TaxCategory:', category.name);
  }

  // 3) Ensure Tax Rate (0%) for that Zone + Category
  const rates = await taxRateService.findAll(ctx);
  if (!rates.items.some(r => r.name === 'Standard 0%')) {
    await taxRateService.create(ctx, {
      name: 'Standard 0%',
      enabled: true,
      value: 0,          // change later to your VAT, e.g. 0.19 for 19%
      zoneId: zone.id,
      categoryId: category.id,
    });
    console.log('Created TaxRate: Standard 0%');
  }

  // 4) Set Zone as Default Channel's default tax zone
  const refreshed = await channelService.getDefaultChannel();
  if (!refreshed.defaultTaxZone || refreshed.defaultTaxZone.id !== zone.id) {
    await channelService.update(ctx, {
      id: refreshed.id,
      defaultTaxZoneId: zone.id,   // update input uses the Id field
    });
    console.log('Linked Zone to Default Channel as default tax zone');
  }

  console.log('✅ Seed complete.');
  await app.close();
})();
