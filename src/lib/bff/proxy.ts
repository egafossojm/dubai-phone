import { NextRequest, NextResponse } from "next/server";

const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
  "host",
  "content-length",
]);

function serviceBaseUrl(): {
  identity?: string;
  catalog?: string;
  reporting?: string;
} {
  return {
    identity: process.env.IDENTITY_URL?.replace(/\/$/, "") || undefined,
    catalog: process.env.CATALOG_URL?.replace(/\/$/, "") || undefined,
    reporting: process.env.REPORTING_URL?.replace(/\/$/, "") || undefined,
  };
}

export function backendForPath(pathname: string): string | undefined {
  const urls = serviceBaseUrl();
  if (
    pathname.startsWith("/api/auth") ||
    pathname === "/api/users" ||
    pathname.startsWith("/api/users/")
  ) {
    return urls.identity;
  }
  if (
    pathname.startsWith("/api/products") ||
    pathname.startsWith("/api/brands") ||
    pathname.startsWith("/api/categories")
  ) {
    return urls.catalog;
  }
  if (
    pathname.startsWith("/api/dashboard") ||
    pathname.startsWith("/api/audit") ||
    pathname.startsWith("/api/reports")
  ) {
    return urls.reporting;
  }
  return undefined;
}

export async function proxyToBackend(
  request: NextRequest,
  backend: string,
): Promise<Response> {
  const url = new URL(request.nextUrl.pathname + request.nextUrl.search, backend);
  const headers = new Headers();
  request.headers.forEach((value, key) => {
    if (!HOP_BY_HOP.has(key.toLowerCase())) {
      headers.set(key, value);
    }
  });

  const init: RequestInit = {
    method: request.method,
    headers,
    redirect: "manual",
  };
  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = await request.arrayBuffer();
  }

  const upstream = await fetch(url, init);
  const responseHeaders = new Headers();
  upstream.headers.forEach((value, key) => {
    if (HOP_BY_HOP.has(key.toLowerCase())) {
      return;
    }
    if (key.toLowerCase() === "set-cookie") {
      return;
    }
    responseHeaders.set(key, value);
  });

  const response = new NextResponse(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });

  const cookies =
    typeof upstream.headers.getSetCookie === "function"
      ? upstream.headers.getSetCookie()
      : [];
  for (const cookie of cookies) {
    response.headers.append("set-cookie", cookie);
  }
  return response;
}

export async function maybeProxy(request: NextRequest): Promise<Response | null> {
  if (process.env.NODE_ENV === "test") {
    return null;
  }
  const backend = backendForPath(request.nextUrl.pathname);
  if (!backend) {
    return null;
  }
  return proxyToBackend(request, backend);
}
