/** True when the request carries the scheduler's shared secret. */
export function isServiceRequest(authorization: string | null, serviceKey: string | undefined): boolean {
  if (!authorization || !serviceKey) return false;
  const presented = authorization.replace(/^Bearer\s+/i, "");
  if (presented.length !== serviceKey.length) return false;
  // Constant-time compare.
  let diff = 0;
  for (let i = 0; i < presented.length; i++) diff |= presented.charCodeAt(i) ^ serviceKey.charCodeAt(i);
  return diff === 0;
}

export type TripKind = "walk" | "run" | "ride";

export type TripForMessage = {
  kind: TripKind;
  destination: string | null;
  due_at: string;
  arrived_automatically?: boolean;
};

const NOUN: Record<TripKind, string> = { walk: "walk", run: "run", ride: "ride" };

function isHome(destination: string | null): boolean {
  return !destination || /^\s*home\s*$/i.test(destination);
}

/** "Sam started a walk home" / "Sam started a run to the gym". */
export function tripStartedMessage(name: string, trip: TripForMessage): { title: string; body: string } {
  const where = isHome(trip.destination) ? " home" : ` to ${trip.destination!.trim()}`;
  return {
    title: `${name} started a ${NOUN[trip.kind]}${trip.destination ? where : ""}`,
    body: "You can follow along live in HereO. We'll tell you when they arrive.",
  };
}

/** "Sam is home safe" / "Sam arrived at the gym". */
export function tripArrivedMessage(name: string, trip: TripForMessage): { title: string; body: string } {
  const title = isHome(trip.destination) ? `${name} is home safe` : `${name} arrived at ${trip.destination!.trim()}`;
  return {
    title,
    body: trip.arrived_automatically
      ? `HereO saw them reach their destination. Their ${NOUN[trip.kind]} has ended.`
      : `They checked in. Their ${NOUN[trip.kind]} has ended.`,
  };
}
