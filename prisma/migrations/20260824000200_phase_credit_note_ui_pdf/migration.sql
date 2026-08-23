CREATE TABLE `credit_note_number_series` (
  `id` CHAR(36) NOT NULL,
  `organisation_id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NULL,
  `name` VARCHAR(120) NOT NULL,
  `pattern` VARCHAR(120) NOT NULL,
  `prefix` VARCHAR(40) NULL,
  `padding` INTEGER NOT NULL DEFAULT 4,
  `starting_number` INTEGER NOT NULL DEFAULT 1,
  `next_sequence` INTEGER NOT NULL DEFAULT 1,
  `reset_rule` ENUM('never', 'calendar_year', 'financial_year') NOT NULL DEFAULT 'financial_year',
  `last_reset_key` VARCHAR(20) NULL,
  `is_default` BOOLEAN NOT NULL DEFAULT false,
  `is_active` BOOLEAN NOT NULL DEFAULT true,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  PRIMARY KEY (`id`),
  INDEX `credit_note_number_series_organisation_company_active_idx` (`organisation_id`, `company_id`, `is_active`),
  INDEX `credit_note_number_series_organisation_default_idx` (`organisation_id`, `is_default`),

  CONSTRAINT `credit_note_number_series_organisation_id_fkey`
    FOREIGN KEY (`organisation_id`) REFERENCES `organisations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `credit_note_number_series_company_id_fkey`
    FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `credit_notes`
  ADD COLUMN `series_id` CHAR(36) NULL,
  ADD COLUMN `sequence_number` INTEGER NULL,
  ADD COLUMN `financial_year` VARCHAR(20) NULL,
  ADD COLUMN `issued_by_id` CHAR(36) NULL,
  ADD COLUMN `issued_at` DATETIME(3) NULL,
  ADD INDEX `credit_notes_series_id_idx` (`series_id`),
  ADD INDEX `credit_notes_issued_by_id_idx` (`issued_by_id`),
  ADD CONSTRAINT `credit_notes_series_id_fkey`
    FOREIGN KEY (`series_id`) REFERENCES `credit_note_number_series`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `credit_notes_issued_by_id_fkey`
    FOREIGN KEY (`issued_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE `credit_note_lines` (
  `id` CHAR(36) NOT NULL,
  `organisation_id` CHAR(36) NOT NULL,
  `credit_note_id` CHAR(36) NOT NULL,
  `invoice_item_id` CHAR(36) NULL,
  `sort_order` INTEGER NOT NULL,
  `sku` VARCHAR(80) NULL,
  `description` TEXT NOT NULL,
  `hsn_sac` VARCHAR(20) NULL,
  `quantity` DECIMAL(18, 4) NOT NULL,
  `unit_code` VARCHAR(20) NULL,
  `rate` DECIMAL(18, 4) NOT NULL,
  `discount_amount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `taxable_amount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `gst_rate` DECIMAL(7, 4) NOT NULL DEFAULT 0,
  `igst_amount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `cgst_amount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `sgst_amount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `line_total` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  PRIMARY KEY (`id`),
  INDEX `credit_note_lines_organisation_credit_note_sort_idx` (`organisation_id`, `credit_note_id`, `sort_order`),
  INDEX `credit_note_lines_organisation_invoice_item_idx` (`organisation_id`, `invoice_item_id`),

  CONSTRAINT `credit_note_lines_organisation_id_fkey`
    FOREIGN KEY (`organisation_id`) REFERENCES `organisations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `credit_note_lines_credit_note_id_fkey`
    FOREIGN KEY (`credit_note_id`) REFERENCES `credit_notes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `credit_note_lines_invoice_item_id_fkey`
    FOREIGN KEY (`invoice_item_id`) REFERENCES `invoice_items`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `generated_documents`
  ADD COLUMN `credit_note_id` CHAR(36) NULL,
  ADD INDEX `generated_documents_organisation_credit_note_idx` (`organisation_id`, `credit_note_id`),
  ADD CONSTRAINT `generated_documents_credit_note_id_fkey`
    FOREIGN KEY (`credit_note_id`) REFERENCES `credit_notes`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
