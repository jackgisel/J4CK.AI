CREATE TABLE `cli_device` (
	`id` text PRIMARY KEY NOT NULL,
	`hostname` text DEFAULT '' NOT NULL,
	`user_id` text,
	`token` text,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `cli_device_expiresAt_idx` ON `cli_device` (`expires_at`);--> statement-breakpoint
CREATE TABLE `cli_token` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`token_hash` text NOT NULL,
	`prefix` text NOT NULL,
	`created_at` integer NOT NULL,
	`last_used_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cli_token_token_hash_unique` ON `cli_token` (`token_hash`);--> statement-breakpoint
CREATE INDEX `cli_token_userId_idx` ON `cli_token` (`user_id`);