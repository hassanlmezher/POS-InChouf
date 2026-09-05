# Before onboarding a real business

- [ ] Verify the deployed Worker, database migrations, R2 uploads and independent login on the final public hostname.
- [ ] Resolve public access and custom-domain DNS/certificate validation; test wildcard tenant routing.
- [ ] Replace platform contacts in `config/contact.ts` and rebuild promotional outputs.
- [ ] Rotate initial demo/admin passwords and keep private credentials out of Git, screenshots and chat.
- [ ] Remove the hosted bootstrap environment value after provisioning.
- [ ] Review business/customer privacy language, retention periods, backup/restore procedures and incident handling.
- [ ] Confirm Starter employee seats and manual subscription policy with the first merchant.
- [ ] Configure the merchant's own products/images, categories, delivery zones, contacts and payment instructions.
- [ ] Exercise the full order/return/refund/cash reconciliation workflow with the merchant.
- [ ] Load-test checkout concurrency, password hashing and storage limits on the actual hosting plan.
- [ ] Decide whether pooled product stock is sufficient or independent variant inventories are needed.
- [ ] Decide whether 500-record analytics need server-side pagination and wider aggregate reports for the merchant's volume.
- [ ] Establish file retention, scanning, cleanup and database recovery policies.
- [ ] Run all tests, dependency auditing, type checking and production build after changes.

No payment gateway, messaging provider or courier API is required. Do not copy credentials from unrelated Vercel or Supabase projects.
