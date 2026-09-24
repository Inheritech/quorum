import { NextResponse, type NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const nonce = Buffer.from(
    crypto.getRandomValues(new Uint8Array(18)),
  ).toString("base64");
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  const connections = convexUrl
    ? `${new URL(convexUrl).origin} ${new URL(convexUrl).origin.replace(/^https:/, "wss:")}`
    : "";
  const dev = process.env.NODE_ENV !== "production";
  const csp = `default-src 'self'; script-src 'self' 'nonce-${nonce}' 'strict-dynamic' ${dev ? "'unsafe-eval'" : ""}; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' ${connections} ${dev ? "ws://localhost:* ws://127.0.0.1:*" : ""}; frame-ancestors 'none'; base-uri 'none'; object-src 'none'; form-action 'self'`;
  const headers = new Headers(request.headers);
  // Next uses this request policy to nonce its own bootstrap scripts.
  headers.set("x-nonce", nonce);
  headers.set("Content-Security-Policy", csp);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  return response;
}
export const config = {
  matcher: ["/((?!_next/static|_next/image|icon.svg|favicon.ico).*)"],
};
