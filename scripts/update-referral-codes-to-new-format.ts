/**
 * Update all existing referral codes to new format (CLM + 7 characters = 10 total)
 * and set expiration date to 30 days from now if not already set
 * 
 * Usage: ts-node scripts/update-referral-codes-to-new-format.ts
 */

import { PrismaClient } from '@prisma/client';
import { generateReferralCode } from '../src/utils/referral';

const prisma = new PrismaClient();

async function updateReferralCodes() {
  try {
    console.log('🔍 Finding users with referral codes...');
    
    // Get all users with referral codes
    const usersWithCodes = await prisma.user.findMany({
      where: {
        referral_code: { not: null },
      },
      select: {
        id: true,
        name: true,
        referral_code: true,
        referral_code_expires_at: true,
      },
    });

    console.log(`📊 Found ${usersWithCodes.length} users with referral codes`);

    if (usersWithCodes.length === 0) {
      console.log('✅ No users with referral codes found!');
      return;
    }

    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const user of usersWithCodes) {
      try {
        const currentCode = user.referral_code!;
        const needsUpdate = !currentCode.startsWith('CLM') || currentCode.length !== 10;
        const needsExpiration = !user.referral_code_expires_at;

        if (!needsUpdate && !needsExpiration) {
          console.log(`⏭️  Skipping user ${user.id.toString()} (${user.name}) - code already in correct format and has expiration`);
          skippedCount++;
          continue;
        }

        let newCode = currentCode;
        
        // Generate new code if format is incorrect
        if (needsUpdate) {
          let referralCode: string | undefined;
          let isUnique = false;
          let attempts = 0;
          const maxAttempts = 10;

          while (!isUnique && attempts < maxAttempts) {
            referralCode = generateReferralCode();
            const existingCode = await prisma.user.findFirst({
              where: { 
                referral_code: referralCode,
                id: { not: user.id }, // Exclude current user
              },
            });

            if (!existingCode) {
              isUnique = true;
            } else {
              attempts++;
            }
          }

          if (!isUnique || !referralCode) {
            console.error(`❌ Failed to generate unique code for user ${user.id.toString()}`);
            errorCount++;
            continue;
          }

          newCode = referralCode;
        }

        // Set expiration to 30 days from now if not already set
        let expiresAt = user.referral_code_expires_at;
        if (!expiresAt) {
          expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + 30);
        }

        // Update user
        await prisma.user.update({
          where: { id: user.id },
          data: { 
            referral_code: newCode,
            referral_code_expires_at: expiresAt,
          },
        });

        if (needsUpdate) {
          console.log(`✅ Updated user ${user.id.toString()} (${user.name}): ${currentCode} → ${newCode}`);
        } else {
          console.log(`✅ Updated expiration for user ${user.id.toString()} (${user.name}): ${newCode}`);
        }
        updatedCount++;
      } catch (error: any) {
        console.error(`❌ Error updating user ${user.id.toString()}:`, error.message);
        errorCount++;
      }
    }

    console.log('\n📊 Summary:');
    console.log(`✅ Updated: ${updatedCount} users`);
    console.log(`⏭️  Skipped: ${skippedCount} users`);
    console.log(`❌ Errors: ${errorCount} users`);
    console.log('🎉 Update complete!');
  } catch (error: any) {
    console.error('❌ Update failed:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

updateReferralCodes();

