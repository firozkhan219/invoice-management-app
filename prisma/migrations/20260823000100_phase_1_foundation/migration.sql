-- CreateTable
CREATE TABLE `users` (
    `id` CHAR(36) NOT NULL,
    `email` VARCHAR(320) NOT NULL,
    `name` VARCHAR(160) NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `email_verified_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sessions` (
    `id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NOT NULL,
    `token_hash` CHAR(64) NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `last_seen_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `user_agent` VARCHAR(255) NULL,
    `ip_address` VARCHAR(64) NULL,

    UNIQUE INDEX `sessions_token_hash_key`(`token_hash`),
    INDEX `sessions_user_id_expires_at_idx`(`user_id`, `expires_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `verification_tokens` (
    `id` CHAR(36) NOT NULL,
    `email` VARCHAR(320) NOT NULL,
    `token_hash` CHAR(64) NOT NULL,
    `purpose` VARCHAR(40) NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `used_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `verification_tokens_token_hash_key`(`token_hash`),
    INDEX `verification_tokens_email_purpose_expires_at_idx`(`email`, `purpose`, `expires_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `organisations` (
    `id` CHAR(36) NOT NULL,
    `name` VARCHAR(180) NOT NULL,
    `slug` VARCHAR(120) NOT NULL,
    `locale` VARCHAR(20) NOT NULL DEFAULT 'en-IN',
    `time_zone` VARCHAR(80) NOT NULL DEFAULT 'Asia/Kolkata',
    `default_currency` CHAR(3) NOT NULL DEFAULT 'INR',
    `financial_year_start` INTEGER NOT NULL DEFAULT 4,
    `plan_status` VARCHAR(40) NOT NULL DEFAULT 'trial',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `organisations_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `organisation_members` (
    `id` CHAR(36) NOT NULL,
    `organisation_id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NOT NULL,
    `role` ENUM('owner', 'admin', 'accountant', 'viewer') NOT NULL,
    `status` ENUM('active', 'invited', 'suspended') NOT NULL DEFAULT 'active',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `organisation_members_user_id_status_idx`(`user_id`, `status`),
    UNIQUE INDEX `organisation_members_organisation_id_user_id_key`(`organisation_id`, `user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `organisation_invitations` (
    `id` CHAR(36) NOT NULL,
    `organisation_id` CHAR(36) NOT NULL,
    `email` VARCHAR(320) NOT NULL,
    `role` ENUM('owner', 'admin', 'accountant', 'viewer') NOT NULL,
    `token_hash` CHAR(64) NOT NULL,
    `invited_by_id` CHAR(36) NOT NULL,
    `accepted_at` DATETIME(3) NULL,
    `revoked_at` DATETIME(3) NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `organisation_invitations_token_hash_key`(`token_hash`),
    INDEX `organisation_invitations_organisation_id_email_idx`(`organisation_id`, `email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `audit_logs` (
    `id` CHAR(36) NOT NULL,
    `organisation_id` CHAR(36) NULL,
    `actor_user_id` CHAR(36) NULL,
    `action` VARCHAR(120) NOT NULL,
    `entity_type` VARCHAR(80) NULL,
    `entity_id` VARCHAR(80) NULL,
    `metadata` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `audit_logs_organisation_id_created_at_idx`(`organisation_id`, `created_at`),
    INDEX `audit_logs_actor_user_id_created_at_idx`(`actor_user_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `file_assets` (
    `id` CHAR(36) NOT NULL,
    `organisation_id` CHAR(36) NOT NULL,
    `kind` VARCHAR(40) NOT NULL,
    `original_name` VARCHAR(255) NOT NULL,
    `storage_key` VARCHAR(255) NOT NULL,
    `mime_type` VARCHAR(120) NOT NULL,
    `byte_size` INTEGER NOT NULL,
    `checksum_sha256` CHAR(64) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `file_assets_storage_key_key`(`storage_key`),
    INDEX `file_assets_organisation_id_kind_idx`(`organisation_id`, `kind`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `sessions` ADD CONSTRAINT `sessions_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `organisation_members` ADD CONSTRAINT `organisation_members_organisation_id_fkey` FOREIGN KEY (`organisation_id`) REFERENCES `organisations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `organisation_members` ADD CONSTRAINT `organisation_members_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `organisation_invitations` ADD CONSTRAINT `organisation_invitations_organisation_id_fkey` FOREIGN KEY (`organisation_id`) REFERENCES `organisations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `organisation_invitations` ADD CONSTRAINT `organisation_invitations_invited_by_id_fkey` FOREIGN KEY (`invited_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_organisation_id_fkey` FOREIGN KEY (`organisation_id`) REFERENCES `organisations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_actor_user_id_fkey` FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `file_assets` ADD CONSTRAINT `file_assets_organisation_id_fkey` FOREIGN KEY (`organisation_id`) REFERENCES `organisations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

