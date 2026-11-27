import { useId, useState } from "react";
import { labels } from "../labels";
import { CARD, CARD_HEADING, CARD_INPUT } from "./cardStyles";

type Props = {
  plan: { text: string | null };
  onApprove(): void;
  onKeepPlanning(feedback: string): void;
};

/** An ExitPlanMode request above the Composer (SRS-FR-167). */
export function PlanCard({ plan, onApprove, onKeepPlanning }: Props) {
  const [feedback, setFeedback] = useState("");
  const headingId = useId();
  return (
    <div role="group" aria-labelledby={headingId} className={CARD}>
      <div id={headingId} className={CARD_HEADING}>
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
        className={CARD_INPUT}
      />
      <div className="card-actions">
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
