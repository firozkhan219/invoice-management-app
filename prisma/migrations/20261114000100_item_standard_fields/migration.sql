ALTER TABLE `items`
  ADD COLUMN `gross_weight_kg` DECIMAL(12, 4) NULL,
  ADD COLUMN `length_cm` DECIMAL(10, 2) NULL,
  ADD COLUMN `width_cm` DECIMAL(10, 2) NULL,
  ADD COLUMN `height_cm` DECIMAL(10, 2) NULL,
  ADD COLUMN `material` VARCHAR(120) NULL,
  ADD COLUMN `finish` VARCHAR(120) NULL,
  ADD COLUMN `country_of_origin` VARCHAR(80) NULL,
  ADD COLUMN `units_per_carton` INTEGER NULL,
  ADD COLUMN `moq` INTEGER NULL;
