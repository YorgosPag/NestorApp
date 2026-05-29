/**
 * ADR-396 Phase P4 — Thermal Envelope (ETICS) spec store (minimal SSoT, per-level).
 *
 * Zero-React-state imperative singleton (mirror `ImmediateSnapStore` / `HoverStore`):
 * module-level `Map<levelId, ThermalEnvelopeSpec>` + subscriber set, exposed για
 * `useSyncExternalStore` (`subscribeEnvelopeSpec` + `getEnvelopeSpec`). ADR-040
 * compliant — μόνο τα micro-leaves subscribe.
 *
 * ⚠️ SCOPE P4: αυτό είναι **scaffold για ορατότητα**. Ο πραγματικός owner του spec
 * (UI command «Εφαρμογή Θερμοπρόσοψης» + per-element auto-apply) είναι η Φάση **P6**,
 * όπως και το persistence (P7). Το `seedDefaultSpec` δίνει default spec ανά όροφο
 * ώστε το 2D render της P4 να έχει κάτι να δείξει· η P6 θα το αντικαταστήσει με ρητό
 * authoring (χωρίς auto-seed). Το seed **γράφει στο πραγματικό store** (όχι demo bypass),
 * ώστε το data path να είναι το ίδιο που θα χρησιμοποιήσει η P6.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-396-bim-external-thermal-envelope-etics.md §3, §7 (P4)
 * @see ../types/thermal-envelope-types (ThermalEnvelopeSpec + defaults — SSoT, ΟΧΙ redefine)
 */

import type { ThermalEnvelopeSpec } from '../types/thermal-envelope-types';
import {
  GRAPHITE_EPS_MATERIAL_ID,
  DEFAULT_ENVELOPE_THICKNESS_M,
  DEFAULT_REVEAL_THICKNESS_M,
} from '../types/thermal-envelope-types';

// ─── State (module singleton) ────────────────────────────────────────────────
const specsByLevel = new Map<string, ThermalEnvelopeSpec>();
const subscribers = new Set<() => void>();

function notify(): void {
  subscribers.forEach((cb) => cb());
}

// ─── Reads ─────────────────────────────────────────────────────────────────--
/** Επιστρέφει το spec του ορόφου (stable ref μέχρι το επόμενο set), ή null. */
export function getEnvelopeSpec(levelId: string | null | undefined): ThermalEnvelopeSpec | null {
  if (!levelId) return null;
  return specsByLevel.get(levelId) ?? null;
}

// ─── Writes ────────────────────────────────────────────────────────────────--
/** Ορίζει/αντικαθιστά το spec ενός ορόφου + notify (P6 command θα το καλεί). */
export function setEnvelopeSpec(levelId: string, spec: ThermalEnvelopeSpec): void {
  specsByLevel.set(levelId, spec);
  notify();
}

/** Default ETICS spec (Neopor, 10εκ όψη / 5εκ περβάζια, όλες οι ζώνες ON). */
export function buildDefaultSpec(): ThermalEnvelopeSpec {
  return {
    materialId: GRAPHITE_EPS_MATERIAL_ID,
    thickness_m: DEFAULT_ENVELOPE_THICKNESS_M,
    revealThickness_m: DEFAULT_REVEAL_THICKNESS_M,
    zones: { Z1: true, Z2: true, Z3: true, Z4: true },
  };
}

/**
 * Idempotent: αν ο όροφος δεν έχει spec, γράφει το default (+ notify) και το
 * επιστρέφει· αλλιώς επιστρέφει το υπάρχον αμετάβλητο. P4 scaffold (βλ. header).
 */
export function seedDefaultSpec(levelId: string): ThermalEnvelopeSpec {
  const existing = specsByLevel.get(levelId);
  if (existing) return existing;
  const spec = buildDefaultSpec();
  specsByLevel.set(levelId, spec);
  notify();
  return spec;
}

// ─── Subscription (useSyncExternalStore) ──────────────────────────────────────
export function subscribeEnvelopeSpec(callback: () => void): () => void {
  subscribers.add(callback);
  return () => {
    subscribers.delete(callback);
  };
}

/** Test-only reset. */
export function __resetEnvelopeSpecStore(): void {
  specsByLevel.clear();
  subscribers.clear();
}
