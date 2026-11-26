import { useId, useState } from "react";
import { labels } from "../labels";
import { CARD, CARD_HEADING, CARD_INPUT } from "./cardStyles";

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
      <div className={CARD_HEADING}>{labels.questionHeading}</div>
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
        className={CARD_INPUT}
      />
      <div className="flex justify-end">
        <button type="button" disabled={!answer} onClick={() => answer && onAnswer(answer)} className="allow px-3 py-1">
          {labels.send}
        </button>
      </div>
    </div>
  );
}
