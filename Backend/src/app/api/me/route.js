import { successResponse } from "@/app/lib/utils";
import { requireAuth } from "@/app/lib/authentication/session";

export async function GET() {
  const { session, response } = await requireAuth();
  if (response) return response;

  const { user } = session;

  return successResponse(
    {
      user: {
        id: session.userId,
        name: user.name,
        email: session.email,
        role: session.role,
        isAdmin: session.isAdmin,
      },
    },
    200,
  );
}
