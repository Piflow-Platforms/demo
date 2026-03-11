CREATE TABLE `clients` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`companyName` varchar(255),
	`email` varchar(320),
	`phone` varchar(50),
	`accountantId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `clients_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `feedbacks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`reportId` int NOT NULL,
	`teamLeaderId` int NOT NULL,
	`comment` text NOT NULL,
	`action` enum('approved','rejected') NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `feedbacks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(500) NOT NULL,
	`message` text NOT NULL,
	`type` enum('audit_review','approved','rejected','report_ready') NOT NULL,
	`reportId` int,
	`isRead` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `reports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`accountantId` int NOT NULL,
	`month` varchar(7) NOT NULL,
	`bankStatus` enum('not_received','partial','received') NOT NULL DEFAULT 'not_received',
	`salariesStatus` enum('not_received','partial','received') NOT NULL DEFAULT 'not_received',
	`salesStatus` enum('not_received','partial','received') NOT NULL DEFAULT 'not_received',
	`purchasesStatus` enum('not_received','partial','received') NOT NULL DEFAULT 'not_received',
	`inventoryStatus` enum('not_received','partial','received') NOT NULL DEFAULT 'not_received',
	`stage` enum('data_entry','justification','audit_review','quality_check','report_sent','sent_to_client') NOT NULL DEFAULT 'data_entry',
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `reports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `team_assignments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`teamLeaderId` int NOT NULL,
	`accountantId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `team_assignments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('user','admin','accountant','team_leader','customer_success') NOT NULL DEFAULT 'user';