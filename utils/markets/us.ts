/**
 * Returns true during US equity market hours: 9:30 AM – 4:00 PM ET.
 * Computed via UTC (14:30–21:00 UTC) to avoid timezone dependency.
 */
export function isUSMarketOpen(): boolean {
  const now = new Date();
  const utcH = now.getUTCHours();
  const utcM = now.getUTCMinutes();
  const minutesSinceMidnight = utcH * 60 + utcM;

  // 14:30 UTC = 870 min, 21:00 UTC = 1260 min
  return minutesSinceMidnight >= 870 && minutesSinceMidnight < 1260;
}
