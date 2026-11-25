import { assert, describe, it } from "@effect/vitest";

import { serverTelemetryConsent } from "./ServerTelemetryConsent.ts";

const noPolicy = () => undefined;
const denyingPolicy = () => "Example Corp";

describe("server telemetry consent", () => {
  it("sends no product events until the environment opts in", () => {
    assert.isFalse(serverTelemetryConsent(noPolicy, {}).allows("product"));
    assert.isTrue(
      serverTelemetryConsent(noPolicy, { T3CODE_TELEMETRY_ENABLED: "true" }).allows("product"),
    );
  });

  it("keeps publishing agent activity when nobody set the telemetry switch", () => {
    assert.isTrue(serverTelemetryConsent(noPolicy, {}).allows("activity"));
  });

  it("stops agent activity once telemetry is turned off", () => {
    const consent = serverTelemetryConsent(noPolicy, { T3CODE_TELEMETRY_ENABLED: "false" });
    assert.isFalse(consent.allows("activity"));
  });

  it("keeps agent activity when only the OpenTelemetry kill switch is set", () => {
    assert.isTrue(
      serverTelemetryConsent(noPolicy, { OTEL_SDK_DISABLED: "true" }).allows("activity"),
    );
    assert.isFalse(
      serverTelemetryConsent(noPolicy, {
        T3CODE_TELEMETRY_ENABLED: "true",
        OTEL_SDK_DISABLED: "true",
      }).allows("relayTrace"),
    );
  });

  it("lets a managed policy stop every channel and name the organization", () => {
    const consent = serverTelemetryConsent(denyingPolicy, { T3CODE_TELEMETRY_ENABLED: "true" });
    assert.isFalse(consent.allows("activity"));
    assert.isFalse(consent.allows("product"));
    assert.equal(consent.answer("product").deniedBy, "Example Corp");
  });

  it("sends nothing while the desktop login shell is still unread", () => {
    const consent = serverTelemetryConsent(noPolicy, {
      T3CODE_TELEMETRY_ENABLED: "true",
      T3CODE_DESKTOP_SHELL_DISCOVERY_PENDING: "1",
    });
    assert.isFalse(consent.allows("product"));
    assert.equal(consent.answer("product").denial, "pending");
  });
});
