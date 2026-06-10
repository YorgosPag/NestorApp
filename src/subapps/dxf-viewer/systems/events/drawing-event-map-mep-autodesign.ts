/**
 * MEP Auto-Design feedback events — extracted from drawing-event-map.ts to keep
 * that file <500 LOC (Google SRP, CLAUDE.md N.7.1).
 *
 * Pure type module: zero runtime logic. `DrawingEventMap` composes these via
 * `interface DrawingEventMap extends MepAutoDesignEventMap`, so EventBus consumers
 * see the keys exactly as before.
 *
 * One coherent family: the per-discipline `generated → empty → committed` feedback
 * triple emitted by each MEP auto-design Slice 2 flow (Generate → review → accept).
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

export interface MepAutoDesignEventMap {
  // ADR-426 Slice 2 — water-supply auto-design (Generate → review → accept) feedback.
  'bim:water-supply-generated': { networkCount: number; warningCount: number };
  'bim:water-supply-empty': { reason: 'no-fixtures' | 'no-source' };
  'bim:water-supply-committed': { networkCount: number; segmentCount: number };
  // ADR-427 Slice 2 — sanitary-drainage auto-design (Generate → review → accept) feedback.
  'bim:drainage-generated': { networkCount: number; warningCount: number };
  'bim:drainage-empty': { reason: 'no-fixtures' | 'no-collector' };
  'bim:drainage-committed': { networkCount: number; segmentCount: number };
  // ADR-428 Slice 2 — heating (hydronic) auto-design (Generate → review → accept) feedback.
  'bim:heating-generated': { networkCount: number; warningCount: number };
  'bim:heating-empty': { reason: 'no-terminals' | 'no-source' };
  'bim:heating-committed': { networkCount: number; segmentCount: number };
  // ADR-430 Slice 2 — electrical-strong auto-design (Generate → review → accept) feedback.
  'bim:electrical-generated': { circuitCount: number; skipped: number; warningCount: number };
  'bim:electrical-empty': { reason: 'no-terminals' | 'no-source' };
  'bim:electrical-committed': { circuitCount: number };
  // ADR-431 Slice 2 — electrical-weak (ασθενή) auto-design feedback.
  'bim:electrical-weak-generated': { channelCount: number; skipped: number; warningCount: number };
  'bim:electrical-weak-empty': { reason: 'no-terminals' | 'no-source' };
  'bim:electrical-weak-committed': { channelCount: number };
  // ADR-432 Slice 2 — HVAC (αερισμός) auto-design feedback (Generate → review → accept).
  'bim:hvac-generated': { networkCount: number; warningCount: number };
  'bim:hvac-empty': { reason: 'no-terminals' | 'no-source' };
  'bim:hvac-committed': { networkCount: number; segmentCount: number };
  // ADR-433 Slice 2 — fire-protection (πυρόσβεση) auto-design feedback (Generate → review → accept).
  'bim:fire-generated': { networkCount: number; warningCount: number };
  'bim:fire-empty': { reason: 'no-terminals' | 'no-source' };
  'bim:fire-committed': { networkCount: number; segmentCount: number };
  // ADR-434 Slice 2 — gas (φυσικό αέριο) auto-design feedback (Generate → review → accept).
  'bim:gas-generated': { networkCount: number; warningCount: number };
  'bim:gas-empty': { reason: 'no-terminals' | 'no-source' };
  'bim:gas-committed': { networkCount: number; segmentCount: number };
}
