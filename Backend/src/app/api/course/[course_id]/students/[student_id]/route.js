import { getClientPromise } from "@/app/lib/mongodb";
import { requireRole } from "@/app/lib/authentication/session";
import { findOwnedCourse } from "@/app/lib/courses";
import { parseObjectId } from "@/app/lib/params";
import corsHeaders from "@/app/lib/cors";
import { errorResponse, printExceptionLog } from "@/app/lib/utils";

export async function DELETE(request, { params }) {
  try {
    const { session, response } = await requireRole("instructor");
    if (response) return response;

    const studentId = await parseObjectId(params, "student_id");
    if (!studentId) return errorResponse("Invalid student id", 400);

    const client = await getClientPromise();
    const db = client.db(process.env.DB_NAME);

    const { course, response: denied } = await findOwnedCourse(db, params, session);
    if (denied) return denied;

    await db
      .collection("courses")
      .updateOne(
        { _id: course._id },
        { $pull: { studentIds: studentId }, $set: { updatedAt: new Date() } },
      );

    return new Response(null, { status: 204, headers: corsHeaders });
  } catch (err) {
    printExceptionLog("DELETE /api/course/[course_id]/students/[student_id]", err);

    return errorResponse("Internal Server Error", 500);
  }
}
