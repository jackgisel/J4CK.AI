CREATE TABLE `card` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`transcript` text NOT NULL,
	`status` text DEFAULT 'idea' NOT NULL,
	`plan` text,
	`estimate` text,
	`spent_usd` real DEFAULT 0 NOT NULL,
	`error` text,
	`approved_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `card_userId_idx` ON `card` (`user_id`);