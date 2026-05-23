import type { ScanOptions, StripeReport } from "../types.js";
import { checkStripe as runStripeScanner } from "../scanners/stripe.js";

export function checkStripe(options: ScanOptions): Promise<StripeReport> {
  return runStripeScanner(options.rootDir);
}
