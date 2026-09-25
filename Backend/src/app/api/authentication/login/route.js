import bcrypt from "bcrypt";
import { getClientPromise } from "@/app/lib/mongodb";
import { printExceptionLog, errorResponse, successResponse } from "@/app/lib/utils";
import { loginSchema } from "@/app/lib/validation/authentication";
import { issueSession } from "@/app/lib/authentication/session";

export async function POST(request) {
  try {
    let body;

    try {
      body = await request.json();
    } catch {
      return errorResponse(400, "Invalid JSON. Request body must be a valid JSON");
    }

    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse(`${parsed.error.issues[0].message}`, 400);
    }

    const { email, password } = parsed.data;

    const client = await getClientPromise();
    const user = client.db(process.env.DB_NAME).collection("Users").findOne({ email });

    const passwordOk = await bcrypt.compare(password, user.password);

    if (!user || !passwordOk) {
      return errorResponse("Invalid Credentials.", 401);
    }

    await issueSession(user);

    return successResponse(user, 200);
  } catch (error) {
    printExceptionLog("POST /api/auth/login", error);

    return errorResponse("Internal Server Error", 500);
  }
}
