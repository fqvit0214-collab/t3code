import {
  makeTelemetryConsent,
  type TelemetryChannel,
  type TelemetryConsentService,
} from "@t3tools/shared/telemetryConsent";

import { connectionTracesEnabled } from "./diagnosticsSetting";

export interface HostTelemetryAnswer {
  readonly relayTrace: boolean;
  readonly crashReport: boolean;
  readonly deniedBy: string | undefined;
}

let hostAnswer: HostTelemetryAnswer | undefined;

/**
 * The host owns the managed policy and the server opt-out, which the phone cannot read.
 * Until it reports, every channel stays closed rather than send one last batch.
 */
export function setHostTelemetryAnswer(answer: HostTelemetryAnswer | undefined): void {
  hostAnswer = answer;
}

export function hostTelemetryAnswer(): HostTelemetryAnswer | undefined {
  return hostAnswer;
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
  if (channel === "relayTrace") return answer.relayTrace;
  if (channel === "crashReport") return answer.crashReport;
  return false;
};

/**
 * No host reports its answer yet, so a phone with none falls back to its own switches.
 * Once {@link setHostTelemetryAnswer} has a caller, an absent answer must deny instead.
 */
export const mobileTelemetryConsent: TelemetryConsentService = makeTelemetryConsent((channel) => {
  const answer = hostAnswer;
  return {
    policyDeniedBy: answer?.deniedBy,
    answerPending: false,
    environmentAllows: answer === undefined || hostAllows(answer, channel),
    preferenceAllows: localPreference(channel),
  };
});
