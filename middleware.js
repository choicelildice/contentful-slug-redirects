// Next.js edge middleware — applies redirect rules before any page renders.
// Calls the /api/redirects endpoint to check for a matching rule.
//
// For high-traffic production use, read from a KV store directly in middleware
// rather than making an internal fetch, to avoid added latency on every request.
//
// Contentful provides this sample code solely to demonstrate a technical scenario.
// Any and all sample code provided by Contentful is not intended for production use.
// Contentful is not responsible for maintaining or supporting this sample code.

import { NextResponse } from "next/server";

export async function middleware(req) {
  const { pathname } = req.nextUrl;

  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_BASE_URL}/api/redirects?path=${encodeURIComponent(pathname)}`
    );

    if (res.ok) {
      const rule = await res.json();
      if (rule?.to) {
        const destination = rule.to.startsWith("http")
          ? new URL(rule.to)
          : new URL(rule.to, req.url);
        const statusCode = rule.isPermanent ? 308 : 307;
        return NextResponse.redirect(destination, statusCode);
      }
    }
  } catch {
    // fetch failed — fall through and serve the request normally
  }

  return NextResponse.next();
}

export const config = {
  // Run on all routes except Next.js internals and static assets
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
