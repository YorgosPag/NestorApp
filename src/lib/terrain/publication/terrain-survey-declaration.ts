/**
 * ADR-920 Δ2 — the declaration that travels WITH the survey source: «I have the right to publish this
 * survey», plus who measured it and when. Encoding and defensive reading, the
 * `model-declaration-metadata` pattern (ADR-845 §6.2.1).
 *
 * 🔑 **It lives on the same Storage object as the bytes** (custom metadata, ONE `save()`): bytes and
 * declaration cannot exist apart, and the public shelf (Β3β) reads both in the same `getMetadata()`.
 *
 * ⛔ **No defaults.** `rightsAffirmed` must be the literal `true`; a missing name or date is NOT a
 * declaration. A default here would mean «the first one who forgets to answer publishes».
 *
 * ⚠️ Who affirmed and when is NOT part of it: those are server facts (`FileRecord.createdBy` /
 * `createdAt`), never a claim of the caller. The versioned legal wording (ADR-861) arrives with the
 * form that shows it (Β4); this contract records the answer.
 *
 * Pure: no I/O — the client that writes and the server that reads share this file.
 *
 * @module lib/terrain/publication/terrain-survey-declaration
 */

import { isCalendarDay } from '@/lib/date/calendar-day';
import { LISTING_TERRAIN_SURVEYOR_NAME_MAX } from './listing-terrain-config';
import type { TerrainRefusalCode } from './terrain-publication-contract';

/** The ONE name of the metadata key — writer and reader both take it from here. */
export const TERRAIN_DECLARATION_METADATA_KEY = 'nestorTerrainDeclaration';

export interface TerrainSurveyDeclaration {
  /** The surveyor (person or firm) who measured the plot — the provenance shown to the buyer. */
  readonly surveyorName: string;
  /** Date of the survey, `YYYY-MM-DD`. */
  readonly surveyedOn: string;
  /** «I have the right to publish a derivative of this survey» — answered, never assumed. */
  readonly rightsAffirmed: true;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The declaration as a structure, or `null` when it is not one. Trims the name — the only normalisation. */
export function readTerrainSurveyDeclaration(value: unknown): TerrainSurveyDeclaration | null {
  if (!isRecord(value)) return null;
  const { surveyorName, surveyedOn, rightsAffirmed } = value;

  if (rightsAffirmed !== true) return null;
  if (typeof surveyorName !== 'string' || typeof surveyedOn !== 'string') return null;

  const name = surveyorName.trim();
  if (name.length === 0 || name.length > LISTING_TERRAIN_SURVEYOR_NAME_MAX) return null;
  // A real calendar day (`2026-02-30` is not one) — the project's one judge (ADR-919).
  if (!isCalendarDay(surveyedOn)) return null;

  return { surveyorName: name, surveyedOn, rightsAffirmed: true };
}

/** The declaration from its wire / metadata string, or `null` — never a default. */
export function decodeTerrainSurveyDeclaration(raw: unknown): TerrainSurveyDeclaration | null {
  if (typeof raw !== 'string' || raw.length === 0) return null;
  try {
    return readTerrainSurveyDeclaration(JSON.parse(raw));
  } catch {
    return null;
  }
}

/** The ONE spelling of a declaration — fixed key order, only validated fields. */
export function encodeTerrainSurveyDeclaration(declaration: TerrainSurveyDeclaration): string {
  return JSON.stringify({
    surveyorName: declaration.surveyorName,
    surveyedOn: declaration.surveyedOn,
    rightsAffirmed: declaration.rightsAffirmed,
  });
}

/** UTC+14 — the earliest time zone on Earth: the latest calendar day that is «today» somewhere. */
const EARLIEST_ZONE_OFFSET_MS = 14 * 60 * 60 * 1000;

/**
 * A survey dated after today is a typo, not a measurement. «Today» is the latest calendar day that
 * exists anywhere at `now` — a server in UTC must not refuse an Athens survey dated today at 01:00.
 */
export function isSurveyDateInFuture(declaration: TerrainSurveyDeclaration, now: Date): boolean {
  const latestToday = new Date(now.getTime() + EARLIEST_ZONE_OFFSET_MS).toISOString().slice(0, 10);
  return declaration.surveyedOn > latestToday;
}

export type TerrainDeclarationVerdict =
  | { readonly ok: true; readonly declaration: TerrainSurveyDeclaration }
  | { readonly ok: false; readonly code: Extract<TerrainRefusalCode, 'TERRAIN_DECLARATION_INVALID' | 'TERRAIN_SURVEY_DATE_IN_FUTURE'> };

/**
 * **The ONE verdict on a declaration, from its wire string** (ADR-920 Β4.7) — the door judges what arrived, the owner's
 * form judges what it is about to send, with the SAME function and the SAME codes ⇒ one i18n row explains both, and the
 * form never lets through what the door refuses. Shape first (`INVALID`), then the calendar (`DATE_IN_FUTURE`).
 */
export function judgeTerrainSurveyDeclaration(raw: unknown, now: Date): TerrainDeclarationVerdict {
  const declaration = decodeTerrainSurveyDeclaration(raw);
  if (declaration === null) return { ok: false, code: 'TERRAIN_DECLARATION_INVALID' };
  if (isSurveyDateInFuture(declaration, now)) return { ok: false, code: 'TERRAIN_SURVEY_DATE_IN_FUTURE' };
  return { ok: true, declaration };
}
