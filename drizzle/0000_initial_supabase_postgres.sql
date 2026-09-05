CREATE TABLE "events" (
	"id" text PRIMARY KEY NOT NULL,
	"tenantid" text NOT NULL,
	"orderid" text,
	"actor" text NOT NULL,
	"action" text NOT NULL,
	"detail" text DEFAULT '' NOT NULL,
	"public" integer DEFAULT 0 NOT NULL,
	"createdat" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "files" (
	"id" text PRIMARY KEY NOT NULL,
	"tenantid" text NOT NULL,
	"orderid" text,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"size" integer NOT NULL,
	"createdat" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "items" (
	"id" text PRIMARY KEY NOT NULL,
	"tenantid" text NOT NULL,
	"orderid" text NOT NULL,
	"productid" text NOT NULL,
	"name" text NOT NULL,
	"quantity" integer NOT NULL,
	"price" integer NOT NULL,
	"variant" text DEFAULT '' NOT NULL,
	"custom" text DEFAULT '{}' NOT NULL,
	CONSTRAINT "quantity_positive" CHECK ("items"."quantity">0)
);
--> statement-breakpoint
CREATE TABLE "limits" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer NOT NULL,
	"expires" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" text PRIMARY KEY NOT NULL,
	"tenantid" text NOT NULL,
	"reference" text NOT NULL,
	"customer" text NOT NULL,
	"phone" text NOT NULL,
	"email" text DEFAULT '' NOT NULL,
	"address" text NOT NULL,
	"zoneid" text NOT NULL,
	"status" text DEFAULT 'New' NOT NULL,
	"payment" text DEFAULT 'Unpaid' NOT NULL,
	"paymentmethod" text DEFAULT 'Cash on delivery' NOT NULL,
	"subtotal" integer NOT NULL,
	"deliveryfee" integer NOT NULL,
	"total" integer NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"employeeid" text,
	"driverid" text,
	"deliverystatus" text DEFAULT 'Pending' NOT NULL,
	"cashcollected" integer DEFAULT 0 NOT NULL,
	"reason" text DEFAULT '' NOT NULL,
	"trackinghash" text,
	"idempotency" text NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"createdat" text NOT NULL,
	"updatedat" text NOT NULL,
	CONSTRAINT "orders_trackinghash_unique" UNIQUE("trackinghash")
);
--> statement-breakpoint
CREATE TABLE "platformevents" (
	"id" text PRIMARY KEY NOT NULL,
	"actor" text NOT NULL,
	"action" text NOT NULL,
	"detail" text NOT NULL,
	"createdat" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" text PRIMARY KEY NOT NULL,
	"tenantid" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"category" text DEFAULT 'General' NOT NULL,
	"sku" text NOT NULL,
	"price" integer NOT NULL,
	"stock" integer NOT NULL,
	"lowstock" integer DEFAULT 5 NOT NULL,
	"active" integer DEFAULT 1 NOT NULL,
	"image" text DEFAULT '' NOT NULL,
	"variants" text DEFAULT '[]' NOT NULL,
	"customfields" text DEFAULT '[]' NOT NULL,
	"createdat" text NOT NULL,
	CONSTRAINT "stock_nonnegative" CHECK ("products"."stock" >= 0),
	CONSTRAINT "price_nonnegative" CHECK ("products"."price" >= 0)
);
--> statement-breakpoint
CREATE TABLE "proofs" (
	"id" text PRIMARY KEY NOT NULL,
	"tenantid" text NOT NULL,
	"orderid" text NOT NULL,
	"version" integer NOT NULL,
	"fileid" text NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'Pending' NOT NULL,
	"feedback" text DEFAULT '' NOT NULL,
	"createdat" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"userid" text NOT NULL,
	"expires" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"active" integer DEFAULT 1 NOT NULL,
	"plan" text DEFAULT 'Starter' NOT NULL,
	"price" integer DEFAULT 2000 NOT NULL,
	"subscription" text DEFAULT 'trial' NOT NULL,
	"trialstart" text,
	"trialend" text,
	"renewaldate" text,
	"suspendeddate" text,
	"settings" text DEFAULT '{}' NOT NULL,
	"createdat" text NOT NULL,
	CONSTRAINT "tenants_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"tenantid" text,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"role" text NOT NULL,
	"active" integer DEFAULT 1 NOT NULL,
	"createdat" text NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "zones" (
	"id" text PRIMARY KEY NOT NULL,
	"tenantid" text NOT NULL,
	"name" text NOT NULL,
	"fee" integer NOT NULL,
	"freeabove" integer,
	"minimum" integer DEFAULT 0 NOT NULL,
	"active" integer DEFAULT 1 NOT NULL,
	"notes" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "orders_tenant_id" ON "orders" USING btree ("tenantid","id");--> statement-breakpoint
CREATE UNIQUE INDEX "products_tenant_id" ON "products" USING btree ("tenantid","id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_tenant_id" ON "users" USING btree ("tenantid","id");--> statement-breakpoint
CREATE UNIQUE INDEX "zones_tenant_id" ON "zones" USING btree ("tenantid","id");--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_tenantid_tenants_id_fk" FOREIGN KEY ("tenantid") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_tenantid_orderid_orders_tenantid_id_fk" FOREIGN KEY ("tenantid","orderid") REFERENCES "public"."orders"("tenantid","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_tenantid_tenants_id_fk" FOREIGN KEY ("tenantid") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_tenantid_orderid_orders_tenantid_id_fk" FOREIGN KEY ("tenantid","orderid") REFERENCES "public"."orders"("tenantid","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_tenantid_orderid_orders_tenantid_id_fk" FOREIGN KEY ("tenantid","orderid") REFERENCES "public"."orders"("tenantid","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_tenantid_productid_products_tenantid_id_fk" FOREIGN KEY ("tenantid","productid") REFERENCES "public"."products"("tenantid","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_tenantid_tenants_id_fk" FOREIGN KEY ("tenantid") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_tenantid_zoneid_zones_tenantid_id_fk" FOREIGN KEY ("tenantid","zoneid") REFERENCES "public"."zones"("tenantid","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_tenantid_employeeid_users_tenantid_id_fk" FOREIGN KEY ("tenantid","employeeid") REFERENCES "public"."users"("tenantid","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_tenantid_driverid_users_tenantid_id_fk" FOREIGN KEY ("tenantid","driverid") REFERENCES "public"."users"("tenantid","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_tenantid_tenants_id_fk" FOREIGN KEY ("tenantid") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proofs" ADD CONSTRAINT "proofs_tenantid_orderid_orders_tenantid_id_fk" FOREIGN KEY ("tenantid","orderid") REFERENCES "public"."orders"("tenantid","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userid_users_id_fk" FOREIGN KEY ("userid") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_tenantid_tenants_id_fk" FOREIGN KEY ("tenantid") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zones" ADD CONSTRAINT "zones_tenantid_tenants_id_fk" FOREIGN KEY ("tenantid") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "events_order" ON "events" USING btree ("tenantid","orderid");--> statement-breakpoint
CREATE INDEX "files_tenant" ON "files" USING btree ("tenantid");--> statement-breakpoint
CREATE INDEX "items_order" ON "items" USING btree ("tenantid","orderid");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_idempotency" ON "orders" USING btree ("tenantid","idempotency");--> statement-breakpoint
CREATE INDEX "orders_queue" ON "orders" USING btree ("tenantid","status","createdat");--> statement-breakpoint
CREATE UNIQUE INDEX "products_tenant_sku" ON "products" USING btree ("tenantid","sku");--> statement-breakpoint
CREATE UNIQUE INDEX "proof_version" ON "proofs" USING btree ("tenantid","orderid","version");--> statement-breakpoint
CREATE INDEX "sessions_user" ON "sessions" USING btree ("userid");--> statement-breakpoint
CREATE UNIQUE INDEX one_owner ON users(tenantid) WHERE role='owner';--> statement-breakpoint
CREATE OR REPLACE FUNCTION reserve_stock() RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM products
    WHERE id = NEW.productid
      AND tenantid = NEW.tenantid
      AND active = 1
      AND stock >= NEW.quantity
  ) THEN
    RAISE EXCEPTION 'INSUFFICIENT_STOCK';
  END IF;

  UPDATE products
  SET stock = stock - NEW.quantity
  WHERE id = NEW.productid
    AND tenantid = NEW.tenantid;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER reserve_stock BEFORE INSERT ON items
FOR EACH ROW EXECUTE FUNCTION reserve_stock();--> statement-breakpoint
CREATE OR REPLACE FUNCTION restore_stock() RETURNS trigger AS $$
BEGIN
  UPDATE products
  SET stock = stock + COALESCE((
    SELECT SUM(quantity)
    FROM items
    WHERE tenantid = NEW.tenantid
      AND orderid = NEW.id
      AND productid = products.id
  ), 0)
  WHERE tenantid = NEW.tenantid
    AND id IN (
      SELECT productid
      FROM items
      WHERE tenantid = NEW.tenantid
        AND orderid = NEW.id
    );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER restore_stock AFTER UPDATE OF status ON orders
FOR EACH ROW
WHEN (NEW.status IN ('Cancelled','Returned') AND OLD.status NOT IN ('Cancelled','Returned'))
EXECUTE FUNCTION restore_stock();--> statement-breakpoint
CREATE OR REPLACE FUNCTION proof_file_scope() RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM files
    WHERE id = NEW.fileid
      AND tenantid = NEW.tenantid
      AND orderid = NEW.orderid
  ) THEN
    RAISE EXCEPTION 'FILE_SCOPE';
  END IF;

  IF EXISTS (
    SELECT 1 FROM proofs
    WHERE tenantid = NEW.tenantid
      AND orderid = NEW.orderid
      AND status = 'Approved'
  ) THEN
    RAISE EXCEPTION 'PROOF_LOCKED';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER proof_file_scope BEFORE INSERT ON proofs
FOR EACH ROW EXECUTE FUNCTION proof_file_scope();--> statement-breakpoint
CREATE OR REPLACE FUNCTION proof_lock() RETURNS trigger AS $$
BEGIN
  IF OLD.status = 'Approved' THEN
    RAISE EXCEPTION 'PROOF_LOCKED';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER proof_lock BEFORE UPDATE ON proofs
FOR EACH ROW EXECUTE FUNCTION proof_lock();--> statement-breakpoint
CREATE OR REPLACE FUNCTION proof_pack_guard() RETURNS trigger AS $$
BEGIN
  IF NEW.status = 'Packed'
    AND EXISTS (
      SELECT 1 FROM proofs
      WHERE tenantid = NEW.tenantid
        AND orderid = NEW.id
    )
    AND NOT EXISTS (
      SELECT 1 FROM proofs
      WHERE tenantid = NEW.tenantid
        AND orderid = NEW.id
        AND status = 'Approved'
    )
  THEN
    RAISE EXCEPTION 'PROOF_APPROVAL_REQUIRED';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER proof_pack_guard BEFORE UPDATE OF status ON orders
FOR EACH ROW EXECUTE FUNCTION proof_pack_guard();--> statement-breakpoint
CREATE OR REPLACE FUNCTION employee_limit() RETURNS trigger AS $$
BEGIN
  IF NEW.role NOT IN ('owner','super_admin') AND NEW.active = 1 THEN
    IF (
      SELECT COUNT(*)
      FROM users
      WHERE tenantid = NEW.tenantid
        AND role NOT IN ('owner','super_admin')
        AND active = 1
        AND id <> NEW.id
    ) >= 2 THEN
      RAISE EXCEPTION 'EMPLOYEE_LIMIT';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER employee_limit BEFORE INSERT OR UPDATE OF tenantid, role, active ON users
FOR EACH ROW EXECUTE FUNCTION employee_limit();--> statement-breakpoint
CREATE OR REPLACE FUNCTION app_user_tenant() RETURNS text AS $$
  SELECT tenantid FROM users WHERE id = auth.uid()::text AND active = 1
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;--> statement-breakpoint
CREATE OR REPLACE FUNCTION app_user_role() RETURNS text AS $$
  SELECT role FROM users WHERE id = auth.uid()::text AND active = 1
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;--> statement-breakpoint
CREATE OR REPLACE FUNCTION app_is_super_admin() RETURNS boolean AS $$
  SELECT COALESCE(app_user_role() = 'super_admin', false)
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;--> statement-breakpoint
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE users ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE products ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE zones ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE items ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE events ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE proofs ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE files ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE limits ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE platformevents ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY tenants_isolation ON tenants
FOR ALL
USING (app_is_super_admin() OR id = app_user_tenant())
WITH CHECK (app_is_super_admin() OR id = app_user_tenant());--> statement-breakpoint
CREATE POLICY users_isolation ON users
FOR ALL
USING (app_is_super_admin() OR id = auth.uid()::text OR tenantid = app_user_tenant())
WITH CHECK (app_is_super_admin() OR tenantid = app_user_tenant());--> statement-breakpoint
CREATE POLICY products_isolation ON products
FOR ALL
USING (app_is_super_admin() OR tenantid = app_user_tenant())
WITH CHECK (app_is_super_admin() OR tenantid = app_user_tenant());--> statement-breakpoint
CREATE POLICY zones_isolation ON zones
FOR ALL
USING (app_is_super_admin() OR tenantid = app_user_tenant())
WITH CHECK (app_is_super_admin() OR tenantid = app_user_tenant());--> statement-breakpoint
CREATE POLICY orders_isolation ON orders
FOR ALL
USING (app_is_super_admin() OR tenantid = app_user_tenant())
WITH CHECK (app_is_super_admin() OR tenantid = app_user_tenant());--> statement-breakpoint
CREATE POLICY items_isolation ON items
FOR ALL
USING (app_is_super_admin() OR tenantid = app_user_tenant())
WITH CHECK (app_is_super_admin() OR tenantid = app_user_tenant());--> statement-breakpoint
CREATE POLICY events_isolation ON events
FOR ALL
USING (app_is_super_admin() OR tenantid = app_user_tenant())
WITH CHECK (app_is_super_admin() OR tenantid = app_user_tenant());--> statement-breakpoint
CREATE POLICY proofs_isolation ON proofs
FOR ALL
USING (app_is_super_admin() OR tenantid = app_user_tenant())
WITH CHECK (app_is_super_admin() OR tenantid = app_user_tenant());--> statement-breakpoint
CREATE POLICY files_isolation ON files
FOR ALL
USING (app_is_super_admin() OR tenantid = app_user_tenant())
WITH CHECK (app_is_super_admin() OR tenantid = app_user_tenant());--> statement-breakpoint
CREATE OR REPLACE FUNCTION op_bind_sql(p_sql text, p_params jsonb)
RETURNS text AS $$
DECLARE
  rendered text := p_sql;
  value jsonb;
  i integer;
BEGIN
  IF jsonb_array_length(p_params) > 0 THEN
    FOR i IN REVERSE jsonb_array_length(p_params) - 1..0 LOOP
      rendered := replace(
        rendered,
        '$' || (i + 1)::text,
        '@@OP_PARAM_' || i::text || '@@'
      );
    END LOOP;
    FOR i IN REVERSE jsonb_array_length(p_params) - 1..0 LOOP
      value := p_params -> i;
      rendered := replace(
        rendered,
        '@@OP_PARAM_' || i::text || '@@',
        CASE jsonb_typeof(value)
          WHEN 'null' THEN 'NULL'
          WHEN 'boolean' THEN value #>> '{}'
          WHEN 'number' THEN value #>> '{}'
          ELSE quote_nullable(value #>> '{}')
        END
      );
    END LOOP;
  END IF;
  RETURN rendered;
END;
$$ LANGUAGE plpgsql IMMUTABLE SET search_path = public;--> statement-breakpoint
CREATE OR REPLACE FUNCTION op_query(p_sql text, p_params jsonb DEFAULT '[]'::jsonb)
RETURNS jsonb AS $$
DECLARE
  rendered text := op_bind_sql(p_sql, p_params);
  result_rows jsonb := '[]'::jsonb;
  affected integer := 0;
  first_keyword text := upper(split_part(trim(rendered), ' ', 1));
BEGIN
  IF first_keyword IN ('SELECT', 'WITH') OR rendered ~* '\mRETURNING\M' THEN
    EXECUTE format(
      'SELECT COALESCE(jsonb_agg(to_jsonb(result_row)), ''[]''::jsonb) FROM (%s) result_row',
      rendered
    ) INTO result_rows;
    affected := jsonb_array_length(result_rows);
  ELSE
    EXECUTE rendered;
    GET DIAGNOSTICS affected = ROW_COUNT;
  END IF;
  RETURN jsonb_build_object('rows', result_rows, 'count', affected);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;--> statement-breakpoint
CREATE OR REPLACE FUNCTION op_batch(p_statements jsonb)
RETURNS jsonb AS $$
DECLARE
  statement jsonb;
  result jsonb;
  results jsonb := '[]'::jsonb;
BEGIN
  FOR statement IN SELECT value FROM jsonb_array_elements(p_statements) LOOP
    result := op_query(statement ->> 'sql', COALESCE(statement -> 'params', '[]'::jsonb));
    results := results || jsonb_build_array(jsonb_build_object(
      'results', result -> 'rows',
      'success', true,
      'meta', jsonb_build_object('changes', result -> 'count')
    ));
  END LOOP;
  RETURN results;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;--> statement-breakpoint
REVOKE ALL ON FUNCTION op_bind_sql(text, jsonb) FROM PUBLIC, anon, authenticated;--> statement-breakpoint
REVOKE ALL ON FUNCTION op_query(text, jsonb) FROM PUBLIC, anon, authenticated;--> statement-breakpoint
REVOKE ALL ON FUNCTION op_batch(jsonb) FROM PUBLIC, anon, authenticated;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION op_query(text, jsonb) TO service_role;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION op_batch(jsonb) TO service_role;
