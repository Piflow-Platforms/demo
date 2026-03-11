CREATE TABLE `cs_assignments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`csUserId` int NOT NULL,
	`clientId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `cs_assignments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('user','admin','accountant','team_leader','customer_success','operation_manager') NOT NULL DEFAULT 'user';