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
