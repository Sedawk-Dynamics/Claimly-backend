/**
 * Resolve Failed Prisma Migration Script
 * 
 * This script helps resolve failed Prisma migrations in production.
 * 
 * Usage:
 *   npm run migrate:resolve -- --rolled-back <migration_name>
 *   npm run migrate:resolve -- --applied <migration_name>
 *   OR
 *   npx ts-node scripts/resolve-failed-migration.ts --rolled-back <migration_name>
 *   npx ts-node scripts/resolve-failed-migration.ts --applied <migration_name>
 */

import { execSync } from 'child_process';
import dotenv from 'dotenv';

dotenv.config();

const MIGRATION_NAME = '20251229133000_update_document_type_enums';

function resolveMigration(action: 'rolled-back' | 'applied', migrationName: string) {
  console.log(`\n🔧 Resolving failed migration: ${migrationName}`);
  console.log(`   Action: Mark as ${action}\n`);

  try {
    const command = `npx prisma migrate resolve --${action} ${migrationName}`;
    console.log(`Running: ${command}\n`);
    
    execSync(command, {
      stdio: 'inherit',
      env: process.env,
    });

    console.log(`\n✅ Migration ${migrationName} marked as ${action} successfully!`);
    console.log('\n📝 Next steps:');
    console.log('   1. Try running migrations again: npm run migrate:deploy');
    console.log('   2. If the migration was already applied, you can proceed');
    console.log('   3. If the migration needs to be re-run, check the database state first\n');
  } catch (error) {
    console.error(`\n❌ Failed to resolve migration: ${error instanceof Error ? error.message : 'Unknown error'}`);
    console.error('\n💡 Alternative: You can run the command manually:');
    console.error(`   npx prisma migrate resolve --${action} ${migrationName}\n`);
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const action = args.find(arg => arg === '--rolled-back' || arg === '--applied');
const migrationNameArg = args.find(arg => !arg.startsWith('--'));

if (!action) {
  console.log('\n❌ Error: Please specify an action (--rolled-back or --applied)');
  console.log('\nUsage:');
  console.log('  npm run migrate:resolve -- --rolled-back [migration_name]');
  console.log('  npm run migrate:resolve -- --applied [migration_name]');
  console.log('\nExample:');
  console.log(`  npm run migrate:resolve -- --rolled-back ${MIGRATION_NAME}`);
  console.log(`  npm run migrate:resolve -- --applied ${MIGRATION_NAME}\n`);
  process.exit(1);
}

const migrationName = migrationNameArg || MIGRATION_NAME;
const actionType = action === '--rolled-back' ? 'rolled-back' : 'applied';

resolveMigration(actionType, migrationName);

