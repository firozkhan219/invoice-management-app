-- Credit notes now reduce the invoice balance.
ALTER TABLE `invoices` ADD COLUMN `credited_total` DECIMAL(18, 4) NOT NULL DEFAULT 0;

-- Document numbers must be unique per organisation (NULL drafts are allowed many times).
-- If this fails, find duplicates first:
--   SELECT organisation_id, invoice_number, COUNT(*) FROM invoices WHERE invoice_number IS NOT NULL GROUP BY 1, 2 HAVING COUNT(*) > 1;
--   SELECT organisation_id, credit_note_number, COUNT(*) FROM credit_notes WHERE credit_note_number IS NOT NULL GROUP BY 1, 2 HAVING COUNT(*) > 1;
CREATE UNIQUE INDEX `invoices_organisation_id_invoice_number_key` ON `invoices`(`organisation_id`, `invoice_number`);
CREATE UNIQUE INDEX `credit_notes_organisation_id_credit_note_number_key` ON `credit_notes`(`organisation_id`, `credit_note_number`);
