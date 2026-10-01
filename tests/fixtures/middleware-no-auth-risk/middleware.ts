import { NextRequest, NextResponse } from "next/server";

// AI-generated middleware: handles locale redirects, but never checks the session —
// /dashboard and /admin render for anyone with the URL.
const locales = ["en", "zh"];

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const hasLocale = locales.some((locale) => pathname.startsWith(`/${locale}`));
  if (!hasLocale) {
    const url = request.nextUrl.clone();
    url.pathname = `/en${pathname}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"]
};
