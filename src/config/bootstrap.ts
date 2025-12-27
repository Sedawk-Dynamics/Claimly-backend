import bcrypt from 'bcrypt';
import { Prisma } from '@prisma/client';
import logger from './logger';
import prisma from './prismaClient';

const DEFAULT_ADMIN_EMAIL = 'admin@claimly.com';
const DEFAULT_ADMIN_PASSWORD ='Claimly@123';
const DEFAULT_ADMIN_NAME ='Admin User';
const DEFAULT_ADMIN_ROLE = 'SUPER_ADMIN';

const ensureAdminTableExists = async (): Promise<void> => {
  try {
    const result = await prisma.$queryRaw<Array<{ tableName: string }>>`
      SELECT relname as "tableName"
      FROM pg_catalog.pg_class
      WHERE relnamespace = (SELECT oid FROM pg_catalog.pg_namespace WHERE nspname = 'public')
        AND relname = 'Admin'
        AND relkind = 'r'
    `;

    if (result.length > 0) {
      return;
    }

    logger.warn('Admin table missing. Creating table automatically.');

    // Create AdminRole enum type if it doesn't exist
    await prisma.$executeRawUnsafe(`
      DO $$ BEGIN
        CREATE TYPE "AdminRole" AS ENUM ('SUPER_ADMIN', 'STAFF');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Admin" (
        "id" BIGSERIAL NOT NULL,
        "name" VARCHAR(191) NOT NULL,
        "email" VARCHAR(191) NOT NULL,
        "password_hash" VARCHAR(191) NOT NULL,
        "role" "AdminRole" NOT NULL DEFAULT 'STAFF',
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "Admin_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "Admin_email_key" UNIQUE ("email")
      );
    `);

    // Create trigger to update updated_at timestamp
    await prisma.$executeRawUnsafe(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW."updated_at" = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ language 'plpgsql';

      DROP TRIGGER IF EXISTS update_admin_updated_at ON "Admin";
      CREATE TRIGGER update_admin_updated_at
        BEFORE UPDATE ON "Admin"
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    `);

    const adminActionTable = await prisma.$queryRaw<Array<{ tableName: string }>>`
      SELECT relname as "tableName"
      FROM pg_catalog.pg_class
      WHERE relnamespace = (SELECT oid FROM pg_catalog.pg_namespace WHERE nspname = 'public')
        AND relname = 'AdminAction'
        AND relkind = 'r'
    `;

    if (adminActionTable.length > 0) {
      const adminActionConstraint = await prisma.$queryRaw<Array<{ constraintName: string }>>`
        SELECT conname as "constraintName"
        FROM pg_catalog.pg_constraint
        WHERE connamespace = (SELECT oid FROM pg_catalog.pg_namespace WHERE nspname = 'public')
          AND conname = 'AdminAction_admin_id_fkey'
      `;

      if (adminActionConstraint.length === 0) {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "AdminAction"
        ADD CONSTRAINT "AdminAction_admin_id_fkey"
        FOREIGN KEY ("admin_id") REFERENCES "Admin"("id")
        ON DELETE RESTRICT
        ON UPDATE CASCADE
      `);
      }
    }

    const deceasedAlertTable = await prisma.$queryRaw<Array<{ tableName: string }>>`
      SELECT relname as "tableName"
      FROM pg_catalog.pg_class
      WHERE relnamespace = (SELECT oid FROM pg_catalog.pg_namespace WHERE nspname = 'public')
        AND relname = 'DeceasedAlert'
        AND relkind = 'r'
    `;

    if (deceasedAlertTable.length > 0) {
      const deceasedConstraint = await prisma.$queryRaw<Array<{ constraintName: string }>>`
        SELECT conname as "constraintName"
        FROM pg_catalog.pg_constraint
        WHERE connamespace = (SELECT oid FROM pg_catalog.pg_namespace WHERE nspname = 'public')
          AND conname = 'DeceasedAlert_verified_by_fkey'
      `;

      if (deceasedConstraint.length === 0) {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "DeceasedAlert"
        ADD CONSTRAINT "DeceasedAlert_verified_by_fkey"
        FOREIGN KEY ("verified_by") REFERENCES "Admin"("id")
        ON DELETE SET NULL
        ON UPDATE CASCADE
      `);
      }
    }

    logger.info('Admin table created successfully via bootstrap');
  } catch (error) {
    logger.error('Failed to verify or create Admin table', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
};

export const ensureDefaultAdmin = async (): Promise<void> => {
  if (!DEFAULT_ADMIN_EMAIL || !DEFAULT_ADMIN_PASSWORD) {
    logger.warn('Default admin credentials not provided. Skipping bootstrap admin creation.');
    return;
  }

  const createDefaultAdmin = async () => {
    const existingAdmin = await prisma.admin.findUnique({
      where: { email: DEFAULT_ADMIN_EMAIL },
    });

    if (existingAdmin) {
      logger.info('Default admin already exists', {
        adminId: existingAdmin.id.toString(),
        email: existingAdmin.email,
      });
      return;
    }

    const passwordHash = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, 10);

    const admin = await prisma.admin.create({
      data: {
        email: DEFAULT_ADMIN_EMAIL,
        name: DEFAULT_ADMIN_NAME,
        password_hash: passwordHash,
        role: DEFAULT_ADMIN_ROLE,
      },
    });

    logger.info('Default admin created successfully', {
      adminId: admin.id.toString(),
      email: admin.email,
      role: admin.role,
    });
  };

  try {
    await ensureAdminTableExists();
    await createDefaultAdmin();
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2021') {
      logger.warn('Admin table still missing after initial attempt. Retrying creation.');
      await ensureAdminTableExists();
      await createDefaultAdmin();
      return;
    }

    logger.error('Failed to ensure default admin exists', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

