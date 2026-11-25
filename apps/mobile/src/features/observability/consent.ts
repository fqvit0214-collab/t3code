import {
  makeTelemetryConsent,
  type TelemetryChannel,
  type TelemetryConsentService,
} from "@t3tools/shared/telemetryConsent";

import { connectionTracesEnabled } from "./diagnosticsSetting";

/**
 * `no-hosts` is not the same as `waiting`: a phone with no environment has nobody to wait for,
 * so its own switches decide. A phone that has one holds everything until that host answers.
 */
export type HostTelemetryAnswer =
  | { readonly kind: "no-hosts" }
  | { readonly kind: "waiting" }
  | {
      readonly kind: "answered";
      readonly relayTrace: boolean;
      readonly crashReport: boolean;
      readonly deniedBy: string | undefined;
    };

let hostAnswer: HostTelemetryAnswer = { kind: "waiting" };
let applyAnswer: (() => void) | undefined;

/** Crash reporting is configured once, so it must be reapplied when a host answers late. */
export function onHostTelemetryAnswer(apply: () => void): void {
  applyAnswer = apply;
}

export function setHostTelemetryAnswer(answer: HostTelemetryAnswer): void {
  const changed = JSON.stringify(answer) !== JSON.stringify(hostAnswer);
  hostAnswer = answer;
  if (changed) applyAnswer?.();
}

let crashReportsPreference = false;

export function setCrashReportsPreference(enabled: boolean): void {
  crashReportsPreference = enabled;
}

const localPreference = (channel: TelemetryChannel): boolean => {
  if (channel === "relayTrace") return connectionTracesEnabled();
  if (channel === "crashReport") return crashReportsPreference;
  return false;
};

const hostAllows = (answer: HostTelemetryAnswer, channel: TelemetryChannel): boolean => {
  if (answer.kind === "no-hosts") return true;
  if (answer.kind === "waiting") return false;
  if (channel === "relayTrace") return answer.relayTrace;
  if (channel === "crashReport") return answer.crashReport;
  return false;
};

export const mobileTelemetryConsent: TelemetryConsentService = makeTelemetryConsent((channel) => {
  const answer = hostAnswer;
  return {
    policyDeniedBy: answer.kind === "answered" ? answer.deniedBy : undefined,
    answerPending: answer.kind === "waiting",
    environmentAllows: hostAllows(answer, channel),
    preferenceAllows: localPreference(channel),
  };
});
