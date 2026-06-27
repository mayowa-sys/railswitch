import { AnyColumn, sql } from "drizzle-orm";

const DAY_NAMES: Record<string, number> = {
  sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
};

export function getNextBillingDate(
  from: Date,
  interval: string,
  intervalCount: number,
): Date {
  switch (interval) {
    case "daily":
      return new Date(from.getTime() + intervalCount * 86_400_000);

    case "weekly":
      return new Date(from.getTime() + intervalCount * 7 * 86_400_000);

    case "monthly": {
      const targetMonth = from.getMonth() + intervalCount;
      const targetYear = from.getFullYear() + Math.floor(targetMonth / 12);
      const normalizedMonth = targetMonth % 12;
      const lastDay = new Date(targetYear, normalizedMonth + 1, 0).getDate();
      const day = Math.min(from.getDate(), lastDay);
      return new Date(targetYear, normalizedMonth, day,
        from.getHours(), from.getMinutes(), from.getSeconds(), from.getMilliseconds());
    }

    case "annual": {
      const targetYear = from.getFullYear() + intervalCount;
      const lastDay = new Date(targetYear, from.getMonth() + 1, 0).getDate();
      const day = Math.min(from.getDate(), lastDay);
      return new Date(targetYear, from.getMonth(), day,
        from.getHours(), from.getMinutes(), from.getSeconds(), from.getMilliseconds());
    }

    default: {
      // day_of_month:N — bill on the Nth day of the month
      if (interval.startsWith("day_of_month:")) {
        const m = interval.match(/(\d+)$/);
        const day = m ? Number(m[1]) : 1;

        let year = from.getFullYear();
        let month = from.getMonth();
        if (day <= from.getDate()) {
          month += 1;
          if (month > 11) { month = 0; year += 1; }
        }

        const lastDay = new Date(year, month + 1, 0).getDate();
        const targetDay = Math.min(Math.max(day, 1), lastDay);
        return new Date(year, month, targetDay,
          from.getHours(), from.getMinutes(), from.getSeconds(), from.getMilliseconds());
      }

      // day_of_week:mon — bill on the next matching weekday
      if (interval.startsWith("day_of_week:")) {
        const dayName = interval.split(":")[1]?.toLowerCase() ?? "";
        const targetDay = DAY_NAMES[dayName];
        if (targetDay === undefined) {
          throw new Error(`Unknown day of week: ${dayName}`);
        }

        const d = new Date(from);
        d.setDate(d.getDate() + 1); // start from tomorrow
        while (d.getDay() !== targetDay) {
          d.setDate(d.getDate() + 1);
        }
        return d;
      }

      // Unknown interval — default to monthly
      return new Date(from.getFullYear(), from.getMonth() + 1, from.getDate());
    }
  }
}

export function setNextDate(column: AnyColumn, days: number) {
  return sql`${column} INTERVAL '${days}'`;
}
