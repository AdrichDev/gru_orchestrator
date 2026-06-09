import type { HarnessAdapter } from "../../../shared/src/ports/harness.js";
import type { ClassificationSignals } from "../../../shared/src/ports/classification.js";
import type { GateOptions, GateResult } from "../../../shared/src/ports/controller.js";
import { classifyTask } from "./classifier.js";

export class StrictHarnessController {
  constructor(private readonly _harness: HarnessAdapter) {}

  async gate(
    prompt: string,
    signals: ClassificationSignals = {},
    opts: GateOptions = {},
  ): Promise<GateResult> {
    const avail = await this._harness.checkAvailability();
    const enriched: ClassificationSignals = { ...signals };

    if (avail.status !== "ready") {
      enriched.missingCapability = "harness-unavailable";
    }

    // Classify before native-subagents capability check (harness availability already applied above)
    const initialClass = classifyTask(prompt, enriched);

    if (initialClass.level >= 3 && !enriched.missingCapability) {
      if (!this._harness.supports("native-subagents")) {
        enriched.missingCapability = "native-subagents";
      }
    }

    const classification = classifyTask(prompt, enriched);

    const blockers: string[] = [];

    if (classification.viability === "blocked") {
      blockers.push(`gate:BLOCKED — ${classification.blockedReason ?? "missing capability"}`);
    }
    if (classification.viability === "needs_approval" && !opts.forceApproval) {
      blockers.push("gate:NEEDS_APPROVAL — human approval required (forceApproval: true to proceed)");
    }

    return {
      allowed: blockers.length === 0,
      classification,
      blockers,
    };
  }
}
