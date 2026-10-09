"use client";

import { useState, type FormEvent } from "react";
import {
  message,
  type Choice,
  type Question,
  type QuestionInput,
  type QuestionType,
} from "../_lib/api";
import { Field, Notice, input, primary, secondary, danger } from "./workspace";

export function QuestionForm({
  question,
  nextOrder,
  onSave,
  onCancel,
}: {
  question?: Question;
  nextOrder: number;
  onSave: (data: QuestionInput) => Promise<void>;
  onCancel: () => void;
}) {
  const [type, setType] = useState<QuestionType>(question?.type || "multiple_choice");

  const [prompt, setPrompt] = useState(question?.prompt || "");
  const [points, setPoints] = useState(question?.points ?? 1);
  const [order, setOrder] = useState(question?.order || nextOrder);
  const [explanation, setExplanation] = useState(question?.explanation || "");

  const [choices, setChoices] = useState<Choice[]>(
    question?.type === "multiple_choice"
      ? question.choices
      : [
          { key: "A", text: "" },
          { key: "B", text: "" },
        ],
  );

  const [answer, setAnswer] = useState(question?.correctAnswer || "A");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function changeType(value: QuestionType) {
    setType(value);
    setAnswer(value === "multiple_choice" ? choices[0].key : value === "true_false" ? "true" : "");
  }

  function addChoice() {
    const key = "ABCDEFGHIJ"
      .split("")
      .find((letter) => !choices.some((choice) => choice.key === letter));

    if (key && choices.length < 10) setChoices([...choices, { key, text: "" }]);
  }

  function removeChoice(key: string) {
    const rest = choices.filter((choice) => choice.key !== key);

    setChoices(rest);
    if (answer === key) setAnswer(rest[0].key);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError("");

    if (!prompt.trim() || !answer.trim()) {
      setError("Question and correct answer are required.");

      return;
    }

    if (type === "multiple_choice" && choices.some((choice) => !choice.text.trim())) {
      setError("Every choice needs text.");

      return;
    }

    const data: QuestionInput = {
      type,
      prompt: prompt.trim(),
      points,
      order,
      explanation: explanation.trim(),
      correctAnswer: answer.trim(),
    };

    if (type === "multiple_choice")
      data.choices = choices.map((choice) => ({
        ...choice,
        text: choice.text.trim(),
      }));
    setBusy(true);

    try {
      await onSave(data);
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <fieldset disabled={busy} className="space-y-4">
        <Field label="Question type">
          <select
            className={input}
            value={type}
            onChange={(e) => changeType(e.target.value as QuestionType)}
          >
            <option value="multiple_choice">Multiple Choice</option>
            <option value="true_false">True / False</option>
            <option value="short_answer">Short Answer</option>
          </select>
        </Field>
        <Field label="Question">
          <textarea
            className={input}
            rows={3}
            required
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
        </Field>
        {type === "multiple_choice" && (
          <div className="space-y-3">
            {choices.map((choice) => (
              <div key={choice.key} className="flex items-end gap-2">
                <div className="flex-1">
                  <Field label={`Choice ${choice.key}`}>
                    <input
                      className={input}
                      required
                      maxLength={500}
                      value={choice.text}
                      onChange={(e) =>
                        setChoices(
                          choices.map((item) =>
                            item.key === choice.key ? { ...item, text: e.target.value } : item,
                          ),
                        )
                      }
                    />
                  </Field>
                </div>
                <button
                  type="button"
                  className={`${danger} mb-1`}
                  disabled={choices.length <= 2}
                  onClick={() => removeChoice(choice.key)}
                  aria-label={`Remove choice ${choice.key}`}
                >
                  Remove
                </button>
              </div>
            ))}
            <button
              type="button"
              className={secondary}
              disabled={choices.length >= 10}
              onClick={addChoice}
            >
              Add Choice
            </button>
          </div>
        )}
        <Field label="Correct answer">
          {type === "multiple_choice" ? (
            <select className={input} value={answer} onChange={(e) => setAnswer(e.target.value)}>
              {choices.map((choice) => (
                <option key={choice.key} value={choice.key}>
                  {`${choice.key}. ${choice.text || `Choice ${choice.key}`}`}
                </option>
              ))}
            </select>
          ) : type === "true_false" ? (
            <select className={input} value={answer} onChange={(e) => setAnswer(e.target.value)}>
              <option value="true">True</option>
              <option value="false">False</option>
            </select>
          ) : (
            <input
              className={input}
              required
              maxLength={200}
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
            />
          )}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Points">
            <input
              className={input}
              type="number"
              min={0}
              max={100}
              step={1}
              required
              value={points}
              onChange={(e) => setPoints(Number(e.target.value))}
            />
          </Field>
          <Field label="Display order">
            <input
              className={input}
              type="number"
              min={1}
              step={1}
              required
              value={order}
              onChange={(e) => setOrder(Number(e.target.value))}
            />
          </Field>
        </div>
        <Field label="Explanation (shown after grading)">
          <textarea
            className={input}
            rows={2}
            maxLength={2000}
            value={explanation}
            onChange={(e) => setExplanation(e.target.value)}
          />
        </Field>
      </fieldset>
      <Notice>{error}</Notice>
      <div className="flex gap-3">
        <button className={primary} disabled={busy}>
          {busy ? "Saving..." : question ? "Save Question" : "Add Question"}
        </button>
        <button type="button" className={secondary} disabled={busy} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
