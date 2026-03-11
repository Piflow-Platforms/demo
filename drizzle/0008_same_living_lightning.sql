ALTER TABLE `client_data_uploads` ADD `status` enum('pending','approved','rejected','reupload_requested') DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE `client_data_uploads` ADD `rejectionReason` text;--> statement-breakpoint
ALTER TABLE `client_data_uploads` ADD `reviewedBy` int;--> statement-breakpoint
ALTER TABLE `client_data_uploads` ADD `reviewedAt` timestamp;--> statement-breakpoint
ALTER TABLE `client_data_uploads` ADD `version` int DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `client_data_uploads` ADD `parentId` int;--> statement-breakpoint
ALTER TABLE `client_data_uploads` ADD `isLatest` int DEFAULT 1 NOT NULL;