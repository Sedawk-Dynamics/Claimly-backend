import bcrypt from 'bcrypt';
import logger from './logger';
import prisma from './prismaClient';

const DEFAULT_ADMIN_EMAIL = 'admin@claimly.com';
const DEFAULT_ADMIN_PASSWORD ='Claimly@123';
const DEFAULT_ADMIN_NAME ='Admin User';
const DEFAULT_ADMIN_ROLE = 'SUPER_ADMIN';

export const ensureDefaultAdmin = async (): Promise<void> => {
  if (!DEFAULT_ADMIN_EMAIL || !DEFAULT_ADMIN_PASSWORD) {
    logger.warn('Default admin credentials not provided. Skipping bootstrap admin creation.');
    return;
  }

  try {
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
  } catch (error) {
    logger.error('Failed to ensure default admin exists', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

