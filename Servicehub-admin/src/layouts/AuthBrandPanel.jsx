import { Radar, ShieldCheck, Sparkles } from "lucide-react";

const FEATURES = [
  {
    icon: Radar,
    text: "Live booking and provider oversight across your service area",
  },
  {
    icon: Sparkles,
    text: "AI-assisted support that drafts replies and checks refund eligibility instantly",
  },
  {
    icon: ShieldCheck,
    text: "Role-based access — every team member sees exactly what their job needs",
  },
];

export function AuthBrandPanel() {
  return (
    <div className="relative hidden flex-1 overflow-hidden border-l border-border bg-surface md:flex md:items-center md:justify-center">
      <svg
        className="pointer-events-none absolute -right-24 -top-24 text-accent opacity-[0.08]"
        width="420"
        height="420"
        viewBox="0 0 420 420"
        fill="none"
        aria-hidden="true"
      >
        <rect x="0" y="0" width="260" height="260" rx="48" stroke="currentColor" strokeWidth="2" />
        <rect x="140" y="140" width="260" height="260" rx="48" stroke="currentColor" strokeWidth="2" />
      </svg>
      <svg
        className="pointer-events-none absolute -bottom-28 -left-16 text-accent opacity-[0.06]"
        width="320"
        height="320"
        viewBox="0 0 320 320"
        fill="none"
        aria-hidden="true"
      >
        <rect x="0" y="0" width="200" height="200" rx="40" stroke="currentColor" strokeWidth="2" />
      </svg>

      <div className="relative flex max-w-[440px] flex-col gap-10 px-12 py-16">
        <div className="flex flex-col gap-3">
          <h2 className="text-balance text-[22px] font-semibold leading-snug text-text-primary">
            Every booking, every conversation, every decision — in one place.
          </h2>
          <p className="text-[13px] leading-relaxed text-text-secondary">
            ServiHub gives your team real-time visibility into bookings and support, backed by an
            AI copilot that reads every ticket so agents don't have to start from zero.
          </p>
        </div>

        <ul className="flex flex-col gap-4">
          {FEATURES.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-start gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-btn bg-accent/10 text-accent">
                <Icon size={15} />
              </span>
              <span className="pt-1 text-[13px] leading-relaxed text-text-secondary">{text}</span>
            </li>
          ))}
        </ul>

        <p className="text-[12px] text-text-secondary">
          © 2026 ServiHub — Internal Operations Platform
        </p>
      </div>
    </div>
  );
}
