import 'reflect-metadata';
import 'dotenv/config';
import { join } from 'path';
import {
  VendureConfig,
  DefaultLogger,
  LogLevel,
  DefaultSearchPlugin,
  DefaultJobQueuePlugin,
  DefaultSchedulerPlugin,
} from '@vendure/core';
import { AdminUiPlugin } from '@vendure/admin-ui-plugin';
import { AssetServerPlugin } from '@vendure/asset-server-plugin';
import { EmailPlugin } from '@vendure/email-plugin';
import { GraphiqlPlugin } from '@vendure/graphiql-plugin';
import { SeedPlugin } from './seed/seed.plugin';
import { ManualPaymentHandler } from './payment/manual';

// ⬇ multi-vendor pieces
import {
  MultivendorSellerStrategy,
  MultivendorShippingLineAssignmentStrategy,
  multivendorShippingEligibilityChecker,
} from './plugins/multivendor/multivendor.plugin';

console.log('DB ->', {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  name: process.env.DB_NAME,
  user: process.env.DB_USER,
  pass: process.env.DB_PASS,
});

const env = process.env as Record<string, string | undefined>;
const withSlash = (p?: string) => (p ? (p.startsWith('/') ? p : `/${p}`) : p);


export const config: VendureConfig = {
apiOptions: {
  port: Number(env.PORT ?? 3000),
  adminApiPath: withSlash(env.ADMIN_API_PATH) ?? '/admin-api',
  shopApiPath: withSlash(env.SHOP_API_PATH) ?? '/shop-api',
  cors: { origin: ['http://localhost:4321','http://127.0.0.1:4321'], credentials: true },
},

  logger: new DefaultLogger({ level: LogLevel.Info }),

  authOptions: {
    tokenMethod: ['cookie', 'bearer'],
    sessionDuration: '30d',
    cookieOptions: { sameSite: 'lax', secure: false },
    superadminCredentials: { identifier: 'superadmin', password: 'superadmin' },
  },

dbConnectionOptions: {
  type: 'postgres',
  host: env.DB_HOST ?? '127.0.0.1',
  port: Number(env.DB_PORT ?? 5432),
  username: env.DB_USER ?? 'ventio',
  password: env.DB_PASS ?? 'ventio',
  database: env.DB_NAME ?? 'ventio',
  synchronize: false,               // use real migrations
  logging: ['info', 'warn', 'error'],
  migrations: [join(__dirname, 'migrations/*.+(js|ts)')],
  extra: {
    max: Number(env.DB_MAX_CONN ?? 20),
    ssl: env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  },
},

  paymentOptions: {
    paymentMethodHandlers: [ManualPaymentHandler],
  },

  // ✅ order-level strategy goes here
  orderOptions: {
    orderSellerStrategy: new MultivendorSellerStrategy(),
  },

  // ✅ shipping-level config goes here (moved strategy here)
  shippingOptions: {
    shippingEligibilityCheckers: [multivendorShippingEligibilityChecker],
    shippingLineAssignmentStrategy: new MultivendorShippingLineAssignmentStrategy(),
  },

  plugins: [
    DefaultJobQueuePlugin,
    DefaultSearchPlugin.init({ bufferUpdates: true }),
    DefaultSchedulerPlugin.init({}),

    AssetServerPlugin.init({
      route: 'assets',
      assetUploadDir: join(process.cwd(), 'assets'),
    }),

    EmailPlugin.init({
      transport: {
        type: 'smtp',
        host: env.SMTP_HOST ?? 'localhost',
        port: Number(env.SMTP_PORT ?? 1025),
      },
      devMode: true,
      templatePath: join(process.cwd(), 'static', 'email', 'templates'),
      outputPath: join(process.cwd(), 'static', 'email', 'test-emails'),
      route: 'mailbox',
      handlers: [],
    }),

    AdminUiPlugin.init({ route: 'admin', port: 3002 }),
    GraphiqlPlugin.init({ route: 'graphiql' }),
    SeedPlugin,

  ],
};

export default config;
