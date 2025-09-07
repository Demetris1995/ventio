import 'reflect-metadata';
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
import {
  EmailPlugin,
  // defaultEmailHandlers,
} from '@vendure/email-plugin';
import { ManualPaymentHandler } from './payment/manual';
import { MarketplacePlugin } from './plugins/marketplace/marketplace.plugin';
import { GraphiqlPlugin } from '@vendure/graphiql-plugin';



console.log('DB ->', {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  name: process.env.DB_NAME,
  user: process.env.DB_USER,
  pass: process.env.DB_PASS,
});

const env = process.env as Record<string, string | undefined>;

export const config: VendureConfig = {
  apiOptions: {
    port: Number(env.PORT ?? 3000),
    adminApiPath: env.ADMIN_API_PATH ?? '/admin-api',
    shopApiPath: env.SHOP_API_PATH ?? '/shop-api',
    cors: {
      origin: ['http://localhost:4321', 'http://127.0.0.1:4321'],
      credentials: true,
    },
  },

  logger: new DefaultLogger({ level: LogLevel.Info }),

  authOptions: {
    // IMPORTANT: enable cookies so the storefront can keep a session
    tokenMethod: ['cookie', 'bearer'],
    sessionDuration: '30d',
    cookieOptions: {
      // dev-friendly cookie settings (works across ports on localhost)
      sameSite: 'lax',
      secure: false,
    },
    superadminCredentials: {
      identifier: 'superadmin',
      password: 'superadmin',
    },
  },

  dbConnectionOptions: {
    type: 'postgres',
    host: env.DB_HOST ?? '127.0.0.1',
    port: Number(env.DB_PORT ?? 5432),
    username: env.DB_USER ?? 'ventio',
    password: env.DB_PASS ?? 'ventio',
    database: env.DB_NAME ?? 'ventio',
    synchronize: false,          // keep off outside dev
    migrationsRun: true,         // auto-run migrations
    logging: ['warn', 'error'],
    extra: {
      max: Number(env.DB_MAX_CONN ?? 20),
      ssl: env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    },
  },

  paymentOptions: {
    paymentMethodHandlers: [ManualPaymentHandler],
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

    AdminUiPlugin.init({
      route: 'admin', // http://localhost:3000/admin
      port: 3002,
    }),

    GraphiqlPlugin.init({ route: 'graphiql' }), // optional; default is 'graphiql',

    MarketplacePlugin.use()

  ],
};


export default config;

