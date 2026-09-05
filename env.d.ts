declare namespace Cloudflare {
  interface Env {
    FILES: R2Bucket;
    SUPABASE_URL: string;
    SUPABASE_ANON_KEY: string;
    SUPABASE_SERVICE_ROLE_KEY: string;
    SITE_HOST?: string;
    BOOTSTRAP_TOKEN?: string;
  }
}
