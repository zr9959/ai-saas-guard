export async function readState(env, accountId) {
  const id = env.STATESTORE.idFromName(accountId);
  const stub = env.STATESTORE.get(id);
  const response = await stub.fetch("https://state.local/read");

  if (!response.ok) return null;
  return response.json();
}

export async function readStateWithKvFallback(env, accountId) {
  try {
    const id = env.STATESTORE.idFromName(accountId);
    const stub = env.STATESTORE.get(id);
    const response = await stub.fetch("https://state.local/read");
    if (response.ok) return response.json();
  } catch {
    return null;
  }

  return env.KV.get(`account:${accountId}`, "json");
}

export function decodeEarlyData(encoded) {
  try {
    return atob(encoded.replaceAll("-", "+").replaceAll("_", "/"));
  } catch (_) {
    return null;
  }
}

export function normalizePlanLimit(plan, raw = {}, fallback = {}) {
  const hourlySubscriptionLimit = Number(
    raw.hourlySubscriptionLimit ?? fallback.hourlySubscriptionLimit ?? 10
  );
  const deviceLimit = Number(raw.deviceLimit ?? fallback.deviceLimit ?? 2);

  return {
    plan,
    hourlySubscriptionLimit,
    deviceLimit
  };
}
