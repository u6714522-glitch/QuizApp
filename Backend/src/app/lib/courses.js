import { ObjectId } from "mongodb";
import { parseObjectId } from "@/app/lib/params";
import { errorResponse } from "@/app/lib/utils";

// Codes of every course the student is enrolled in.
export async function enrolledCourseCodes(db, studentId) {
  const courses = await db
    .collection("courses")
    .find({ studentIds: new ObjectId(studentId) }, { projection: { code: 1 } })
    .toArray();

  return courses.map((c) => c.code);
}

export async function isEnrolled(db, studentId, code) {
  const count = await db
    .collection("courses")
    .countDocuments({ code, studentIds: new ObjectId(studentId) }, { limit: 1 });

  return count > 0;
}

export async function ownsCourse(db, instructorId, code) {
  const count = await db
    .collection("courses")
    .countDocuments({ code, ownerId: new ObjectId(instructorId) }, { limit: 1 });

  return count > 0;
}

// Loads /api/course/[course_id] and checks the caller owns it.
export async function findOwnedCourse(db, params, session) {
  const courseId = await parseObjectId(params, "course_id");
  if (!courseId) return { course: null, response: errorResponse("Invalid course id", 400) };

  const course = await db.collection("courses").findOne({ _id: courseId });
  if (!course) return { course: null, response: errorResponse("Course not found", 404) };

  if (course.ownerId.toString() !== session.userId) {
    return { course: null, response: errorResponse("You can only manage your own courses", 403) };
  }

  return { course, response: null };
}
