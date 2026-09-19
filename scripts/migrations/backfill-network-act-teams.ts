#!/usr/bin/env tsx
/**
 * **BACKFILL `network_act_teams`** — ADR-867 §4.3 / Β3.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 ΓΙΑΤΙ ΧΡΕΙΑΖΕΤΑΙ
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Η ομάδα της πράξης γεννιέται πλέον **μαζί** με την εντολή (αποδοχή αιτήματος: στην ίδια
 * συναλλαγή· καταχώριση μεσίτη: αμέσως μετά τη γραφή). Οι εντολές που γράφτηκαν **πριν**
 * δεν έχουν ομάδα — άρα κανένα νήμα τους δεν ξέρει *«ποιος διαβάζει;»*.
 *
 * 🔴 **ΚΑΙ ΕΙΝΑΙ ΤΟ ΔΙΧΤΥ ΤΟΥ ΔΡΟΜΟΥ ΤΟΥ ΜΕΣΙΤΗ** (N.7.2 #4): εκείνος ο δρόμος **δεν έχει
 * συναλλαγή** (`brokered-listing.service.ts` — ο `createOwnerProperty` γράφει μόνος του),
 * οπότε μια πτώση ανάμεσα στις δύο γραφές αφήνει πράξη χωρίς ομάδα. Το κλειδί είναι
 * **ντετερμινιστικό** ⇒ αυτό το script γράφει **την ίδια** ομάδα, ποτέ δεύτερη.
 *
 * 🔴 **ΚΑΙ ΤΟ ΝΗΜΑ (ADR-867 Β9)**: ως τις 2026-09-19 έγραφε **μόνο** ομάδα — ενώ το νήμα γεννιέται
 * μόνο τη στιγμή της αποδοχής. Άρα κάθε εντολή προ-Β4 έμενε **χωρίς νήμα για πάντα** (μετρημένο:
 * 0 νήματα στη βάση, 2 αποδεκτά αιτήματα). Πλέον γράφει ομάδα **και** νήμα με τον **ίδιο** γραφέα
 * που τρέχει η αποδοχή (`ensureActBirth`), όπου το `mandateEdgesOf` βρίσκει ακμή **με πρόσωπο**.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔑 ΚΑΜΙΑ ΜΑΝΤΕΨΙΑ ΥΠΕΥΘΥΝΟΥ — ΤΡΕΙΣ ΠΗΓΕΣ, ΜΕ ΣΕΙΡΑ, ΚΑΙ ΜΕΤΑ ΣΙΩΠΗ
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Η εντολή **δεν γράφει άνθρωπο** (ADR-867 §2.3). Οι μόνες γραμμένες πηγές:
 *
 * | # | Πηγή | Πότε ισχύει |
 * |---|---|---|
 * | 1 | `proof.attestedByUserId` | δρόμος **βεβαίωσης** — ο υπογράφων είναι ονομαστικά γραμμένος |
 * | 2 | `authorUserId` της αγγελίας, **όταν** `authorCompanyId === agencyCompanyId` | καταχώριση **από το ίδιο** γραφείο |
 * | 3 | `createdBy` της επαφής πελάτη, **όταν** η επαφή ανήκει στο ίδιο γραφείο | αποδοχή αιτήματος: εκεί έγραψε ο `deciderUid` (`mandate-acceptance-prepare.ts`) |
 *
 * ⛔ **Καμία τέταρτη.** Αν καμία δεν απαντά, η γραμμή μπαίνει στο `unresolved` και **δεν
 * γράφεται τίποτα**: ένας υπεύθυνος που δεν επιλέχθηκε από άνθρωπο ούτε από γραμμένο
 * γεγονός θα ήταν **ψέμα με όνομα** — και το νήμα θα το έδειχνε στον πελάτη ως «ποιοι
 * διαβάζουν».
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ΧΡΗΣΗ
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   npx tsx scripts/migrations/backfill-network-act-teams.ts           # ξηρό (προεπιλογή)
 *   npx tsx scripts/migrations/backfill-network-act-teams.ts --apply   # γράφει
 */

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { mandateActSeed, mandateEdgesOf } from '@/lib/network-edge/edge-sources';
import { ensureActBirth } from '@/services/network-messaging/act-team-writer';
import { AGENCY_ATTESTATION, mandatesOf } from '@/types/owner-property-mandate';
import type { BrokeredListingMandate } from '@/types/owner-property-mandate';

interface Row {
  readonly propertyId: string;
  readonly agencyCompanyId: string;
  readonly responsibleUid: string | null;
  readonly via: 'attestation' | 'author' | 'contact-creator' | null;
}

const APPLY = process.argv.includes('--apply');

/** Η **μία** συνάρτηση που απαντά «ποιος ανέλαβε;» — με τη σειρά του πίνακα της κεφαλίδας. */
async function responsibleOf(
  db: FirebaseFirestore.Firestore,
  property: { readonly authorUserId?: string; readonly authorCompanyId?: string | null },
  mandate: BrokeredListingMandate,
): Promise<{ uid: string; via: Row['via'] } | null> {
  if (mandate.proof.via === AGENCY_ATTESTATION && mandate.proof.attestedByUserId) {
    return { uid: mandate.proof.attestedByUserId, via: 'attestation' };
  }
  if (property.authorCompanyId === mandate.agencyCompanyId && property.authorUserId) {
    return { uid: property.authorUserId, via: 'author' };
  }
  if (mandate.clientContactId) {
    const contact = await db.collection(COLLECTIONS.CONTACTS).doc(mandate.clientContactId).get();
    const data = contact.data() as { companyId?: string; createdBy?: string } | undefined;
    if (data?.companyId === mandate.agencyCompanyId && data.createdBy) {
      return { uid: data.createdBy, via: 'contact-creator' };
    }
  }
  return null;
}

async function main(): Promise<void> {
  const db = getAdminFirestore();
  // tenant-scope-exempt: εφάπαξ επανασύνθεση από script διαχειριστή (καμία ταυτότητα χρήστη) —
  //   κάθε γραφή που ακολουθεί είναι ανά `agencyCompanyId`, με ντετερμινιστικό κλειδί.
  const properties = await db.collection(COLLECTIONS.OWNER_PROPERTIES).get();
  const nowISO = new Date().toISOString();

  const rows: Row[] = [];
  let created = 0;
  let existed = 0;
  let threadsBorn = 0;
  let threadsExisting = 0;
  let edgeless = 0;

  for (const doc of properties.docs) {
    const property = doc.data() as Parameters<typeof responsibleOf>[1] & Record<string, unknown>;
    const mandates = mandatesOf(property);
    // 🔑 «Υπάρχει ακμή με πρόσωπο;» — ΜΙΑ απάντηση, από το μητρώο πηγών (ADR-834 (α) ①).
    const counterpartBySeed = new Map(
      mandateEdgesOf({ propertyId: doc.id, mandates }).map((edge) => [edge.actSeed, edge.counterpartUid]),
    );
    for (const mandate of mandates) {
      const agencyCompanyId = (mandate.agencyCompanyId ?? '').trim();
      // ⚠️ Εντολή **προ-ADR-832** δεν ξέρει ποιο γραφείο — καμία ομάδα, όπως καμία ακμή
      //    (`edge-sources.ts`): άγνωστο ≠ κενό.
      if (agencyCompanyId === '') {
        rows.push({ propertyId: doc.id, agencyCompanyId: '', responsibleUid: null, via: null });
        continue;
      }

      const found = await responsibleOf(db, property, mandate);
      rows.push({
        propertyId: doc.id,
        agencyCompanyId,
        responsibleUid: found?.uid ?? null,
        via: found?.via ?? null,
      });
      if (found === null) continue;

      const actSeed = mandateActSeed(doc.id, agencyCompanyId);
      const counterpartUid = counterpartBySeed.get(actSeed) ?? null;
      if (counterpartUid === null) edgeless += 1;
      if (!APPLY) continue;

      const outcome = await ensureActBirth(
        db,
        { actKind: 'mandate', actSeed, hostCompanyId: agencyCompanyId, responsibleUid: found.uid },
        counterpartUid,
        nowISO,
      );
      if (outcome.teamCreated) created += 1;
      else existed += 1;
      if (outcome.thread.created) threadsBorn += 1;
      else if (outcome.thread.threadId !== null) threadsExisting += 1;
    }
  }

  const unresolved = rows.filter((row) => row.responsibleUid === null);
  console.log(`[ACT-TEAM BACKFILL] ${APPLY ? 'ΓΡΑΦΗ' : 'ΞΗΡΟ'} — αγγελίες: ${properties.size}, εντολές: ${rows.length}`);
  console.log(`  επιλύθηκε υπεύθυνος: ${rows.length - unresolved.length} (νέες: ${created}, υπήρχαν: ${existed})`);
  console.log(`  νήματα (ADR-867 Β9): νέα ${threadsBorn} · υπήρχαν ${threadsExisting} · χωρίς ακμή με πρόσωπο ${edgeless} (§8 #1)`);
  console.log(`  🔴 ΑΝΕΠΙΛΥΤΕΣ (καμία γραφή): ${unresolved.length}`);
  for (const row of unresolved) {
    console.log(`     - ${row.propertyId} / ${row.agencyCompanyId || '(χωρίς γραφείο — προ-ADR-832)'}`);
  }
}

main().catch((error: unknown) => {
  console.error('[ACT-TEAM BACKFILL] απέτυχε', error);
  process.exitCode = 1;
});
