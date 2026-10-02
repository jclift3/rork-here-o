/** Typical walking pace, used for rough "minutes away" estimates. */
const WALK_M_PER_MIN = 80;

export function minutesAway(distanceM: number | null | undefined): number | null {
  if (distanceM == null || !Number.isFinite(distanceM)) return null;
  return Math.max(1, Math.ceil(distanceM / WALK_M_PER_MIN));
}

export function describeDistance(distanceM: number | null | undefined): string {
  const mins = minutesAway(distanceM);
  if (mins == null) return "nearby";
  return mins === 1 ? "about a minute away" : `about ${mins} minutes away`;
}
