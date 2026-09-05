import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/constants";

const PUBLIC_PATHS = new Set([
  "/login",
  "/offline",
  "/api/health",
  "/api/ready",
  "/api/auth/login",
]);

function isPublic(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) {
    return true;
  }
  if (pathname.startsWith("/icons/")) {
    return true;
  }
  if (pathname === "/manifest.webmanifest") {
    return true;
  }
  return false;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);

  if (pathname.startsWith("/api/")) {
    if (isPublic(pathname)) {
      return NextResponse.next();
    }
    if (!hasSession) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "AUTHENTICATION_ERROR",
            message: "Session expirée. Veuillez vous reconnecter.",
          },
        },
        { status: 401 },
      );
    }
    return NextResponse.next();
  }

  if (isPublic(pathname)) {
    // Do not bounce `/login` → `/` on cookie presence: Edge cannot check the
    // session in PostgreSQL. A dead cookie + bounce caused an infinite loop.
    // The login page redirects only after `getCurrentUser()` succeeds.
    return NextResponse.next();
  }

  if (!hasSession) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
