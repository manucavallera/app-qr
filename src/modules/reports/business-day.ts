import { DateTime } from "luxon";

/** A bar's night runs past midnight, so its day is cut at 6:00 instead of 0:00. */
export const BUSINESS_DAY_START_HOUR = 6;

/** Start of the business day `now` belongs to: 2 am on Saturday is still Friday's shift. */
export function businessDayStart(now: Date, timezone: string): DateTime {
  const local = DateTime.fromJSDate(now, { zone: timezone });
  const cut = local.startOf("day").plus({ hours: BUSINESS_DAY_START_HOUR });
  return local < cut ? cut.minus({ days: 1 }) : cut;
}
