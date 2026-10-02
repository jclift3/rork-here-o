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
