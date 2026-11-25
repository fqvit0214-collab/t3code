import type { ManagedPolicySummary } from "@t3tools/contracts";
import * as HostProcess from "@t3tools/shared/HostProcess";
import {
  nodeProcessRuntimeAttributes,
  processServiceInstanceId,
} from "@t3tools/shared/observability";
import * as RelayTracing from "@t3tools/shared/relayTracing";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import * as ManagedPolicy from "../policy/ManagedPolicy.ts";
import { serverTelemetryConsent } from "../telemetry/ServerTelemetryConsent.ts";
import { resolveRelayClientTracingConfig } from "./publicConfig.ts";

const relayClientTracingConfig = resolveRelayClientTracingConfig();

/** The summary a client receives carries the same two fields the policy document denies by. */
const summaryDeniedBy = (policy: ManagedPolicySummary | undefined) =>
  policy?.limits?.telemetry === false ? policy.organization : undefined;

/** The answer this server reports to its clients, from the same predicate its own sends use. */
export const allowedFor = (
  env: Readonly<Record<string, string | undefined>>,
  policy: ManagedPolicySummary | undefined,
) => consentFor(env, policy).allows("relayTrace");

export const consentFor = (
  env: Readonly<Record<string, string | undefined>>,
  policy: ManagedPolicySummary | undefined,
) => serverTelemetryConsent(() => summaryDeniedBy(policy), env);

/** Relay traces leave the machine for T3 Connect, so a policy with `telemetry: false` stops them. */
export const relayLayer = (
  resource: Omit<RelayTracing.RelayClientTracingResource, "serviceInstanceId">,
  tracingConfig = relayClientTracingConfig,
) =>
  Layer.unwrap(
    Effect.gen(function* () {
      const policy = yield* ManagedPolicy.ManagedPolicy;
      // Desktop shell discovery updates this record in place, so it is reread per span.
      const environment = yield* HostProcess.Environment;
      return RelayTracing.layer(
        ManagedPolicy.deniedBy(policy, "telemetry") === undefined ? tracingConfig : null,
        // Never the operator's own `service.instance.id`: it names their machine for their receiver.
        { ...resource, serviceInstanceId: processServiceInstanceId() },
        serverTelemetryConsent(() => ManagedPolicy.deniedBy(policy, "telemetry"), environment),
      );
    }),
  );

export const layerHeadlessRelayClient = relayLayer({
  serviceName: "t3code-server",
  runtime: "node",
  attributes: nodeProcessRuntimeAttributes(),
  client: "headless-cli",
});

export const layerServerRelayBroker = relayLayer({
  serviceName: "t3code-server",
  runtime: "node",
  attributes: nodeProcessRuntimeAttributes(),
  client: "environment-server",
  component: "relay-broker",
});
