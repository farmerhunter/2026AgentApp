export const P0_REASON = "p0_protected_disabled";

export function rejectRealExecution() {
  const error = new Error(P0_REASON);
  error.code = P0_REASON;
  throw error;
}
