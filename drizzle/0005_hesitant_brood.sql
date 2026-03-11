CREATE TABLE `report_tasks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`reportId` int NOT NULL,
	`createdBy` int NOT NULL,
	`assignedTo` int,
	`title` varchar(500) NOT NULL,
	`status` enum('pending','in_progress','done') NOT NULL DEFAULT 'pending',
	`dueDate` varchar(20),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `report_tasks_id` PRIMARY KEY(`id`)
);
