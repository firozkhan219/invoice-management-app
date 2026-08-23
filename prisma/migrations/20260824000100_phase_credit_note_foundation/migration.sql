CREATE TABLE `credit_notes` (
  `id` CHAR(36) NOT NULL,
  `organisation_id` CHAR(36) NOT NULL,
  `original_invoice_id` CHAR(36) NOT NULL,
  `status` ENUM('draft', 'issued', 'cancelled') NOT NULL DEFAULT 'draft',
  `credit_note_number` VARCHAR(120) NULL,
  `credit_note_date` DATE NOT NULL,
  `reason` TEXT NULL,
  `currency` CHAR(3) NOT NULL DEFAULT 'INR',
  `subtotal` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `taxable_total` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `igst_total` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `cgst_total` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `sgst_total` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `round_off` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `grand_total` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `original_invoice_snapshot` JSON NOT NULL,
  `created_by_id` CHAR(36) NOT NULL,
  `updated_by_id` CHAR(36) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  PRIMARY KEY (`id`),
  INDEX `credit_notes_organisation_status_credit_note_date_idx` (`organisation_id`, `status`, `credit_note_date`),
  INDEX `credit_notes_organisation_original_invoice_idx` (`organisation_id`, `original_invoice_id`),
  INDEX `credit_notes_organisation_credit_note_number_idx` (`organisation_id`, `credit_note_number`),

  CONSTRAINT `credit_notes_organisation_id_fkey`
    FOREIGN KEY (`organisation_id`) REFERENCES `organisations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `credit_notes_original_invoice_id_fkey`
    FOREIGN KEY (`original_invoice_id`) REFERENCES `invoices`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `credit_notes_created_by_id_fkey`
    FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `credit_notes_updated_by_id_fkey`
    FOREIGN KEY (`updated_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
