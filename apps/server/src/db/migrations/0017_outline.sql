CREATE TABLE `outline_node` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`parent_id` text,
	`kind` text NOT NULL,
	`title` text NOT NULL,
	`body` text,
	`order` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`parent_id`) REFERENCES `outline_node`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "outline_node_kind" CHECK(`kind` IN ('book', 'volume', 'detail'))
);
--> statement-breakpoint
CREATE INDEX `outline_node_project_id_idx` ON `outline_node` (`project_id`);
--> statement-breakpoint
CREATE INDEX `outline_node_parent_id_idx` ON `outline_node` (`parent_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `outline_node_one_book` ON `outline_node` (`project_id`) WHERE `kind` = 'book';
--> statement-breakpoint
CREATE TABLE `outline_node_volume` (
	`outline_node_id` text NOT NULL,
	`volume_id` text NOT NULL,
	PRIMARY KEY(`outline_node_id`, `volume_id`),
	FOREIGN KEY (`outline_node_id`) REFERENCES `outline_node`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`volume_id`) REFERENCES `volume`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `outline_node_chapter` (
	`outline_node_id` text NOT NULL,
	`chapter_id` text NOT NULL,
	PRIMARY KEY(`outline_node_id`, `chapter_id`),
	FOREIGN KEY (`outline_node_id`) REFERENCES `outline_node`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`chapter_id`) REFERENCES `chapter`(`id`) ON UPDATE no action ON DELETE cascade
);
