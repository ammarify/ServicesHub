import { BadgeCheck, Radar, ShieldCheck, Sparkles, UsersRound } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import { Avatar } from "../components/ui/Avatar";
import { StatusBadge } from "../components/ui/StatusBadge";
import { TypingDots } from "../components/ui/TypingDots";

const FEATURES = [
  { icon: Radar, text: "Live bookings and provider availability" },
  { icon: Sparkles, text: "AI drafts replies and checks refund policy" },
  { icon: UsersRound, text: "Every role sees exactly what its job needs" },
];

// The preview is drawn at this size and scaled down to the space it gets.
const PREVIEW_WIDTH = 424;
const PREVIEW_HEIGHT = 340;
// Below this it would be too small to read; the panel leaves it out.
const MIN_PREVIEW_SCALE = 0.55;

// A still life of the product: a live ticket, the Copilot's verdict on it and
// the booking it's about. Decorative, so hidden from assistive technology.
function ProductPreview() {
  return (
    <div aria-hidden="true" className="relative select-none" style={{ width: PREVIEW_WIDTH, height: PREVIEW_HEIGHT }}>
      <div className="animate-preview-enter absolute left-0 top-0 w-[320px] rounded-card border border-border bg-surface p-4 shadow-pop" style={{ animationDelay: "80ms" }}>
        <div className="flex items-center justify-between gap-3">
          <span className="truncate text-[13px] font-semibold text-text-primary">Cleaner cancelled twice</span>
          <span className="flex shrink-0 items-center gap-1.5 text-[11px] font-medium text-success">
            <span className="animate-live h-1.5 w-1.5 rounded-full bg-success" />
            Live
          </span>
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-[11px] text-text-secondary">
          <span className="font-data">TK-232</span>
          <span>Emily Johnson</span>
        </div>
        <div className="mt-3 rounded-card rounded-tl-none border border-border bg-canvas px-3 py-2 text-[12px] leading-relaxed text-text-primary">
          My cleaner cancelled twice already. Please send someone reliable.
        </div>
        <div className="mt-2.5 flex items-center gap-2 text-[11px] text-text-secondary">
          <TypingDots className="text-accent" />
          Madison is replying
        </div>
      </div>

      <div className="animate-preview-enter absolute right-0 top-[138px] w-[250px] rounded-card border border-border bg-surface p-4 shadow-pop" style={{ animationDelay: "260ms" }}>
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-accent">
          <Sparkles size={12} />
          AI Copilot
        </div>
        <div className="mt-2.5 text-[11px] text-text-secondary">Refund eligibility</div>
        <div className="mt-0.5 text-[15px] font-semibold text-text-primary">
          Eligible, <span className="font-data">70%</span>
        </div>
        <div className="mt-2 flex items-start gap-1.5 text-[11px] leading-snug text-text-secondary">
          <ShieldCheck size={12} className="mt-px shrink-0 text-success" />
          Capped by policy, Section 4
        </div>
      </div>

      <div className="animate-preview-enter absolute left-6 top-[246px] w-[290px] rounded-card border border-border bg-surface p-4 shadow-pop" style={{ animationDelay: "440ms" }}>
        <div className="flex items-center justify-between">
          <span className="font-data text-[12px] text-text-secondary">BK-4853</span>
          <StatusBadge status="assigned" />
        </div>
        <div className="mt-2.5 flex items-center gap-2.5">
          <Avatar name="Crystal Howard" size={30} />
          <div className="min-w-0">
            <div className="flex items-center gap-1 text-[13px] font-medium text-text-primary">
              Crystal Howard
              <BadgeCheck size={13} className="text-success" />
            </div>
            <div className="text-[11px] text-text-secondary">Maid service, Saturday 2:45 PM</div>
          </div>
          <span className="font-data ml-auto text-[13px] font-semibold text-text-primary">$135</span>
        </div>
      </div>
    </div>
  );
}

// Gives the preview whatever height is left in the panel (up to its natural
// size) and scales it to fit, so the sign-in page never needs to scroll.
function FittedPreview() {
  const frameRef = useRef(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const frame = frameRef.current;
    if (!frame) return undefined;
    function fit() {
      const { width, height } = frame.getBoundingClientRect();
      if (width === 0) return; // hidden below lg
      setScale(Math.min(1, width / PREVIEW_WIDTH, height / PREVIEW_HEIGHT));
    }
    fit();
    if (typeof ResizeObserver !== "function") return undefined;
    const observer = new ResizeObserver(fit);
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={frameRef} className="relative hidden min-h-0 shrink basis-[340px] lg:block [@media(max-height:540px)]:hidden">
      {scale >= MIN_PREVIEW_SCALE && (
        <div className="absolute left-0 top-0 origin-top-left" style={{ transform: `scale(${scale})` }}>
          <ProductPreview />
        </div>
      )}
    </div>
  );
}

export function AuthBrandPanel() {
  return (
    <div className="relative hidden h-full flex-1 overflow-hidden md:flex md:justify-center">
      <svg className="pointer-events-none absolute inset-0 h-full w-full text-border" aria-hidden="true">
        <defs>
          <pattern id="auth-dot-grid" width="24" height="24" patternUnits="userSpaceOnUse">
            <circle cx="1.5" cy="1.5" r="1.5" fill="currentColor" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#auth-dot-grid)" />
      </svg>

      <div className="relative flex h-full w-full max-w-[520px] flex-col justify-center gap-10 px-10 py-16 lg:px-12 short:gap-7 short:py-10 shorter:gap-5 shorter:py-8">
        <div className="flex shrink-0 flex-col gap-3">
          <h2 className="text-balance text-[22px] font-semibold leading-snug text-text-primary">
            Every booking, every conversation, every decision in one place.
          </h2>
          <p className="max-w-[440px] text-[13px] leading-relaxed text-text-secondary">
            Your team watches bookings and support as they happen, with an AI copilot that reads each ticket
            and checks it against your refund policy before anyone replies.
          </p>
        </div>

        <FittedPreview />

        <ul className="flex shrink-0 flex-col gap-3 lg:flex-row lg:flex-wrap lg:gap-x-6 short:gap-y-2">
          {FEATURES.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-2 text-[12px] text-text-secondary">
              <Icon size={14} className="shrink-0 text-accent" />
              {text}
            </li>
          ))}
        </ul>

        <p className="shrink-0 text-[12px] text-text-secondary">© 2026 ServiHub, internal operations platform</p>
      </div>
    </div>
  );
}
