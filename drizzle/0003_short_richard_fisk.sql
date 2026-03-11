CREATE TABLE `client_attachments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`type` enum('cr','contract','eol','logo','other') NOT NULL,
	`fileName` varchar(255) NOT NULL,
	`fileUrl` text NOT NULL,
	`fileKey` varchar(500) NOT NULL,
	`mimeType` varchar(100),
	`uploadedBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `client_attachments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `clients` ADD `taxNumber` varchar(50);--> statement-breakpoint
ALTER TABLE `clients` ADD `crNumber` varchar(50);--> statement-breakpoint
ALTER TABLE `clients` ADD `crExpiry` varchar(20);--> statement-breakpoint
ALTER TABLE `clients` ADD `capital` varchar(100);--> statement-breakpoint
ALTER TABLE `clients` ADD `partnersCount` int;--> statement-breakpoint
ALTER TABLE `clients` ADD `branchesCount` int;--> statement-breakpoint
ALTER TABLE `clients` ADD `companyType` varchar(100);--> statement-breakpoint
ALTER TABLE `clients` ADD `establishedDate` varchar(20);--> statement-breakpoint
ALTER TABLE `clients` ADD `businessActivity` varchar(255);--> statement-breakpoint
ALTER TABLE `clients` ADD `masterNotes` text;--> statement-breakpoint
ALTER TABLE `clients` ADD `logoUrl` text;--> statement-breakpoint
ALTER TABLE `clients` ADD `logoKey` varchar(500);--> statement-breakpoint
ALTER TABLE `clients` ADD `sortOrder` int DEFAULT 0 NOT NULL;