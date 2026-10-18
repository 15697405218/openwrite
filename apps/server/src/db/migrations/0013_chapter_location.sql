CREATE TABLE `chapter_location` (
	`chapter_id` text NOT NULL,
	`location_id` text NOT NULL,
	PRIMARY KEY(`chapter_id`, `location_id`),
	FOREIGN KEY (`chapter_id`) REFERENCES `chapter`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`location_id`) REFERENCES `location`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `chapter_location_location_id_idx` ON `chapter_location` (`location_id`);
