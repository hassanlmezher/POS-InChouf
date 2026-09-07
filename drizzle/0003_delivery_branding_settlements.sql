ALTER TABLE orders ADD COLUMN IF NOT EXISTS deliverymethod text DEFAULT 'internal_driver' NOT NULL;
--> statement-breakpoint
ALTER TABLE orders ADD COLUMN IF NOT EXISTS deliveryprovider text DEFAULT '' NOT NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS settlements (
	"id" text PRIMARY KEY NOT NULL,
	"tenantid" text NOT NULL,
	"method" text NOT NULL,
	"driverid" text,
	"provider" text DEFAULT '' NOT NULL,
	"periodstart" text,
	"periodend" text,
	"expected" integer NOT NULL,
	"actual" integer NOT NULL,
	"variance" integer NOT NULL,
	"status" text NOT NULL,
	"createdby" text NOT NULL,
	"createdat" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS settlementorders (
	"id" text PRIMARY KEY NOT NULL,
	"tenantid" text NOT NULL,
	"settlementid" text NOT NULL,
	"orderid" text NOT NULL,
	"amount" integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orders_delivery_method" ON "orders" USING btree ("tenantid","deliverymethod","driverid","deliveryprovider");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "settlements_tenant" ON "settlements" USING btree ("tenantid","createdat");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "settlements_tenant_id" ON "settlements" USING btree ("tenantid","id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "settlementorders_order" ON "settlementorders" USING btree ("tenantid","orderid");
--> statement-breakpoint
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_tenantid_tenants_id_fk" FOREIGN KEY ("tenantid") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_tenantid_driverid_users_tenantid_id_fk" FOREIGN KEY ("tenantid","driverid") REFERENCES "public"."users"("tenantid","id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "settlementorders" ADD CONSTRAINT "settlementorders_tenantid_settlementid_settlements_tenantid_id_fk" FOREIGN KEY ("tenantid","settlementid") REFERENCES "public"."settlements"("tenantid","id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "settlementorders" ADD CONSTRAINT "settlementorders_tenantid_orderid_orders_tenantid_id_fk" FOREIGN KEY ("tenantid","orderid") REFERENCES "public"."orders"("tenantid","id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE settlements ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE settlementorders ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY settlements_isolation ON settlements
FOR ALL
USING (app_is_super_admin() OR tenantid = app_user_tenant())
WITH CHECK (app_is_super_admin() OR tenantid = app_user_tenant());
--> statement-breakpoint
CREATE POLICY settlementorders_isolation ON settlementorders
FOR ALL
USING (app_is_super_admin() OR tenantid = app_user_tenant())
WITH CHECK (app_is_super_admin() OR tenantid = app_user_tenant());
