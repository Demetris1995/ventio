// apps/vendure/migration.ts
import { Command } from 'commander';
import { generateMigration, runMigrations, revertLastMigration } from '@vendure/core';
import { config } from './src/vendure-config';

const program = new Command();

program
  .command('generate <name>')
  .description('Generate a new migration file with the given name')
  .action(async (name: string) => {
    await generateMigration(config, { name, outputDir: './src/migrations' });
  });

program
  .command('run')
  .description('Run all pending migrations')
  .action(async () => {
    await runMigrations(config);
  });

program
  .command('revert')
  .description('Revert the last applied migration')
  .action(async () => {
    await revertLastMigration(config);
  });

program.parse(process.argv);
