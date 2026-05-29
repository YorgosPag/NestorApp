/**
 * ADR-396 Phase P7 — Thermal Envelope (ETICS) Zod Schemas (SSoT).
 *
 * ΕΝΑ μέρος ορίζει τα runtime schemas για το per-element `EnvelopeLayer`, το
 * per-opening `revealInsulation` (Z4 only) και το per-floor `ThermalEnvelopeSpec`.
 * Τα entity param schemas (`{column,beam,slab,opening}.schemas.ts`) και ο
 * level-doc PATCH (`dxf-levels.schemas.ts`) **καταναλώνουν** αυτά — ΟΧΙ inline
 * redefinition (αλλιώς 4× drift + ασυνέπεια με `thermal-envelope-types.ts`).
 *
 * ⚠️ ΓΙΑΤΙ ΥΠΑΡΧΕΙ (P2 flag → P7): τα 4 entity param schemas είναι `.strict()`.
 * Η P2 πρόσθεσε ΜΟΝΟ τους TypeScript τύπους (`envelopeLayer?`/`revealInsulation?`)
 * — όχι τα schemas. Άρα κάθε PATCH έσβηνε σιωπηρά τα πεδία (ADR-375 v2.13 pattern).
 * Η P7 τα προσθέτει στα schemas μέσω αυτού του SSoT.
 *
 * @see ./thermal-envelope-types (EnvelopeLayer / ThermalEnvelopeSpec — type SSoT)
 * @see docs/centralized-systems/reference/adrs/ADR-396-bim-external-thermal-envelope-etics.md §7 (P7)
 */

import { z } from 'zod';
import { MIN_ENVELOPE_THICKNESS_M } from './thermal-envelope-types';

/** Άνω λογικό όριο πάχους στρώσης μόνωσης (ΜΕΤΡΑ) — 1m = absurd, καθαρό guard. */
const MAX_ENVELOPE_THICKNESS_M = 1 as const;

/** Πάχος στρώσης κελύφους σε ΜΕΤΡΑ (D6: ≥5εκ). */
const EnvelopeThicknessSchema = z
  .number()
  .min(MIN_ENVELOPE_THICKNESS_M)
  .max(MAX_ENVELOPE_THICKNESS_M);

/** Οι 4 ζώνες μόνωσης (mirror `EnvelopeZoneId`). */
export const EnvelopeZoneSchema = z.enum(['Z1', 'Z2', 'Z3', 'Z4']);

/**
 * Per-element εξωτερική στρώση μόνωσης (mirror `EnvelopeLayer`). Προσαρτάται σε
 * column/beam/slab params. Το `materialId` είναι free-form (preset ή custom).
 */
export const EnvelopeLayerSchema = z
  .object({
    materialId: z.string().min(1),
    thickness_m: EnvelopeThicknessSchema,
    zone: EnvelopeZoneSchema,
  })
  .strict();

/**
 * Reveal μόνωση ανοίγματος (Z4 only) — ίδιο shape με `EnvelopeLayer` αλλά η ζώνη
 * είναι κλειδωμένη στο Z4 (τα περβάζια ανήκουν πάντα στη Z4, ADR-396 §2.1).
 */
export const RevealInsulationSchema = z
  .object({
    materialId: z.string().min(1),
    thickness_m: EnvelopeThicknessSchema,
    zone: z.literal('Z4'),
  })
  .strict();

/** On/off toggles ανά ζώνη (mirror `EnvelopeZoneToggles`). */
export const EnvelopeZoneTogglesSchema = z
  .object({
    Z1: z.boolean(),
    Z2: z.boolean(),
    Z3: z.boolean(),
    Z4: z.boolean(),
  })
  .strict();

/**
 * Per-floor ορισμός θερμοπρόσοψης (mirror `ThermalEnvelopeSpec`). Persist στο
 * level doc (ADR-396 P7 OQ-A) ως preset + display driver.
 */
export const ThermalEnvelopeSpecSchema = z
  .object({
    materialId: z.string().min(1),
    thickness_m: EnvelopeThicknessSchema,
    revealThickness_m: EnvelopeThicknessSchema,
    zones: EnvelopeZoneTogglesSchema,
  })
  .strict();
