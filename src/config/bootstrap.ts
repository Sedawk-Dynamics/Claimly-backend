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
      SELECT TABLE_NAME as tableName
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'Admin'
    `;

    if (result.length > 0) {
      return;
    }

    logger.warn('Admin table missing. Creating table automatically.');

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS \`Admin\` (
        \`id\` BIGINT NOT NULL AUTO_INCREMENT,
        \`name\` VARCHAR(191) NOT NULL,
        \`email\` VARCHAR(191) NOT NULL,
        \`password_hash\` VARCHAR(191) NOT NULL,
        \`role\` ENUM('SUPER_ADMIN', 'STAFF') NOT NULL DEFAULT 'STAFF',
        \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        \`updated_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        UNIQUE INDEX \`Admin_email_key\`(\`email\`),
        PRIMARY KEY (\`id\`)
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
    `);

    const adminActionTable = await prisma.$queryRaw<Array<{ tableName: string }>>`
      SELECT TABLE_NAME as tableName
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'AdminAction'
    `;

    if (adminActionTable.length > 0) {
      const adminActionConstraint = await prisma.$queryRaw<Array<{ constraintName: string }>>`
        SELECT CONSTRAINT_NAME as constraintName
        FROM information_schema.REFERENTIAL_CONSTRAINTS
        WHERE CONSTRAINT_SCHEMA = DATABASE()
          AND CONSTRAINT_NAME = 'AdminAction_admin_id_fkey'
      `;

      if (adminActionConstraint.length === 0) {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE \`AdminAction\`
        ADD CONSTRAINT \`AdminAction_admin_id_fkey\`
        FOREIGN KEY (\`admin_id\`) REFERENCES \`Admin\`(\`id\`)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
      `);
      }
    }

    const deceasedAlertTable = await prisma.$queryRaw<Array<{ tableName: string }>>`
      SELECT TABLE_NAME as tableName
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'DeceasedAlert'
    `;

    if (deceasedAlertTable.length > 0) {
      const deceasedConstraint = await prisma.$queryRaw<Array<{ constraintName: string }>>`
        SELECT CONSTRAINT_NAME as constraintName
        FROM information_schema.REFERENTIAL_CONSTRAINTS
        WHERE CONSTRAINT_SCHEMA = DATABASE()
          AND CONSTRAINT_NAME = 'DeceasedAlert_verified_by_fkey'
      `;

      if (deceasedConstraint.length === 0) {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE \`DeceasedAlert\`
        ADD CONSTRAINT \`DeceasedAlert_verified_by_fkey\`
        FOREIGN KEY (\`verified_by\`) REFERENCES \`Admin\`(\`id\`)
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

