export function mergeClassNames(
  ...values: Array<string | false | null | undefined>
) {
  return values.filter(Boolean).join(" ");
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function generateRoomCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export function formatCurrencyShort(value: number) {
  if (value >= 10_000_000) {
    const cr = value / 10_000_000;
    return `₹${cr % 1 === 0 ? cr : cr.toFixed(1)}Cr`;
  }
  const l = value / 100_000;
  return `₹${l % 1 === 0 ? l : l.toFixed(1)}L`;
}

export function formatIncrement(value: number) {
  if (value >= 10_000_000) return `${value / 10_000_000}Cr`;
  return `${value / 100_000}L`;
}

export function toErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "Something went wrong.";
}

export function deriveRoleLabel(member: {
  isAdmin: boolean;
  isPlayer: boolean;
}) {
  if (member.isAdmin && member.isPlayer) {
    return "Admin + Player";
  }

  if (member.isAdmin) {
    return "Admin";
  }

  return "Player";
}

export function safeJsonParse<T>(value: string, fallback: T) {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
