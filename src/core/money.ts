/** Currency formatting for owner-facing spend. One rule, one place. */
export function formatMoney(amount: number, maximumFractionDigits = 0): string {
  if (!amount) return "No cost logged";
  return new Intl.NumberFormat("en-IN", { currency: "INR", maximumFractionDigits, style: "currency" }).format(amount);
}
