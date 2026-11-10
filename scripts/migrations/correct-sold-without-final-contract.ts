/**
 * =============================================================================
 * ΔΙΟΡΘΩΣΗ — «Πωλήθηκε» χωρίς υπογεγραμμένο οριστικό → πίσω σε «Κρατημένο» (ADR-935 §6)
 * =============================================================================
 *
 * **Γιατί**: ως το ADR-935 (2026-11-10) η πράξη «Πώληση» έγραφε `sold` χωρίς να ρωτήσει το νομικό στάδιο.
 * Πλέον `sold` σημαίνει «πέρασε η κυριότητα» — άρα ό,τι μπήκε σε `sold` χωρίς οριστικό είναι **ψευδές γεγονός**.
 *
 * ┌─ ΣΥΜΒΟΛΑΙΟ ────────────────────────────────────────────────────────────────┐
 * │ 🔒 Ο κριτής ΔΕΝ γράφεται εδώ: `isFinalContractSigned` — ο ίδιος με τον      │
 * │    φραγμό του server (`assertSaleFollowsFinalContract`). Καμία 2η λογική.   │
 * │ 🔒 Γράφει ΜΟΝΟ: `commercialStatus`/`status` → `reserved` · σβήνει           │
 * │    `commercial.finalPrice` + `commercial.saleDate`. Αγοραστής, προκαταβολή,  │
 * │    ημερομηνία κράτησης, αλυσίδα συναλλαγής μένουν ΑΝΕΓΓΙΧΤΑ.               │
 * │ 🔒 ΜΟΝΟ τα `--id` που δίνει ρητά ο χειριστής. Το ξηρό τρέξιμο απογράφει     │
 * │    ΟΛΑ τα ύποπτα — η απόφαση ανά ακίνητο είναι ανθρώπινη (τα «ΔΟΚΙΜΗ» είναι  │
 * │    δηλωμένα δείγματα εμφάνισης, ADR-935 §6).                                │
 * │ 🔒 Χωρίς αγοραστή ⇒ ΑΡΝΗΣΗ: `reserved` χωρίς αγοραστή είναι άλλο ψέμα.     │
 * │ 🔒 Ιδεμποτητική, με ξανα-κρίση ΜΕΣΑ στη συναλλαγή (`withVersionCheckOnCurrent`, │
 * │    `_v`/`updatedAt`/`updatedBy` όπως κάθε PATCH). Ίχνος στο Ιστορικό με τη   │
 * │    ΜΙΑ μηχανή diff (`diffFieldsWithResolution`) + ξαναπροβολή αγγελίας.     │
 * │ ⚠️ Το τιμολόγιο υπολοίπου ΔΕΝ το αγγίζει: ακυρώνεται από τη Λογιστική      │
 * │    (αντιλογισμός εγγραφής · πιστωτικό αν έχει διαβιβαστεί) — ΠΡΙΝ από εδώ.  │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * USAGE:
 * ```bash
 * npm run correct:sold-without-final-contract                                       # ξηρό — απογραφή
 * npm run correct:sold-without-final-contract -- --apply --by=<uid> --id=prop_xxx   # γραφή (ένα ή περισσότερα --id)
 * ```
 *
 * @see src/lib/conveyance/case-state.ts — `isFinalContractSigned`
 * @see docs/centralized-systems/reference/adrs/ADR-935-sold-means-ownership-passed.md §6
 */

import { FieldValue } from 'firebase-admin/firestore';

import { PROPERTY_TRACKED_FIELDS } from '@/config/audit-tracked-fields';
import { ENTITY_TYPES } from '@/config/domain-constants';
import { COLLECTIONS } from '@/config/firestore-collections';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { isFinalContractSigned } from '@/lib/conveyance/case-state';
import { withVersionCheckOnCurrent } from '@/lib/firestore/version-check';
import { EntityAuditService } from '@/services/entity-audit.service';
import { republishListingOfChangedUnit } from '@/services/listings/listing-media-refresh';
import type { ListingSourceProperty } from '@/services/listings/publish-public-listing';

import { applyEnvLocal } from '../_shared/loadEnvLocal';

// ⚠️ ΠΡΙΝ από την πρώτη κλήση Admin SDK (αρχικοποιείται οκνηρά).
applyEnvLocal();

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const BY = (args.find((a) => a.startsWith('--by=')) ?? '').slice('--by='.length) || null;
const IDS = args.filter((a) => a.startsWith('--id=')).map((a) => a.slice('--id='.length)).filter(Boolean);

type Doc = Readonly<Record<string, unknown>>;

function commercialOf(doc: Doc): Record<string, unknown> {
  const c = doc.commercial;
  return c && typeof c === 'object' ? (c as Record<string, unknown>) : {};
}

function hasBuyer(doc: Doc): boolean {
  const owners = commercialOf(doc).owners;
  return Array.isArray(owners) && owners.some((o) => (o as { role?: unknown })?.role === 'buyer');
}

/** Ο ΕΝΑΣ κριτής «χρειάζεται διόρθωση;» — ίδιος στην απογραφή και μέσα στη συναλλαγή. */
function needsCorrection(doc: Doc): boolean {
  return doc.commercialStatus === 'sold' && !isFinalContractSigned(commercialOf(doc).legalPhase);
}

/**
 * Η κατάσταση ΜΕΤΑ τη διόρθωση, ως απλό αντικείμενο — για το diff του Ιστορικού (όχι sentinels).
 * ⚠️ `null`, ΟΧΙ απουσία: η μηχανή diff δεν μετρά «τιμή → απούσα» ως αλλαγή (μετρημένο 2026-11-10 — η 1η εφαρμογή
 * κατέγραψε 2 από τα 4 πεδία). Στη βάση τα πεδία ΣΒΗΝΟΝΤΑΙ (όπως πριν την πώληση)· εδώ περιγράφεται η αλλαγή.
 */
function correctedView(doc: Doc): Record<string, unknown> {
  const commercial = { ...commercialOf(doc), finalPrice: null, saleDate: null };
  return { ...doc, commercialStatus: 'reserved', status: 'reserved', commercial };
}

async function census(): Promise<void> {
  const db = getAdminFirestore();
  // tenant-scope-exempt: εργασία χειριστή — απογραφή σε ΚΑΘΕ κάτοχο, μόνο ανάγνωση.
  const snap = await db.collection(COLLECTIONS.PROPERTIES).where('commercialStatus', '==', 'sold').get();
  const suspects = snap.docs.filter((d) => needsCorrection(d.data()));
  console.log(`Πωλημένα: ${snap.size} · χωρίς υπογεγραμμένο οριστικό: ${suspects.length}`);
  for (const d of suspects) {
    const data = d.data();
    console.log(`  ${d.id} · «${String(data.name)}» · αγοραστής: ${hasBuyer(data) ? 'ναι' : 'ΟΧΙ'}`);
  }
}

async function correctOne(id: string, by: string): Promise<void> {
  const db = getAdminFirestore();
  const result = await withVersionCheckOnCurrent({
    db,
    collection: COLLECTIONS.PROPERTIES,
    docId: id,
    userId: by,
    derive: (current) => {
      if (!needsCorrection(current)) throw new Error(`${id}: δεν χρειάζεται πλέον διόρθωση (ιδεμποτητική έξοδος)`);
      if (!hasBuyer(current)) throw new Error(`${id}: χωρίς αγοραστή — «κρατημένο» θα ήταν ψέμα· απόφαση ανθρώπου`);
      return {
        commercialStatus: 'reserved',
        status: 'reserved',
        'commercial.finalPrice': FieldValue.delete(),
        'commercial.saleDate': FieldValue.delete(),
      };
    },
  });

  const after = correctedView(result.before);
  const changes = await EntityAuditService.diffFieldsWithResolution(result.before, after, PROPERTY_TRACKED_FIELDS, {});
  await EntityAuditService.recordChange({
    entityType: ENTITY_TYPES.PROPERTY,
    entityId: id,
    entityName: (result.before.name as string) ?? null,
    action: 'status_changed',
    changes,
    performedBy: by,
    performedByName: null,
    companyId: String(result.before.companyId),
  });
  const outcome = await republishListingOfChangedUnit(db, id, after as unknown as ListingSourceProperty);
  console.log(`✅ ${id} → reserved · _v ${result.newVersion} · ίχνος: ${changes.length} πεδία · αγγελία: ${outcome}`);
}

async function main(): Promise<void> {
  await census();
  if (!APPLY) {
    console.log('\nΞηρό τρέξιμο — τίποτα δεν γράφτηκε. Γραφή: --apply --by=<uid> --id=<propertyId>');
    return;
  }
  if (!BY || IDS.length === 0) throw new Error('--apply απαιτεί --by=<uid χειριστή> και τουλάχιστον ένα --id=');
  for (const id of IDS) await correctOne(id, BY);
}

main().then(
  () => process.exit(0),
  (error: unknown) => {
    console.error('❌', error instanceof Error ? error.message : error);
    process.exit(1);
  },
);
