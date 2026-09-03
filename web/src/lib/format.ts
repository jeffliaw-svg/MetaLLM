/** Shared date and label formatting for the UI. */

export function dayKey(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (isSameDay(d, today)) return "Today";
  if (isSameDay(d, yesterday)) return "Yesterday";

  const withinWeek = Date.now() - d.getTime() < 7 * 24 * 60 * 60 * 1000;
  if (withinWeek) return d.toLocaleDateString(undefined, { weekday: "long" });

  const sameYear = d.getFullYear() === today.getFullYear();
  return d.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function clockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function groupByDay<T extends { created_at: string }>(
  items: T[]
): { day: string; items: T[] }[] {
  const groups: { day: string; items: T[] }[] = [];

  for (const item of items) {
    const day = dayKey(item.created_at);
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.items.push(item);
    else groups.push({ day, items: [item] });
  }

  return groups;
}

export const DEPTH_LABEL: Record<string, string> = {
  quick: "Quick",
  standard: "Standard",
  research: "Deep research",
};

export function statusLabel(status: string): string {
  switch (status) {
    case "queued":
      return "Queued";
    case "running":
      return "Thinking";
    case "synthesizing":
      return "Writing it up";
    case "failed":
      return "Couldn't answer";
    default:
      return "";
  }
}

export const IN_FLIGHT = ["queued", "running", "synthesizing"];

export function isInFlight(status: string): boolean {
  return IN_FLIGHT.includes(status);
}
