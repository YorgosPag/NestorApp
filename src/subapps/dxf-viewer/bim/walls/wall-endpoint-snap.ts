/**
 * ADR-508 — Wall ENDPOINT face-snap — **thin re-export** του member-agnostic SSoT.
 *
 * Η πραγματική λογική ζει πλέον στο `bim/framing/member-endpoint-snap.ts` (canonical), αφού το END snap
 * είναι μέλος-αγνωστικό — ο ΙΔΙΟΣ κώδικας εξυπηρετεί τοίχο ΚΑΙ δοκάρι (Giorgio 2026-06-24, ενοποίηση
 * τοίχου ↔ δοκαριού ↔ κολώνας). Αυτό το αρχείο διατηρεί τα wall-named aliases ώστε οι υπάρχοντες wall
 * consumers (+ tests) να μένουν αμετάβλητοι (byte-for-byte) — mirror του beam-adapter pattern
 * (`beam-column-face-snap` → `member-column-face-snap`).
 *
 * @see ../framing/member-endpoint-snap.ts — η canonical υλοποίηση
 * @see docs/centralized-systems/reference/adrs/ADR-508-unified-linear-member-framing.md
 */

import {
  resolveMemberEndpointSnap,
  resolveMemberEndpointWithFineStep,
  type MemberEndpointSnap,
} from '../framing/member-endpoint-snap';

/** @deprecated Wall-named alias του member-agnostic `MemberEndpointSnap` (canonical). */
export type WallEndpointSnap = MemberEndpointSnap;

/** Wall-named alias του canonical `resolveMemberEndpointSnap`. */
export const resolveWallEndpointSnap = resolveMemberEndpointSnap;

/** Wall-named alias του canonical `resolveMemberEndpointWithFineStep`. */
export const resolveWallEndpointWithFineStep = resolveMemberEndpointWithFineStep;
