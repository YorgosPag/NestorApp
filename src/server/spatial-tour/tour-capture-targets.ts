import 'server-only';

/**
 * @fileoverview **«ΤΑ ΑΚΙΝΗΤΑ ΜΟΥ» ΓΙΑ ΤΗ ΛΗΨΗ** — σε ποια ακίνητα μπορεί ο συνδεδεμένος να ανεβάσει (ADR-904 Κ7).
 * @related ADR-904 §3.2 Κ7 · ADR-884 Φ0.3 · Φ0.5 · `tour-authority.ts` · `tour-capture-list.ts` · `lib/api/chained-pages.ts`
 * @module server/spatial-tour/tour-capture-targets
 *
 * 🔴 **ΚΑΜΙΑ ΝΕΑ ΑΡΧΗ ΕΞΟΥΣΙΟΔΟΤΗΣΗΣ** (CHECK 3.68). Τα ερωτήματα **προτείνουν** υποψήφιους· **κάθε** υποψήφιος κρίνεται
 * από τον **ίδιο** κριτή που κρίνει το ανέβασμα (`mayManageTour` · ο φωτογράφος από τον κριτή αδειών). Άρα η λίστα δεν
 * μπορεί να υποσχεθεί ακίνητο που το `startUpload` θα αρνηθεί — και ένα πειραγμένο `pageToken` δεν δίνει τίποτα.
 *
 * 🔑 **Τέσσερις πηγές, με σειρά** (`readChainedPage`, Google AIP-158):
 *  1. `grants`  — οι άδειες λήψης του φωτογράφου (η **ίδια** ανάγνωση με τη σελίδα web `(me)/tour-captures`)· όσες αφορούν
 *     ακίνητο που ο ίδιος **διαχειρίζεται** παραλείπονται εδώ — εμφανίζονται ως `manager` (μία γραμμή ανά ακίνητο)·
 *  2. `own`     — οι αγγελίες που **έγραψε** (`authorUserId`, ο άξονας απομόνωσης)·
 *  3. `agency`  — οι αγγελίες του **γραφείου** του (`authorCompanyId`), εκτός όσων έγραψε ο ίδιος (ήδη στο 2)·
 *  4. `company` — τα εταιρικά ακίνητα (`properties.companyId`), **μόνο** αν ο κριτής δίνει διαχείριση εταιρικής περιήγησης.
 *
 * ⚠️ **Σειρά κατά id εγγράφου**: σταθερή, χωρίς σύνθετο δείκτη (ισότητα + `__name__` = αυτόματος δείκτης). Η αλλαγή σε
 * «πιο πρόσφατα πρώτα» είναι **μη-σπαστική** (το συμβόλαιο δεν υπόσχεται σειρά) — θέλει δείκτη ανά πηγή (CHECK 3.91).
 */

import { FieldPath, type Firestore, type Query } from 'firebase-admin/firestore';
import type { z } from 'zod/v4';

import { FIELDS } from '@/config/firestore-field-constants';
import { CAPTURE_TARGETS_PAGE_SIZE } from '@/constants/spatial-tour-vocabulary';
import type { CaptureTargetSchema, CaptureTargetsResponseSchema } from '@/contracts/capture-api/capture-api-schemas';
import { readChainedPage, type ChainPosition, type PageSource, type SourcePage } from '@/lib/api/chained-pages';
import { mayManageTour, type TourActor } from '@/lib/spatial-tour/tour-authority';
import type { TourSubject } from '@/types/spatial-tour';

import { readMyTourCaptureGrants } from './tour-capture-list';
import { TOUR_SUBJECT_COLLECTION, tourSubjectFromDocument } from './tour-locate';

export type CaptureTarget = z.infer<typeof CaptureTargetSchema>;
export type CaptureTargetsPage = z.infer<typeof CaptureTargetsResponseSchema>;

/** Τα ids των πηγών — γράφονται στο `pageToken`, άρα **σταθερά** (μετονομασία = σπασμένα tokens πελατών). */
export const CAPTURE_TARGET_SOURCES = ['grants', 'own', 'agency', 'company'] as const;
type CaptureTargetSource = (typeof CAPTURE_TARGET_SOURCES)[number];

const EXHAUSTED: SourcePage<CaptureTarget> = { items: [], after: null };

/** AIP-158: απών/`0` ⇒ προεπιλογή · πάνω από το όριο ⇒ **μειώνεται** (όχι σφάλμα). Το αρνητικό το έκοψε ήδη το σχήμα. */
export function captureTargetsPageSize(requested: number | undefined): number {
  if (requested === undefined || requested === 0) return CAPTURE_TARGETS_PAGE_SIZE.default;
  return Math.min(requested, CAPTURE_TARGETS_PAGE_SIZE.max);
}

const subjectKey = (subject: TourSubject): string => `${subject.kind}/${subject.id}`;

/** Πηγή 1 — οι άδειες: λίγες (φραγμένες στην ανάγνωση), ταξινομούνται στη μνήμη· ο δρομέας = το κλειδί της ρίζας. */
function grantSource(db: Firestore, actor: TourActor): PageSource<CaptureTarget> {
  return {
    id: 'grants',
    async read(after, limit) {
      const entries = (await readMyTourCaptureGrants(db, actor.listing.uid))
        .filter((entry) => mayManageTour(entry.record, actor) !== 'granted')
        .map(({ grant }): CaptureTarget => ({
          subject: grant.subject,
          label: grant.propertyLabel,
          access: { kind: 'capture-grant', standing: grant.standing, expiresAt: grant.expiresAt, reason: grant.reason },
        }))
        .sort((a, b) => subjectKey(a.subject).localeCompare(subjectKey(b.subject)))
        .filter((target) => after === null || subjectKey(target.subject) > after);
      const items = entries.slice(0, limit);
      const last = items[items.length - 1];
      return { items, after: entries.length > limit && last !== undefined ? subjectKey(last.subject) : null };
    },
  };
}

/**
 * Πηγές 2-4 — ένα ερώτημα ισότητας, σελίδα κατά id. Κάθε έγγραφο περνά από το **σύνορο** της ρίζας και τον **κριτή**·
 * `skip` = όσα ανήκουν ήδη σε προηγούμενη πηγή.
 */
function querySource(
  id: Exclude<CaptureTargetSource, 'grants'>,
  kind: TourSubject['kind'],
  query: Query | null,
  actor: TourActor,
  skip: (data: unknown) => boolean = () => false,
): PageSource<CaptureTarget> {
  return {
    id,
    async read(after, limit) {
      if (query === null) return EXHAUSTED;
      const ordered = query.orderBy(FieldPath.documentId());
      const snap = await (after === null ? ordered : ordered.startAfter(after)).limit(limit).get();
      const items = snap.docs.flatMap((doc): CaptureTarget[] => {
        const reading = tourSubjectFromDocument(kind, doc.data(), doc.id);
        if (reading === null || skip(doc.data()) || mayManageTour(reading.record, actor) !== 'granted') return [];
        return [{ subject: { kind, id: doc.id }, label: reading.label, access: { kind: 'manager' } }];
      });
      const last = snap.docs[snap.docs.length - 1];
      return { items, after: snap.docs.length === limit && last !== undefined ? last.id : null };
    },
  };
}

/** Ο μισθωτής του δράστη — κενό **δεν** είναι μισθωτής (ίδιο δόγμα με το `hasTenant` του `listing-custody`). */
function tenantOf(actor: TourActor): string | null {
  const companyId = actor.listing.companyId;
  return typeof companyId === 'string' && companyId.length > 0 ? companyId : null;
}

/** Οι τέσσερις πηγές, με τη σειρά τους — οι ανεφάρμοστες (χωρίς μισθωτή · χωρίς δικαίωμα) είναι **κενές**, όχι απούσες. */
function captureTargetSources(db: Firestore, actor: TourActor): readonly PageSource<CaptureTarget>[] {
  const uid = actor.listing.uid;
  const tenant = tenantOf(actor);
  const listings = db.collection(TOUR_SUBJECT_COLLECTION['owner-property']);
  // Ρωτά τον ΙΔΙΟ κριτή με ρίζα-δείγμα του μισθωτή: «διαχειρίζεσαι εταιρική περιήγηση εδώ;» — όχι λίστα ρόλων.
  const managesCompanyTours = tenant !== null
    && mayManageTour({ kind: 'company-property', property: { companyId: tenant } }, actor) === 'granted';
  const authoredBySelf = (data: unknown) => (data as { readonly authorUserId?: unknown } | undefined)?.authorUserId === uid;
  return [
    grantSource(db, actor),
    querySource('own', 'owner-property', listings.where(FIELDS.AUTHOR_USER_ID, '==', uid), actor),
    querySource('agency', 'owner-property', tenant === null ? null : listings.where(FIELDS.AUTHOR_COMPANY_ID, '==', tenant), actor, authoredBySelf),
    querySource('company', 'company-property', !managesCompanyTours
      ? null
      : db.collection(TOUR_SUBJECT_COLLECTION['company-property']).where(FIELDS.COMPANY_ID, '==', tenant), actor),
  ];
}

/** **Μία σελίδα** του «τα ακίνητά μου» για τη λήψη. Η θέση (`from`) είναι ήδη αποκωδικοποιημένη και κριμένη. */
export async function listCaptureTargets(
  db: Firestore,
  input: { readonly actor: TourActor; readonly from: ChainPosition | null; readonly pageSize: number },
): Promise<CaptureTargetsPage> {
  const page = await readChainedPage(captureTargetSources(db, input.actor), input.from, input.pageSize);
  return { targets: [...page.items], nextPageToken: page.nextPageToken };
}
