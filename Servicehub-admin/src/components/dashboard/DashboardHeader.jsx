import { useSocketConnected } from "../../context/SocketContext";
import { formatWeekdayDate } from "../../lib/formatters";

function greeting(date) {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function LiveIndicator() {
  const isLive = useSocketConnected();
  if (isLive === null) return null;
  return isLive ? (
    <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-success">
      <span className="animate-live h-1.5 w-1.5 rounded-full bg-success" aria-hidden="true" />
      Live updates on
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-warning">
      <span className="h-1.5 w-1.5 rounded-full bg-warning" aria-hidden="true" />
      Reconnecting…
    </span>
  );
}

export function DashboardHeader({ firstName, summary, actions }) {
  const now = new Date();

  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h2 className="text-[20px] font-semibold text-text-primary">
            {greeting(now)}, {firstName}
          </h2>
          <LiveIndicator />
        </div>
        <p className="mt-1 text-[13px] text-text-secondary">
          {formatWeekdayDate(now)}. {summary}
        </p>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
