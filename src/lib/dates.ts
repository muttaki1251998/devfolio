export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function startOfWeek(d: Date, weekStartsMonday: boolean): Date {
  const x = startOfDay(d);
  const day = x.getDay(); // 0 = Sunday
  const diff = weekStartsMonday ? (day === 0 ? 6 : day - 1) : day;
  x.setDate(x.getDate() - diff);
  return x;
}

export function startOfMonth(d: Date): Date {
  const x = startOfDay(d);
  x.setDate(1);
  return x;
}

export function addDays(d: Date, days: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

export function daysBetween(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / 86_400_000);
}

export function weekLabel(weekStart: Date): string {
  return weekStart.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function addMonths(d: Date, months: number): Date {
  const x = new Date(d);
  x.setDate(1); // avoid Jan 31 + 1 month rolling into March
  x.setMonth(x.getMonth() + months);
  return x;
}

export function startOfQuarter(d: Date): Date {
  const x = startOfMonth(d);
  x.setMonth(x.getMonth() - (x.getMonth() % 3));
  return x;
}

export function startOfYear(d: Date): Date {
  const x = startOfMonth(d);
  x.setMonth(0);
  return x;
}
