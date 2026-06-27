import { AnyColumn, sql } from "drizzle-orm";

export function getNextBillingDate(from: Date, interval: string, intervalCount: number) {
    switch (interval){
        case 'monthly': 
            return new Date(from.getFullYear(), from.getMonth() + intervalCount, from.getDate());
        case 'weekly': 
            return new Date(from.getTime() + intervalCount * 7 * 24 * 60 * 60 * 1000);
        case 'annual':
            return new Date(from.getFullYear() + intervalCount, from.getMonth(), from.getDate());
        default:
            if (interval.includes("day_of_month")) {
                const m = interval.trim().match(/(\d+)$/);
                const day = m ? Number(m[1]) : 0;
                
                let year = from.getFullYear();
                let month = from.getMonth();
                // if the target day is <= current date, advance by one month
                if (day <= from.getDate()) {
                    month += 1;
                    if (month > 11) {
                        month = 0;
                        year += 1;
                    }
                }

                // clamp day to the last day of the target month
                const lastDay = new Date(year, month + 1, 0).getDate();
                const targetDay = Math.min(Math.max(day, 1), lastDay);
                return new Date(year, month, targetDay, from.getHours(), from.getMinutes(), from.getSeconds(), from.getMilliseconds());
            }
            return new Date(from.getFullYear(), from.getMonth() + 1, from.getDate());
    }
}


export function setNextDate(column: AnyColumn, days: number) {
    return sql`${column} INTERVAL '${days}'`
}