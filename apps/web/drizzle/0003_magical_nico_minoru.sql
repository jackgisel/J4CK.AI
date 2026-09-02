CREATE TABLE `pipeline` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`graph` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `pipeline_userId_idx` ON `pipeline` (`user_id`);--> statement-breakpoint
CREATE TABLE `pipeline_run` (
	`id` text PRIMARY KEY NOT NULL,
	`pipeline_id` text NOT NULL,
	`user_id` text NOT NULL,
	`status` text NOT NULL,
	`input` text NOT NULL,
	`workflow_instance_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`pipeline_id`) REFERENCES `pipeline`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `pipeline_run_pipelineId_idx` ON `pipeline_run` (`pipeline_id`);--> statement-breakpoint
CREATE INDEX `pipeline_run_userId_idx` ON `pipeline_run` (`user_id`);