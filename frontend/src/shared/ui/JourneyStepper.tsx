type Step = "learn" | "watch" | "setup" | "practice" | "feedback";

const LABELS: Record<Step, string> = {
  learn: "Learn",
  watch: "Watch",
  setup: "Setup",
  practice: "Practice",
  feedback: "Feedback",
};

const ORDER: Step[] = ["learn", "watch", "setup", "practice", "feedback"];

export function JourneyStepper({
  active,
  liveLabel,
}: {
  active: Step;
  liveLabel?: string;
}) {
  const idx = ORDER.indexOf(active);
  return (
    <div className="journey-stepper">
      <div className="journey-stepper-inner">
        {ORDER.map((step, i) => {
          const done = i < idx;
          const current = i === idx;
          return (
            <div key={step} className="journey-step-group">
              {i > 0 && <span className="journey-rail" aria-hidden />}
              <div
                className={`journey-step ${done ? "done" : ""} ${current ? "current" : ""}`}
              >
                <span className="journey-dot">
                  {done ? "✓" : current && liveLabel ? "" : i + 1}
                  {current && liveLabel ? <span className="live-ping" /> : null}
                </span>
                <span className="journey-label">
                  {i + 1}. {LABELS[step]}
                  {current && liveLabel ? (
                    <span className="live-chip">{liveLabel}</span>
                  ) : null}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
