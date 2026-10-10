import { ObjectId } from "mongodb";
import { getClientPromise } from "@/app/lib/mongodb";
import { requireAuth, requireRole } from "@/app/lib/authentication/session";
import { serializeCourse } from "@/app/lib/api";
import { errorResponse, printExceptionLog, successResponse } from "@/app/lib/utils";
import { courseCreateSchema } from "@/app/lib/validation/course";

export async function GET() {
  try {
    const { session, response } = await requireAuth();
    if (response) return response;

    const userId = new ObjectId(session.userId);

    // Instructors see courses they own; students see courses they're enrolled in.
    const filter = session.role === "instructor" ? { ownerId: userId } : { studentIds: userId };

    const client = await getClientPromise();
    const db = client.db(process.env.DB_NAME);

    const courses = await db.collection("courses").find(filter).sort({ code: 1 }).toArray();

    return successResponse(courses.map(serializeCourse), 200);
  } catch (err) {
    printExceptionLog("GET /api/course", err);

    return errorResponse("Internal Server Error", 500);
  }
}

export async function POST(request) {
  try {
    const { session, response } = await requireRole("instructor");
    if (response) return response;

    let body;

    try {
      body = await request.json();
    } catch {
      return errorResponse("Invalid JSON", 400);
    }

    const parsed = courseCreateSchema.safeParse(body);
    if (!parsed.success) return errorResponse(parsed.error.issues[0].message, 400);

    const now = new Date();

    const course = {
      code: parsed.data.code,
      name: parsed.data.name,
      ownerId: new ObjectId(session.userId),
      studentIds: [],
      createdAt: now,
      updatedAt: now,
    };

    const client = await getClientPromise();
    const db = client.db(process.env.DB_NAME);

    try {
      await db.collection("courses").insertOne(course); // adds course._id
    } catch (err) {
      // needs the unique index on courses.code
      if (err.code === 11000) {
        return errorResponse(`Course code ${course.code} already exists`, 409);
      }

      throw err;
    }

    return successResponse(serializeCourse(course), 201);
  } catch (err) {
    printExceptionLog("POST /api/course", err);

    return errorResponse("Internal Server Error", 500);
  }
}
