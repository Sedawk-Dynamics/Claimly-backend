-- AlterTable
ALTER TABLE `subscription` ADD COLUMN `wallet_amount_used` DECIMAL(10, 2) NULL;

-- AlterTable
ALTER TABLE `user` ADD COLUMN `wallet_balance` DECIMAL(10, 2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE `WalletTransaction` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT NOT NULL,
    `transaction_type` ENUM('REFERRAL_REWARD', 'REDEMPTION', 'REFUND') NOT NULL,
    `amount` DECIMAL(10, 2) NOT NULL,
    `description` VARCHAR(191) NOT NULL,
    `related_user_id` BIGINT NULL,
    `related_subscription_id` BIGINT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `WalletTransaction` ADD CONSTRAINT `WalletTransaction_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WalletTransaction` ADD CONSTRAINT `WalletTransaction_related_subscription_id_fkey` FOREIGN KEY (`related_subscription_id`) REFERENCES `Subscription`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
