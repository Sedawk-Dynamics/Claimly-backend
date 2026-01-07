import { PrismaClient } from '@prisma/client';

// Declare Node's process to avoid needing @types/node for this simple script
declare const process: any;

const prisma = new PrismaClient();

// Keep in sync with SUBSCRIPTION_VALIDITY_DAYS in src/services/subscription.service.ts
// Use a very large value so subscriptions are effectively lifetime
const SUBSCRIPTION_VALIDITY_DAYS = 365 * 110; // ~110 years (treated as lifetime)

async function backfillSubscriptionExpiry() {
  try {
    console.log('🔍 Finding subscriptions with missing expiry dates...');

    const subscriptionsWithoutExpiry = await prisma.subscription.findMany({
      where: {
        expires_at: null,
        payment_status: 'SUCCESS', // Only process successful subscriptions
      },
      include: {
        user: {
          select: {
            subscription_status: true,
          },
        },
      },
      orderBy: {
        transaction_date: 'asc',
      },
    });

    console.log(`📊 Found ${subscriptionsWithoutExpiry.length} subscriptions without expiry dates`);

    if (subscriptionsWithoutExpiry.length === 0) {
      console.log('✅ All subscriptions already have expiry dates.');
      return;
    }

    // Group subscriptions by user_id to process them in order
    const subscriptionsByUser = new Map<string, typeof subscriptionsWithoutExpiry>();

    for (const sub of subscriptionsWithoutExpiry) {
      const userId = sub.user_id.toString();
      if (!subscriptionsByUser.has(userId)) {
        subscriptionsByUser.set(userId, []);
      }
      subscriptionsByUser.get(userId)!.push(sub);
    }

    let successCount = 0;
    let errorCount = 0;

    // Process each user's subscriptions in chronological order
    for (const [userId, userSubscriptions] of subscriptionsByUser) {
      // Sort by transaction_date to process oldest first
      userSubscriptions.sort((a, b) => 
        a.transaction_date.getTime() - b.transaction_date.getTime()
      );

      let currentExpiry: Date | null = null;

      for (const sub of userSubscriptions) {
        try {
          let expiresAt: Date;

          if (currentExpiry && currentExpiry > sub.transaction_date) {
            // Extend from current expiry if subscription was purchased before current expiry
            expiresAt = new Date(currentExpiry);
            expiresAt.setDate(expiresAt.getDate() + SUBSCRIPTION_VALIDITY_DAYS);
          } else {
            // Start fresh from transaction date
            expiresAt = new Date(sub.transaction_date);
            expiresAt.setDate(expiresAt.getDate() + SUBSCRIPTION_VALIDITY_DAYS);
          }

          // Update the subscription
          await prisma.subscription.update({
            where: { id: sub.id },
            data: { expires_at: expiresAt },
          });

          currentExpiry = expiresAt; // Update current expiry for next subscription
          successCount++;

          console.log(
            `✅ Updated subscription ${sub.id.toString()} for user ${userId}: expires ${expiresAt.toLocaleDateString()}`
          );
        } catch (error: any) {
          console.error(`❌ Error updating subscription ${sub.id.toString()}:`, error.message);
          errorCount++;
        }
      }
    }

    console.log('\n📊 Summary:');
    console.log(`✅ Success: ${successCount} subscriptions updated`);
    console.log(`❌ Errors: ${errorCount} subscriptions`);
    console.log('🎉 Backfill complete!');
  } catch (error: any) {
    console.error('❌ Backfill failed:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

backfillSubscriptionExpiry();

