import {parseObjectId} from "@/app/lib/params";

export function quizAccess(session, quiz) {
  if (quiz.ownerId.toString() === session.sub) return "owner";
  
  const now = new Date();

  const isOpen = 
    quiz.status === "published" &&
    (!quiz.opensAt || quiz.opensAt <= now) &&
    (!quiz.closesAt || quiz.closesAt > now);
  
  return isOpen ? "reader" : null; 
}

function getQuizId(request) {
  return parseObjectId({ quizId: request.nextUrl.searchParams.get("quizId") }, "quizId");
}

export const READER_PROJECTION = { correctAnswer: 0, explanation: 0 };
