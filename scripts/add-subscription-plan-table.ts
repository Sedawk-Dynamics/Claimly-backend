import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('Adding SubscriptionPlan table...');

    // Create SubscriptionPlan table
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS \`SubscriptionPlan\` (
        \`id\` BIGINT NOT NULL AUTO_INCREMENT,
        \`name\` VARCHAR(191) NOT NULL,
        \`price\` DECIMAL(10, 2) NOT NULL,
        \`features\` TEXT NOT NULL,
        \`is_popular\` BOOLEAN NOT NULL DEFAULT false,
        \`status\` ENUM('ACTIVE', 'INACTIVE', 'DRAFT', 'REJECTED') NOT NULL DEFAULT 'ACTIVE',
        \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        \`updated_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (\`id\`),
        UNIQUE INDEX \`SubscriptionPlan_name_key\`(\`name\`)
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
    `;

    console.log('✅ SubscriptionPlan table created successfully');

    // Insert default plans
    const defaultPlans = [
      {
        name: 'Basic',
        price: 3.00,
        features: JSON.stringify([
          'Manage up to 5 policies',
          'Add up to 3 nominees',
          'Document storage',
          'Email support',
        ]),
        is_popular: false,
        status: 'ACTIVE',
      },
      {
        name: 'Premium',
        price: 5.00,
        features: JSON.stringify([
          'Unlimited policies',
          'Unlimited nominees',
          'Document storage',
          'Priority support',
          'Advanced analytics',
        ]),
        is_popular: true,
        status: 'ACTIVE',
      },
    ];

    for (const plan of defaultPlans) {
      try {
        await prisma.$executeRaw`
          INSERT INTO \`SubscriptionPlan\` (\`name\`, \`price\`, \`features\`, \`is_popular\`, \`status\`)
          VALUES (${plan.name}, ${plan.price}, ${plan.features}, ${plan.is_popular}, ${plan.status})
          ON DUPLICATE KEY UPDATE
            \`price\` = VALUES(\`price\`),
            \`features\` = VALUES(\`features\`),
            \`is_popular\` = VALUES(\`is_popular\`),
            \`status\` = VALUES(\`status\`);
        `;
        console.log(`✅ Plan "${plan.name}" inserted/updated`);
      } catch (error: any) {
        console.error(`❌ Error inserting plan "${plan.name}":`, error.message);
      }
    }

    console.log('✅ Default subscription plans created successfully');
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
