import { NextResponse, type NextRequest } from 'next/server';
import { hostTenant, validHost } from './lib/server/security';
export function middleware(req: NextRequest) {
  const host = req.nextUrl.host;
  if (!validHost(host, 'inchouf-orderpilot.copper-goat-7392.chatgpt.site'))
    return new NextResponse('Unknown host', { status: 400 });
  const slug = hostTenant(host);
  const url = req.nextUrl.clone();
  if (
    !url.pathname.startsWith('/api') &&
    !url.pathname.startsWith('/_') &&
    !url.pathname.includes('.')
  ) {
    if (slug) {
      if (url.pathname.startsWith('/store/')) {
        if (
          !url.pathname.startsWith(`/store/${slug}/`) &&
          url.pathname !== `/store/${slug}`
        )
          return new NextResponse('Store not found', { status: 404 });
      } else {
        url.pathname = `/store/${slug}${url.pathname === '/' ? '' : url.pathname}`;
        return NextResponse.rewrite(url);
      }
    } else if (url.pathname === '/') {
      if (host.startsWith('app.')) {
        url.pathname = '/pos';
        return NextResponse.rewrite(url);
      }
      if (host.startsWith('admin.')) {
        url.pathname = '/admin';
        return NextResponse.rewrite(url);
      }
    }
  }
  const res = NextResponse.next();
  res.headers.set('X-Frame-Options', 'SAMEORIGIN');
  res.headers.set('Referrer-Policy', 'no-referrer');
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=()',
  );
  return res;
}
