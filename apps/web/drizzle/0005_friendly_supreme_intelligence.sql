CREATE TABLE `studio_message` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`role` text NOT NULL,
	`model` text NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`artifact_key` text,
	`content_type` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `studio_message_userId_createdAt_idx` ON `studio_message` (`user_id`,`created_at`);