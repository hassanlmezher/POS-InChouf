CREATE TRIGGER reserve_stock BEFORE INSERT ON items BEGIN
 SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM products WHERE id=NEW.productId AND tenantId=NEW.tenantId AND active=1 AND stock>=NEW.quantity) THEN RAISE(ABORT,'INSUFFICIENT_STOCK') END;
 UPDATE products SET stock=stock-NEW.quantity WHERE id=NEW.productId AND tenantId=NEW.tenantId;
END;
--> statement-breakpoint
CREATE TRIGGER restore_stock AFTER UPDATE OF status ON orders WHEN NEW.status IN ('Cancelled','Returned') AND OLD.status NOT IN ('Cancelled','Returned') BEGIN
 UPDATE products SET stock=stock+COALESCE((SELECT SUM(quantity) FROM items WHERE tenantId=NEW.tenantId AND orderId=NEW.id AND productId=products.id),0) WHERE tenantId=NEW.tenantId AND id IN (SELECT productId FROM items WHERE tenantId=NEW.tenantId AND orderId=NEW.id);
END;
--> statement-breakpoint
CREATE TRIGGER proof_file_scope BEFORE INSERT ON proofs BEGIN
 SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM files WHERE id=NEW.fileId AND tenantId=NEW.tenantId AND orderId=NEW.orderId) THEN RAISE(ABORT,'FILE_SCOPE') END;
 SELECT CASE WHEN EXISTS (SELECT 1 FROM proofs WHERE tenantId=NEW.tenantId AND orderId=NEW.orderId AND status='Approved') THEN RAISE(ABORT,'PROOF_LOCKED') END;
END;
--> statement-breakpoint
CREATE TRIGGER proof_lock BEFORE UPDATE ON proofs WHEN OLD.status='Approved' BEGIN
 SELECT RAISE(ABORT,'PROOF_LOCKED');
END;
--> statement-breakpoint
CREATE TRIGGER proof_pack_guard BEFORE UPDATE OF status ON orders WHEN NEW.status='Packed' BEGIN
 SELECT CASE WHEN EXISTS (SELECT 1 FROM proofs WHERE tenantId=NEW.tenantId AND orderId=NEW.id) AND NOT EXISTS (SELECT 1 FROM proofs WHERE tenantId=NEW.tenantId AND orderId=NEW.id AND status='Approved') THEN RAISE(ABORT,'PROOF_APPROVAL_REQUIRED') END;
END;
--> statement-breakpoint
CREATE TRIGGER employee_limit BEFORE INSERT ON users WHEN NEW.role NOT IN ('owner','super_admin') AND NEW.active=1 BEGIN
 SELECT CASE WHEN (SELECT COUNT(*) FROM users WHERE tenantId=NEW.tenantId AND role NOT IN ('owner','super_admin') AND active=1)>=2 THEN RAISE(ABORT,'EMPLOYEE_LIMIT') END;
END;
--> statement-breakpoint
CREATE UNIQUE INDEX one_owner ON users(tenantId) WHERE role='owner';
