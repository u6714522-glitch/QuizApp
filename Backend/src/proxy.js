import { NextResponse } from "next/server";
import corsHeaders from "@/app/lib/cors";

export function proxy(request) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  return NextResponse.next();
}

export const config = { matcher: "/api/:path*" };
