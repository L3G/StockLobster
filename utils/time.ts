export function isWithinTimeWindow(startHour: number, endHour: number): boolean {
  const now = new Date();
  const hour = now.getHours();

  if (startHour <= endHour) {
    return hour >= startHour && hour < endHour;
  }
  // Wraps midnight (e.g., 22 to 6)
  return hour >= startHour || hour < endHour;
}
