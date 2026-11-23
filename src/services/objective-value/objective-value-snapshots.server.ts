import 'server-only';

/**
 * @fileoverview **Ο ΕΝΑΣ γραφέας και αναγνώστης των στιγμιοτύπων αντικειμενικής αξίας** (ADR-947 Δ3 · Φ2).
 * @related `lib/objective-value/objective-value-snapshot.ts` (σύνθεση · αποτύπωμα) ·
 *   `lib/objective-value/objective-value-divergence.ts` (απόκλιση κατά την ανάγνωση) ·
 *   `lib/objective-value/objective-value-snapshot-request.ts` (σύρμα · πίνακας αρνήσεων) ·
 *   `services/market/value-zones.reader.ts` (η ζώνη ΜΑΖΙ με την ταυτότητα του πίνακα)
 *
 * 🔑 **Ο εκδότης είναι γραφείο με δημοσιευμένη βιτρίνα** και προσόν από τον ΙΔΙΟ κριτή με τον κατάλογο `/pro`
 *    (`showcaseCredentialAmong`). Κάτοχος του στιγμιοτύπου = ο χώρος του εκδότη (είναι δικό του έργο). Η παράδοση στον
 *    ιδιοκτήτη έρχεται στη Φ5, μέσα από την ανάθεση.
 * 🔑 **Αμετάβλητο από κατασκευή**: id ντετερμινιστικό από (εκδότης, αποτύπωμα) και `tx.create` μέσα σε συναλλαγή ⇒
 *    ίδιο περιεχόμενο δύο φορές = το **ίδιο** έγγραφο (`existing`), ποτέ αντικατάσταση. Κανένας κώδικας δεν κάνει update.
 * 🔑 **Απόκλιση κατά την ανάγνωση, ποτέ αποθηκευμένη** (ADR-889 §10.2): ο αναγνώστης ξαναδιαβάζει τη ζώνη και ρωτά την
 *    τρέχουσα μηχανή.
 * 🔒 Στιγμιότυπο άλλου χώρου ≡ ανύπαρκτο (`absent`, 404 — ποτέ 403 που θα επιβεβαίωνε ότι υπάρχει).
 */

import type { Firestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { nowISO } from '@/lib/date-local';
import { showcaseCredentialAmong } from '@/lib/document-validity/issuance-showcase-credential';
import { marketDayOf } from '@/lib/listings/listing-stats';
import { objectiveValueDivergence, type ObjectiveValueDivergence } from '@/lib/objective-value/objective-value-divergence';
import { objectiveValueEngineIdentity } from '@/lib/objective-value/objective-value-engine-version';
import {
  composeObjectiveValueSnapshot,
  objectiveValueSnapshotDigest,
  objectiveValueSnapshotSeed,
  type ObjectiveValueSnapshot,
  type ObjectiveValueSnapshotIssuer,
  type ObjectiveValueSnapshotZone,
} from '@/lib/objective-value/objective-value-snapshot';
import { isObjectiveValueSnapshotRecord } from '@/lib/objective-value/objective-value-snapshot-record';
import {
  OBJECTIVE_VALUE_ISSUER_QUALIFICATIONS,
  snapshotRequestDraft,
  type ObjectiveValueSnapshotBody,
  type ObjectiveValueSnapshotRefusal,
  type ObjectiveValueSnapshotZoneRequest,
} from '@/lib/objective-value/objective-value-snapshot-request';
import { chosenFigureOf, isCandidateFront } from '@/lib/objective-value/objective-value-zone';
import type { ObjectiveValueMissing } from '@/lib/objective-value/objective-value-types';
import { createModuleLogger } from '@/lib/telemetry';
import { isOwnedByCustody } from '@/lib/workspace/custody-scope';
import { generateDeterministicObjectiveValueSnapshotId } from '@/services/enterprise-id.service';
import { readValueZoneWithTable } from '@/services/market/value-zones.reader';
import { lookupAgencyProfile } from '@/services/mandate/agency-profile.service';
import type { GeoPoint } from '@/types/geo/coordinates';

const logger = createModuleLogger('objective-value-snapshots');

/** Ο δρων: μέλος γραφείου (η διαδρομή έχει ήδη κρίνει το δικαίωμα). */
export interface ObjectiveValueSnapshotActor {
  readonly companyId: string;
  readonly uid: string;
}

type Refused = { readonly ok: false; readonly refusal: ObjectiveValueSnapshotRefusal; readonly missing?: readonly ObjectiveValueMissing[] };

export type RecordSnapshotResult =
  | { readonly ok: true; readonly outcome: 'created' | 'existing'; readonly snapshot: ObjectiveValueSnapshot }
  | Refused;

export type ReadSnapshotResult =
  | { readonly ok: true; readonly snapshot: ObjectiveValueSnapshot; readonly divergence: ObjectiveValueDivergence }
  | Refused;

const refused = (refusal: ObjectiveValueSnapshotRefusal): Refused => ({ ok: false, refusal });

function snapshotsOf(db: Firestore) {
  return db.collection(COLLECTIONS.OBJECTIVE_VALUE_SNAPSHOTS);
}

/** Ο εκδότης: η δημοσιευμένη βιτρίνα του γραφείου με προσόν της Δ9 — ή η άρνηση που λέει **γιατί** όχι. */
async function issuerOf(db: Firestore, companyId: string): Promise<ObjectiveValueSnapshotIssuer | Refused> {
  const lookup = await lookupAgencyProfile(db, companyId);
  if (lookup.outcome === 'unavailable') return refused('unavailable');
  if (lookup.outcome === 'not-published') return refused('professional-unavailable');
  const credential = showcaseCredentialAmong(lookup.showcase, OBJECTIVE_VALUE_ISSUER_QUALIFICATIONS);
  if (credential === null) return refused('unqualified');
  return { companyId, name: lookup.showcase.displayName, ...credential };
}

function knownPosition(point: GeoPoint) {
  return { kind: 'known', provenance: 'manual', point, locatedAt: nowISO() } as const;
}

/** **Η ζώνη, όπως τη βρίσκει ο server** — ποτέ τιμή από τον client για τα δεδομένα ζωνών. */
async function resolveZone(request: ObjectiveValueSnapshotZoneRequest): Promise<ObjectiveValueSnapshotZone | Refused> {
  if (request.kind === 'manual') return request;
  const { verdict, table } = await readValueZoneWithTable(knownPosition(request.point));
  if (verdict.kind === 'unavailable' || table === null) return refused('zone-unavailable');
  if (request.frontKey !== null && !isCandidateFront(verdict, request.frontKey)) return refused('front-not-candidate');
  const figure = chosenFigureOf(verdict, request.frontKey);
  if (figure === null) return refused('zone-not-found');
  return {
    kind: 'valueZones',
    point: request.point,
    frontKey: request.frontKey,
    price: figure.price,
    validFrom: figure.validFrom,
    commerciality: figure.commerciality,
    table: { sha256: table.source.sha256, lastModified: table.source.lastModified, validFrom: table.validFrom },
  };
}

function isRefused<T extends object>(value: T | Refused): value is Refused {
  return 'ok' in value && value.ok === false;
}

/** Γράφει το έγγραφο μία φορά: υπάρχει ήδη (ίδιο περιεχόμενο) ⇒ το υπάρχον, ποτέ αντικατάσταση. */
async function createOnce(db: Firestore, snapshot: ObjectiveValueSnapshot): Promise<RecordSnapshotResult> {
  const ref = snapshotsOf(db).doc(snapshot.id);
  return db.runTransaction(async (tx): Promise<RecordSnapshotResult> => {
    const current = await tx.get(ref);
    const stored = current.data();
    if (current.exists && isObjectiveValueSnapshotRecord(stored)) return { ok: true, outcome: 'existing', snapshot: stored };
    if (current.exists) return refused('unavailable');
    tx.create(ref, snapshot);
    return { ok: true, outcome: 'created', snapshot };
  });
}

/** **Παγώνει έναν υπολογισμό** — εκδότης, ζώνη, μηχανή και ποσό τα βγάζει ο server. */
export async function recordObjectiveValueSnapshot(
  db: Firestore,
  actor: ObjectiveValueSnapshotActor,
  body: ObjectiveValueSnapshotBody,
  now: Date,
): Promise<RecordSnapshotResult> {
  const issuer = await issuerOf(db, actor.companyId);
  if (isRefused(issuer)) return issuer;
  const zone = await resolveZone(body.zone);
  if (isRefused(zone)) return zone;
  const engine = await objectiveValueEngineIdentity();
  const valuationDate = marketDayOf(now.getTime());
  const draft = snapshotRequestDraft(body.draft);
  const composed = composeObjectiveValueSnapshot({ valuationDate, subject: body.subject, draft, zone, engine, issuer });
  if (!composed.ok) return { ok: false, refusal: 'not-computed', missing: composed.missing };
  const digest = await objectiveValueSnapshotDigest(composed.content);
  const id = generateDeterministicObjectiveValueSnapshotId(objectiveValueSnapshotSeed(actor.companyId, digest));
  const snapshot: ObjectiveValueSnapshot = {
    ...composed.content,
    id,
    digest,
    companyId: actor.companyId,
    createdAt: now.toISOString(),
    createdBy: actor.uid,
  };
  return createOnce(db, snapshot);
}

/** Η τρέχουσα ζώνη στη θέση του στιγμιοτύπου — `null` = δεν διαβάστηκε / δεν υπάρχει πια (η απόκλιση το λέει). */
async function liveZoneOf(snapshot: ObjectiveValueSnapshot) {
  const { zone } = snapshot;
  if (zone.kind === 'manual') return null;
  const { verdict, table } = await readValueZoneWithTable(knownPosition(zone.point));
  if (table === null || (zone.frontKey !== null && !isCandidateFront(verdict, zone.frontKey))) return null;
  const figure = chosenFigureOf(verdict, zone.frontKey);
  if (figure === null) return null;
  const tableIdentity = { sha256: table.source.sha256, lastModified: table.source.lastModified, validFrom: table.validFrom };
  return { price: figure.price, validFrom: figure.validFrom, commerciality: figure.commerciality, table: tableIdentity };
}

/**
 * Το στιγμιότυπο του χώρου του δρώντος, με το αποτύπωμά του **επαληθευμένο** — αλλιώς `null`. Χωρίς απόκλιση: η εγγραφή
 * όπως παγώθηκε (το PDF της, ADR-947 Φ2β, δεν χρειάζεται τις τρέχουσες ζώνες).
 */
export async function readObjectiveValueSnapshotRecord(db: Firestore, actor: ObjectiveValueSnapshotActor, snapshotId: string): Promise<ObjectiveValueSnapshot | null> {
  const current = await snapshotsOf(db).doc(snapshotId).get();
  const stored = current.data();
  if (!current.exists || !isOwnedByCustody(stored, { companyId: actor.companyId }) || !isObjectiveValueSnapshotRecord(stored)) return null;
  if ((await objectiveValueSnapshotDigest(stored)) !== stored.digest) {
    logger.error('Το αποτύπωμα στιγμιοτύπου δεν συμφωνεί με το περιεχόμενο — έγγραφο αλλοιωμένο μετά τη γραφή', { snapshotId });
    return null;
  }
  return stored;
}

/** **Διαβάζει ένα στιγμιότυπο του δρώντος, με τη ζωντανή απόκλιση** (υπολογισμένη τώρα, όχι αποθηκευμένη). */
export async function readObjectiveValueSnapshot(
  db: Firestore,
  actor: ObjectiveValueSnapshotActor,
  snapshotId: string,
  now: Date,
): Promise<ReadSnapshotResult> {
  const snapshot = await readObjectiveValueSnapshotRecord(db, actor, snapshotId);
  if (snapshot === null) return refused('absent');
  const [engine, zone] = await Promise.all([objectiveValueEngineIdentity(), liveZoneOf(snapshot)]);
  const divergence = objectiveValueDivergence(snapshot, { engine, today: marketDayOf(now.getTime()), zone });
  return { ok: true, snapshot, divergence };
}
