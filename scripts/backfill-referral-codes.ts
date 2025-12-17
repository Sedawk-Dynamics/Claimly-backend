/**
 * Backfill referral codes for existing users who don't have one
 * Run this script after running the migration to add referral_code field
 * 
 * Usage: ts-node scripts/backfill-referral-codes.ts
 */

import { PrismaClient } from '@prisma/client';
import { generateReferralCode } from '../src/utils/referral';

const prisma = new PrismaClient();

async function backfillReferralCodes() {
  try {
    console.log('🔍 Finding users without referral codes...');
    
    const usersWithoutCodes = await prisma.user.findMany({
      where: {
        referral_code: null,
      },
    });

    console.log(`📊 Found ${usersWithoutCodes.length} users without referral codes`);

    if (usersWithoutCodes.length === 0) {
      console.log('✅ All users already have referral codes!');
      return;
    }

    let successCount = 0;
    let errorCount = 0;

    for (const user of usersWithoutCodes) {
      try {
        // Generate unique referral code
        let referralCode: string;
        let isUnique = false;
        let attempts = 0;
        const maxAttempts = 10;

        while (!isUnique && attempts < maxAttempts) {
          referralCode = generateReferralCode();
          const existingCode = await prisma.user.findUnique({
            where: { referral_code: referralCode },
          });

          if (!existingCode) {
            isUnique = true;
          } else {
            attempts++;
          }
        }

        if (!isUnique) {
          console.error(`❌ Failed to generate unique code for user ${user.id.toString()}`);
          errorCount++;
          continue;
        }

        // Set expiration to 30 days from now
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30);

        // Update user with referral code and expiration
        await prisma.user.update({
          where: { id: user.id },
          data: { 
            referral_code: referralCode!,
            referral_code_expires_at: expiresAt,
          },
        });

        successCount++;
        console.log(`✅ Generated referral code ${referralCode!} (expires: ${expiresAt.toLocaleDateString()}) for user ${user.id.toString()} (${user.name})`);
      } catch (error: any) {
        console.error(`❌ Error updating user ${user.id.toString()}:`, error.message);
        errorCount++;
      }
    }

    console.log('\n📊 Summary:');
    console.log(`✅ Success: ${successCount} users`);
    console.log(`❌ Errors: ${errorCount} users`);
    console.log('🎉 Backfill complete!');
  } catch (error: any) {
    console.error('❌ Backfill failed:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

backfillReferralCodes();

