import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('Fixing subscription plan dates...');

    // Update all subscription plans with valid dates
    await prisma.$executeRaw`
      UPDATE \`SubscriptionPlan\`
      SET 
        \`created_at\` = COALESCE(\`created_at\`, CURRENT_TIMESTAMP(3)),
        \`updated_at\` = CURRENT_TIMESTAMP(3)
      WHERE 
        \`created_at\` IS NULL 
        OR \`updated_at\` IS NULL
        OR \`created_at\` = '0000-00-00 00:00:00.000'
        OR \`updated_at\` = '0000-00-00 00:00:00.000';
    `;

    console.log('✅ Subscription plan dates fixed successfully');
    
    // Verify the fix
    const plans = await prisma.subscriptionPlan.findMany();
    console.log(`✅ Found ${plans.length} subscription plans`);
    
    for (const plan of plans) {
      console.log(`  - ${plan.name}: created_at=${plan.created_at}, updated_at=${plan.updated_at}`);
    }
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
