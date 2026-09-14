/**
 * @fileoverview **Η ΦΟΡΜΑ ΤΗΣ ΚΑΡΤΑΣ, ΧΩΡΙΣ REACT** — πρόχειρο ⇄ σύρμα (ADR-841 §7 Α21.16).
 * @related components/mandate/ShowcaseCardSection.tsx · types/showcase-card.ts
 * @module lib/agency/showcase-card-draft
 *
 * 🔑 **Γιατί χωριστό πρόχειρο και όχι το σύρμα στη φόρμα**: ο άνθρωπος χρειάζεται καταστάσεις
 * που το σύρμα **απαγορεύεται** να εκφράσει — κατάστημα **χωρίς ακόμη** τόπο, διακόπτη οδού
 * κλειστό **με κρατημένη** την οδό (για να μη χαθεί αν τον ξανανοίξει), ωράριο απενεργοποιημένο
 * με κρατημένες ώρες. Η μετατροπή σε σύρμα είναι **ένα** σημείο, και **δοκιμάζεται**.
 */

import { revealablePhone } from '@/lib/contact/channel-phone';
import { weeklyHoursDefect, type WeeklyHours, type WeeklyHoursDefect } from '@/lib/calendar/weekly-hours';
import type { PlaceRef } from '@/types/geo/public-place';
import type { ImportField, ImportOrigin } from '@/types/showcase-card-import';
import type {
  OwnedShowcaseLocation,
  ShowcaseCardWire,
  ShowcaseLocationRole,
} from '@/types/showcase-card';

export interface PhoneDraft {
  readonly number: string;
  readonly extension: string;
}

export interface ShowcaseLocationDraft {
  /** Κλειδί React — **μόνο** στον φυλλομετρητή, ποτέ στο σύρμα. */
  readonly key: string;
  readonly id: string | null;
  readonly role: ShowcaseLocationRole;
  readonly label: string;
  readonly place: PlaceRef | null;
  readonly publishStreet: boolean;
  readonly street: { readonly street: string; readonly number: string; readonly postalCode: string };
  readonly hoursEnabled: boolean;
  readonly hours: WeeklyHours;
  readonly phones: readonly PhoneDraft[];
  readonly emails: readonly string[];
  /**
   * Α21.19 — **από πού ήρθε** κάθε πεδίο που γέμισε η «Εισαγωγή από τα στοιχεία της εταιρείας». Ζει **μόνο** στο
   * πρόχειρο (ποτέ στο σύρμα) και σβήνει όταν ο άνθρωπος αλλάξει το πεδίο (`withoutProvenance`).
   */
  readonly provenance: Readonly<Partial<Record<ImportField, ImportOrigin>>>;
  /**
   * Α21.19 — η διεύθυνση που **εισήχθη**, ως ερώτημα εντοπισμού: κεντράρει τον χάρτη ώστε ο άνθρωπος να πατήσει
   * το κτίριο. ⛔ Ποτέ τόπος από μόνη της.
   */
  readonly placeHint: string | null;
}

/** Η προεπιλογή όταν ο άνθρωπος ανοίγει το ωράριο: Δευ–Παρ 09:00–17:00 — **πρόταση**, όχι δήλωση. */
export const DEFAULT_WEEK: WeeklyHours = {
  1: [{ opens: '09:00', closes: '17:00' }],
  2: [{ opens: '09:00', closes: '17:00' }],
  3: [{ opens: '09:00', closes: '17:00' }],
  4: [{ opens: '09:00', closes: '17:00' }],
  5: [{ opens: '09:00', closes: '17:00' }],
  6: [],
  7: [],
};

let draftSequence = 0;

/** Κλειδί React χωρίς τυχαιότητα — δεν αποθηκεύεται ποτέ, άρα δεν είναι ταυτότητα (N.6). */
export function nextDraftKey(): string {
  draftSequence += 1;
  return `card-draft-${draftSequence}`;
}

export function emptyLocationDraft(role: ShowcaseLocationRole): ShowcaseLocationDraft {
  return {
    key: nextDraftKey(),
    id: null,
    role,
    label: '',
    place: null,
    publishStreet: false,
    street: { street: '', number: '', postalCode: '' },
    hoursEnabled: false,
    hours: DEFAULT_WEEK,
    phones: [{ number: '', extension: '' }],
    emails: [''],
    provenance: {},
    placeHint: null,
  };
}

/** Αποθηκευμένο κατάστημα → πρόχειρο. Το τηλέφωνο εμφανίζεται **μορφοποιημένο**, όχι ωμό E.164. */
export function draftOfLocation(owned: OwnedShowcaseLocation): ShowcaseLocationDraft {
  return {
    key: nextDraftKey(),
    id: owned.id,
    role: owned.role,
    label: owned.label ?? '',
    place: owned.place,
    publishStreet: owned.street !== null,
    street: owned.street ?? { street: '', number: '', postalCode: '' },
    hoursEnabled: owned.hours !== null,
    hours: owned.hours ?? DEFAULT_WEEK,
    phones: owned.channels.phones.map(({ e164, extension }) => ({
      number: revealablePhone(e164, null)?.display ?? e164,
      extension: extension ?? '',
    })),
    emails: [...owned.channels.emails],
    provenance: {},
    placeHint: null,
  };
}

/** Το ελάττωμα ωραρίου **πριν** την υποβολή — ο **ίδιος** κριτής με τον διακομιστή. */
export function draftHoursDefect(draft: ShowcaseLocationDraft): WeeklyHoursDefect | null {
  return draft.hoursEnabled ? weeklyHoursDefect(draft.hours) : null;
}

/**
 * **Πρόχειρα → σύρμα**, ή ο δείκτης του πρώτου καταστήματος **χωρίς τόπο**.
 *
 * ⚠️ Κατάστημα χωρίς τόπο **δεν** φιλτράρεται σιωπηλά: ο άνθρωπος θα πατούσε «Αποθήκευση» και θα
 * έβλεπε ένα κατάστημα να εξαφανίζεται. Η φόρμα το ονομάζει.
 */
export function wireOfDrafts(
  drafts: readonly ShowcaseLocationDraft[],
  website: string,
): { readonly wire: ShowcaseCardWire } | { readonly missingPlaceIndex: number } {
  const missingPlaceIndex = drafts.findIndex(({ place }) => place === null);
  if (missingPlaceIndex !== -1) return { missingPlaceIndex };

  return {
    wire: {
      locations: drafts.map((draft) => ({
        id: draft.id,
        role: draft.role,
        label: draft.label.trim() === '' ? null : draft.label,
        place: draft.place as PlaceRef,
        street: draft.publishStreet ? draft.street : null,
        hours: draft.hoursEnabled ? draft.hours : null,
        phones: draft.phones.map(({ number, extension }) => ({
          number,
          extension: extension.trim() === '' ? null : extension,
        })),
        emails: draft.emails,
      })),
      // Κενό ⇒ `null`: η **αφαίρεση** της ιστοσελίδας είναι δήλωση, όχι παράλειψη.
      website: website.trim() === '' ? null : website.trim(),
    },
  };
}
