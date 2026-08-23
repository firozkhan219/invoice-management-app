-- CreateTable
CREATE TABLE `organisation_settings` (
    `id` CHAR(36) NOT NULL,
    `organisation_id` CHAR(36) NOT NULL,
    `default_company_id` CHAR(36) NULL,
    `default_bank_account_id` CHAR(36) NULL,
    `default_invoice_title` VARCHAR(120) NOT NULL DEFAULT 'Tax Invoice',
    `default_tax_mode` ENUM('automatic', 'igst', 'cgst_sgst', 'zero_rated_export', 'no_tax') NOT NULL DEFAULT 'automatic',
    `rounding_policy` ENUM('none', 'nearest_rupee', 'two_decimals') NOT NULL DEFAULT 'nearest_rupee',
    `default_declaration` TEXT NULL,
    `default_notes` TEXT NULL,
    `payment_terms` TEXT NULL,
    `delivery_terms` TEXT NULL,
    `pdf_footer` TEXT NULL,
    `show_page_numbers` BOOLEAN NOT NULL DEFAULT true,
    `draft_autosave` BOOLEAN NOT NULL DEFAULT true,
    `number_on_issue` BOOLEAN NOT NULL DEFAULT true,
    `allow_manual_number_override` BOOLEAN NOT NULL DEFAULT false,
    `allow_manual_date_override` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `organisation_settings_organisation_id_key`(`organisation_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `locked_periods` (
    `id` CHAR(36) NOT NULL,
    `organisation_id` CHAR(36) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `starts_on` DATE NOT NULL,
    `ends_on` DATE NOT NULL,
    `reason` TEXT NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_by_id` CHAR(36) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `locked_periods_organisation_id_starts_on_ends_on_idx`(`organisation_id`, `starts_on`, `ends_on`),
    INDEX `locked_periods_organisation_id_is_active_idx`(`organisation_id`, `is_active`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `invoice_number_series` (
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

    INDEX `invoice_number_series_organisation_id_company_id_is_active_idx`(`organisation_id`, `company_id`, `is_active`),
    INDEX `invoice_number_series_organisation_id_is_default_idx`(`organisation_id`, `is_default`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `invoice_number_voids` (
    `id` CHAR(36) NOT NULL,
    `organisation_id` CHAR(36) NOT NULL,
    `series_id` CHAR(36) NOT NULL,
    `sequence_number` INTEGER NOT NULL,
    `invoice_number` VARCHAR(120) NOT NULL,
    `reason` TEXT NOT NULL,
    `created_by_id` CHAR(36) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `invoice_number_voids_organisation_id_invoice_number_key`(`organisation_id`, `invoice_number`),
    UNIQUE INDEX `invoice_number_voids_series_id_sequence_number_key`(`series_id`, `sequence_number`),
    INDEX `invoice_number_voids_organisation_id_created_at_idx`(`organisation_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `organisation_settings` ADD CONSTRAINT `organisation_settings_organisation_id_fkey` FOREIGN KEY (`organisation_id`) REFERENCES `organisations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `organisation_settings` ADD CONSTRAINT `organisation_settings_default_company_id_fkey` FOREIGN KEY (`default_company_id`) REFERENCES `companies`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `organisation_settings` ADD CONSTRAINT `organisation_settings_default_bank_account_id_fkey` FOREIGN KEY (`default_bank_account_id`) REFERENCES `company_bank_accounts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `locked_periods` ADD CONSTRAINT `locked_periods_organisation_id_fkey` FOREIGN KEY (`organisation_id`) REFERENCES `organisations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `locked_periods` ADD CONSTRAINT `locked_periods_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invoice_number_series` ADD CONSTRAINT `invoice_number_series_organisation_id_fkey` FOREIGN KEY (`organisation_id`) REFERENCES `organisations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invoice_number_series` ADD CONSTRAINT `invoice_number_series_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invoice_number_voids` ADD CONSTRAINT `invoice_number_voids_organisation_id_fkey` FOREIGN KEY (`organisation_id`) REFERENCES `organisations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invoice_number_voids` ADD CONSTRAINT `invoice_number_voids_series_id_fkey` FOREIGN KEY (`series_id`) REFERENCES `invoice_number_series`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invoice_number_voids` ADD CONSTRAINT `invoice_number_voids_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
