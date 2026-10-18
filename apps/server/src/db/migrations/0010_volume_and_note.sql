CREATE TABLE `volume` (
	`id` text PRIMARY KEY NOT NULL,
	`work_id` text NOT NULL,
	`title` text NOT NULL,
	`order` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`work_id`) REFERENCES `work`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `volume_work_id_idx` ON `volume` (`work_id`);
--> statement-breakpoint
CREATE TABLE `note` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`title` text NOT NULL,
	`body` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `note_project_id_idx` ON `note` (`project_id`);
--> statement-breakpoint
INSERT INTO `volume` (`id`, `work_id`, `title`, `order`, `created_at`, `updated_at`)
SELECT lower(hex(randomblob(16))), `work_id`, 'Volume 1', 1, unixepoch(), unixepoch()
FROM (SELECT DISTINCT `work_id` FROM `chapter`);
--> statement-breakpoint
ALTER TABLE `chapter` ADD `volume_id` text REFERENCES `volume`(`id`) ON UPDATE no action ON DELETE cascade;
--> statement-breakpoint
UPDATE `chapter` SET `volume_id` = (
	SELECT `id` FROM `volume` WHERE `volume`.`work_id` = `chapter`.`work_id` LIMIT 1
);
--> statement-breakpoint
CREATE INDEX `chapter_volume_id_idx` ON `chapter` (`volume_id`);
