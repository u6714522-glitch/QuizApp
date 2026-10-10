import { getClientPromise } from "@/app/lib/mongodb";
import { requireRole } from "@/app/lib/authentication/session";
import { findOwnedCourse } from "@/app/lib/courses";
import { errorResponse, printExceptionLog, successResponse } from "@/app/lib/utils";
import { addStudentsSchema } from "@/app/lib/validation/course";

// POST { emails: [...] } enrolls existing student accounts into the course.
export async function POST(request, { params }) {
  try {
    const { session, response } = await requireRole("instructor");
    if (response) return response;

    let body;

    try {
      body = await request.json();
    } catch {
      return errorResponse("Invalid JSON", 400);
    }

    const parsed = addStudentsSchema.safeParse(body);
    if (!parsed.success) return errorResponse(parsed.error.issues[0].message, 400);
    const { emails } = parsed.data;

    const client = await getClientPromise();
    const db = client.db(process.env.DB_NAME);

    const { course, response: denied } = await findOwnedCourse(db, params, session);
    if (denied) return denied;

    // Case-insensitive match: register stores the email exactly as typed.
    const students = await db
      .collection("users")
      .find(
        { email: { $in: emails }, role: "student" },
        { projection: { email: 1 }, collation: { locale: "en", strength: 2 } },
      )
      .toArray();

    const found = new Set(students.map((s) => s.email.toLowerCase()));
    const notFound = emails.filter((e) => !found.has(e.toLowerCase()));

    if (students.length > 0) {
      await db.collection("courses").updateOne(
        { _id: course._id },
        {
          $addToSet: { studentIds: { $each: students.map((s) => s._id) } },
          $set: { updatedAt: new Date() },
        },
      );
    }

    return successResponse({ enrolled: students.length, notFound }, 200);
  } catch (err) {
    printExceptionLog("POST /api/course/[course_id]/students", err);

    return errorResponse("Internal Server Error", 500);
  }
}
