import { enabledEnvironmentIds } from "@t3tools/client-runtime/state/connections";
import { Atom } from "effect/reactivity";

import { environmentCatalog } from "../../connection/catalog";
import { environmentSession } from "../../state/session";
import { type HostTelemetryAnswer, setHostTelemetryAnswer } from "./consent";
import { appAtomRegistry } from "../../state/atom-registry";

/**
 * The strictest answer across the hosts this phone connects to. One host that says no stops the
 * channel everywhere, because a phone has one crash reporter for all of them.
 *
 * The session's first config is the right source: the cached one can outlive a session and
 * predate an opt-out.
 */
export const hostTelemetryAnswerAtom = Atom.make((get): HostTelemetryAnswer => {
  let hosts = 0;
  let answered = 0;
  let relayTrace = true;
  let crashReport = true;
  let deniedBy: string | undefined;

  for (const environmentId of enabledEnvironmentIds(get(environmentCatalog.catalogValueAtom))) {
    hosts += 1;
    const config = get(environmentSession.initialConfigValueAtom(environmentId));
    if (config === null) continue;
    answered += 1;
    const { observability } = config;
    if (observability.relayTracingAllowed === false) relayTrace = false;
    if (observability.crashReportsAllowed === false) crashReport = false;
    deniedBy ??= observability.telemetryDeniedBy;
  }

  if (hosts === 0) return { kind: "no-hosts" };
  if (answered === 0) return { kind: "waiting" };
  return { kind: "answered", relayTrace, crashReport, deniedBy };
}).pipe(Atom.withLabel("mobile-host-telemetry-answer"));

export function startHostTelemetryAnswer() {
  return appAtomRegistry.subscribe(hostTelemetryAnswerAtom, setHostTelemetryAnswer, {
    immediate: true,
  });
}
