# Before onboarding a real business

- [ ] Verify the deployed Worker, Supabase migrations/RLS, R2 uploads and independent Supabase Auth login on the final public hostname.
- [ ] Resolve public access and custom-domain DNS/certificate validation; test wildcard tenant routing.
- [ ] Replace platform contacts in `config/contact.ts` and rebuild promotional outputs.
- [ ] Rotate initial demo/admin passwords and keep private credentials out of Git, screenshots and chat.
- [ ] Remove the hosted `BOOTSTRAP_TOKEN` after provisioning and confirm no service-role key is client-exposed.
- [ ] Review business/customer privacy language, retention periods, backup/restore procedures and incident handling.
- [ ] Confirm Starter employee seats and manual subscription policy with the first merchant.
- [ ] Configure the merchant's own products/images, categories, delivery zones, contacts and payment instructions.
- [ ] Exercise the full order/return/refund/cash reconciliation workflow with the merchant.
- [ ] Load-test checkout concurrency, Supabase RPC/Auth limits and R2 storage limits on the actual plans.
- [ ] Decide whether pooled product stock is sufficient or independent variant inventories are needed.
- [ ] Decide whether 500-record analytics need server-side pagination and wider aggregate reports for the merchant's volume.
- [ ] Establish file retention, scanning, cleanup and database recovery policies.
- [ ] Confirm RLS is enabled for every tenant-owned table and test a second tenant with the Supabase API.
- [ ] Run all tests, dependency auditing, type checking and production build after changes.

No payment gateway, messaging provider or courier API is required. Do not copy credentials from unrelated Vercel or Supabase projects.
