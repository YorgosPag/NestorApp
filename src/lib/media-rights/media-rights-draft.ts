/**
 * @fileoverview **Η δήλωση δικαιωμάτων μέσου όπως τη συμπληρώνει άνθρωπος** — πρόχειρο ⇄ `MediaRights` (ADR-884 Φ0.14 ·
 *   ADR-923 §5.10.4).
 * @related types/media-rights.ts (ο ένας τύπος IPTC) · constants/media-rights-vocabulary.ts (πλαίσια) ·
 *   lib/media-rights/media-rights-schema.ts (ο διακομιστής ξανακρίνει) · components/shared/media-rights/MediaRightsFields
 * @module lib/media-rights/media-rights-draft
 *
 * 🔑 **Ένας μετασχηματισμός για κάθε φόρμα**: η φόρμα κρατά ό,τι γράφει ο άνθρωπος (όνομα, σκοπός, διάρκεια)· το IPTC
 *    (`creator` · `copyrightNotice` · `license`) **παράγεται** εδώ. Δύο φόρμες με δικό τους `declarationOf` θα έδιναν
 *    δύο διαφορετικά «© …» για την ίδια δήλωση.
 * 🔑 **Ο δημιουργός δένεται σε λογαριασμό ΜΟΝΟ όσο δηλώνει τον εαυτό του** (ίδιο όνομα με τον συνδεδεμένο): εξωτερικός
 *    φωτογράφος δηλώνεται με όνομα και `userId: null` — ο διακομιστής αρνείται απόδοση σε **ξένο** λογαριασμό.
 * 🔑 **Επεξεργασία ≠ νέα δήλωση**: πάνω σε υπάρχοντα δικαιώματα κρατιούνται ό,τι η φόρμα δεν δείχνει (`licensors` ·
 *    `webStatementOfRights` · ο λογαριασμός και το URL του δημιουργού όσο το όνομα δεν άλλαξε). Αλλιώς ένα απλό «αποθήκευση»
 *    θα έσβηνε σιωπηλά τον αδειοδότη που έγραψε η εισαγωγή.
 * ⚠️ Διάρκεια **μόνο** `date` / `perpetual`: η `mandate` θέλει ταυτότητα εντολής που καμία από αυτές τις φόρμες δεν διαλέγει
 *    (την ορίζει η ροή της αγγελίας). Πλαίσιο που δεν δέχεται κάποια από τις δύο δεν τη βλέπει.
 */

import {
  MEDIA_LICENSE_PURPOSES,
  isMediaLicensePurposeIn,
  isMediaLicenseTermKindIn,
  type MediaLicenseContext,
  type MediaLicensePurposeIn,
} from '@/constants/media-rights-vocabulary';
import type { MediaLicenseTerm, MediaParty, MediaRights } from '@/types/media-rights';

/** Οι διάρκειες που συμπληρώνει άνθρωπος σε φόρμα. */
export const DRAFT_TERM_KINDS = ['perpetual', 'date'] as const;
export type DraftTermKind = (typeof DRAFT_TERM_KINDS)[number];

export interface MediaRightsDraft<C extends MediaLicenseContext> {
  readonly creatorName: string;
  /** Κενό ⇒ παράγεται «© <έτος> <δημιουργός>». */
  readonly copyrightNotice: string;
  readonly purpose: MediaLicensePurposeIn<C>;
  readonly termKind: DraftTermKind;
  readonly termUntil: Date | undefined;
}

/** Ποιος συμπληρώνει τη φόρμα — για το δέσιμο του δημιουργού στον λογαριασμό. */
export interface MediaRightsAuthor {
  readonly uid: string | null;
  readonly name: string;
}

export type MediaRightsDraftIssue = 'creatorRequired' | 'termDateRequired';

/** Οι διάρκειες της φόρμας που δέχεται το πλαίσιο, στη σειρά εμφάνισης. */
export function draftTermKindsIn(context: MediaLicenseContext): readonly DraftTermKind[] {
  return DRAFT_TERM_KINDS.filter((kind) => isMediaLicenseTermKindIn(context, kind));
}

/** Οι σκοποί που δέχεται το πλαίσιο, στη σειρά της ρίζας — με τύπο στενεμένο στο πλαίσιο. */
export function mediaLicensePurposesIn<C extends MediaLicenseContext>(context: C): readonly MediaLicensePurposeIn<C>[] {
  return MEDIA_LICENSE_PURPOSES.filter((purpose): purpose is MediaLicensePurposeIn<C> => isMediaLicensePurposeIn(context, purpose));
}

function purposeOrDefault<C extends MediaLicenseContext>(context: C, value: unknown): MediaLicensePurposeIn<C> {
  const purposes = mediaLicensePurposesIn(context);
  const match = purposes.find((purpose) => purpose === value);
  if (match !== undefined) return match;
  if (purposes.length === 0) throw new Error(`media licence context without purposes: ${context}`);
  return purposes[0];
}

/** Νέα δήλωση: ο συνδεδεμένος ως δημιουργός, ο πρώτος σκοπός του πλαισίου, η πρώτη διάρκεια που δέχεται. */
export function emptyMediaRightsDraft<C extends MediaLicenseContext>(context: C, author: MediaRightsAuthor): MediaRightsDraft<C> {
  return {
    creatorName: author.name,
    copyrightNotice: '',
    purpose: purposeOrDefault(context, undefined),
    termKind: draftTermKindsIn(context)[0] ?? 'perpetual',
    termUntil: undefined,
  };
}

/** Υπάρχοντα δικαιώματα ⇒ πρόχειρο (επεξεργασία). Σκοπός εκτός πλαισίου ⇒ ο πρώτος του πλαισίου, ορατά στη φόρμα. */
export function mediaRightsDraftOf<C extends MediaLicenseContext>(context: C, rights: MediaRights): MediaRightsDraft<C> {
  const { term } = rights.license;
  return {
    creatorName: rights.creator.name,
    copyrightNotice: rights.copyrightNotice,
    purpose: purposeOrDefault(context, rights.license.purpose),
    termKind: term.kind === 'date' ? 'date' : 'perpetual',
    termUntil: term.kind === 'date' ? new Date(term.until) : undefined,
  };
}

/** Τι λείπει για να γίνει η δήλωση δικαιώματα — κενό ⇒ πλήρης. */
export function mediaRightsDraftIssues<C extends MediaLicenseContext>(draft: MediaRightsDraft<C>): readonly MediaRightsDraftIssue[] {
  const issues: MediaRightsDraftIssue[] = [];
  if (draft.creatorName.trim().length === 0) issues.push('creatorRequired');
  if (draft.termKind === 'date' && draft.termUntil === undefined) issues.push('termDateRequired');
  return issues;
}

function termOf<C extends MediaLicenseContext>(draft: MediaRightsDraft<C>): MediaLicenseTerm {
  return draft.termKind === 'date' && draft.termUntil ? { kind: 'date', until: draft.termUntil.toISOString() } : { kind: 'perpetual' };
}

function creatorOf(name: string, author: MediaRightsAuthor, base: MediaRights | null): MediaParty {
  if (base !== null && base.creator.name === name) return base.creator;
  const isSelf = author.uid !== null && name === author.name.trim();
  return { name, userId: isSelf ? author.uid : null, url: null };
}

/**
 * Πρόχειρο ⇒ `MediaRights`. Το `base` (υπάρχοντα δικαιώματα) κρατά ό,τι η φόρμα δεν δείχνει. Η χρονιά του «©» είναι
 * παράμετρος (καθαρή συνάρτηση — ο καλών δίνει το «τώρα»).
 */
export function mediaRightsOf<C extends MediaLicenseContext>(
  draft: MediaRightsDraft<C>,
  author: MediaRightsAuthor,
  year: number,
  base: MediaRights | null = null,
): MediaRights {
  const name = draft.creatorName.trim();
  const notice = draft.copyrightNotice.trim();
  return {
    creator: creatorOf(name, author, base),
    licensors: base?.licensors ?? [],
    copyrightNotice: notice.length > 0 ? notice : `© ${year} ${name}`,
    webStatementOfRights: base?.webStatementOfRights ?? null,
    license: { purpose: draft.purpose, term: termOf(draft) },
  };
}
