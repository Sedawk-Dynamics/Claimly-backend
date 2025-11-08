-- Rename firebase_uid to firebase_id
ALTER TABLE `User` CHANGE COLUMN `firebase_uid` `firebase_id` VARCHAR(191) NOT NULL;

-- Drop old unique index and create new one
DROP INDEX `User_firebase_uid_key` ON `User`;
CREATE UNIQUE INDEX `User_firebase_id_key` ON `User`(`firebase_id`);

-- Update sum_assured precision from DECIMAL(15,2) to DECIMAL(13,2)
ALTER TABLE `Policy` MODIFY COLUMN `sum_assured` DECIMAL(13, 2) NOT NULL;

