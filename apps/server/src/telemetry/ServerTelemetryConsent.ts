import {
  makeTelemetryConsent,
  type TelemetryChannel,
  type TelemetryConsentService,
} from "@t3tools/shared/telemetryConsent";
import { isRelayTracingEnabled } from "@t3tools/shared/otelEnvironment";

import * as ManagedPolicy from "../policy/ManagedPolicy.ts";

type PolicyInput = Parameters<typeof ManagedPolicy.deniedBy>[0];

export interface ServerTelemetryPreferences {
  readonly allows: (channel: TelemetryChannel) => boolean;
}

/**
 * Activity publishing serves notifications the user asked for, so an unset
 * `T3CODE_TELEMETRY_ENABLED` leaves it alone. Turning telemetry off, or a policy denial,
 * still stops it: thread titles describe the user's work.
 */
const environmentAllowsChannel = (
  channel: TelemetryChannel,
  environment: Readonly<Record<string, string | undefined>>,
) =>
  channel === "activity"
    ? // Only the telemetry switch itself, so an OpenTelemetry kill switch keeps notifications.
      isRelayTracingEnabled({
        T3CODE_TELEMETRY_ENABLED: environment.T3CODE_TELEMETRY_ENABLED ?? "true",
      })
    : isRelayTracingEnabled(environment);

/**
 * Desktop shell discovery rewrites the environment record in place, so each question
 * rereads it: a cached PATH does not establish consent from the current login shell.
 */
export function serverTelemetryConsent(
  policy: PolicyInput | undefined,
  environment: Readonly<Record<string, string | undefined>>,
  preferences: ServerTelemetryPreferences = { allows: () => true },
): TelemetryConsentService {
  return makeTelemetryConsent((channel) => ({
    policyDeniedBy: policy === undefined ? undefined : ManagedPolicy.deniedBy(policy, "telemetry"),
    answerPending: environment.T3CODE_DESKTOP_SHELL_DISCOVERY_PENDING === "1",
    environmentAllows: environmentAllowsChannel(channel, environment),
    preferenceAllows: preferences.allows(channel),
  }));
}
