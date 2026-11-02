import { useEffect, useState } from "react";
import { Logo } from "./ui/Logo";

// A server on free hosting sleeps when idle and takes up to a minute to start
// again. While waiting on it (`waitingForServer`), the loader explains a long
// wait after a few seconds.
const SLOW_AFTER_MS = 3000;

export function FullPageLoader({ waitingForServer = false }) {
  const [isSlow, setIsSlow] = useState(false);

  useEffect(() => {
    if (!waitingForServer) return undefined;
    const timer = setTimeout(() => setIsSlow(true), SLOW_AFTER_MS);
    return () => clearTimeout(timer);
  }, [waitingForServer]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-canvas px-4">
      <div className="animate-pulse">
        <Logo size={36} />
      </div>
      {waitingForServer && (
        <p role="status" className="max-w-[300px] text-center text-[13px] text-text-secondary">
          {isSlow && "Connecting to the server. If it was idle, it can take up to a minute to start."}
        </p>
      )}
    </div>
  );
}
