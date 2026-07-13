/**
 * ADR-651 Φάση Η — το **αποτύπωμα (snapshot)** του σετ φύλλων τη στιγμή μιας αναθεώρησης.
 *
 * Καθαρή, ντετερμινιστική συνάρτηση: ίδιο σχέδιο ⇒ ίδιο snapshot ⇒ ίδιο `digest`. Είναι ο
 * **μοναδικός** λόγος που το AI μπορεί αργότερα να πει «τι άλλαξε»: χωρίς αποθηκευμένο
 * αποτύπωμα δεν υπάρχει «προηγούμενη έκδοση» να συγκριθεί.
 *
 * ## Γιατί υπογραφή ανά οντότητα (και όχι μόνο πλήθη)
 * Με μόνο `countsByType`, μια **μετακίνηση** πόρτας (ίδιο πλήθος) θα ήταν αόρατη και η
 * αυτόματη περιγραφή θα έλεγε «καμία αλλαγή» ενώ το σχέδιο άλλαξε — ψέμα σε νομικό έγγραφο.
 * Άρα κάθε οντότητα δίνει `idHash:contentHash:type`:
 *   - `idHash`      → ταυτότητα (προστέθηκε / αφαιρέθηκε),
 *   - `contentHash` → περιεχόμενο (τροποποιήθηκε επί τόπου),
 *   - `type`        → για να ξέρουμε ΤΙ αφαιρέθηκε (η οντότητα δεν υπάρχει πια να τη δούμε).
 *
 * Τα ids **δεν** αποθηκεύονται ωμά (μέγεθος): κρατάμε 32-bit FNV-1a hash. Μια σύγκρουση θα
 * χαρακτήριζε λάθος μία οντότητα σε μια **πρόταση** περιγραφής που ο χρήστης εγκρίνει — ρίσκο
 * αποδεκτό, όφελος 5× μικρότερο έγγραφο.
 *
 * ## Όριο (χωρίς σιωπηλή περικοπή)
 * Πάνω από `MAX_SIGNATURES` οντότητες συνολικά, οι υπογραφές **παραλείπονται** (coarse mode)
 * και η σύγκριση πέφτει στα `countsByType`. Το `RevisionSheetChange.coarse` το **δηλώνει**
 * ρητά στο AI και στο UI — ποτέ σιωπηλά.
 */

import type { Entity } from '../../../types/entities';
import type { RevisionSheetSnapshot, RevisionSnapshot } from './revision.types';

/** Το φύλλο όπως το δίνει ο καλών (React layer): level + οι οντότητες του scene του. */
export interface RevisionSheetSource {
  readonly levelId: string;
  readonly title: string;
  readonly entities: readonly Entity[];
}

/**
 * Ανώτατο πλήθος υπογραφών σε ΟΛΟ το σετ (~22 bytes/υπογραφή ⇒ ~260KB, άνετα κάτω από το
 * όριο 1MB του Firestore document, με χώρο για τα υπόλοιπα πεδία).
 */
export const MAX_SIGNATURES = 12_000;

/** Πεδία καθαρά UI/παροδικά: αλλάζουν χωρίς να αλλάζει το ΣΧΕΔΙΟ ⇒ έξω από το hash. */
const VOLATILE_KEYS: ReadonlySet<string> = new Set([
  'selected',
  'preview',
  'isOverlayPreview',
  'showPreviewGrips',
  'previewGripPoints',
]);

/** FNV-1a 32-bit → 8 hex chars. Σταθερό σε όλες τις πλατφόρμες (καμία εξάρτηση). */
function fnv1a(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * Κανονικοποιημένο JSON: **ταξινομημένα κλειδιά** + στρογγυλοποίηση αριθμών στα 6 δεκαδικά.
 * Χωρίς αυτό, δύο φορτώσεις του ίδιου σχεδίου (διαφορετική σειρά κλειδιών ή θόρυβος
 * κινητής υποδιαστολής) θα έδιναν διαφορετικό hash ⇒ ψεύτικες «τροποποιήσεις».
 */
function canonicalJson(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'number') return Number.isFinite(value) ? String(Math.round(value * 1e6) / 1e6) : 'null';
  if (typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([key, item]) => !VOLATILE_KEYS.has(key) && item !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`);
  return `{${entries.join(',')}}`;
}

/** `idHash:contentHash:type` — η υπογραφή μιας οντότητας. */
export function entitySignature(entity: Entity): string {
  return `${fnv1a(entity.id)}:${fnv1a(canonicalJson(entity))}:${entity.type}`;
}

/** Τα τρία μέρη μιας υπογραφής. */
export function parseSignature(signature: string): { id: string; content: string; type: string } {
  const [id = '', content = '', ...rest] = signature.split(':');
  return { id, content, type: rest.join(':') };
}

function countByType(entities: readonly Entity[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const entity of entities) {
    counts[entity.type] = (counts[entity.type] ?? 0) + 1;
  }
  return counts;
}

function buildSheetSnapshot(source: RevisionSheetSource, withSignatures: boolean): RevisionSheetSnapshot {
  return {
    levelId: source.levelId,
    title: source.title,
    entityCount: source.entities.length,
    countsByType: countByType(source.entities),
    signatures: withSignatures ? source.entities.map(entitySignature).sort() : [],
  };
}

/**
 * Το αποτύπωμα ολόκληρου του σετ. Οι υπογραφές ταξινομούνται ⇒ το `digest` δεν εξαρτάται
 * από τη σειρά των οντοτήτων στο scene (μόνο από το ΠΕΡΙΕΧΟΜΕΝΟ) — άρα «δύο κλικ χωρίς
 * αλλαγή» δίνουν το ίδιο digest και η καταχώρηση μένει idempotent.
 */
export function buildRevisionSnapshot(sources: readonly RevisionSheetSource[]): RevisionSnapshot {
  const total = sources.reduce((sum, source) => sum + source.entities.length, 0);
  const withSignatures = total <= MAX_SIGNATURES;
  const sheets = [...sources]
    .sort((a, b) => (a.levelId < b.levelId ? -1 : a.levelId > b.levelId ? 1 : 0))
    .map((source) => buildSheetSnapshot(source, withSignatures));

  const digestInput = sheets
    .map((sheet) =>
      withSignatures
        ? `${sheet.levelId}#${sheet.signatures.join(',')}`
        : `${sheet.levelId}#${canonicalJson(sheet.countsByType)}`,
    )
    .join('|');

  return { sheets, digest: wideHash(digestInput) };
}

/**
 * 64-bit-ish αποτύπωμα (δύο ανεξάρτητα FNV-1a: κανονικό + ανεστραμμένο). Το `digest` είναι
 * το κλειδί idempotency — μια σύγκρουση θα σήμαινε ότι **πραγματική** αλλαγή δεν καταχωρείται
 * ως αναθεώρηση. Στα 32 bit αυτό είναι 1 στα ~4 δισ.· εδώ γίνεται πρακτικά αδύνατο.
 */
function wideHash(input: string): string {
  return `${fnv1a(input)}${fnv1a([...input].reverse().join(''))}`;
}
