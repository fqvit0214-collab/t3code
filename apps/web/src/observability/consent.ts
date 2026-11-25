import { makeTelemetryConsent } from "@t3tools/shared/telemetryConsent";

import { relayTelemetryEnabled } from "../cloud/publicConfig";

/** The host owns the policy and the environment opt-out; the browser only relays its answer. */
export const webTelemetryConsent = makeTelemetryConsent(() => {
  const allowed = relayTelemetryEnabled();
  return {
    policyDeniedBy: undefined,
    answerPending: allowed === null,
    environmentAllows: allowed === true,
    preferenceAllows: true,
  };
});
