CREATE TABLE `quotes` (
	`id` text PRIMARY KEY NOT NULL,
	`unit_id` text NOT NULL,
	`request_id` text,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`amount` integer NOT NULL,
	`due` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`installment_id` text,
	`decision_note` text DEFAULT '' NOT NULL,
	`decided_by` text,
	`decided_at` text,
	`author_id` text NOT NULL,
	`created` text NOT NULL,
	FOREIGN KEY (`unit_id`) REFERENCES `units`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`request_id`) REFERENCES `requests`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`installment_id`) REFERENCES `installments`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`author_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `quotes_unit` ON `quotes` (`unit_id`);--> statement-breakpoint
CREATE INDEX `quotes_request` ON `quotes` (`request_id`);--> statement-breakpoint
ALTER TABLE `files` ADD `category` text DEFAULT 'other' NOT NULL;--> statement-breakpoint
ALTER TABLE `slots` ADD `kind` text DEFAULT 'handover' NOT NULL;