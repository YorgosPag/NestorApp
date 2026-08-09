/**
 * =============================================================================
 * ΕΠΑΝΑΣΥΝΘΕΣΗ ΔΗΜΟΣΙΩΝ ΠΡΟΒΟΛΩΝ (ADR-777 Α3/Α5)
 * =============================================================================
 *
 * Ξαναχτίζει **από την αρχή** το `public_listings` για κάθε ακίνητο.
 *
 * 🔑 **Είναι το δηλωμένο δίχτυ ασφαλείας**, όχι εργαλείο έκτακτης ανάγκης. Η προβολή
 * γράφεται στη διαδρομή γραφής (`/api/properties/[id]` · `/api/properties/create`),
 * που καλύπτει κάθε αλλαγή μέσω της εφαρμογής. **Δεν** καλύπτει γραφή με Admin SDK,
 * μαζική εισαγωγή, ή χειροκίνητη επεξεργασία στην κονσόλα Firebase — και αντί να
 * ελπίζουμε ότι δεν συμβαίνουν, υπάρχει πράξη που τις διορθώνει και τις **μετρά**.
 *
 * ⚠️ **ΚΛΕΙΣΤΗ ΛΟΓΙΣΤΙΚΗ, fail-closed** — το ίδιο εργαλείο που επιβάλλουμε στις πύλες
 * μας: κάθε ακίνητο καταλήγει σε **έναν** ονομασμένο κάδο, το άθροισμα **πρέπει** να
 * κλείνει, και η αναφορά το λέει ρητά. Μια επανασύνθεση που τυπώνει «ok» χωρίς να πει
 * **πόσα** κοίταξε είναι το «0 = κανείς δεν κοίταξε» με άλλο ρούχο.
 *
 * 🔴 **Επιπλέον σβήνει ΟΡΦΑΝΕΣ προβολές**: έγγραφα στο `public_listings` των οποίων το
 * ακίνητο δεν υπάρχει πια. Χωρίς αυτό, ένα διαγραμμένο ακίνητο θα έμενε **δημόσια
 * ορατό για πάντα** — ακριβώς το είδος σιωπηλού υπολείμματος που ο κύκλος ζωής της
 * κατηγορίας `published-projection` υπάρχει για να αποκλείσει.
 *
 * - GET  = στεγνή εκτέλεση (μετράει, **μηδέν** εγγραφές)
 * - POST = εκτέλεση
 *
 * 🔒 SECURITY: super_admin ONLY + withSensitiveRateLimit
 *
 * @module api/admin/rebuild-public-listings
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import { isRoleBypass } from '@/lib/auth/roles';
import {
  republishListing,
  type PublishOutcome,
} from '@/services/listings/publish-public-listing';
import {
  isPubliclyListed,
  type ProjectableProperty,
} from '@/services/listings/public-listing-projection';

const logger = createModuleLogger('rebuild-public-listings');

/** Οι κάδοι της λογιστικής. Άγνωστη κατάσταση ⇒ δεν υπάρχει: ο τύπος τη σβήνει. */
interface RebuildReport {
  readonly scannedProperties: number;
  readonly published: number;
  readonly withdrawn: number;
  readonly failed: number;
  readonly orphansRemoved: number;
  /** Κλείνει το άθροισμα; **Πεδίο**, ώστε να μη χρειάζεται να το υπολογίσει ο αναγνώστης. */
  readonly balanced: boolean;
}

function buildReport(
  tally: Record<PublishOutcome, number>,
  scanned: number,
  orphansRemoved: number
): RebuildReport {
  return {
    scannedProperties: scanned,
    published: tally.published,
    withdrawn: tally.withdrawn,
    failed: tally.failed,
    orphansRemoved,
    balanced: tally.published + tally.withdrawn + tally.failed === scanned,
  };
}

async function rebuildAll(dryRun: boolean): Promise<RebuildReport> {
  const adminDb = getAdminFirestore();
  const tally: Record<PublishOutcome, number> = { published: 0, withdrawn: 0, failed: 0 };

  const properties = await adminDb.collection(COLLECTIONS.PROPERTIES).get();
  const liveIds = new Set<string>();

  for (const doc of properties.docs) {
    liveIds.add(doc.id);
    const data = doc.data() as ProjectableProperty & { buildingId?: string | null; projectId?: string | null };

    if (dryRun) {
      // ⚠️ Η στεγνή εκτέλεση ρωτά ΜΟΝΟ «θα δημοσιευόταν;» — δεν λύνει θέση, γιατί η
      // θέση δεν αλλάζει την **απάντηση**, μόνο το περιεχόμενο. Έτσι το dry-run μένει
      // ένα ερώτημα ανά ακίνητο αντί για τρία, και εξακολουθεί να λέει την αλήθεια.
      tally[isPubliclyListed({ ...data, id: doc.id }) ? 'published' : 'withdrawn'] += 1;
      continue;
    }

    tally[await republishListing(adminDb, doc.id, data)] += 1;
  }

  const orphansRemoved = await removeOrphanListings(adminDb, liveIds, dryRun);
  return buildReport(tally, properties.size, orphansRemoved);
}

/** Προβολές χωρίς ακίνητο — δημόσια ορατές αγγελίες που δεν αντιστοιχούν σε τίποτα. */
async function removeOrphanListings(
  adminDb: ReturnType<typeof getAdminFirestore>,
  liveIds: ReadonlySet<string>,
  dryRun: boolean
): Promise<number> {
  const listings = await adminDb.collection(COLLECTIONS.PUBLIC_LISTINGS).get();
  const orphans = listings.docs.filter((doc) => !liveIds.has(doc.id));

  if (!dryRun) {
    for (const orphan of orphans) await orphan.ref.delete();
  }
  return orphans.length;
}

async function handle(request: NextRequest, ctx: AuthContext, dryRun: boolean) {
  if (!isRoleBypass(ctx.role)) {
    return NextResponse.json({ error: 'super_admin only' }, { status: 403 });
  }
  try {
    const report = await rebuildAll(dryRun);
    logger.info(dryRun ? 'Στεγνή επανασύνθεση' : 'Επανασύνθεση προβολών', { ...report });
    return NextResponse.json({ dryRun, report });
  } catch (error) {
    logger.error('Η επανασύνθεση απέτυχε', { error: getErrorMessage(error) });
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}

export const GET = withSensitiveRateLimit(
  withAuth(async (request: NextRequest, ctx: AuthContext, _cache: PermissionCache) =>
    handle(request, ctx, true)
  )
);

export const POST = withSensitiveRateLimit(
  withAuth(async (request: NextRequest, ctx: AuthContext, _cache: PermissionCache) =>
    handle(request, ctx, false)
  )
);
