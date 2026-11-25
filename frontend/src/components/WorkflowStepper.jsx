export function WorkflowStepper({ steps, activeStep, onSelectStep }) {
  return (
    <div className="border-b border-[var(--border-default)] bg-[var(--bg-header)]">
      <nav
        aria-label="Repository recovery navigation"
        className="mx-auto flex max-w-7xl overflow-x-auto px-4 sm:px-6"
      >
        <ul className="flex min-w-max items-center gap-1">
          {steps.map((step) => {
            const isActive = activeStep === step.id;
            const isEnabled = step.enabled;

            return (
              <li key={step.id}>
                <button
                  type="button"
                  disabled={!isEnabled}
                  onClick={() => onSelectStep(step.id)}
                  className={`relative flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition ${
                    isActive
                      ? "border-[var(--accent-tab)] text-[var(--text-primary)]"
                      : isEnabled
                        ? "border-transparent text-[var(--text-secondary)] hover:border-[var(--border-default)] hover:text-[var(--text-primary)]"
                        : "cursor-not-allowed border-transparent text-[var(--text-muted)] opacity-50"
                  }`}
                >
                  <span>{step.label}</span>
                  {step.done && (
                    <span className="h-2 w-2 rounded-full bg-[#2da44e]" />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
