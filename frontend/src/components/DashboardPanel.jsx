const TONE_CLASSES = {
  neutral: "border-slate-700 bg-slate-800 text-slate-300",
  success: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  warning: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  error: "border-rose-500/30 bg-rose-500/10 text-rose-300",
  info: "border-cyan-500/30 bg-cyan-500/10 text-cyan-300",
};

export function DashboardPanel({
  title,
  icon: Icon,
  badge = "Idle",
  badgeTone = "neutral",
  children,
  className = "",
}) {
  return (
    <section
      className={`flex flex-col rounded-xl border border-slate-800 bg-slate-900/70 p-5 shadow-sm ${className}`}
    >
      <div className="mb-4 flex items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-2">
          {Icon && <Icon className="h-4 w-4 text-cyan-400" />}
          <h3 className="text-sm font-semibold text-slate-100">{title}</h3>
        </div>
        <span
          className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${TONE_CLASSES[badgeTone] || TONE_CLASSES.neutral}`}
        >
          {badge}
        </span>
      </div>
      <div className="flex-1">{children}</div>
    </section>
  );
}
