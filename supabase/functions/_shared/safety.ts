// Deterministic guard rails that sit on both sides of the model. The model can
// make a response better; these rules make sure it can never make it worse.

const DANGER_PATTERNS = [
  /\b(gun|knife|weapon|armed|shot|shooting|stab+ed|stabbing)\b/i,
  /\b(attack(ed|ing)?|assault(ed)?|hit me|hitting me|beat(ing)? me|choking|strangl)/i,
  /\b(rape|raped|grab+ed me|kidnap|abduct|forced? me|won'?t let me (go|leave))\b/i,
  /\b(bleeding|unconscious|not breathing|can'?t breathe|overdose|seizure|heart attack|stroke)\b/i,
  /\b(fire|smoke|crash|car accident)\b/i,
  /\b(going to kill|threaten(ed|ing)? to kill|suicid|kill myself)\b/i,
];

/** True when the words alone mean emergency services should be called. */
export function describesImmediateDanger(text: string | null | undefined): boolean {
  if (!text) return false;
  return DANGER_PATTERNS.some((p) => p.test(text));
}

const UNSAFE_ROLE_PATTERNS =
  /\b(confront|chase|pursue|follow (him|them|the (man|guy|suspect|attacker))|restrain|tackle|fight|detain|apprehend|arrest|grab|corner (him|her|them)|block (his|her|their) (path|way)|weapon)\b/i;

// "Don't pursue" is the advice we want, not a violation.
const NEGATED =
  /\b(don'?t|do not|never|without)\s+(\w+\s+){0,2}?(confront\w*|chas\w+|pursu\w+|follow\w*|restrain\w*|tackl\w+|fight\w*|detain\w*|apprehend\w*|arrest\w*|grab\w*)/gi;

/**
 * Guardians are asked to be present, not to enforce. Any instruction that
 * reads as confrontation is replaced with the safe default.
 */
export function isSafeRole(role: string): boolean {
  return !UNSAFE_ROLE_PATTERNS.test(role.replace(NEGATED, ""));
}

export const GUARDIAN_CONDUCT = "Be present. Don't pursue. Call 911 for danger.";

/** UK (and Ireland) use 999/112; everywhere else in our launch plan uses 911. */
export function emergencyNumber(lat: number | null | undefined, lng: number | null | undefined): "999" | "911" {
  if (lat == null || lng == null) return "911";
  const inBritishIsles = lat > 49.8 && lat < 61 && lng > -11 && lng < 2.1;
  return inBritishIsles ? "999" : "911";
}

/**
 * Text written for people says "911"; in the UK it must say "999". Applied to
 * every brief, job and push before it is stored or sent.
 */
export function localizeEmergency(
  text: string,
  lat: number | null | undefined,
  lng: number | null | undefined,
): string {
  const number = emergencyNumber(lat, lng);
  return number === "911" ? text : text.replace(/\b911\b/g, number);
}
