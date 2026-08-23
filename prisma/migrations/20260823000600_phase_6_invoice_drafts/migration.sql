-- CreateTable
CREATE TABLE `invoices` (
    `id` CHAR(36) NOT NULL,
    `organisation_id` CHAR(36) NOT NULL,
    `company_id` CHAR(36) NULL,
    `buyer_id` CHAR(36) NULL,
    `consignee_buyer_id` CHAR(36) NULL,
    `billing_address_id` CHAR(36) NULL,
    `shipping_address_id` CHAR(36) NULL,
    `bank_account_id` CHAR(36) NULL,
    `status` ENUM('draft', 'issued', 'cancelled', 'amended') NOT NULL DEFAULT 'draft',
    `invoice_number` VARCHAR(120) NULL,
    `invoice_date` DATE NOT NULL,
    `due_date` DATE NULL,
    `currency` CHAR(3) NOT NULL DEFAULT 'INR',
    `place_of_supply_state_code` VARCHAR(10) NULL,
    `tax_mode` ENUM('automatic', 'igst', 'cgst_sgst', 'zero_rated_export', 'no_tax') NOT NULL DEFAULT 'automatic',
    `buyer_order_number` VARCHAR(120) NULL,
    `buyer_order_date` DATE NULL,
    `exporter_reference` VARCHAR(120) NULL,
    `pre_carriage_by` VARCHAR(120) NULL,
    `place_of_receipt` VARCHAR(120) NULL,
    `vessel_flight_no` VARCHAR(120) NULL,
    `port_of_loading` VARCHAR(120) NULL,
    `port_of_discharge` VARCHAR(120) NULL,
    `final_destination` VARCHAR(120) NULL,
    `terms_of_delivery` TEXT NULL,
    `notes` TEXT NULL,
    `declaration` TEXT NULL,
    `subtotal` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `invoice_discount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `other_charges` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `taxable_total` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `igst_total` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `cgst_total` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `sgst_total` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `round_off` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `grand_total` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `version` INTEGER NOT NULL DEFAULT 1,
    `created_by_id` CHAR(36) NOT NULL,
    `updated_by_id` CHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `invoices_organisation_id_status_invoice_date_idx`(`organisation_id`, `status`, `invoice_date`),
    INDEX `invoices_organisation_id_buyer_id_idx`(`organisation_id`, `buyer_id`),
    INDEX `invoices_organisation_id_invoice_number_idx`(`organisation_id`, `invoice_number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `invoice_items` (
    `id` CHAR(36) NOT NULL,
    `organisation_id` CHAR(36) NOT NULL,
    `invoice_id` CHAR(36) NOT NULL,
    `item_id` CHAR(36) NULL,
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

    INDEX `invoice_items_organisation_id_invoice_id_sort_order_idx`(`organisation_id`, `invoice_id`, `sort_order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `invoices` ADD CONSTRAINT `invoices_organisation_id_fkey` FOREIGN KEY (`organisation_id`) REFERENCES `organisations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `invoices` ADD CONSTRAINT `invoices_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `invoices` ADD CONSTRAINT `invoices_buyer_id_fkey` FOREIGN KEY (`buyer_id`) REFERENCES `buyers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `invoices` ADD CONSTRAINT `invoices_consignee_buyer_id_fkey` FOREIGN KEY (`consignee_buyer_id`) REFERENCES `buyers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `invoices` ADD CONSTRAINT `invoices_billing_address_id_fkey` FOREIGN KEY (`billing_address_id`) REFERENCES `buyer_addresses`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `invoices` ADD CONSTRAINT `invoices_shipping_address_id_fkey` FOREIGN KEY (`shipping_address_id`) REFERENCES `buyer_addresses`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `invoices` ADD CONSTRAINT `invoices_bank_account_id_fkey` FOREIGN KEY (`bank_account_id`) REFERENCES `company_bank_accounts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `invoices` ADD CONSTRAINT `invoices_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `invoices` ADD CONSTRAINT `invoices_updated_by_id_fkey` FOREIGN KEY (`updated_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invoice_items` ADD CONSTRAINT `invoice_items_organisation_id_fkey` FOREIGN KEY (`organisation_id`) REFERENCES `organisations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `invoice_items` ADD CONSTRAINT `invoice_items_invoice_id_fkey` FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `invoice_items` ADD CONSTRAINT `invoice_items_item_id_fkey` FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
