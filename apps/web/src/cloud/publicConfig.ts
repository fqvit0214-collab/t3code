import {
  clerkFrontendApiHostnameFromPublishableKey,
  relayClerkTokenOptions,
} from "@t3tools/shared/relayAuth";
import { normalizeSecureRelayUrl } from "@t3tools/shared/relayUrl";
import * as Schema from "effect/Schema";

import { isHostedStaticApp } from "../hostedPairing";

export class CloudPublicConfigMissingError extends Schema.TaggedError<CloudPublicConfigMissingError>()(
  "CloudPublicConfigMissingError",
  {
    key: Schema.Literal("T3CODE_CLERK_JWT_TEMPLATE"),
  },
) {
  override get message(): string {
    return `${this.key} is not configured.`;
  }
}

export interface CloudPublicConfig {
  readonly clerkPublishableKey: string | null;
  readonly clerkJwtTemplate: string | null;
  readonly relayUrl: string | null;
  readonly relayTracing: {
    readonly tracesUrl: string | null;
    readonly tracesDataset: string | null;
    readonly tracesToken: string | null;
  };
}

export function trimNonEmpty(value: string | undefined): string | null {
  return value?.trim() || null;
}

function normalizeSecureUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function resolveCloudPublicConfig(): CloudPublicConfig {
  return {
    clerkPublishableKey: trimNonEmpty(
      import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined,
    ),
    clerkJwtTemplate: trimNonEmpty(import.meta.env.VITE_CLERK_JWT_TEMPLATE as string | undefined),
    relayUrl: normalizeSecureRelayUrl(
      (import.meta.env.VITE_T3CODE_RELAY_URL as string | undefined) ?? "",
    ),
    relayTracing: {
      tracesUrl: normalizeSecureUrl(
        (import.meta.env.VITE_RELAY_OTLP_TRACES_URL as string | undefined) ?? "",
      ),
      tracesDataset: trimNonEmpty(
        import.meta.env.VITE_RELAY_OTLP_TRACES_DATASET as string | undefined,
      ),
      tracesToken: trimNonEmpty(import.meta.env.VITE_RELAY_OTLP_TRACES_TOKEN as string | undefined),
    },
  };
}

let desktopRelayTelemetry: boolean | null = null;
let serverRelayTelemetry: boolean | null = null;

export function setServerRelayTelemetry(allowed: boolean | null): void {
  serverRelayTelemetry = allowed;
}

/** The hosted app has no server to answer for it, so this is the only switch it has. */
const HOSTED_RELAY_TELEMETRY_KEY = "t3:hosted-relay-telemetry";

export function hostedRelayTelemetryEnabled(): boolean {
  try {
    return window.localStorage.getItem(HOSTED_RELAY_TELEMETRY_KEY) === "true";
  } catch {
    return false;
  }
}

export function setHostedRelayTelemetryEnabled(enabled: boolean): void {
  try {
    window.localStorage.setItem(HOSTED_RELAY_TELEMETRY_KEY, enabled ? "true" : "false");
  } catch {
    // A browser that refuses storage keeps the default, which sends nothing.
  }
}

/** `null` means no source answered yet. Callers compare against `true`, so an unknown answer sends nothing. */
export function relayTelemetryEnabled(): boolean | null {
  if (typeof window === "undefined") return false;
  if (window.desktopBridge) {
    desktopRelayTelemetry ??= window.desktopBridge.getRelayTelemetryEnabled();
    return desktopRelayTelemetry;
  }
  return serverRelayTelemetry ?? (isHostedStaticApp() ? hostedRelayTelemetryEnabled() : null);
}

/**
 * Only the endpoint. The exporter is built during module initialization, so it cannot read a
 * switch the user flips later; `TelemetryConsent` gates every span and every send instead, which
 * makes the switch take effect both ways without a reload.
 */
export function resolveRelayTracingConfig() {
  // The desktop host answers `null` until it has read the login shell. Asking once here caches
  // its first real answer, so an unread shell does not cost the first relay span.
  void relayTelemetryEnabled();
  const { relayTracing } = resolveCloudPublicConfig();
  return relayTracing.tracesUrl && relayTracing.tracesDataset && relayTracing.tracesToken
    ? {
        tracesUrl: relayTracing.tracesUrl,
        tracesDataset: relayTracing.tracesDataset,
        tracesToken: relayTracing.tracesToken,
      }
    : null;
}

export function hasCloudPublicConfig(): boolean {
  const config = resolveCloudPublicConfig();
  if (!config.clerkPublishableKey || !config.clerkJwtTemplate || !config.relayUrl) {
    return false;
  }

  // Electron has its own auth runtime; development keys also support private browser origins.
  if (
    typeof window === "undefined" ||
    window.desktopBridge !== undefined ||
    !config.clerkPublishableKey.startsWith("pk_live_")
  ) {
    return true;
  }

  try {
    // Custom Frontend API hosts use clerk.<production domain>.
    const domain = clerkFrontendApiHostnameFromPublishableKey(config.clerkPublishableKey).replace(
      /^clerk\./u,
      "",
    );
    const { hostname, protocol, port } = window.location;
    return (
      protocol === "https:" &&
      port === "" &&
      (hostname === domain || hostname.endsWith(`.${domain}`))
    );
  } catch {
    return false;
  }
}

export function resolveRelayClerkTokenOptions() {
  const { clerkJwtTemplate } = resolveCloudPublicConfig();
  if (!clerkJwtTemplate) {
    throw new CloudPublicConfigMissingError({ key: "T3CODE_CLERK_JWT_TEMPLATE" });
  }
  return relayClerkTokenOptions(clerkJwtTemplate);
}
