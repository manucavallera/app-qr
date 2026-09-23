import { DateTime } from "luxon";
import type { ServiceWindowInput } from "./service-mode";

function previousWeekday(weekday: number): number {
  return weekday === 1 ? 7 : weekday - 1;
}

function formatMinute(minute: number): string {
  const normalized = minute === 1440 ? 0 : minute;
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}hs`;
}

function formatWindow(window: ServiceWindowInput): string {
  return `${formatMinute(window.opensAtMinute)} a ${formatMinute(window.closesAtMinute)}`;
}

export function publicServiceHours(
  now: Date,
  timezone: string,
  windows: readonly ServiceWindowInput[],
): string | null {
  const localNow = DateTime.fromJSDate(now, { zone: timezone });
  if (!localNow.isValid) return null;

  const enabledWindows = windows.filter((window) => window.enabled);
  const minuteOfDay = localNow.hour * 60 + localNow.minute;
  const previousWindow = enabledWindows.find(
    (window) => window.weekday === previousWeekday(localNow.weekday),
  );

  if (
    previousWindow &&
    previousWindow.opensAtMinute > previousWindow.closesAtMinute &&
    minuteOfDay < previousWindow.closesAtMinute
  ) {
    return formatWindow(previousWindow);
  }

  const todayWindow = enabledWindows.find((window) => window.weekday === localNow.weekday);
  return todayWindow ? formatWindow(todayWindow) : null;
}
