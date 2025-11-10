import { exec } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import logger from './logger';

const PRISMA_GENERATE_COMMAND = 'npx prisma generate --schema=./src/prisma/schema.prisma';
const MIGRATE_COMMAND = 'npx prisma migrate deploy --schema=./src/prisma/schema.prisma';

const runCommand = async (command: string, description: string) => {
  logger.info(description);

  await new Promise<void>((resolve, reject) => {
    const childProcess = exec(
      command,
      {
        env: process.env,
      },
      (error, stdout, stderr) => {
        if (stdout) {
          logger.info(stdout.trim());
        }

        if (stderr) {
          logger.warn(stderr.trim());
        }

        if (error) {
          logger.error(`${description} failed`, {
            error: error.message,
          });
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
      reject(error);
    });
  });
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
  await runCommand(MIGRATE_COMMAND, 'Checking for pending database migrations');
  logger.info('Database migrations completed successfully');
};


