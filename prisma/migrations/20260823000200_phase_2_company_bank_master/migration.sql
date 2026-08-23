-- CreateTable
CREATE TABLE `companies` (
    `id` CHAR(36) NOT NULL,
    `organisation_id` CHAR(36) NOT NULL,
    `legal_name` VARCHAR(180) NOT NULL,
    `trading_name` VARCHAR(180) NULL,
    `address_line_1` VARCHAR(180) NOT NULL,
    `address_line_2` VARCHAR(180) NULL,
    `city` VARCHAR(100) NOT NULL,
    `state` VARCHAR(100) NOT NULL,
    `state_code` VARCHAR(10) NULL,
    `postcode` VARCHAR(20) NOT NULL,
    `country` VARCHAR(80) NOT NULL DEFAULT 'India',
    `phone` VARCHAR(40) NULL,
    `email` VARCHAR(320) NULL,
    `gstin` VARCHAR(15) NULL,
    `pan` VARCHAR(10) NULL,
    `iec` VARCHAR(20) NULL,
    `tax_identifiers` JSON NULL,
    `logo_asset_id` CHAR(36) NULL,
    `signature_asset_id` CHAR(36) NULL,
    `signatory_name` VARCHAR(160) NULL,
    `signatory_designation` VARCHAR(120) NULL,
    `default_declaration` TEXT NULL,
    `default_terms` TEXT NULL,
    `is_default` BOOLEAN NOT NULL DEFAULT false,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `companies_organisation_id_is_active_idx`(`organisation_id`, `is_active`),
    INDEX `companies_organisation_id_is_default_idx`(`organisation_id`, `is_default`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `company_bank_accounts` (
    `id` CHAR(36) NOT NULL,
    `organisation_id` CHAR(36) NOT NULL,
    `company_id` CHAR(36) NOT NULL,
    `bank_name` VARCHAR(160) NOT NULL,
    `account_holder_name` VARCHAR(180) NOT NULL,
    `account_number_ciphertext` TEXT NOT NULL,
    `account_number_iv` VARCHAR(32) NOT NULL,
    `account_number_tag` VARCHAR(32) NOT NULL,
    `account_number_last4` VARCHAR(4) NOT NULL,
    `ifsc` VARCHAR(11) NULL,
    `swift_bic` VARCHAR(20) NULL,
    `branch_code` VARCHAR(40) NULL,
    `branch_name` VARCHAR(120) NULL,
    `branch_address` TEXT NULL,
    `currency` CHAR(3) NOT NULL DEFAULT 'INR',
    `is_default` BOOLEAN NOT NULL DEFAULT false,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `company_bank_accounts_organisation_id_company_id_is_active_idx`(`organisation_id`, `company_id`, `is_active`),
    INDEX `company_bank_accounts_organisation_id_is_default_idx`(`organisation_id`, `is_default`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `companies` ADD CONSTRAINT `companies_organisation_id_fkey` FOREIGN KEY (`organisation_id`) REFERENCES `organisations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `companies` ADD CONSTRAINT `companies_logo_asset_id_fkey` FOREIGN KEY (`logo_asset_id`) REFERENCES `file_assets`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `companies` ADD CONSTRAINT `companies_signature_asset_id_fkey` FOREIGN KEY (`signature_asset_id`) REFERENCES `file_assets`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `company_bank_accounts` ADD CONSTRAINT `company_bank_accounts_organisation_id_fkey` FOREIGN KEY (`organisation_id`) REFERENCES `organisations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `company_bank_accounts` ADD CONSTRAINT `company_bank_accounts_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
