#!/usr/bin/env tsx
/**
 * **ΤΟΠΟΘΕΤΗΣΗ ΤΩΝ ΠΑΡΑΚΟΛΟΥΘΗΜΑΤΩΝ «ΧΩΡΙΣ ΚΤΙΡΙΟ»** — ADR-898 §21.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 ΓΙΑΤΙ ΧΡΕΙΑΖΕΤΑΙ
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Παρακολούθημα μονάδας **χωρίς** `buildingId` μετρά (κανόνας, `building-space-membership.ts`) στο κτίριο της
 * μονάδας, αλλά λείπει από τη λίστα και τα στατιστικά της καρτέλας θέσεων/αποθηκών («βρίσκεται εδώ») ⇒ δύο αριθμοί.
 * Από §21 καμία νέα τέτοια περίπτωση δεν γεννιέται (το PATCH μονάδας τοποθετεί στην ίδια συναλλαγή · η αποσύνδεση
 * δίνει 409). Αυτό το αρχείο τοποθετεί **τα παλιά** — και τότε η λίστα `buildingId = Χ` ΤΑΥΤΙΖΕΤΑΙ με τον κανόνα.
 *
 * ┌─ ΣΥΜΒΟΛΑΙΟ ────────────────────────────────────────────────────────────────┐
 * │ 🔒 Η απόφαση ΔΕΝ γράφεται εδώ: `planSpacePlacement` — ο ΙΔΙΟΣ με το PATCH. │
 * │ 🔒 Η εγγραφή ΔΕΝ γράφεται εδώ: `spacePlacementWrite` — η ΙΔΙΑ με το PATCH.  │
 * │ 🔒 Γράφει ΜΟΝΟ κενό `buildingId`· χώρος σε κτίριο δεν αγγίζεται ΠΟΤΕ.      │
 * │ 🔒 Ξανα-κρίση ΜΕΣΑ στη συναλλαγή · ιδεμποτική · μετά: «ισορρόπησε;»         │
 * │ 🔒 Συνέπειες: `recordLinkChange` — ο ΙΔΙΟΣ cascade + ίχνος με το linkEntity. │
 * │ ⛔ Μονάδα χωρίς κτίριο ⇒ ΑΝΑΦΟΡΑ, ποτέ μαντεψιά.                           │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * ΕΚΤΕΛΕΣΗ — ξηρό εξ ορισμού (μόνο ανάγνωση). Η γραφή θέλει ΡΗΤΗ άδεια Giorgio μετά το ξηρό.
 *
 *   npm run migrate:unplaced-linked-spaces
 *   npm run migrate:unplaced-linked-spaces -- --apply
 *
 * @see docs/centralized-systems/reference/adrs/ADR-898-objective-value-calculator.md §21
 */

import type { SpaceOwner, SpaceOwningUnit, SpaceRecord } from '@/lib/building-spaces/building-space-membership';
import type { SpacePlacement } from '@/lib/building-spaces/space-placement';

import { applyEnvLocal } from '../_shared/loadEnvLocal';

// ⚠️ ΠΡΙΝ από κάθε άλλη φόρτωση: τα ονόματα συλλογών (`COLLECTIONS`) και ο πελάτης Firebase διαβάζουν `process.env`
// τη στιγμή που φορτώνονται — γι' αυτό οι υπηρεσίες έρχονται με `import()` ΜΕΣΑ στο `main`, όχι στατικά (που ανεβαίνουν
// πάνω από αυτή τη γραμμή · μετρημένο: `auth/invalid-api-key`).
applyEnvLocal();

const APPLY = process.argv.slice(2).includes('--apply');

/** Οι υπηρεσίες — φορτωμένες ΜΕΤΑ το env. */
async function loadDeps() {
  const [collections, domain, admin, membership, planner, linking, reader, server] = await Promise.all([
    import('@/config/firestore-collections'),
    import('@/config/domain-constants'),
    import('@/lib/firebaseAdmin'),
    import('@/lib/building-spaces/building-space-membership'),
    import('@/lib/building-spaces/space-placement'),
    import('@/lib/firestore/entity-linking.service'),
    import('@/services/building-spaces/building-space-admin-reader'),
    import('@/services/building-spaces/space-placement.server'),
  ]);
  return {
    COLLECTIONS: collections.COLLECTIONS,
    SYSTEM_IDENTITY: domain.SYSTEM_IDENTITY,
    db: admin.getAdminFirestore(),
    BUILDING_SPACE_KINDS: membership.BUILDING_SPACE_KINDS,
    spaceOwnersOf: membership.spaceOwnersOf,
    planSpacePlacement: planner.planSpacePlacement,
    recordLinkChange: linking.recordLinkChange,
    SPACE_COLLECTION_OF: reader.SPACE_COLLECTION_OF,
    spaceDocRef: server.spaceDocRef,
    spacePlacementWrite: server.spacePlacementWrite,
  };
}

type Deps = Awaited<ReturnType<typeof loadDeps>>;

interface Survey {
  readonly placements: readonly SpacePlacement[];
  /** Χώροι χωρίς κτίριο με μονάδα χωρίς κτίριο — αναφέρονται, δεν γράφονται. */
  readonly unitWithoutBuilding: readonly { readonly spaceId: string; readonly unitId: string }[];
}

/** Όλες οι μονάδες που έχουν συνδεδεμένους χώρους (κάθε μισθωτής — η μετάπτωση είναι του συστήματος). */
async function readOwningUnits(d: Deps): Promise<SpaceOwningUnit[]> {
  const snapshot = await d.db.collection(d.COLLECTIONS.PROPERTIES).select('buildingId', 'name', 'linkedSpaces').get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

/** Οι χώροι που έχουν κάτοχο, και των δύο ειδών. */
async function readOwnedSpaces(d: Deps, owners: ReadonlyMap<string, SpaceOwner>): Promise<SpaceRecord[]> {
  const perKind = await Promise.all(
    d.BUILDING_SPACE_KINDS.map(async (kind) => {
      const snapshot = await d.db.collection(d.SPACE_COLLECTION_OF[kind]).get();
      return snapshot.docs.filter((doc) => owners.has(doc.id)).map((doc) => ({ id: doc.id, kind, data: doc.data() }));
    }),
  );
  return perKind.flat();
}

/** **Η μέτρηση** — τι θα γινόταν, με τον ΙΔΙΟ planner με το PATCH. */
async function survey(d: Deps): Promise<{ readonly result: Survey; readonly owners: ReadonlyMap<string, SpaceOwner> }> {
  const owners = d.spaceOwnersOf(await readOwningUnits(d));
  const placements: SpacePlacement[] = [];
  const unitWithoutBuilding: { spaceId: string; unitId: string }[] = [];
  for (const space of await readOwnedSpaces(d, owners)) {
    const owner = owners.get(space.id);
    if (owner === undefined) continue;
    const decision = d.planSpacePlacement(space, owner);
    if (decision.kind === 'place') placements.push(decision.placement);
    if (decision.kind === 'unit-without-building') unitWithoutBuilding.push({ spaceId: space.id, unitId: owner.unitId });
  }
  return { result: { placements, unitWithoutBuilding }, owners };
}

/** Ξανα-κρίνει ΜΕΣΑ στη συναλλαγή και γράφει · επιστρέφει το έγγραφο **πριν** αν γράφτηκε, αλλιώς `null`. */
async function applyPlacement(d: Deps, placement: SpacePlacement, owner: SpaceOwner): Promise<Record<string, unknown> | null> {
  const ref = d.spaceDocRef(d.db, placement.kind, placement.spaceId);
  return d.db.runTransaction(async (transaction) => {
    const data = (await transaction.get(ref)).data();
    if (data === undefined) return null;
    const decision = d.planSpacePlacement({ id: placement.spaceId, kind: placement.kind, data }, owner);
    if (decision.kind !== 'place') return null;
    transaction.update(ref, d.spacePlacementWrite(decision.placement, d.SYSTEM_IDENTITY.ID));
    return data;
  });
}

/** Γραφή + συνέπειες (cascade έργου/εταιρείας + ίχνος), περιμένοντας ώστε το `process.exit` να μην τις κόψει. */
async function place(d: Deps, placement: SpacePlacement, owner: SpaceOwner): Promise<'placed' | 'skipped'> {
  const before = await applyPlacement(d, placement, owner);
  if (before === null) return 'skipped';
  const companyId = typeof before.companyId === 'string' ? before.companyId : '';
  if (companyId === '') console.log(`   ⚠️ ${placement.spaceId}: χωρίς companyId — το ίχνος οντότητας δεν γράφεται`);
  await d.recordLinkChange(`${placement.kind}:buildingId`, {
    entityId: placement.spaceId,
    existingDoc: before,
    oldValue: null,
    newValue: placement.buildingId,
    performedBy: d.SYSTEM_IDENTITY.ID,
    performedByName: d.SYSTEM_IDENTITY.DISPLAY_NAME,
    companyId,
  });
  return 'placed';
}

function report(result: Survey): void {
  console.log(`\n📍 Τοποθετήσεις: ${result.placements.length}`);
  for (const p of result.placements) {
    console.log(`   ${p.kind}/${p.spaceId} «${p.name ?? '—'}» → κτίριο ${p.buildingId} (μονάδα ${p.unitId})`);
  }
  console.log(`⚠️ Μονάδα χωρίς κτίριο (μόνο αναφορά): ${result.unitWithoutBuilding.length}`);
  for (const item of result.unitWithoutBuilding) console.log(`   ${item.spaceId} (μονάδα ${item.unitId})`);
}

async function main(): Promise<void> {
  console.log(`\n🔁 ΤΟΠΟΘΕΤΗΣΗ παρακολουθημάτων χωρίς κτίριο — ADR-898 §21 · ${APPLY ? '✍️  ΓΡΑΦΗ (--apply)' : '👁️  ΞΗΡΟ ΤΡΕΞΙΜΟ'}`);
  const d = await loadDeps();
  const { result, owners } = await survey(d);
  report(result);
  if (!APPLY) {
    console.log('\n   (ξηρό τρέξιμο — καμία εγγραφή· η γραφή θέλει --apply ΜΕ άδεια)');
    process.exit(0);
  }
  for (const placement of result.placements) {
    const owner = owners.get(placement.spaceId);
    if (owner !== undefined) console.log(`   ${placement.spaceId}: ${await place(d, placement, owner)}`);
  }
  const left = (await survey(d)).result.placements.length;
  console.log(left === 0 ? '✅ Ισορρόπησε: 0 χώροι προς τοποθέτηση.' : `❌ Απομένουν ${left}.`);
  process.exit(left === 0 ? 0 : 1);
}

main().catch((error: unknown) => {
  console.error('❌ Η μετάπτωση απέτυχε:', error);
  process.exit(1);
});
