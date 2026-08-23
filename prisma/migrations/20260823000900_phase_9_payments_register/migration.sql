-- AlterEnumLikeColumn
ALTER TABLE `invoices`
  MODIFY `status` ENUM('draft', 'issued', 'partially_paid', 'paid', 'cancelled', 'amended') NOT NULL DEFAULT 'draft';

-- AlterTable
ALTER TABLE `invoices`
  ADD COLUMN `paid_total` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  ADD COLUMN `balance_due` DECIMAL(18, 4) NOT NULL DEFAULT 0;

-- Backfill existing issued invoice balances.
UPDATE `invoices`
SET `balance_due` = `grand_total`
WHERE `status` IN ('issued', 'partially_paid', 'paid');

-- CreateTable
CREATE TABLE `payments` (
    `id` CHAR(36) NOT NULL,
    `organisation_id` CHAR(36) NOT NULL,
    `payment_date` DATE NOT NULL,
    `amount` DECIMAL(18, 4) NOT NULL,
    `currency` CHAR(3) NOT NULL DEFAULT 'INR',
    `payment_method` VARCHAR(80) NOT NULL,
    `reference_number` VARCHAR(160) NULL,
    `bank_account_id` CHAR(36) NULL,
    `notes` TEXT NULL,
    `status` ENUM('posted', 'reversed') NOT NULL DEFAULT 'posted',
    `idempotency_key` VARCHAR(120) NULL,
    `created_by_id` CHAR(36) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `reversed_by_id` CHAR(36) NULL,
    `reversed_at` DATETIME(3) NULL,
    `reversal_reason` TEXT NULL,

    UNIQUE INDEX `payments_organisation_id_idempotency_key_key`(`organisation_id`, `idempotency_key`),
    INDEX `payments_organisation_id_payment_date_idx`(`organisation_id`, `payment_date`),
    INDEX `payments_organisation_id_status_idx`(`organisation_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payment_allocations` (
    `id` CHAR(36) NOT NULL,
    `organisation_id` CHAR(36) NOT NULL,
    `payment_id` CHAR(36) NOT NULL,
    `invoice_id` CHAR(36) NOT NULL,
    `amount` DECIMAL(18, 4) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `payment_allocations_payment_id_invoice_id_key`(`payment_id`, `invoice_id`),
    INDEX `payment_allocations_organisation_id_invoice_id_idx`(`organisation_id`, `invoice_id`),
    INDEX `payment_allocations_organisation_id_payment_id_idx`(`organisation_id`, `payment_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `payments` ADD CONSTRAINT `payments_organisation_id_fkey` FOREIGN KEY (`organisation_id`) REFERENCES `organisations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `payments` ADD CONSTRAINT `payments_bank_account_id_fkey` FOREIGN KEY (`bank_account_id`) REFERENCES `company_bank_accounts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `payments` ADD CONSTRAINT `payments_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `payments` ADD CONSTRAINT `payments_reversed_by_id_fkey` FOREIGN KEY (`reversed_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_allocations` ADD CONSTRAINT `payment_allocations_organisation_id_fkey` FOREIGN KEY (`organisation_id`) REFERENCES `organisations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `payment_allocations` ADD CONSTRAINT `payment_allocations_payment_id_fkey` FOREIGN KEY (`payment_id`) REFERENCES `payments`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `payment_allocations` ADD CONSTRAINT `payment_allocations_invoice_id_fkey` FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
