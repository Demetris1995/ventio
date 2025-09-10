import 'reflect-metadata';
import 'dotenv/config';
import { bootstrap, runMigrations } from '@vendure/core';
import { config } from './vendure-config';

async function start() {
  // Run pending migrations first
  await runMigrations(config);
  // Then start the server
  await bootstrap(config);
}

start().catch(err => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
