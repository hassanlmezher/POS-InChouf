export function supabaseJsonHeaders(key: string, init?: HeadersInit) {
  const headers = new Headers(init);
  headers.set('apikey', key);
  if (!key.startsWith('sb_')) headers.set('Authorization', `Bearer ${key}`);
  headers.set('Content-Type', 'application/json');
  return headers;
}
