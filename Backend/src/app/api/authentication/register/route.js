import bcrypt from "bcrypt";
import { getClientPromise } from "@/app/lib/mongodb";
import { errorResponse, successResponse, printExceptionLog } from "@/app/lib/utils";
import { registerSchema } from "@/app/lib/validation/authentication";
import { issueSession } from "@/app/lib/authentication/session";

export async function POST(request) {
  try {
    let body;

    try {
      body = await request.json();
    } catch {
      return errorResponse("Invalid JSON. Request body must be valid JSON.", 400);
    }

    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) return errorResponse(parsed.error.issues[0].message, 400);
    const { name, email, password } = parsed.data;

    const client = await getClientPromise();
    const users = client.db(process.env.DB_NAME).collection("users");

    const now = new Date();

    const doc = {
      name,
      email,
      password: await bcrypt.hash(password, 10),
      role: "student", // never taken from the request
      tokenVersion: 0,
      createdAt: now,
      updatedAt: now,
    };

    try {
      await users.insertOne(doc); // adds doc._id
    } catch (err) {
      if (err.code === 11000) return errorResponse("Email is already registered", 409);
      throw err;
    }

    await issueSession(doc);

    return successResponse(
      { user: { id: doc._id.toString(), name: doc.name, email: doc.email, role: doc.role } },
      201,
    );
  } catch (err) {
    printExceptionLog("POST /api/authentication/register", err);

    return errorResponse("Internal Server Error", 500);
  }
}
