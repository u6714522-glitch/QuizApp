import { getClientPromise } from "@/app/lib/mongodb";
import { requireRole } from "@/app/lib/authentication/session";
import { serializeCourse } from "@/app/lib/api";
import { findOwnedCourse } from "@/app/lib/courses";
import corsHeaders from "@/app/lib/cors";
import { errorResponse, printExceptionLog, successResponse } from "@/app/lib/utils";
import { courseUpdateSchema } from "@/app/lib/validation/course";

export async function GET(request, { params }) {
  try {
    const { session, response } = await requireRole("instructor");
    if (response) return response;

    const client = await getClientPromise();
    const db = client.db(process.env.DB_NAME);

    const { course, response: denied } = await findOwnedCourse(db, params, session);
    if (denied) return denied;

    const students = await db
      .collection("users")
      .find({ _id: { $in: course.studentIds } }, { projection: { name: 1, email: 1 } })
      .sort({ name: 1 })
      .toArray();

    const quizCount = await db.collection("quizzes").countDocuments({ courseCode: course.code });

    return successResponse(
      {
        course: serializeCourse(course),
        students: students.map((s) => ({ id: s._id.toString(), name: s.name, email: s.email })),
        quizCount,
      },
      200,
    );
  } catch (err) {
    printExceptionLog("GET /api/course/[course_id]", err);

    return errorResponse("Internal Server Error", 500);
  }
}

export async function PUT(request, { params }) {
  try {
    const { session, response } = await requireRole("instructor");
    if (response) return response;

    let body;

    try {
      body = await request.json();
    } catch {
      return errorResponse("Invalid JSON", 400);
    }

    const parsed = courseUpdateSchema.safeParse(body);
    if (!parsed.success) return errorResponse(parsed.error.issues[0].message, 400);

    const client = await getClientPromise();
    const db = client.db(process.env.DB_NAME);

    const { course, response: denied } = await findOwnedCourse(db, params, session);
    if (denied) return denied;

    const updated = await db
      .collection("courses")
      .findOneAndUpdate(
        { _id: course._id },
        { $set: { name: parsed.data.name, updatedAt: new Date() } },
        { returnDocument: "after" },
      );

    return successResponse(serializeCourse(updated), 200);
  } catch (err) {
    printExceptionLog("PUT /api/course/[course_id]", err);

    return errorResponse("Internal Server Error", 500);
  }
}

export async function DELETE(request, { params }) {
  try {
    const { session, response } = await requireRole("instructor");
    if (response) return response;

    const client = await getClientPromise();
    const db = client.db(process.env.DB_NAME);

    const { course, response: denied } = await findOwnedCourse(db, params, session);
    if (denied) return denied;

    // Refuse rather than unassign: an unassigned quiz would become visible to ALL students.
    const assigned = await db.collection("quizzes").countDocuments({ courseCode: course.code });

    if (assigned > 0) {
      return errorResponse(
        `Reassign or delete the ${assigned} quiz(zes) in this course first`,
        409,
      );
    }

    await db.collection("courses").deleteOne({ _id: course._id });

    return new Response(null, { status: 204, headers: corsHeaders });
  } catch (err) {
    printExceptionLog("DELETE /api/course/[course_id]", err);

    return errorResponse("Internal Server Error", 500);
  }
}
