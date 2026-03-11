CREATE TABLE `report_comments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`reportId` int NOT NULL,
	`userId` int NOT NULL,
	`userName` varchar(255) NOT NULL,
	`userRole` varchar(64) NOT NULL,
	`comment` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `report_comments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `reports` ADD `reportFileUrl` text;--> statement-breakpoint
ALTER TABLE `reports` ADD `reportFileKey` varchar(500);--> statement-breakpoint
ALTER TABLE `reports` ADD `reportFileName` varchar(255);--> statement-breakpoint
ALTER TABLE `reports` ADD `reportFileMime` varchar(100);