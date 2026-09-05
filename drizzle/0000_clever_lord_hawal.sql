CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`tenantId` text NOT NULL,
	`orderId` text,
	`actor` text NOT NULL,
	`action` text NOT NULL,
	`detail` text DEFAULT '' NOT NULL,
	`public` integer DEFAULT 0 NOT NULL,
	`createdAt` text NOT NULL,
	FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tenantId`,`orderId`) REFERENCES `orders`(`tenantId`,`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `events_order` ON `events` (`tenantId`,`orderId`);--> statement-breakpoint
CREATE TABLE `files` (
	`id` text PRIMARY KEY NOT NULL,
	`tenantId` text NOT NULL,
	`orderId` text,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`size` integer NOT NULL,
	`createdAt` text NOT NULL,
	FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tenantId`,`orderId`) REFERENCES `orders`(`tenantId`,`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `files_tenant` ON `files` (`tenantId`);--> statement-breakpoint
CREATE TABLE `items` (
	`id` text PRIMARY KEY NOT NULL,
	`tenantId` text NOT NULL,
	`orderId` text NOT NULL,
	`productId` text NOT NULL,
	`name` text NOT NULL,
	`quantity` integer NOT NULL,
	`price` integer NOT NULL,
	`variant` text DEFAULT '' NOT NULL,
	`custom` text DEFAULT '{}' NOT NULL,
	FOREIGN KEY (`tenantId`,`orderId`) REFERENCES `orders`(`tenantId`,`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tenantId`,`productId`) REFERENCES `products`(`tenantId`,`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "quantity_positive" CHECK("items"."quantity">0)
);
--> statement-breakpoint
CREATE INDEX `items_order` ON `items` (`tenantId`,`orderId`);--> statement-breakpoint
CREATE TABLE `limits` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`expires` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` text PRIMARY KEY NOT NULL,
	`tenantId` text NOT NULL,
	`reference` text NOT NULL,
	`customer` text NOT NULL,
	`phone` text NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`address` text NOT NULL,
	`zoneId` text NOT NULL,
	`status` text DEFAULT 'New' NOT NULL,
	`payment` text DEFAULT 'Unpaid' NOT NULL,
	`paymentMethod` text DEFAULT 'Cash on delivery' NOT NULL,
	`subtotal` integer NOT NULL,
	`deliveryFee` integer NOT NULL,
	`total` integer NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`employeeId` text,
	`driverId` text,
	`deliveryStatus` text DEFAULT 'Pending' NOT NULL,
	`cashCollected` integer DEFAULT 0 NOT NULL,
	`reason` text DEFAULT '' NOT NULL,
	`trackingHash` text,
	`idempotency` text NOT NULL,
	`version` integer DEFAULT 0 NOT NULL,
	`createdAt` text NOT NULL,
	`updatedAt` text NOT NULL,
	FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tenantId`,`zoneId`) REFERENCES `zones`(`tenantId`,`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tenantId`,`employeeId`) REFERENCES `users`(`tenantId`,`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tenantId`,`driverId`) REFERENCES `users`(`tenantId`,`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `orders_trackingHash_unique` ON `orders` (`trackingHash`);--> statement-breakpoint
CREATE UNIQUE INDEX `orders_tenant_id` ON `orders` (`tenantId`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `orders_idempotency` ON `orders` (`tenantId`,`idempotency`);--> statement-breakpoint
CREATE INDEX `orders_queue` ON `orders` (`tenantId`,`status`,`createdAt`);--> statement-breakpoint
CREATE TABLE `platformEvents` (
	`id` text PRIMARY KEY NOT NULL,
	`actor` text NOT NULL,
	`action` text NOT NULL,
	`detail` text NOT NULL,
	`createdAt` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`tenantId` text NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`category` text DEFAULT 'General' NOT NULL,
	`sku` text NOT NULL,
	`price` integer NOT NULL,
	`stock` integer NOT NULL,
	`lowStock` integer DEFAULT 5 NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`image` text DEFAULT '' NOT NULL,
	`variants` text DEFAULT '[]' NOT NULL,
	`customFields` text DEFAULT '[]' NOT NULL,
	`createdAt` text NOT NULL,
	FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "stock_nonnegative" CHECK("products"."stock" >= 0),
	CONSTRAINT "price_nonnegative" CHECK("products"."price" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `products_tenant_id` ON `products` (`tenantId`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `products_tenant_sku` ON `products` (`tenantId`,`sku`);--> statement-breakpoint
CREATE TABLE `proofs` (
	`id` text PRIMARY KEY NOT NULL,
	`tenantId` text NOT NULL,
	`orderId` text NOT NULL,
	`version` integer NOT NULL,
	`fileId` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'Pending' NOT NULL,
	`feedback` text DEFAULT '' NOT NULL,
	`createdAt` text NOT NULL,
	FOREIGN KEY (`tenantId`,`orderId`) REFERENCES `orders`(`tenantId`,`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `proof_version` ON `proofs` (`tenantId`,`orderId`,`version`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`expires` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `sessions_user` ON `sessions` (`userId`);--> statement-breakpoint
CREATE TABLE `tenants` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`plan` text DEFAULT 'Starter' NOT NULL,
	`price` integer DEFAULT 2000 NOT NULL,
	`subscription` text DEFAULT 'trial' NOT NULL,
	`trialStart` text,
	`trialEnd` text,
	`renewalDate` text,
	`suspendedDate` text,
	`settings` text DEFAULT '{}' NOT NULL,
	`createdAt` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tenants_slug_unique` ON `tenants` (`slug`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`tenantId` text,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`role` text NOT NULL,
	`password` text NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`createdAt` text NOT NULL,
	FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_tenant_id` ON `users` (`tenantId`,`id`);--> statement-breakpoint
CREATE TABLE `zones` (
	`id` text PRIMARY KEY NOT NULL,
	`tenantId` text NOT NULL,
	`name` text NOT NULL,
	`fee` integer NOT NULL,
	`freeAbove` integer,
	`minimum` integer DEFAULT 0 NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `zones_tenant_id` ON `zones` (`tenantId`,`id`);