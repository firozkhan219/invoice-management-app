-- CreateTable
CREATE TABLE `buyers` (
    `id` CHAR(36) NOT NULL,
    `organisation_id` CHAR(36) NOT NULL,
    `display_name` VARCHAR(180) NOT NULL,
    `legal_name` VARCHAR(180) NULL,
    `contact_person` VARCHAR(160) NULL,
    `phone` VARCHAR(40) NULL,
    `email` VARCHAR(320) NULL,
    `gstin` VARCHAR(15) NULL,
    `pan` VARCHAR(10) NULL,
    `iec` VARCHAR(20) NULL,
    `customer_reference` VARCHAR(80) NULL,
    `tax_identifiers` JSON NULL,
    `notes` TEXT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `buyers_organisation_id_is_active_idx`(`organisation_id`, `is_active`),
    INDEX `buyers_organisation_id_display_name_idx`(`organisation_id`, `display_name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `buyer_addresses` (
    `id` CHAR(36) NOT NULL,
    `organisation_id` CHAR(36) NOT NULL,
    `buyer_id` CHAR(36) NOT NULL,
    `label` VARCHAR(120) NOT NULL,
    `contact_person` VARCHAR(160) NULL,
    `phone` VARCHAR(40) NULL,
    `email` VARCHAR(320) NULL,
    `address_line_1` VARCHAR(180) NOT NULL,
    `address_line_2` VARCHAR(180) NULL,
    `city` VARCHAR(100) NOT NULL,
    `state` VARCHAR(100) NOT NULL,
    `state_code` VARCHAR(10) NULL,
    `postcode` VARCHAR(20) NOT NULL,
    `country` VARCHAR(80) NOT NULL DEFAULT 'India',
    `is_billing_default` BOOLEAN NOT NULL DEFAULT false,
    `is_shipping_default` BOOLEAN NOT NULL DEFAULT false,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `buyer_addresses_organisation_id_buyer_id_is_active_idx`(`organisation_id`, `buyer_id`, `is_active`),
    INDEX `buyer_addresses_organisation_id_buyer_id_is_billing_default_idx`(`organisation_id`, `buyer_id`, `is_billing_default`),
    INDEX `buyer_addresses_organisation_id_buyer_id_is_shipping_default_idx`(`organisation_id`, `buyer_id`, `is_shipping_default`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `buyers` ADD CONSTRAINT `buyers_organisation_id_fkey` FOREIGN KEY (`organisation_id`) REFERENCES `organisations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `buyer_addresses` ADD CONSTRAINT `buyer_addresses_organisation_id_fkey` FOREIGN KEY (`organisation_id`) REFERENCES `organisations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `buyer_addresses` ADD CONSTRAINT `buyer_addresses_buyer_id_fkey` FOREIGN KEY (`buyer_id`) REFERENCES `buyers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
