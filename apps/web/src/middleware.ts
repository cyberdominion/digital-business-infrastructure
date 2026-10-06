import { NextResponse, type NextRequest } from 'next/server';

import { createServerClient } from '@supabase/ssr';

const PUBLIC_ROUTES = ['/', '/login', '/signup', '/auth'];

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

export async function middleware(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const { pathname, search, origin } = requestUrl;

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !isPublicRoute(pathname)) {
    const redirectUrl = new URL('/login', origin);
    redirectUrl.searchParams.set('next', `${pathname}${search}`);
    return NextResponse.redirect(redirectUrl);
  }

  if (user && isPublicRoute(pathname) && pathname !== '/') {
    return NextResponse.redirect(new URL('/workspace', origin));
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};