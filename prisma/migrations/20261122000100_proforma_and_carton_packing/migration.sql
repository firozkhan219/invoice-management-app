-- AlterTable
ALTER TABLE `invoices` ADD COLUMN `document_type` ENUM('tax_invoice', 'proforma') NOT NULL DEFAULT 'tax_invoice',
    ADD COLUMN `source_proforma_id` CHAR(36) NULL;

-- AlterTable
ALTER TABLE `packing_lists` ADD COLUMN `buyer_order_date` DATE NULL,
    ADD COLUMN `buyer_order_number` VARCHAR(120) NULL,
    ADD COLUMN `country_of_final_destination` VARCHAR(80) NULL,
    ADD COLUMN `country_of_origin` VARCHAR(80) NULL,
    ADD COLUMN `place_of_receipt` VARCHAR(120) NULL,
    ADD COLUMN `pre_carriage_by` VARCHAR(120) NULL,
    ADD COLUMN `terms_of_delivery` TEXT NULL,
    ADD COLUMN `vessel_flight_no` VARCHAR(120) NULL;

-- AlterTable
ALTER TABLE `packing_list_lines` ADD COLUMN `carton_from` INTEGER NULL,
    ADD COLUMN `carton_to` INTEGER NULL,
    ADD COLUMN `gross_weight_per_carton_kg` DECIMAL(18, 4) NULL,
    ADD COLUMN `net_weight_per_piece_kg` DECIMAL(18, 6) NULL,
    ADD COLUMN `pieces_per_carton` DECIMAL(18, 4) NULL;

-- CreateIndex
CREATE INDEX `invoices_organisation_id_document_type_status_idx` ON `invoices`(`organisation_id`, `document_type`, `status`);

-- CreateIndex
CREATE INDEX `invoices_source_proforma_id_idx` ON `invoices`(`source_proforma_id`);

-- AddForeignKey
ALTER TABLE `invoices` ADD CONSTRAINT `invoices_source_proforma_id_fkey` FOREIGN KEY (`source_proforma_id`) REFERENCES `invoices`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

