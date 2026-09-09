ALTER TABLE orders ADD COLUMN IF NOT EXISTS discountpercent integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discountamount integer DEFAULT 0 NOT NULL;
