import { NextResponse } from "next/server";
import { verifyToken } from "@/app/lib/authentication/jwt";

const COOKIE_NAME = "qd_session";
const PROTECTED = ["/dashboard", "/quizzes", "/attempts"];
const AUTH_PAGES = ["/login", "/register"];

export async function middleware(request) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(COOKIE_NAME)?.value;
  const payload = token ? await verifyToken(token) : null;

  if (!payload && PROTECTED.some((p) => pathname.startsWith(p))) {
    const url = new URL("/login", request.url);

    url.searchParams.set("next", pathname);

    return NextResponse.redirect(url);
  }

  if (payload && AUTH_PAGES.includes(pathname)) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/quizzes/:path*", "/attempts/:path*", "/login", "/register"],
};
