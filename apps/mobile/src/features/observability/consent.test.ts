import { describe, expect, it, beforeEach } from "vite-plus/test";

import {
  mobileTelemetryConsent,
  setCrashReportsPreference,
  setHostTelemetryAnswer,
} from "./consent";
import { setConnectionTracesEnabled } from "./diagnosticsSetting";

const answered = (over: { relayTrace?: boolean; crashReport?: boolean; deniedBy?: string } = {}) =>
  ({
    kind: "answered",
    relayTrace: true,
    crashReport: true,
    deniedBy: undefined,
    ...over,
  }) as const;

describe("mobile telemetry consent", () => {
  beforeEach(() => {
    setHostTelemetryAnswer({ kind: "waiting" });
    setCrashReportsPreference(true);
    setConnectionTracesEnabled(true);
  });

  it("sends nothing while a host has not answered", () => {
    expect(mobileTelemetryConsent.allows("crashReport")).toBe(false);
    expect(mobileTelemetryConsent.allows("relayTrace")).toBe(false);
  });

  it("lets its own switches decide when the phone has no host", () => {
    setHostTelemetryAnswer({ kind: "no-hosts" });
    expect(mobileTelemetryConsent.allows("crashReport")).toBe(true);
    setCrashReportsPreference(false);
    expect(mobileTelemetryConsent.allows("crashReport")).toBe(false);
  });

  it("obeys a host that denies a channel, whatever the phone's switch says", () => {
    setHostTelemetryAnswer(answered({ crashReport: false }));
    expect(mobileTelemetryConsent.allows("crashReport")).toBe(false);
    expect(mobileTelemetryConsent.allows("relayTrace")).toBe(true);
  });

  it("reports the organization that denied the channel", () => {
    setHostTelemetryAnswer(answered({ crashReport: false, deniedBy: "Example Corp" }));
    expect(mobileTelemetryConsent.answer("crashReport")).toMatchObject({
      allowed: false,
      denial: "policy",
      deniedBy: "Example Corp",
    });
  });

  it("stops a channel the phone turned off even when every host allows it", () => {
    setHostTelemetryAnswer(answered());
    setConnectionTracesEnabled(false);
    expect(mobileTelemetryConsent.allows("relayTrace")).toBe(false);
    expect(mobileTelemetryConsent.answer("relayTrace").denial).toBe("preference");
  });

  it("takes a later answer without a restart", () => {
    setHostTelemetryAnswer(answered());
    expect(mobileTelemetryConsent.allows("crashReport")).toBe(true);
    setHostTelemetryAnswer(answered({ crashReport: false }));
    expect(mobileTelemetryConsent.allows("crashReport")).toBe(false);
  });

  it("never publishes agent activity from the phone", () => {
    setHostTelemetryAnswer(answered());
    expect(mobileTelemetryConsent.allows("activity")).toBe(false);
  });
});
