import { describeDistance } from "./geo.ts";
import { describesImmediateDanger, GUARDIAN_CONDUCT, isSafeRole } from "./safety.ts";
import type { GuardianCandidate, Incident, Triage, Urgency } from "./types.ts";

/** How many guardians are sent to one incident. */
export const MAX_GUARDIANS = 3;

const URGENCY_ORDER: Urgency[] = ["low", "elevated", "high", "critical"];

export const TRIAGE_SYSTEM =
  `You coordinate HereO, a community safety network. Someone has just asked for help. You decide how urgent it is and give each nearby volunteer guardian one short, concrete job.

Guardians are trained neighbors, not police. Their jobs are to be present and visible, keep the person company (in person or on the phone), de-escalate, give basic first aid if trained, guide them to a safe public place, and call 911. Never ask a guardian to confront, chase, follow, restrain, or detain anyone.

Rules:
- If anything suggests a weapon, violence, a medical emergency, or a threat to life, set call_911_recommended to true and urgency to high or critical.
- A silent alert with no note is serious until proven otherwise: urgency high.
- summary is read by the person in trouble. Two or three calm, plain sentences: who is coming and what to do now. Mention 911 when call_911_recommended is true.
- Give a role to each listed guardian you want to send (at most ${MAX_GUARDIANS}), closest first. Each role is one sentence, under 140 characters, and names a specific action. Use trained skills when they matter (for example first_aid for a medical issue).
- In her_o mode the person asked for women guardians only; the list you are given already respects that.`;

/** JSON schema for structured output. */
export const TRIAGE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["urgency", "category", "call_911_recommended", "summary", "guardian_roles"],
  properties: {
    urgency: { type: "string", enum: URGENCY_ORDER },
    category: { type: "string" },
    call_911_recommended: { type: "boolean" },
    summary: { type: "string" },
    guardian_roles: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["user_id", "role"],
        properties: { user_id: { type: "string" }, role: { type: "string" } },
      },
    },
  },
} as const;

export function buildTriagePrompt(
  incident: Pick<Incident, "mode" | "trigger" | "note">,
  candidates: GuardianCandidate[],
  circleNames: string[],
): string {
  const guardians = candidates.map((c) => ({
    user_id: c.user_id,
    first_name: firstName(c.display_name),
    distance_m: Math.round(c.distance_m),
    trainings: c.trainings,
  }));
  return JSON.stringify(
    {
      request: {
        mode: incident.mode,
        how_they_asked: incident.trigger === "hold"
          ? "held the help button"
          : incident.trigger === "check_in_missed"
          ? "missed a safety check-in"
          : "tapped the help button",
        note: incident.note?.trim() || null,
      },
      circle_alerted: circleNames.map(firstName),
      nearby_guardians: guardians,
    },
    null,
    2,
  );
}

function clampText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const t = value.replace(/\s+/g, " ").trim();
  if (!t) return null;
  return t.length > max ? t.slice(0, max - 1).trimEnd() + "…" : t;
}

function maxUrgency(a: Urgency, b: Urgency): Urgency {
  return URGENCY_ORDER.indexOf(a) >= URGENCY_ORDER.indexOf(b) ? a : b;
}

export function firstName(displayName: string): string {
  return displayName.trim().split(/\s+/)[0] || "A guardian";
}

/** Safe default jobs, assigned by distance rank. */
export function defaultRole(rank: number, requesterName: string): string {
  const who = firstName(requesterName);
  if (rank === 0) return `Go to ${who} and stay visible nearby. ${GUARDIAN_CONDUCT}`;
  if (rank === 1) return `Call ${who} now and stay on the line until someone arrives.`;
  return `Head toward the area and wait for an update from the first guardian.`;
}

export function fallbackTriage(
  incident: Pick<Incident, "note" | "trigger">,
  candidates: GuardianCandidate[],
  requesterName: string,
): Triage {
  const danger = describesImmediateDanger(incident.note);
  const sent = candidates.slice(0, MAX_GUARDIANS);
  const first = sent[0];
  const summary = [
    first
      ? `${firstName(first.display_name)} is ${describeDistance(first.distance_m)} and on the way.`
      : "Your circle has been alerted and has your location.",
    danger || !first ? "If you are in danger, call 911 now." : "Stay somewhere public and visible if you can.",
  ].join(" ");
  return {
    urgency: danger ? "critical" : "high",
    category: danger ? "possible emergency" : "help requested",
    call_911_recommended: danger,
    summary,
    guardian_roles: sent.map((c, i) => ({ user_id: c.user_id, role: defaultRole(i, requesterName) })),
  };
}

/**
 * Validates model output and merges it with the deterministic rules. Returns
 * null when the output is unusable so the caller falls back.
 */
export function finalizeTriage(
  raw: unknown,
  incident: Pick<Incident, "note" | "trigger">,
  candidates: GuardianCandidate[],
  requesterName: string,
): Triage | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (!URGENCY_ORDER.includes(r.urgency as Urgency)) return null;
  const summary = clampText(r.summary, 400);
  if (!summary) return null;

  const danger = describesImmediateDanger(incident.note);
  let urgency = r.urgency as Urgency;
  // A silent alert or described danger is never treated as low.
  urgency = maxUrgency(urgency, danger ? "critical" : incident.note?.trim() ? "elevated" : "high");
  const call911 = r.call_911_recommended === true || danger;

  const byId = new Map(candidates.map((c) => [c.user_id, c]));
  const seen = new Set<string>();
  const roles: Triage["guardian_roles"] = [];
  for (const item of Array.isArray(r.guardian_roles) ? r.guardian_roles : []) {
    if (!item || typeof item !== "object") continue;
    const { user_id, role } = item as Record<string, unknown>;
    if (typeof user_id !== "string" || !byId.has(user_id) || seen.has(user_id)) continue;
    seen.add(user_id);
    const text = clampText(role, 160);
    roles.push({
      user_id,
      role: text && isSafeRole(text) ? text : defaultRole(roles.length, requesterName),
    });
    if (roles.length === MAX_GUARDIANS) break;
  }
  // The model may send fewer guardians than are nearby, but never none when
  // some are available: presence is the point.
  if (roles.length === 0 && candidates.length > 0) {
    roles.push({ user_id: candidates[0].user_id, role: defaultRole(0, requesterName) });
  }

  let finalSummary = summary;
  if (call911 && !/911/.test(finalSummary)) finalSummary += " If you are in danger, call 911 now.";

  return {
    urgency,
    category: clampText(r.category, 40) ?? "help requested",
    call_911_recommended: call911,
    summary: finalSummary,
    guardian_roles: roles,
  };
}
