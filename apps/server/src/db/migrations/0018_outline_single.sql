CREATE TABLE `outline_node_next` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`body` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `outline_node_next` (`id`, `project_id`, `body`, `created_at`, `updated_at`)
SELECT `id`, `project_id`, `body`, `created_at`, `updated_at` FROM `outline_node` WHERE `kind` = 'book';
--> statement-breakpoint
DROP TABLE `outline_node_chapter`;
--> statement-breakpoint
DROP TABLE `outline_node_volume`;
--> statement-breakpoint
DROP TABLE `outline_node`;
--> statement-breakpoint
ALTER TABLE `outline_node_next` RENAME TO `outline_node`;
--> statement-breakpoint
CREATE UNIQUE INDEX `outline_node_project_id_idx` ON `outline_node` (`project_id`);
