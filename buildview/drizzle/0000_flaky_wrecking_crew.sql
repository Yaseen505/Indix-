CREATE TABLE `audit` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`actor_id` text NOT NULL,
	`action` text NOT NULL,
	`entity_id` text NOT NULL,
	`unit_id` text,
	`created` text NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `audit_company` ON `audit` (`company_id`);--> statement-breakpoint
CREATE TABLE `companies` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`owner_subject` text NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `files` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`unit_id` text,
	`project_id` text,
	`kind` text NOT NULL,
	`target_id` text,
	`name` text NOT NULL,
	`label` text NOT NULL,
	`mime` text NOT NULL,
	`size` integer NOT NULL,
	`object_key` text NOT NULL,
	`author_id` text NOT NULL,
	`created` text NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`unit_id`) REFERENCES `units`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`author_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `files_unit` ON `files` (`unit_id`);--> statement-breakpoint
CREATE INDEX `files_project` ON `files` (`project_id`);--> statement-breakpoint
CREATE INDEX `files_target` ON `files` (`target_id`);--> statement-breakpoint
CREATE TABLE `handovers` (
	`id` text PRIMARY KEY NOT NULL,
	`unit_id` text NOT NULL,
	`keys` integer DEFAULT 0 NOT NULL,
	`meters` integer DEFAULT 0 NOT NULL,
	`documents` integer DEFAULT 0 NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`signed_name` text,
	`signed_by` text,
	`signed_at` text,
	`created` text NOT NULL,
	FOREIGN KEY (`unit_id`) REFERENCES `units`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `handover_unit` ON `handovers` (`unit_id`);--> statement-breakpoint
CREATE TABLE `installments` (
	`id` text PRIMARY KEY NOT NULL,
	`unit_id` text NOT NULL,
	`label` text NOT NULL,
	`amount` integer NOT NULL,
	`due` text NOT NULL,
	`created` text NOT NULL,
	FOREIGN KEY (`unit_id`) REFERENCES `units`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `installments_unit` ON `installments` (`unit_id`);--> statement-breakpoint
CREATE TABLE `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`request_id` text NOT NULL,
	`author_id` text NOT NULL,
	`body` text NOT NULL,
	`created` text NOT NULL,
	FOREIGN KEY (`request_id`) REFERENCES `requests`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`author_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `messages_request` ON `messages` (`request_id`);--> statement-breakpoint
CREATE TABLE `payments` (
	`id` text PRIMARY KEY NOT NULL,
	`unit_id` text NOT NULL,
	`installment_id` text NOT NULL,
	`author_id` text NOT NULL,
	`amount` integer NOT NULL,
	`reference` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`review_note` text DEFAULT '' NOT NULL,
	`reviewed_by` text,
	`reviewed_at` text,
	`created` text NOT NULL,
	FOREIGN KEY (`unit_id`) REFERENCES `units`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`installment_id`) REFERENCES `installments`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`author_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `payments_unit` ON `payments` (`unit_id`);--> statement-breakpoint
CREATE INDEX `payments_installment` ON `payments` (`installment_id`);--> statement-breakpoint
CREATE TABLE `people` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`subject` text,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`role` text NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`invite_hash` text,
	`invite_expires` text,
	`created` text NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `people_subject` ON `people` (`subject`);--> statement-breakpoint
CREATE INDEX `people_company` ON `people` (`company_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `people_invite` ON `people` (`invite_hash`);--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`name` text NOT NULL,
	`location` text NOT NULL,
	`progress` integer DEFAULT 0 NOT NULL,
	`handover` text DEFAULT '' NOT NULL,
	`demo` integer DEFAULT 0 NOT NULL,
	`created` text NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `projects_company` ON `projects` (`company_id`);--> statement-breakpoint
CREATE TABLE `requests` (
	`id` text PRIMARY KEY NOT NULL,
	`unit_id` text NOT NULL,
	`author_id` text NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`status` text DEFAULT 'received' NOT NULL,
	`created` text NOT NULL,
	FOREIGN KEY (`unit_id`) REFERENCES `units`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`author_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `requests_unit` ON `requests` (`unit_id`);--> statement-breakpoint
CREATE TABLE `slots` (
	`id` text PRIMARY KEY NOT NULL,
	`unit_id` text NOT NULL,
	`start` text NOT NULL,
	`status` text DEFAULT 'available' NOT NULL,
	`booked_by` text,
	`created` text NOT NULL,
	FOREIGN KEY (`unit_id`) REFERENCES `units`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `slots_unit_start` ON `slots` (`unit_id`,`start`);--> statement-breakpoint
CREATE TABLE `snags` (
	`id` text PRIMARY KEY NOT NULL,
	`unit_id` text NOT NULL,
	`author_id` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`location` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`resolution` text DEFAULT '' NOT NULL,
	`created` text NOT NULL,
	FOREIGN KEY (`unit_id`) REFERENCES `units`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`author_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `snags_unit` ON `snags` (`unit_id`);--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`unit_id` text NOT NULL,
	`title` text NOT NULL,
	`due` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`created` text NOT NULL,
	FOREIGN KEY (`unit_id`) REFERENCES `units`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `tasks_unit` ON `tasks` (`unit_id`);--> statement-breakpoint
CREATE TABLE `units` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`project_id` text NOT NULL,
	`buyer_id` text,
	`code` text NOT NULL,
	`floor` text NOT NULL,
	`bedrooms` integer NOT NULL,
	`area` integer NOT NULL,
	`parking` text DEFAULT '' NOT NULL,
	`dewa` text DEFAULT '' NOT NULL,
	`price` integer NOT NULL,
	`progress` integer DEFAULT 0 NOT NULL,
	`ownership` integer DEFAULT 100 NOT NULL,
	`created` text NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`buyer_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `units_buyer` ON `units` (`buyer_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `units_project_code` ON `units` (`project_id`,`code`);--> statement-breakpoint
CREATE TABLE `updates` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`unit_id` text,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`progress` integer NOT NULL,
	`stage` text NOT NULL,
	`created` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`unit_id`) REFERENCES `units`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `updates_project` ON `updates` (`project_id`);