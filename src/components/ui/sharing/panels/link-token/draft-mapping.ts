/**
 * =============================================================================
 * Link-token draft ↔ αιτήματα διακομιστή (ADR-315 §5 · Α13)
 * =============================================================================
 *
 * **Καθαρές** συναρτήσεις — η φόρμα κρατά strings (Select/Input), ο διακομιστής αριθμούς και
 * τριαδικό κωδικό (`string` = νέος · `null` = αφαίρεση · απόν = αμετάβλητος). Η μετάφραση ζει
 * **εδώ και μόνο εδώ**, ώστε δημιουργία και αλλαγή ρυθμίσεων να μη διαφωνήσουν ποτέ για το
 * «τι σημαίνει κενό πεδίο».
 *
 * @module components/ui/sharing/panels/link-token/draft-mapping
 */

import type { CreateShareRequest, ShareLinkSummary, UpdateShareRequest } from '@/types/sharing';
import { INITIAL_LINK_TOKEN_DRAFT, type LinkTokenDraft } from './types';

/** Οι επιλογές λήξης της φόρμας (ώρες) — ίδιο εύρος με τον διακομιστή (Α8). */
export const LINK_EXPIRY_OPTION_HOURS = ['1', '24', '72', '168', '720'] as const;

/**
 * «Μην αλλάξεις τη λήξη» στην αλλαγή ρυθμίσεων. **Ονομασμένη** τιμή, όχι `''`: το Radix Select
 * δεσμεύει το κενό (CHECK 3.48).
 */
export const LINK_EXPIRY_UNCHANGED = 'keep';

const DEFAULT_EXPIRY_HOURS = 72;

function hoursOf(draft: LinkTokenDraft): number {
  return parseInt(draft.expiresInHours, 10) || DEFAULT_EXPIRY_HOURS;
}

function maxOf(draft: LinkTokenDraft): number {
  return parseInt(draft.maxDownloads, 10) || 0;
}

/** Τα πεδία πολιτικής ενός **νέου** συνδέσμου. */
export function draftToCreatePolicy(
  draft: LinkTokenDraft,
): Pick<CreateShareRequest, 'expiresInHours' | 'password' | 'maxAccesses' | 'note' | 'label'> {
  return {
    expiresInHours: hoursOf(draft),
    password: draft.password.trim() || undefined,
    maxAccesses: maxOf(draft),
    note: draft.note.trim() || undefined,
    label: draft.label.trim() || undefined,
  };
}

/**
 * Σύνοψη υπάρχοντος συνδέσμου → προσχέδιο για την αλλαγή ρυθμίσεων. Η λήξη **δεν** προ-
 * συμπληρώνεται με «ό,τι απομένει» (θα έδειχνε επιλογή που δεν υπάρχει)· ξεκινά ως
 * `LINK_EXPIRY_UNCHANGED`. Ο κωδικός ξεκινά **κενός**: ο παλιός δεν ξαναδιαβάζεται ποτέ.
 */
export function summaryToDraft(link: ShareLinkSummary): LinkTokenDraft {
  return {
    ...INITIAL_LINK_TOKEN_DRAFT,
    label: link.label ?? '',
    expiresInHours: LINK_EXPIRY_UNCHANGED,
    maxDownloads: String(link.maxAccesses),
    note: link.note ?? '',
  };
}

/**
 * Προσχέδιο → **μόνο ό,τι άλλαξε** σε σχέση με τον σύνδεσμο. `null` = καμία αλλαγή (το κουμπί
 * «Αποθήκευση» μένει ανενεργό — ένα PATCH χωρίς περιεχόμενο είναι 400).
 */
export function draftToUpdate(draft: LinkTokenDraft, link: ShareLinkSummary): UpdateShareRequest | null {
  const label = draft.label.trim();
  const request: {
    label?: string | null; expiresInHours?: number; password?: string | null; maxAccesses?: number;
  } = {};
  if (label !== (link.label ?? '')) request.label = label === '' ? null : label;
  if (draft.expiresInHours !== LINK_EXPIRY_UNCHANGED) request.expiresInHours = hoursOf(draft);
  if (maxOf(draft) !== link.maxAccesses) request.maxAccesses = maxOf(draft);
  if (draft.password.trim() !== '') request.password = draft.password.trim();
  else if (draft.removePassword && link.requiresPassword) request.password = null;
  return Object.keys(request).length === 0 ? null : request;
}
