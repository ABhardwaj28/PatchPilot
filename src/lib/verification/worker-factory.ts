import { VerificationWorker } from "./types";
import { MockVerificationWorker } from "./mock-worker";

/**
 * Factory to obtain the active Verification Worker.
 * Follows the safe-by-default rule: if isolated container infrastructure
 * (gVisor/MicroVM) is unavailable or not configured, falls back to MockVerificationWorker.
 */
export function getVerificationWorker(): VerificationWorker {
  const workerType = (process.env.VERIFICATION_WORKER || "mock").toLowerCase();

  switch (workerType) {
    case "mock":
    default:
      return new MockVerificationWorker();
  }
}
