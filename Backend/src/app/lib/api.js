export function serializeQuiz({ _id, ownerId, ...rest }) {
  return { id: _id.toString(), ownerId: ownerId.toString(), ...rest };
}

export function serializeQuestion({ _id, quizId, ...rest }) {
  return { id: _id.toString(), quizId: quizId.toString(), ...rest };
}

export function serializeAttempt(a) {
  const { _id, quizId, studentId, answers, student, quiz, ...rest } = a;

  return {
    ...rest,
    id: _id.toString(),
    quizId: quizId.toString(),
    studentId: studentId.toString(),
    ...(answers && {
      answers: answers.map(({ questionId, ...x }) => ({ ...x, questionId: questionId.toString() })),
    }),
    ...(student && { student: { id: student._id.toString(), name: student.name }}),
    ...(quiz && { quiz: { id: quiz._id.toString(), title: quiz.title }}),
  }
}

export function serializeQuestion(doc) {
  return { ...doc, id: doc._id.toString(), quizId: doc.quizId.toString() };
}

