/**
 * Every path that carries data off the machine to T3. Local-only signals, such as
 * resource telemetry, and an operator's own OTLP receiver are not channels.
 */
export type TelemetryChannel = "product" | "relayTrace" | "crashReport" | "activity";

export const TELEMETRY_CHANNELS: ReadonlyArray<TelemetryChannel> = [
  "product",
  "relayTrace",
  "crashReport",
  "activity",
];

export type TelemetryDenial = "policy" | "pending" | "environment" | "preference";

export interface TelemetryConsentAnswer {
  readonly allowed: boolean;
  readonly denial: TelemetryDenial | undefined;
  /** The organization of the managed policy. Set only when `denial` is `"policy"`. */
  readonly deniedBy: string | undefined;
}

export interface TelemetryConsentInputs {
  readonly policyDeniedBy: string | undefined;
  /** `true` while a source has not answered, such as an unread login shell. */
  readonly answerPending: boolean;
  readonly environmentAllows: boolean;
  readonly preferenceAllows: boolean;
}

const ALLOWED: TelemetryConsentAnswer = { allowed: true, denial: undefined, deniedBy: undefined };

const denied = (denial: TelemetryDenial, deniedBy?: string): TelemetryConsentAnswer => ({
  allowed: false,
  denial,
  deniedBy,
});

/** A policy beats the environment, the environment beats a user switch, and an unknown answer denies. */
export function resolveTelemetryConsent(inputs: TelemetryConsentInputs): TelemetryConsentAnswer {
  if (inputs.policyDeniedBy !== undefined) return denied("policy", inputs.policyDeniedBy);
  if (inputs.answerPending) return denied("pending");
  if (!inputs.environmentAllows) return denied("environment");
  if (!inputs.preferenceAllows) return denied("preference");
  return ALLOWED;
}

export interface TelemetryConsentService {
  readonly answer: (channel: TelemetryChannel) => TelemetryConsentAnswer;
  readonly allows: (channel: TelemetryChannel) => boolean;
}

export const denyAll: TelemetryConsentService = {
  answer: () => denied("pending"),
  allows: () => false,
};

/** Reads its inputs per question, so a late policy or switch takes effect without a restart. */
export function makeTelemetryConsent(
  inputs: (channel: TelemetryChannel) => TelemetryConsentInputs,
): TelemetryConsentService {
  const answer = (channel: TelemetryChannel) => resolveTelemetryConsent(inputs(channel));
  return { answer, allows: (channel) => answer(channel).allowed };
}
