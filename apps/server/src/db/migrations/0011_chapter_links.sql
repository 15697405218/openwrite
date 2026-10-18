CREATE TABLE `chapter_character` (
	`chapter_id` text NOT NULL,
	`character_id` text NOT NULL,
	PRIMARY KEY(`chapter_id`, `character_id`),
	FOREIGN KEY (`chapter_id`) REFERENCES `chapter`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`character_id`) REFERENCES `character`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `chapter_character_character_id_idx` ON `chapter_character` (`character_id`);
--> statement-breakpoint
CREATE TABLE `plot_point_chapter` (
	`plot_point_id` text NOT NULL,
	`chapter_id` text NOT NULL,
	PRIMARY KEY(`plot_point_id`, `chapter_id`),
	FOREIGN KEY (`plot_point_id`) REFERENCES `plot_point`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`chapter_id`) REFERENCES `chapter`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `plot_point_chapter_chapter_id_idx` ON `plot_point_chapter` (`chapter_id`);
--> statement-breakpoint
CREATE TABLE `plot_point_character` (
	`plot_point_id` text NOT NULL,
	`character_id` text NOT NULL,
	PRIMARY KEY(`plot_point_id`, `character_id`),
	FOREIGN KEY (`plot_point_id`) REFERENCES `plot_point`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`character_id`) REFERENCES `character`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `plot_point_character_character_id_idx` ON `plot_point_character` (`character_id`);
--> statement-breakpoint
INSERT INTO `plot_point_chapter` (`plot_point_id`, `chapter_id`)
SELECT `id`, `chapter_id` FROM `plot_point` WHERE `chapter_id` IS NOT NULL;
