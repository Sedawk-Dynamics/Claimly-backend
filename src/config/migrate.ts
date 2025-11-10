import { exec } from 'child_process';
import logger from './logger';

const MIGRATE_COMMAND = 'npx prisma migrate deploy --schema=./src/prisma/schema.prisma';

export const runDatabaseMigrations = async (): Promise<void> => {
  logger.info('Checking for pending database migrations');

  await new Promise<void>((resolve, reject) => {
    const migrateProcess = exec(
      MIGRATE_COMMAND,
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
          logger.error('Database migration failed', {
            error: error.message,
          });
          reject(error);
          return;
        }

        resolve();
      }
    );

    migrateProcess.on('error', (error) => {
      logger.error('Failed to spawn migration process', {
        error: error.message,
      });
      reject(error);
    });
  });

  logger.info('Database migrations completed successfully');
};


