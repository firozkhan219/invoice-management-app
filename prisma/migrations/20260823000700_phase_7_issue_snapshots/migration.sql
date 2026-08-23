-- AlterTable
ALTER TABLE `invoices`
  ADD COLUMN `series_id` CHAR(36) NULL,
  ADD COLUMN `sequence_number` INTEGER NULL,
  ADD COLUMN `financial_year` VARCHAR(20) NULL,
  ADD COLUMN `company_snapshot` JSON NULL,
  ADD COLUMN `buyer_snapshot` JSON NULL,
  ADD COLUMN `consignee_snapshot` JSON NULL,
  ADD COLUMN `bank_snapshot` JSON NULL,
  ADD COLUMN `calculation_snapshot` JSON NULL,
  ADD COLUMN `document_snapshot` JSON NULL,
  ADD COLUMN `issued_by_id` CHAR(36) NULL,
  ADD COLUMN `issued_at` DATETIME(3) NULL,
  ADD COLUMN `cancelled_by_id` CHAR(36) NULL,
  ADD COLUMN `cancelled_at` DATETIME(3) NULL,
  ADD COLUMN `cancellation_reason` TEXT NULL;

-- CreateTable
CREATE TABLE `invoice_revisions` (
    `id` CHAR(36) NOT NULL,
    `organisation_id` CHAR(36) NOT NULL,
    `invoice_id` CHAR(36) NOT NULL,
    `revision_number` INTEGER NOT NULL,
    `reason` TEXT NOT NULL,
    `snapshot` JSON NOT NULL,
    `created_by_id` CHAR(36) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `invoice_revisions_invoice_id_revision_number_key`(`invoice_id`, `revision_number`),
    INDEX `invoice_revisions_organisation_id_invoice_id_idx`(`organisation_id`, `invoice_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `generated_documents` (
    `id` CHAR(36) NOT NULL,
    `organisation_id` CHAR(36) NOT NULL,
    `invoice_id` CHAR(36) NOT NULL,
    `document_type` VARCHAR(40) NOT NULL,
    `template_version` VARCHAR(40) NOT NULL,
    `storage_key` VARCHAR(255) NULL,
    `checksum_sha256` CHAR(64) NULL,
    `generated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `generated_by_id` CHAR(36) NOT NULL,

    INDEX `generated_documents_organisation_id_invoice_id_idx`(`organisation_id`, `invoice_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `invoices` ADD CONSTRAINT `invoices_series_id_fkey` FOREIGN KEY (`series_id`) REFERENCES `invoice_number_series`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `invoices` ADD CONSTRAINT `invoices_issued_by_id_fkey` FOREIGN KEY (`issued_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `invoices` ADD CONSTRAINT `invoices_cancelled_by_id_fkey` FOREIGN KEY (`cancelled_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invoice_revisions` ADD CONSTRAINT `invoice_revisions_organisation_id_fkey` FOREIGN KEY (`organisation_id`) REFERENCES `organisations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `invoice_revisions` ADD CONSTRAINT `invoice_revisions_invoice_id_fkey` FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `invoice_revisions` ADD CONSTRAINT `invoice_revisions_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `generated_documents` ADD CONSTRAINT `generated_documents_organisation_id_fkey` FOREIGN KEY (`organisation_id`) REFERENCES `organisations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `generated_documents` ADD CONSTRAINT `generated_documents_invoice_id_fkey` FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `generated_documents` ADD CONSTRAINT `generated_documents_generated_by_id_fkey` FOREIGN KEY (`generated_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
