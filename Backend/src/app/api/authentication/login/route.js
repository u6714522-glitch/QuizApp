import bcrypt from "bcrypt";
import { getClientPromise } from "@/app/lib/mongodb";
import { printExceptionLog, errorResponse, successResponse } from "@/app/lib/utils";
import { loginSchema } from "@/app/lib/validation/authentication";
import { issueSession } from "@/app/lib/authentication/session";

// Compared against when the email doesn't exist, so both failures take the same time.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 10);

export async function POST(request) {
  try {
    let body;

    try {
      body = await request.json();
    } catch {
      return errorResponse("Invalid JSON. Request body must be valid JSON.", 400);
    }

    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) return errorResponse(parsed.error.issues[0].message, 400);
    const { email, password } = parsed.data;

    const client = await getClientPromise();
    const user = await client.db(process.env.DB_NAME).collection("users").findOne({ email });

    const passwordOk = await bcrypt.compare(password, user?.password ?? DUMMY_HASH);
    if (!user || !passwordOk) return errorResponse("Invalid email or password", 401);

    await issueSession(user);

    return successResponse(
      { user: { id: user._id.toString(), name: user.name, email: user.email, role: user.role } },
      200,
    );
  } catch (error) {
    printExceptionLog("POST /api/authentication/login", error);

    return errorResponse("Internal Server Error", 500);
  }
}
