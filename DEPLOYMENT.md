# Deployment status and remaining work

The current implementation uses Vinext on Cloudflare Workers with Sites-managed D1 and R2. It is not a PostgreSQL/Vercel deployment.

The Sites project has been registered as InChouf OrderPilot (`appgprj_6a9c1233527481919635712e9d8b5aba`). No successful publication or live application URL has been verified. Source must be committed and pushed using a fresh temporary Sites credential, built, packaged, saved as a version and deployed. Set private BOOTSTRAP_TOKEN and SITE_HOST environment values before provisioning; remove bootstrap access afterward. Never commit credentials.

## Existing domain inspection

At inspection, inchouf.com used GoDaddy nameservers ns39.domaincontrol.com and ns40.domaincontrol.com, apex A 216.198.79.1, and redirected to www.inchouf.com on Vercel. The signed-in Vercel project pos-whatsapp already serves the existing website. It was not overwritten. The visible Supabase project was unrelated and was not used.

Before DNS changes, recheck current records and the official documentation:
- https://vercel.com/docs/domains/working-with-domains
- https://vercel.com/docs/domains/working-with-nameservers
- https://developers.cloudflare.com/dns/manage-dns-records/reference/wildcard-dns-records/

After publishing, register inchouf.com, app.inchouf.com, admin.inchouf.com and the supported tenant/wildcard hostnames with the chosen hosting service. Copy only the exact CNAME/A/TXT targets returned by that service into GoDaddy. Preserve mail and unrelated verification records. Do not guess DNS targets or replace nameservers without reviewing existing records. Exact new DNS values are not available until custom-domain registration succeeds.

Verify certificates and every host, valid and unknown tenant routing, tenant suspension, cross-tenant access, checkout, R2 proof access, tracking revocation, and independent login on the actual deployment. A private Sites preview can require an additional hosting access gate; public customer storefront operation needs the correct public hosting policy.

No domain is claimed deployed by this document. See docs/PRODUCTION-CHECKLIST.md for operational requirements.
