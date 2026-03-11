CREATE TABLE `time_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`clientId` int NOT NULL,
	`sopCode` varchar(20) NOT NULL,
	`sopName` varchar(255) NOT NULL,
	`transactionCount` int NOT NULL DEFAULT 0,
	`month` varchar(7) NOT NULL,
	`startedAt` bigint NOT NULL,
	`endedAt` bigint,
	`durationSeconds` int,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `time_sessions_id` PRIMARY KEY(`id`)
);
