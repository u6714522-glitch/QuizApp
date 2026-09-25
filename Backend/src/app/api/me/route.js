import { successResponse } from "@/app/lib/utils";
import { requireAuth } from "@/app/lib/authentication/session";

export async function GET() {
  const { session, response } = await requireAuth();

  if (response) return response;

  return successResponse({ session, response }, 200);
}
