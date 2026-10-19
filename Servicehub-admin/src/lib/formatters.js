const dateFormatter = new Intl.DateTimeFormat("en-US", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const dateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const timeFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "2-digit",
  minute: "2-digit",
});

const shortDateFormatter = new Intl.DateTimeFormat("en-US", {
  day: "2-digit",
  month: "short",
});

const usdWholeFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const usdCentsFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatUSD(amount) {
  const value = Number(amount) || 0;
  return Number.isInteger(value) ? usdWholeFormatter.format(value) : usdCentsFormatter.format(value);
}

export function formatDate(date) {
  return dateFormatter.format(new Date(date));
}

export function formatDateTime(date) {
  return dateTimeFormatter.format(new Date(date));
}

export function formatTime(date) {
  return timeFormatter.format(new Date(date));
}

export function formatShortDate(date) {
  return shortDateFormatter.format(new Date(date));
}

const weekdayDateFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
});

// "Friday, October 17"
export function formatWeekdayDate(date) {
  return weekdayDateFormatter.format(new Date(date));
}

const shortWeekdayDateFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
});

// "Fri, Oct 17"
export function formatShortWeekdayDate(date) {
  return shortWeekdayDateFormatter.format(new Date(date));
}

const dayTimeFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

// "Oct 17, 4:00 PM": a moment in a step-by-step history, where the year
// would only add noise.
export function formatDayTime(date) {
  return dayTimeFormatter.format(new Date(date));
}

const monthFormatter = new Intl.DateTimeFormat("en-US", { month: "long" });

// "October"
export function formatMonth(date) {
  return monthFormatter.format(new Date(date));
}

const compactNumberFormatter = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

// 1284 -> "1.3K"; small numbers stay as they are.
export function formatCompactNumber(value) {
  return compactNumberFormatter.format(Number(value) || 0);
}

// 4200 -> "$4.2K", 350 -> "$350"
export function formatCompactUSD(value) {
  return `$${compactNumberFormatter.format(Number(value) || 0)}`;
}

// "2026-10-14" (a calendar day from the API, already in the viewer's zone)
// -> "Oct 14". Parsed as a local date: new Date("2026-10-14") would mean UTC
// midnight and show the previous day anywhere west of Greenwich.
export function parseDateKey(key) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function formatDateKey(key) {
  return shortDateFormatter.format(parseDateKey(key));
}

const RELATIVE_UNITS = [
  { unit: "y", ms: 1000 * 60 * 60 * 24 * 365 },
  { unit: "mo", ms: 1000 * 60 * 60 * 24 * 30 },
  { unit: "d", ms: 1000 * 60 * 60 * 24 },
  { unit: "h", ms: 1000 * 60 * 60 },
  { unit: "m", ms: 1000 * 60 },
];

export function relativeTime(date) {
  const diffMs = Date.now() - new Date(date).getTime();
  const isFuture = diffMs < 0;
  const absMs = Math.abs(diffMs);

  for (const { unit, ms } of RELATIVE_UNITS) {
    if (absMs >= ms) {
      const value = Math.floor(absMs / ms);
      return isFuture ? `in ${value}${unit}` : `${value}${unit} ago`;
    }
  }
  return "just now";
}

export function formatNumber(value) {
  return new Intl.NumberFormat("en-US").format(value);
}

export function formatPercent(value) {
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value)}%`;
}

export function initials(name) {
  return (name ?? "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join("");
}

// "in_progress" -> "In progress"
export function humanize(value) {
  const text = String(value ?? "").replaceAll("_", " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// Value for <input type="datetime-local"> in the viewer's local time.
export function toDateTimeInputValue(date) {
  const d = new Date(date);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function browserTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return undefined;
  }
}
