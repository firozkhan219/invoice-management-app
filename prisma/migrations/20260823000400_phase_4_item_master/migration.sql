-- CreateTable
CREATE TABLE `units` (
    `id` CHAR(36) NOT NULL,
    `organisation_id` CHAR(36) NOT NULL,
    `code` VARCHAR(20) NOT NULL,
    `name` VARCHAR(80) NOT NULL,
    `precision` INTEGER NOT NULL DEFAULT 2,
    `is_default` BOOLEAN NOT NULL DEFAULT false,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `units_organisation_id_code_key`(`organisation_id`, `code`),
    INDEX `units_organisation_id_is_active_idx`(`organisation_id`, `is_active`),
    INDEX `units_organisation_id_is_default_idx`(`organisation_id`, `is_default`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tax_rates` (
    `id` CHAR(36) NOT NULL,
    `organisation_id` CHAR(36) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `rate` DECIMAL(7, 4) NOT NULL,
    `tax_type` ENUM('gst', 'export_zero_rated', 'no_tax') NOT NULL DEFAULT 'gst',
    `is_default` BOOLEAN NOT NULL DEFAULT false,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `tax_rates_organisation_id_is_active_idx`(`organisation_id`, `is_active`),
    INDEX `tax_rates_organisation_id_is_default_idx`(`organisation_id`, `is_default`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `items` (
    `id` CHAR(36) NOT NULL,
    `organisation_id` CHAR(36) NOT NULL,
    `sku` VARCHAR(80) NULL,
    `name` VARCHAR(180) NOT NULL,
    `description` TEXT NULL,
    `hsn_sac` VARCHAR(20) NULL,
    `unit_id` CHAR(36) NULL,
    `tax_rate_id` CHAR(36) NULL,
    `sale_rate` DECIMAL(18, 4) NULL,
    `currency` CHAR(3) NOT NULL DEFAULT 'INR',
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `items_organisation_id_sku_key`(`organisation_id`, `sku`),
    INDEX `items_organisation_id_is_active_idx`(`organisation_id`, `is_active`),
    INDEX `items_organisation_id_name_idx`(`organisation_id`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `units` ADD CONSTRAINT `units_organisation_id_fkey` FOREIGN KEY (`organisation_id`) REFERENCES `organisations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tax_rates` ADD CONSTRAINT `tax_rates_organisation_id_fkey` FOREIGN KEY (`organisation_id`) REFERENCES `organisations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `items` ADD CONSTRAINT `items_organisation_id_fkey` FOREIGN KEY (`organisation_id`) REFERENCES `organisations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `items` ADD CONSTRAINT `items_unit_id_fkey` FOREIGN KEY (`unit_id`) REFERENCES `units`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `items` ADD CONSTRAINT `items_tax_rate_id_fkey` FOREIGN KEY (`tax_rate_id`) REFERENCES `tax_rates`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
