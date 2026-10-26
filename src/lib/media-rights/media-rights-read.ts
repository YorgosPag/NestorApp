/**
 * @fileoverview **ΤΟ ΣΥΝΟΡΟ ΑΝΑΓΝΩΣΗΣ ΤΩΝ ΔΙΚΑΙΩΜΑΤΩΝ ΜΕΣΟΥ** — ωμά δεδομένα → `MediaRights`, ή `null`.
 * @related ADR-884 Φ0.14 · ADR-866 §5.6.1 · types/media-rights
 * @module lib/media-rights/media-rights-read
 *
 * 🔴 **`null` σημαίνει «ΔΕΝ ξέρουμε αν επιτρέπεται η χρήση»** — και ο καλών το αντιμετωπίζει ως
 * **απαγόρευση** (μέσο χωρίς αναγνώσιμα δικαιώματα δεν ανεβαίνει στο ράφι). Κανένα πεδίο δεν
 * «συμπληρώνεται» με εφευρημένη τιμή: ένας εφευρημένος δικαιούχος είναι ψευδής δήλωση δικαιωμάτων.
 *
 * **Layering**: leaf.
 */

import {
  isMediaLicensePurposeIn,
  isMediaLicenseTermKindIn,
  MAX_MEDIA_LICENSORS,
  type MediaLicenseContext,
} from '@/constants/media-rights-vocabulary';
import { text } from '@/lib/agency/showcase-read-primitives';
import { normalizeToISO } from '@/lib/date-local';
import { isRecord } from '@/lib/type-guards';
import type { MediaLicenseTerm, MediaParty, MediaRights } from '@/types/media-rights';

function readParty(raw: unknown): MediaParty | null {
  if (!isRecord(raw)) return null;
  const name = text(raw.name);
  if (name === null) return null;
  return { name, userId: text(raw.userId), url: text(raw.url) };
}

function readTerm(raw: unknown, context: MediaLicenseContext): MediaLicenseTerm | null {
  if (!isRecord(raw) || !isMediaLicenseTermKindIn(context, raw.kind)) return null;
  switch (raw.kind) {
    case 'perpetual':
      return { kind: 'perpetual' };
    case 'mandate': {
      const mandateId = text(raw.mandateId);
      return mandateId === null ? null : { kind: 'mandate', mandateId };
    }
    case 'date': {
      const until = normalizeToISO(raw.until);
      return until === null ? null : { kind: 'date', until };
    }
  }
}

function readLicensors(raw: unknown): MediaParty[] | null {
  if (!Array.isArray(raw) || raw.length > MAX_MEDIA_LICENSORS) return null;
  const parties = raw.map(readParty);
  return parties.every((party): party is MediaParty => party !== null) ? parties : null;
}

/**
 * @param context το πλαίσιο του μέσου (ADR-923 §5.10.3): σκοπός ή διάρκεια **άλλου** πλαισίου ⇒ `null` — ένα μέσο αγγελίας με
 *   «μεταπώληση από αντιπρόσωπο» δεν είναι αναγνώσιμη δήλωση δικαιωμάτων, είναι λάθος.
 */
export function readMediaRights(raw: unknown, context: MediaLicenseContext): MediaRights | null {
  if (!isRecord(raw) || !isRecord(raw.license)) return null;
  const creator = readParty(raw.creator);
  const licensors = readLicensors(raw.licensors ?? []);
  const copyrightNotice = text(raw.copyrightNotice);
  const purpose = raw.license.purpose;
  const term = readTerm(raw.license.term, context);
  if (creator === null || licensors === null || copyrightNotice === null) return null;
  if (!isMediaLicensePurposeIn(context, purpose) || term === null) return null;
  return {
    creator,
    licensors,
    copyrightNotice,
    webStatementOfRights: text(raw.webStatementOfRights),
    license: { purpose, term },
  };
}
