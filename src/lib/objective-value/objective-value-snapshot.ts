/**
 * @fileoverview **Το αμετάβλητο στιγμιότυπο αντικειμενικής αξίας** — μοντέλο, σύνθεση και αποτύπωμα (ADR-947 Δ3).
 * Καθαρές συναρτήσεις, χωρίς I/O: ο server το γράφει (`services/objective-value/objective-value-snapshots.server.ts`),
 * το PDF και η απόκλιση το διαβάζουν.
 * @related `objective-value-draft.ts` (`effectiveDraftOf` · `draftToInput`) · `compute-objective-value.ts` ·
 *   `objective-value-input-provenance.ts` · `objective-value-engine-version.ts` · `objective-value-divergence.ts`
 * @module lib/objective-value/objective-value-snapshot
 *
 * 🏆 **Πρότυπο οριστικοποίησης (Stripe)**: το πρόχειρο αλλάζει ελεύθερα· η οριστικοποίηση **αντιγράφει** ό,τι χρειάζεται
 *    μέσα στην εγγραφή και την κλειδώνει. Το στιγμιότυπο είναι **αυτάρκες** — είσοδοι, ζώνη με την ταυτότητα του πίνακα,
 *    ταυτότητα μηχανής, αποτέλεσμα — ποτέ δείκτες σε ζωντανά δεδομένα που θα άλλαζαν πίσω από την πλάτη του.
 * 🔑 **Το ποσό το βγάζει ο server**, ποτέ ο client: η σύνθεση ξανατρέχει την ΕΝΑ μηχανή πάνω στις εισόδους. Αποτέλεσμα
 *    που δεν είναι `computed` ⇒ **άρνηση** (δεν παγώνουμε «λείπει κάτι»).
 * 🔑 **Περιεχόμενο-διευθυνσιοδότηση (Git)**: `digest` = sha256 του κανονικού JSON του περιεχομένου. Ίδιο περιεχόμενο ⇒
 *    ίδιο αποτύπωμα ⇒ ίδιο id (ιδεμποτές)· τυπώνεται στο PDF και ελέγχεται στη σελίδα επαλήθευσης.
 * 🔴 **Πληροφοριακός υπολογισμός, ΟΧΙ βεβαίωση** (ADR-947 §2): ούτε το μοντέλο ούτε τα κείμενά του λένε «επίσημη».
 */

import type { IssuerQualification } from '@/config/document-validity/document-issuers';
import { sha256HexOfText } from '@/lib/hash/sha256';
import { canonicalJson } from '@/lib/legal/canonical-json';
import { UNKNOWN_COMMERCIALITY, type CommercialityFact } from '@/lib/market/value-zone-file';
import type { GeoPoint } from '@/types/geo/coordinates';

import { computeObjectiveValue } from './compute-objective-value';
import type { ObjectiveValueEngineIdentity } from './objective-value-engine-version';
import { draftToInput, effectiveDraftOf, sourcedCommercialityFactorOf, type ObjectiveValueDraft } from './objective-value-draft';
import { deriveInputProvenance, type ObjectiveValueProvenance } from './objective-value-input-provenance';
import type { ComputedObjectiveValue, ObjectiveValueMissing } from './objective-value-types';

/** Η έκδοση του **σχήματος** του εγγράφου — αλλάζει μόνο με μετανάστευση· ξεχωριστή από την έκδοση της μηχανής. */
export const OBJECTIVE_VALUE_SNAPSHOT_SCHEMA = 1;

/** Η ταυτότητα του πίνακα ζωνών από τον οποίο ήρθε η τιμή (`value-zones/index.json` → `source` + `validFrom`). */
export interface ZoneTableIdentity {
  readonly sha256: string;
  readonly lastModified: string | null;
  readonly validFrom: { readonly from: string; readonly to: string };
}

/**
 * Η τιμή ζώνης του στιγμιότυπου — από **πού** ήρθε. Από τα δεδομένα ζωνών: ο server την ξαναβρήκε από τη θέση (ποτέ
 * τιμή από τον client). Χειροκίνητη: δήλωση του εκδότη (π.χ. από το ΦΥΑΑ), χωρίς πίνακα.
 */
export type ObjectiveValueSnapshotZone =
  | {
      readonly kind: 'valueZones';
      readonly point: GeoPoint;
      /** Το δηλωμένο μέτωπο (`frontKeyOf`) — `null` = η ζώνη που περικλείει το σημείο. */
      readonly frontKey: string | null;
      readonly price: number;
      /** `YYYY-MM-DD` — έναρξη ισχύος της τιμής. */
      readonly validFrom: string;
      readonly commerciality: CommercialityFact;
      readonly table: ZoneTableIdentity;
    }
  | { readonly kind: 'manual'; readonly price: number };

/**
 * Το ακίνητο του στιγμιότυπου. Φ2: ελεύθερη περιγραφή του εκδότη. Οι δεμένες μορφές (ακίνητο ιδιοκτήτη · ακίνητο
 * γραφείου) έρχονται στη Φ5 **μαζί** με την αρχή που επιτρέπει στον εκδότη να τις δει — ο compiler θα ρωτήσει κάθε
 * καταναλωτή.
 */
export type ObjectiveValueSnapshotSubject = { readonly kind: 'freeform'; readonly label: string };

/** Ο εκδότης — γραφείο με δημοσιευμένη βιτρίνα και προσόν από τον ΙΔΙΟ κριτή με τον κατάλογο `/pro`. */
export interface ObjectiveValueSnapshotIssuer {
  readonly companyId: string;
  readonly name: string;
  readonly qualification: IssuerQualification;
  readonly registryNumber: string | null;
}

/** Η προέλευση ανά είσοδο, όπως τη βγάζει ο server — χωρίς τα στοιχεία επαναφοράς της οθόνης. */
export type ObjectiveValueSnapshotProvenance = Pick<ObjectiveValueProvenance, 'zonePrice' | 'commercialityFactor' | 'fields' | 'levels'>;

/** **Το περιεχόμενο** — ό,τι καλύπτει το αποτύπωμα. */
export interface ObjectiveValueSnapshotContent {
  readonly schema: typeof OBJECTIVE_VALUE_SNAPSHOT_SCHEMA;
  /** `YYYY-MM-DD` — η ημερομηνία αποτίμησης (μετρά στην παλαιότητα). */
  readonly valuationDate: string;
  readonly subject: ObjectiveValueSnapshotSubject;
  /** Το πρόχειρο **όπως το έδωσε** ο εκδότης (πριν την τιμή ζώνης). */
  readonly draft: ObjectiveValueDraft;
  readonly zone: ObjectiveValueSnapshotZone;
  readonly provenance: ObjectiveValueSnapshotProvenance;
  readonly engine: ObjectiveValueEngineIdentity;
  readonly result: ComputedObjectiveValue;
  readonly issuer: ObjectiveValueSnapshotIssuer;
}

/** **Το αποθηκευμένο έγγραφο** — περιεχόμενο + αποτύπωμα + μεταδεδομένα δημιουργίας. Ο κάτοχος = ο χώρος του εκδότη. */
export interface ObjectiveValueSnapshot extends ObjectiveValueSnapshotContent {
  readonly id: string;
  readonly digest: string;
  readonly companyId: string;
  /** ISO 8601. */
  readonly createdAt: string;
  readonly createdBy: string;
}

/** Ό,τι χρειάζεται η σύνθεση — όλα ήδη επικυρωμένα και επιλυμένα από τον server. */
export interface ObjectiveValueSnapshotRequest {
  readonly valuationDate: string;
  readonly subject: ObjectiveValueSnapshotSubject;
  readonly draft: ObjectiveValueDraft;
  readonly zone: ObjectiveValueSnapshotZone;
  readonly engine: ObjectiveValueEngineIdentity;
  readonly issuer: ObjectiveValueSnapshotIssuer;
}

export type ObjectiveValueSnapshotComposition =
  | { readonly ok: true; readonly content: ObjectiveValueSnapshotContent }
  | { readonly ok: false; readonly refusal: 'not-computed'; readonly missing: readonly ObjectiveValueMissing[] };

/** Ο ΣΕ που φέρνει η ζώνη στη μηχανή — η χειροκίνητη τιμή δεν φέρνει ΣΕ (τον δηλώνει το πρόχειρο). */
function snapshotZoneCommerciality(zone: ObjectiveValueSnapshotZone): CommercialityFact {
  return zone.kind === 'valueZones' ? zone.commerciality : UNKNOWN_COMMERCIALITY;
}

/** Το πρόχειρο **όπως το είδε η μηχανή** — ο ΕΝΑΣ κανόνας του υπολογιστή (`effectiveDraftOf`). */
export function snapshotEffectiveDraft(draft: ObjectiveValueDraft, zone: ObjectiveValueSnapshotZone): ObjectiveValueDraft {
  return effectiveDraftOf(draft, { price: zone.price, commerciality: snapshotZoneCommerciality(zone) });
}

function provenanceOf(effective: ObjectiveValueDraft, zone: ObjectiveValueSnapshotZone, valuationDate: string): ObjectiveValueSnapshotProvenance {
  const { zonePrice, commercialityFactor, fields, levels } = deriveInputProvenance({
    draft: effective,
    prefill: null,
    location: {
      zonePriceFromSource: zone.kind === 'valueZones',
      zonePrice: zone.price,
      sourcedCommercialityFactor: sourcedCommercialityFactorOf(effective, snapshotZoneCommerciality(zone), valuationDate),
    },
  });
  return { zonePrice, commercialityFactor, fields, levels };
}

/**
 * **Η σύνθεση του στιγμιότυπου** — ξανατρέχει την ΕΝΑ μηχανή. Μόνο αποτέλεσμα `computed` παγώνει· αλλιώς η άρνηση λέει
 * **τι** λείπει, με το λεξιλόγιο της μηχανής.
 */
export function composeObjectiveValueSnapshot(request: ObjectiveValueSnapshotRequest): ObjectiveValueSnapshotComposition {
  const { valuationDate, subject, draft, zone, engine, issuer } = request;
  const effective = snapshotEffectiveDraft(draft, zone);
  const result = computeObjectiveValue(draftToInput(effective, valuationDate));
  if (result.kind !== 'computed') return { ok: false, refusal: 'not-computed', missing: result.missing };
  const provenance = provenanceOf(effective, zone, valuationDate);
  return {
    ok: true,
    content: { schema: OBJECTIVE_VALUE_SNAPSHOT_SCHEMA, valuationDate, subject, draft, zone, provenance, engine, result, issuer },
  };
}

/** Μόνο τα πεδία του περιεχομένου — ό,τι προστέθηκε κατά την αποθήκευση **δεν** μπαίνει στο αποτύπωμα. */
export function snapshotContentOf(snapshot: ObjectiveValueSnapshotContent): ObjectiveValueSnapshotContent {
  const { schema, valuationDate, subject, draft, zone, provenance, engine, result, issuer } = snapshot;
  return { schema, valuationDate, subject, draft, zone, provenance, engine, result, issuer };
}

/** **Το αποτύπωμα** — sha256 (hex) του κανονικού JSON του περιεχομένου (ίδια σειριοποίηση με τα νομικά κείμενα, ADR-861). */
export function objectiveValueSnapshotDigest(content: ObjectiveValueSnapshotContent): Promise<string> {
  return sha256HexOfText(canonicalJson(snapshotContentOf(content)));
}

/** Ο σπόρος του ντετερμινιστικού id: **ΕΝΑ** στιγμιότυπο ανά (εκδότης, περιεχόμενο). */
export function objectiveValueSnapshotSeed(companyId: string, digest: string): string {
  return `${companyId}:${digest}`;
}
