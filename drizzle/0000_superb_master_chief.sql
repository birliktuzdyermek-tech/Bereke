CREATE TABLE `cards` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`bank_name` text NOT NULL,
	`last4` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `subscriptions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`merchant` text NOT NULL,
	`monthly_amount` integer NOT NULL,
	`next_payment` text NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`card_id` integer,
	`merchant` text NOT NULL,
	`category` text NOT NULL,
	`amount` integer NOT NULL,
	`type` text NOT NULL,
	`tx_date` text NOT NULL,
	`created_at` text NOT NULL
);
