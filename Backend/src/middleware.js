import { NextResponse } from "next/server";
import { verifyToken } from "@/app/lib/authentication/jwt";
import * as response from "next/headers";
import corsHeaders from "@/app/lib/cors";

const COOKIE_NAME = "qd_session";
const PROTECTED = ["/dashboard", "/quizzes", "/attempts"];
const AUTH_PAGES = ["/login", "/register"];

export async function middleware(request) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(COOKIE_NAME)?.value;
  const payload = token ? await verifyToken(token) : null;

  if (pathname.startsWith("/api/")) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    return NextResponse.next();
  }

  if (!payload && PROTECTED.some((p) => pathname.startsWith(p))) {
    const url = new URL("/login", request.url).toString();

    url.searchParams.set("next", pathname);

    return NextResponse.redirect(url);
  }

  if (payload && AUTH_PAGES.includes(pathname)) {
    return NextResponse.redirect(new URL("/dashboard", request.url).toString());
  }

  return NextResponse.next();
}
export const config = {
  matcher: [
    "/api/:path*",
    "/dashboard/:path*",
    "/quizzes/:path*",
    "/attempts/:path*",
    "/login",
    "/register",
  ],
};
