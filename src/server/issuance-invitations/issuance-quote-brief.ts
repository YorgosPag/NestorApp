import 'server-only';

/**
 * @fileoverview ADR-915 §42 — **ο φάκελος προσφοράς**: όσα χρειάζεται ο επαγγελματίας για να τιμολογήσει την έκδοση,
 *   **και τίποτα παραπάνω** (Procore bid package · Upwork πριν τη σύμβαση: καμία επαφή πριν την ανάθεση).
 * @related issuance-link-view.ts (ο καλών — όψη του συνδέσμου) · services/document-registry/registry-owner-properties.server.ts
 *   (`readAdministeredOwnerProperty`: σύνορο ανάγνωσης CHECK 3.74 + κριτής θεματοφυλακής CHECK 3.56)
 * @module server/issuance-invitations/issuance-quote-brief
 *
 * 🔒 **Κλειστή λίστα πεδίων, από τον server**: εμβαδόν · όροφος · έτος κατασκευής · τρέχουσα ενεργειακή κατηγορία και
 *    ισχύς. **Ποτέ** όνομα ή επαφές ιδιοκτήτη, ποτέ ακριβής διεύθυνση — όλα αυτά ανοίγουν **μετά** την έγκριση της
 *    προσφοράς, στον χώρο της ανάθεσης (§39).
 * 🔑 **Κάθε πεδίο μπορεί να λείπει** (`null` = «δεν δηλώθηκε»)· η σελίδα το λέει, δεν το μαντεύει.
 * 🔑 **Ξένο ≡ ανύπαρκτο**: έγγραφο άλλου γραφείου ⇒ κενός φάκελος, ποτέ σφάλμα που αποκαλύπτει ύπαρξη.
 */

import type { Firestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { FIELDS } from '@/config/firestore-field-constants';
import { certificateValidUntil, readEnergyCertificate } from '@/lib/energy-certificate/energy-certificate';
import { isPlainRecord } from '@/lib/type-guards';
import { resolveGrossBasisArea } from '@/lib/properties/property-display-area';
import type { RegistryPropertyScope } from '@/services/document-registry/document-registry.types';
import { readAdministeredOwnerProperty } from '@/services/document-registry/registry-owner-properties.server';
import type { IssuanceQuoteBrief } from '@/types/issuance-invitation';

const EMPTY_BRIEF: IssuanceQuoteBrief = { grossAreaSqm: null, floor: null, constructionYear: null, energyClass: null, energyValidUntil: null };

function integer(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) ? value : null;
}

/** Η τρέχουσα δήλωση ΠΕΑ — κατηγορία και ως πότε ισχύει (ο ένας υπολογισμός ισχύος του μοντέλου). */
function energyOf(raw: unknown): Pick<IssuanceQuoteBrief, 'energyClass' | 'energyValidUntil'> {
  const energy = readEnergyCertificate(raw);
  return { energyClass: energy.class, energyValidUntil: certificateValidUntil(energy.issuedOn) };
}

/** Το έτος κατασκευής ζει στο **κτίριο**, όχι στη μονάδα — ίδιος μισθωτής, αλλιώς «δεν δηλώθηκε». */
async function constructionYearOf(db: Firestore, companyId: string, buildingId: unknown): Promise<number | null> {
  if (typeof buildingId !== 'string' || buildingId.length === 0) return null;
  const building = (await db.collection(COLLECTIONS.BUILDINGS).doc(buildingId).get()).data();
  if (!isPlainRecord(building) || building[FIELDS.COMPANY_ID] !== companyId) return null;
  return integer(building.constructionYear);
}

async function unitBrief(db: Firestore, companyId: string, propertyId: string): Promise<IssuanceQuoteBrief> {
  const unit = (await db.collection(COLLECTIONS.PROPERTIES).doc(propertyId).get()).data();
  if (!isPlainRecord(unit) || unit[FIELDS.COMPANY_ID] !== companyId) return EMPTY_BRIEF;
  return {
    // Ο ΕΝΑΣ αναγνώστης εμβαδού του μητρώου (μικτό, αλλιώς το παλιό αδιευκρίνιστο `area`).
    grossAreaSqm: resolveGrossBasisArea(unit)?.value ?? null,
    floor: integer(unit.floor),
    constructionYear: await constructionYearOf(db, companyId, unit.buildingId),
    ...energyOf(unit.energy),
  };
}

/**
 * Ακίνητο ιδιώτη: «διαχειρίζεται το γραφείο αυτό το ακίνητο;» το κρίνει ο ΕΝΑΣ κριτής θεματοφυλακής
 * (`readAdministeredOwnerProperty` → `mayAdminister(custodyOf(…))`, CHECK 3.56) — ποτέ δεύτερη σύγκριση εδώ.
 */
async function ownerPropertyBrief(db: Firestore, target: BriefTarget): Promise<IssuanceQuoteBrief> {
  const administered = await readAdministeredOwnerProperty(db, { uid: target.actorUid, companyId: target.companyId }, target.propertyId);
  if (administered === null) return EMPTY_BRIEF;
  const { certificate, data } = administered.property;
  return {
    grossAreaSqm: resolveGrossBasisArea({ areas: { gross: data.areaSqm } })?.value ?? null,
    floor: integer(data.floor),
    constructionYear: null,
    energyClass: certificate.class,
    energyValidUntil: certificateValidUntil(certificate.issuedOn),
  };
}

interface BriefTarget {
  readonly companyId: string;
  readonly propertyId: string;
  readonly scope: RegistryPropertyScope;
  /** Ο άνθρωπος του γραφείου που έστειλε το αίτημα — ο «ποιος» της θεματοφυλακής. */
  readonly actorUid: string;
}

/** **Ο φάκελος προσφοράς** του ακινήτου — δύο σχήματα εγγράφου, μία απάντηση. */
export async function readIssuanceQuoteBrief(db: Firestore, target: BriefTarget): Promise<IssuanceQuoteBrief> {
  return target.scope === 'property' ? unitBrief(db, target.companyId, target.propertyId) : ownerPropertyBrief(db, target);
}
