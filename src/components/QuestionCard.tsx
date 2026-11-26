import { useId, useState } from "react";
import { labels } from "../labels";

const CARD = "card card-app mx-3 mb-2 flex shrink-0 flex-col gap-2 p-3 text-[13px]";
const HEADING = "side-label text-[11px]";
const INPUT = "field field-on min-w-0 px-3 py-1.5 text-[12px] outline-none placeholder:text-muted-foreground";

/** The transcript's question and option labels. */
export type Question = { text: string; options: string[] };
export type QuestionAnswer = { kind: "option"; label: string } | { kind: "other"; text: string };

/** A single-choice AskUserQuestion above the Composer (SRS-FR-166). */
export function QuestionCard({ question, onAnswer }: { question: Question; onAnswer(answer: QuestionAnswer): void }) {
  const textId = useId();
  const name = useId();
  const [picked, setPicked] = useState<string | null>(null);
  const [other, setOther] = useState("");
  const typed = other.trim() !== "";
  const answer: QuestionAnswer | null = typed ? { kind: "other", text: other } : picked !== null ? { kind: "option", label: picked } : null;

  return (
    <div role="group" aria-labelledby={textId} className={CARD}>
      <div className={HEADING}>{labels.questionHeading}</div>
      <div id={textId} className="font-medium">
        {question.text}
      </div>
      <div role="radiogroup" aria-labelledby={textId} className="flex flex-col gap-1">
        {question.options.map((label) => (
          <label key={label} className={`flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 ${picked === label ? "pick-on" : ""}`}>
            <input
              type="radio"
              name={name}
              value={label}
              checked={picked === label}
              onChange={() => {
                setPicked(label);
                setOther("");
              }}
              className="accent-[var(--row-focus)]"
            />
            <span className="min-w-0 flex-1">{label}</span>
          </label>
        ))}
      </div>
      <input
        type="text"
        aria-label={labels.other}
        placeholder={labels.other}
        value={other}
        onChange={(e) => {
          setOther(e.target.value);
          if (e.target.value !== "") setPicked(null);
        }}
        className={INPUT}
      />
      <div className="flex justify-end">
        <button type="button" disabled={!answer} onClick={() => answer && onAnswer(answer)} className="allow px-3 py-1">
          {labels.send}
        </button>
      </div>
    </div>
  );
}

type PlanProps = {
  /** `text` is null when the transcript holds no plan. */
  plan: { text: string | null };
  onApprove(): void;
  onKeepPlanning(feedback: string): void;
};

/** An ExitPlanMode request above the Composer (SRS-FR-167). */
export function PlanCard({ plan, onApprove, onKeepPlanning }: PlanProps) {
  const [feedback, setFeedback] = useState("");
  const headingId = useId();
  return (
    <div role="group" aria-labelledby={headingId} className={CARD}>
      <div id={headingId} className={HEADING}>
        {labels.planHeading}
      </div>
      {plan.text === null ? (
        <div className="sub text-[12px]">{labels.planInTerm}</div>
      ) : (
        // Markdown stays plain text until the Plan view renders it; at most 12 rows, then it scrolls.
        <pre className="max-h-60 overflow-auto whitespace-pre-wrap break-words font-mono text-[12px] leading-5">{plan.text}</pre>
      )}
      <input
        type="text"
        aria-label={labels.planFeedback}
        placeholder={labels.planFeedback}
        value={feedback}
        onChange={(e) => setFeedback(e.target.value)}
        className={INPUT}
      />
      <div className="flex justify-end gap-2">
        <button type="button" disabled={feedback.trim() === ""} onClick={() => onKeepPlanning(feedback)} className="outline-btn px-3 py-1">
          {labels.keepPlanning}
        </button>
        <button type="button" onClick={onApprove} className="allow px-3 py-1">
          {labels.approvePlan}
        </button>
      </div>
    </div>
  );
}
