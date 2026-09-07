DROP TRIGGER IF EXISTS proof_pack_guard ON orders;--> statement-breakpoint
DROP FUNCTION IF EXISTS proof_pack_guard();--> statement-breakpoint
DROP TRIGGER IF EXISTS proof_lock ON proofs;--> statement-breakpoint
DROP FUNCTION IF EXISTS proof_lock();--> statement-breakpoint
DROP TRIGGER IF EXISTS proof_file_scope ON proofs;--> statement-breakpoint
DROP FUNCTION IF EXISTS proof_file_scope();
