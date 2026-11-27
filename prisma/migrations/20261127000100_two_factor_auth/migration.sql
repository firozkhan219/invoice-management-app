-- AlterTable
ALTER TABLE `users` ADD COLUMN `totp_enabled_at` DATETIME(3) NULL,
    ADD COLUMN `totp_last_step` INTEGER NULL,
    ADD COLUMN `totp_recovery_codes` JSON NULL,
    ADD COLUMN `totp_secret` JSON NULL;

