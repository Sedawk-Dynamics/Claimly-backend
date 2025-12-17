/*
  Warnings:

  - A unique constraint covering the columns `[referral_code]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE `user` ADD COLUMN `referral_code` VARCHAR(191) NULL,
    ADD COLUMN `referred_by` BIGINT NULL;

-- CreateIndex
CREATE UNIQUE INDEX `User_referral_code_key` ON `User`(`referral_code`);

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `User_referred_by_fkey` FOREIGN KEY (`referred_by`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
