import clsx from "clsx";
import { X } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Button } from "../ui/Button";
import { Logo } from "../ui/Logo";

const PAD = 6; // space between the highlighted element and the spotlight's edge
const GAP = 14; // space between the spotlight and the popover
const MARGIN = 16; // the popover never comes closer than this to the window's edge
const POPOVER_WIDTH = 340;

function subscribe(onChange) {
  window.addEventListener("resize", onChange);
  window.addEventListener("scroll", onChange, true);
  const observer = new ResizeObserver(onChange);
  observer.observe(document.body);
  return () => {
    window.removeEventListener("resize", onChange);
    window.removeEventListener("scroll", onChange, true);
    observer.disconnect();
  };
}

// Window size plus the target's box, re-read whenever layout can change.
function useLayout(selector) {
  const getSnapshot = useCallback(() => {
    const el = selector ? document.querySelector(selector) : null;
    const r = el?.getBoundingClientRect();
    const box = r && r.width > 0 && r.height > 0 ? `${r.top}|${r.left}|${r.width}|${r.height}` : "";
    return `${window.innerWidth}|${window.innerHeight}|${box}`;
  }, [selector]);
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, () => "0|0|");
  const [vw, vh, top, left, width, height] = snapshot.split("|");
  return {
    vw: Number(vw),
    vh: Number(vh),
    rect: top ? { top: Number(top), left: Number(left), width: Number(width), height: Number(height) } : null,
  };
}

function popoverBox({ vw, vh, rect }, placement, popoverHeight) {
  const width = Math.min(POPOVER_WIDTH, vw - MARGIN * 2);
  if (!rect) {
    return { width, left: (vw - width) / 2, top: Math.max(MARGIN, (vh - popoverHeight) / 2) };
  }
  const spot = {
    top: rect.top - PAD,
    left: rect.left - PAD,
    right: rect.left + rect.width + PAD,
    bottom: rect.top + rect.height + PAD,
  };
  const clampLeft = (x) => Math.min(Math.max(x, MARGIN), vw - width - MARGIN);
  const clampTop = (y) => Math.min(Math.max(y, MARGIN), vh - popoverHeight - MARGIN);
  const centreX = spot.left + (spot.right - spot.left) / 2;

  if (placement === "right" && spot.right + GAP + width <= vw - MARGIN) {
    return { width, left: spot.right + GAP, top: clampTop(spot.top + (spot.bottom - spot.top) / 2 - popoverHeight / 2) };
  }
  if (spot.bottom + GAP + popoverHeight <= vh - MARGIN) {
    return { width, left: clampLeft(centreX - width / 2), top: spot.bottom + GAP };
  }
  return { width, left: clampLeft(centreX - width / 2), top: Math.max(MARGIN, spot.top - GAP - popoverHeight) };
}

// Spotlight tour: dims the app, highlights one element at a time and explains
// it in a popover. Keyboard: → next, ← back, Esc skips. `onClose(outcome)` is
// called with "done" or "skipped".
export function GuidedTour({ steps, onClose }) {
  const [index, setIndex] = useState(0);
  const [popoverHeight, setPopoverHeight] = useState(220);
  const popoverRef = useRef(null);
  const primaryRef = useRef(null);
  const titleId = useId();
  const bodyId = useId();

  const step = steps[index];
  const isWelcome = index === 0;
  const isLast = index === steps.length - 1;
  const layout = useLayout(step.target);
  const box = popoverBox(layout, step.placement, popoverHeight);

  const goNext = useCallback(() => {
    if (index >= steps.length - 1) onClose("done");
    else setIndex(index + 1);
  }, [index, steps.length, onClose]);
  const goBack = useCallback(() => setIndex((current) => Math.max(0, current - 1)), []);

  useEffect(() => {
    const el = popoverRef.current;
    if (!el) return undefined;
    const observer = new ResizeObserver(() => setPopoverHeight(el.offsetHeight));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Each step brings its element into view and moves focus to the main button.
  useEffect(() => {
    if (step.target) document.querySelector(step.target)?.scrollIntoView({ block: "nearest" });
    primaryRef.current?.focus({ preventScroll: true });
  }, [step]);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose("skipped");
      } else if (event.key === "ArrowRight") {
        goNext();
      } else if (event.key === "ArrowLeft") {
        goBack();
      } else if (event.key === "Tab") {
        // Keep focus inside the popover while the tour is open.
        const focusable = popoverRef.current?.querySelectorAll("button:not([disabled])");
        if (!focusable?.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [goNext, goBack, onClose]);

  const { rect } = layout;

  return createPortal(
    <div className="fixed inset-0 z-[70]">
      {/* Blocks the app underneath while the tour is open. */}
      <div className="absolute inset-0" aria-hidden="true" />

      {rect ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute rounded-card transition-all duration-300 ease-out"
          style={{
            top: rect.top - PAD,
            left: rect.left - PAD,
            width: rect.width + PAD * 2,
            height: rect.height + PAD * 2,
            // An accent ring around the spotlight, and everything else dimmed.
            boxShadow: "0 0 0 2px var(--color-accent), 0 0 0 9999px rgb(0 0 0 / 0.55)",
          }}
        />
      ) : (
        <div aria-hidden="true" className="animate-overlay-enter absolute inset-0 bg-black/55 backdrop-blur-[2px]" />
      )}

      <div
        ref={popoverRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        className="animate-dialog-enter absolute rounded-card border border-border bg-surface p-5 shadow-pop transition-[top,left] duration-300 ease-out"
        style={{ top: box.top, left: box.left, width: box.width }}
      >
        <div className="flex items-start justify-between gap-3">
          {isWelcome ? (
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10">
              <Logo size={22} />
            </span>
          ) : (
            <span className="font-data pt-0.5 text-[11px] text-text-secondary">
              Step {index} of {steps.length - 1}
            </span>
          )}
          <button
            type="button"
            onClick={() => onClose("skipped")}
            aria-label="Close the tour"
            className="-mr-1.5 -mt-1.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-btn text-text-secondary transition-colors hover:bg-canvas hover:text-text-primary"
          >
            <X size={15} />
          </button>
        </div>

        <h2 id={titleId} className={clsx("font-semibold text-text-primary", isWelcome ? "mt-4 text-[17px]" : "mt-2 text-[15px]")}>
          {step.title}
        </h2>
        <p id={bodyId} className="mt-1.5 text-[13px] leading-relaxed text-text-secondary">
          {step.body}
        </p>

        {!isWelcome && (
          <div className="mt-4 flex gap-1" aria-hidden="true">
            {steps.slice(1).map((s, i) => (
              <span
                key={s.id}
                className={clsx("h-1 flex-1 rounded-full transition-colors", i < index ? "bg-accent" : "bg-border")}
              />
            ))}
          </div>
        )}

        <div className="mt-5 flex items-center justify-between gap-2">
          {isWelcome ? (
            <Button variant="ghost" onClick={() => onClose("skipped")}>
              Skip for now
            </Button>
          ) : (
            <Button variant="ghost" onClick={() => onClose("skipped")}>
              Skip tour
            </Button>
          )}
          <div className="flex gap-2">
            {!isWelcome && (
              <Button variant="secondary" onClick={goBack}>
                Back
              </Button>
            )}
            <Button ref={primaryRef} variant="primary" onClick={goNext}>
              {isWelcome ? "Start the tour" : isLast ? "Finish" : "Next"}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
