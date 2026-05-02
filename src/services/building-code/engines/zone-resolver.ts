/**
 * @related ADR-186 Building Code Module — Modular ΝΟΚ
 *
 * Zone lookup — normalise raw input → canonical zoneId → ZoneParameters.
 */
import { ZONE_PARAMETERS } from '@/services/building-code/constants/zones.constants';
import type { ZoneParameters } from '@/services/building-code/types/zone.types';

/** Map keywords/aliases → canonical zoneId */
const ALIASES: Record<string, string> = {
  'ΕΚΤΟΣ': 'ΕΚΤ',
  'ΕΚΤΟΣ ΣΧΕΔΙΟΥ': 'ΕΚΤ',
  'ΑΜΙΓΗΣ': 'Α',
  'ΑΜΙΓΗΣ ΚΑΤΟΙΚΙΑ': 'Α',
  'ΓΕΝΙΚΗ': 'Β',
  'ΓΕΝΙΚΗ ΚΑΤΟΙΚΙΑ': 'Β',
  'ΚΕΝΤΡΙΚΗ': 'Κ',
};

/** Normalize: uppercase, trim, collapse whitespace, normalize hyphen spacing. */
export function normalizeZoneId(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s*-\s*/g, '-').replace(/\s+/g, ' ');
}

/** Exact lookup (after normalization) + alias fallback. Returns null if not found. */
export function lookupZone(raw: string): ZoneParameters | null {
  const normalized = normalizeZoneId(raw);
  return ZONE_PARAMETERS[normalized] ?? ZONE_PARAMETERS[ALIASES[normalized] ?? ''] ?? null;
}
