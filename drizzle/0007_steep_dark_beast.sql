CREATE TABLE `client_data_uploads` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`month` varchar(7) NOT NULL,
	`type` enum('bank','salaries','sales','purchases','inventory','other') NOT NULL,
	`fileUrl` text NOT NULL,
	`fileKey` varchar(500) NOT NULL,
	`fileName` varchar(500) NOT NULL,
	`uploadedByType` enum('client','accountant') NOT NULL DEFAULT 'accountant',
	`uploadedByUserId` int,
	`uploadedByClientPortalId` int,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `client_data_uploads_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `client_portal_users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`email` varchar(320) NOT NULL,
	`passwordHash` varchar(255) NOT NULL,
	`name` varchar(255) NOT NULL,
	`isActive` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `client_portal_users_id` PRIMARY KEY(`id`),
	CONSTRAINT `client_portal_users_clientId_unique` UNIQUE(`clientId`),
	CONSTRAINT `client_portal_users_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE TABLE `cs_tickets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`raisedBy` int NOT NULL,
	`assignedTo` int,
	`clientId` int NOT NULL,
	`type` enum('complaint','extra_service','volume_increase','data_delay','other') NOT NULL,
	`priority` enum('low','medium','high','urgent') NOT NULL DEFAULT 'medium',
	`status` enum('open','in_progress','resolved','closed') NOT NULL DEFAULT 'open',
	`title` varchar(500) NOT NULL,
	`description` text,
	`resolution` text,
	`month` varchar(7),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cs_tickets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('user','admin','accountant','team_leader','customer_success','cs_manager','operation_manager') NOT NULL DEFAULT 'user';