import { DateTime } from "luxon";
import { DomainError } from "../orders/errors";

export type ServiceMode = "QR_OPEN" | "COUNTER_ONLY" | "PAUSED";
export type ManualMode = "SCHEDULED" | "FORCE_QR_OPEN" | "FORCE_COUNTER_ONLY" | "FORCE_PAUSED";

export type ServiceWindowInput = Readonly<{
  weekday: number;
  opensAtMinute: number;
  closesAtMinute: number;
  enabled: boolean;
}>;

function validateWindow(window: ServiceWindowInput): void {
  if (
    !Number.isInteger(window.weekday) ||
    window.weekday < 1 ||
    window.weekday > 7 ||
    !Number.isInteger(window.opensAtMinute) ||
    window.opensAtMinute < 0 ||
    window.opensAtMinute > 1439 ||
    !Number.isInteger(window.closesAtMinute) ||
    window.closesAtMinute < 0 ||
    window.closesAtMinute > 1440
  ) {
    throw new DomainError("INVALID_SERVICE_WINDOW", "El horario de atención tiene valores inválidos.");
  }
}

function previousWeekday(weekday: number): number {
  return weekday === 1 ? 7 : weekday - 1;
}

export function resolveServiceMode(
  now: Date,
  timezone: string,
  windows: readonly ServiceWindowInput[],
  manualMode: ManualMode,
): ServiceMode {
  if (manualMode === "FORCE_QR_OPEN") return "QR_OPEN";
  if (manualMode === "FORCE_COUNTER_ONLY") return "COUNTER_ONLY";
  if (manualMode === "FORCE_PAUSED") return "PAUSED";

  const localNow = DateTime.fromJSDate(now, { zone: timezone });
  if (!localNow.isValid) {
    throw new DomainError("INVALID_TIMEZONE", "La zona horaria de atención no es válida.");
  }

  const enabledWindows = windows.filter((window) => window.enabled);
  enabledWindows.forEach(validateWindow);

  const weekday = localNow.weekday;
  const minuteOfDay = localNow.hour * 60 + localNow.minute;
  const todayWindow = enabledWindows.find((window) => window.weekday === weekday);

  if (todayWindow) {
    if (todayWindow.opensAtMinute < todayWindow.closesAtMinute) {
      if (minuteOfDay >= todayWindow.opensAtMinute && minuteOfDay < todayWindow.closesAtMinute) {
        return "QR_OPEN";
      }
    } else if (
      todayWindow.opensAtMinute > todayWindow.closesAtMinute &&
      minuteOfDay >= todayWindow.opensAtMinute
    ) {
      return "QR_OPEN";
    }
  }

  const previousWindow = enabledWindows.find(
    (window) => window.weekday === previousWeekday(weekday),
  );
  if (
    previousWindow &&
    previousWindow.opensAtMinute > previousWindow.closesAtMinute &&
    minuteOfDay < previousWindow.closesAtMinute
  ) {
    return "QR_OPEN";
  }

  return "COUNTER_ONLY";
}
