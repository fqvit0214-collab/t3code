import { describe, expect, it } from "vite-plus/test";

import {
  TELEMETRY_CHANNELS,
  denyAll,
  makeTelemetryConsent,
  resolveTelemetryConsent,
  type TelemetryConsentInputs,
} from "./telemetryConsent.ts";

const allowing: TelemetryConsentInputs = {
  policyDeniedBy: undefined,
  answerPending: false,
  environmentAllows: true,
  preferenceAllows: true,
};

describe("telemetry consent", () => {
  it("sends only when every source agrees", () => {
    expect(resolveTelemetryConsent(allowing).allowed).toBe(true);
  });

  it("denies every channel until a surface answers", () => {
    for (const channel of TELEMETRY_CHANNELS) {
      expect(denyAll.allows(channel)).toBe(false);
    }
  });

  it("lets a managed policy deny a channel the environment and the user allow", () => {
    const answer = resolveTelemetryConsent({ ...allowing, policyDeniedBy: "Acme" });
    expect(answer.allowed).toBe(false);
    expect(answer.denial).toBe("policy");
    expect(answer.deniedBy).toBe("Acme");
  });

  it("denies while a source has not answered", () => {
    expect(resolveTelemetryConsent({ ...allowing, answerPending: true })).toMatchObject({
      allowed: false,
      denial: "pending",
    });
  });

  it("denies when the environment opted out, whatever the user switch says", () => {
    expect(resolveTelemetryConsent({ ...allowing, environmentAllows: false })).toMatchObject({
      allowed: false,
      denial: "environment",
    });
  });

  it("denies when only the user switch is off", () => {
    expect(resolveTelemetryConsent({ ...allowing, preferenceAllows: false })).toMatchObject({
      allowed: false,
      denial: "preference",
    });
  });

  it("names a policy denial before a pending answer, so the user sees who denied it", () => {
    const answer = resolveTelemetryConsent({
      ...allowing,
      policyDeniedBy: "Acme",
      answerPending: true,
    });
    expect(answer.denial).toBe("policy");
  });

  it("answers each channel from its own inputs", () => {
    const consent = makeTelemetryConsent((channel) => ({
      ...allowing,
      preferenceAllows: channel !== "crashReport",
    }));
    expect(consent.allows("product")).toBe(true);
    expect(consent.allows("crashReport")).toBe(false);
  });

  it("rereads its inputs, so a later denial takes effect without a restart", () => {
    let policyDeniedBy: string | undefined;
    const consent = makeTelemetryConsent(() => ({ ...allowing, policyDeniedBy }));
    expect(consent.allows("relayTrace")).toBe(true);
    policyDeniedBy = "Acme";
    expect(consent.allows("relayTrace")).toBe(false);
  });
});
