import { exec } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import logger from './logger';

const PRISMA_GENERATE_COMMAND = 'npx prisma generate --schema=./src/prisma/schema.prisma';
const MIGRATE_COMMAND = 'npx prisma migrate deploy --schema=./src/prisma/schema.prisma';
const DB_PUSH_COMMAND = 'npx prisma db push --schema=./src/prisma/schema.prisma';

const runCommand = async (command: string, description: string): Promise<void> => {
  logger.info(description);
  console.log(`🔄 ${description}`);

  await new Promise<void>((resolve, reject) => {
    const childProcess = exec(
      command,
      {
        env: process.env,
      },
      (error, stdout, stderr) => {
        if (stdout) {
          logger.info(stdout.trim());
          console.log(stdout.trim());
        }

        if (stderr) {
          logger.warn(stderr.trim());
          console.warn(stderr.trim());
        }

        if (error) {
          logger.error(`${description} failed`, {
            error: error.message,
          });
          console.error(`❌ ${description} failed: ${error.message}`);
          reject(error);
          return;
        }

        resolve();
      }
    );

    childProcess.on('error', (error: NodeJS.ErrnoException) => {
      logger.error(`Failed to start ${description.toLowerCase()}`, {
        error: error.message,
      });
      console.error(`❌ Failed to start ${description.toLowerCase()}: ${error.message}`);
      reject(error);
    });
  });

  console.log(`✅ ${description} completed`);
};

export const ensurePrismaClientGenerated = async (): Promise<void> => {
  const prismaClientPath = path.join(process.cwd(), 'node_modules', '.prisma', 'client');

  try {
    await fs.access(prismaClientPath);
    logger.info('Prisma client artifacts already present');
    return;
  } catch {
    logger.warn('Prisma client artifacts missing. Generating...');
  }

  await runCommand(PRISMA_GENERATE_COMMAND, 'Generating Prisma client');
  logger.info('Prisma client generated successfully');
};

export const runDatabaseMigrations = async (): Promise<void> => {
  try {
    await runCommand(MIGRATE_COMMAND, 'Running Prisma migrations (deploy)');
    logger.info('Database migrations completed successfully');
  } catch (migrationError) {
    logger.warn('Prisma migrate deploy failed, attempting fallback db push', {
      error: migrationError instanceof Error ? migrationError.message : 'Unknown error',
    });
    console.warn('⚠️ Prisma migrate deploy failed. Falling back to `prisma db push`');

    await runCommand(DB_PUSH_COMMAND, 'Synchronizing Prisma schema with database (db push)');
    logger.info('Database schema synchronized via prisma db push');
  }
};


