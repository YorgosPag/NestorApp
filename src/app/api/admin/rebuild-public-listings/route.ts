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
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴🔴 ΔΥΟ ΟΙΚΟΓΕΝΕΙΕΣ ΓΡΑΦΟΥΝ ΕΔΩ — ΚΑΙ ΤΟ ΑΡΧΕΙΟ ΗΞΕΡΕ ΜΟΝΟ ΤΗ ΜΙΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το `public_listings` δέχεται προβολές από **δύο** πηγές (ADR-777 Α14): τον
 * **επαγγελματία** (`properties/{prop_*}`, ο τόπος λύνεται ανεβαίνοντας ακίνητο →
 * κτίριο → έργο) και τον **ιδιώτη** (`owner_properties/{ownp_*}`, ο τόπος είναι η
 * **δήλωσή** του). Μέχρι τις 2026-08-27 αυτή η πράξη σάρωνε **μόνο** το `properties`.
 *
 * ⛔ **Και δεν ήταν απλώς ελλιπής — ήταν ΚΑΤΑΣΤΡΟΦΙΚΗ.** Το `removeOrphanListings`
 * σβήνει κάθε προβολή της οποίας η ταυτότητα **δεν βρέθηκε στη σάρωση**. Καμία
 * ταυτότητα `ownp_*` δεν ήταν ποτέ εκεί ⇒ **μία εκτέλεση θα διέγραφε ΚΑΘΕ αγγελία
 * ιδιώτη από τον δημόσιο χάρτη**, και θα το ανέφερε ως **επιτυχία** («orphansRemoved»).
 * Η ίδια η αναφορά ήταν το σχήμα «*0 = κανείς δεν κοίταξε*» που η επικεφαλίδα από πάνω
 * απαγορεύει: η λογιστική **έκλεινε**, επειδή μετρούσε **λάθος σύμπαν**.
 *
 * 🔑 **Η θεραπεία ΔΕΝ είναι δεύτερος γραφέας.** Κάθε οικογένεια επανασυντίθεται από
 * τη **δική της** υπάρχουσα διαδρομή —`republishListing` ⇄ `republishOwnerProperty`—
 * που είναι οι ίδιες που τρέχουν στη γραφή. Ένας «ενοποιημένος» γραφέας εδώ θα ήταν
 * **τρίτος** και θα απέκλινε από αμφότερους (ADR-749).
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
import { BYPASS_ROLES } from '@/lib/auth/roles';
import {
  republishListing,
  type PublishOutcome,
} from '@/services/listings/publish-public-listing';
import {
  isPubliclyListed,
  type ProjectableProperty,
} from '@/services/listings/public-listing-projection';
import { projectableFromOwnerProperty } from '@/lib/owner-property/owner-property-projection';
import { republishOwnerProperty } from '@/services/owner-property/owner-property-publication.service';
import { nowISO } from '@/lib/date-local';
import type { OwnerProperty } from '@/types/owner-property';

const logger = createModuleLogger('rebuild-public-listings');

/** Οι κάδοι της λογιστικής. Άγνωστη κατάσταση ⇒ δεν υπάρχει: ο τύπος τη σβήνει. */
interface RebuildReport {
  readonly scannedProperties: number;
  /**
   * Πόσες **αγγελίες ιδιώτη** σαρώθηκαν — **χωριστός** αριθμός, επίτηδες.
   *
   * ⚠️ Ένα κοινό `scanned` θα έκρυβε ακριβώς το ελάττωμα που διορθώθηκε: με **μηδέν**
   * αγγελίες ιδιώτη σαρωμένες, το άθροισμα εξακολουθούσε να **κλείνει**.
   */
  readonly scannedOwnerProperties: number;
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
  scannedOwner: number,
  orphansRemoved: number
): RebuildReport {
  return {
    scannedProperties: scanned,
    scannedOwnerProperties: scannedOwner,
    published: tally.published,
    withdrawn: tally.withdrawn,
    failed: tally.failed,
    orphansRemoved,
    // 🔑 Το άθροισμα κλείνει πάνω στο **σύνολο** των δύο οικογενειών — αλλιώς θα
    //    έκλεινε ψευδώς αγνοώντας τη μία, όπως έκλεινε μέχρι τις 2026-08-27.
    balanced: tally.published + tally.withdrawn + tally.failed === scanned + scannedOwner,
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

  // ────────────────────────────────────────────────────────────────────────
  // Η ΔΕΥΤΕΡΗ ΟΙΚΟΓΕΝΕΙΑ — η προσφορά του ιδιώτη (ADR-777 Α14)
  // ────────────────────────────────────────────────────────────────────────
  //
  // ⚠️ **Ο ίδιος βρόχος, ΑΛΛΗ διαδρομή επανασύνθεσης**: ο ιδιώτης δεν έχει αλυσίδα
  //    να ανέβει — ο τόπος του είναι η δήλωσή του — και η
  //    `republishOwnerProperty` **καταγράφει** επιπλέον την έκβαση στο έγγραφο,
  //    ώστε μια διορθωμένη αγγελία να πάψει να εμφανίζεται «εκκρεμής» στην οθόνη.
  const ownerProperties = await adminDb.collection(COLLECTIONS.OWNER_PROPERTIES).get();

  for (const doc of ownerProperties.docs) {
    // 🔴 **ΚΑΙ ΣΤΗ ΣΤΕΓΝΗ ΕΚΤΕΛΕΣΗ**: το `liveIds` δεν είναι λογιστική, είναι το
    //    σύνολο που **προστατεύει** από τη διαγραφή. Παράλειψή του εδώ θα σήμαινε ότι
    //    ένα `GET` αναφέρει κάθε αγγελία ιδιώτη ως «ορφανή προς διαγραφή».
    liveIds.add(doc.id);
    const owner = doc.data() as OwnerProperty;

    if (dryRun) {
      tally[
        isPubliclyListed(projectableFromOwnerProperty(owner, nowISO())) ? 'published' : 'withdrawn'
      ] += 1;
      continue;
    }

    tally[(await republishOwnerProperty(adminDb, { ...owner, id: doc.id })).publish] += 1;
  }

  const orphansRemoved = await removeOrphanListings(adminDb, liveIds, dryRun);
  return buildReport(tally, properties.size, ownerProperties.size, orphansRemoved);
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
  // ⚠️ `ctx.globalRole`, ΠΟΤΕ `ctx.role`: το `AuthContext` (lib/auth/types.ts:262) **δεν
  // έχει** πεδίο `role`. Το `ctx.role` έδινε `undefined` ⇒ `PREDEFINED_ROLES[undefined]`
  // ⇒ `isRoleBypass` = `false` ⇒ **403 για ΚΑΘΕ χρήστη, συμπεριλαμβανομένου του
  // super_admin** — δηλαδή η επανασύνθεση ήταν δομικά μη εκτελέσιμη. Το βρήκε η
  // **εκτέλεση**, όχι η ανάγνωση (2026-08-10, ADR-777 Β2β). Και τα **20** άλλα admin
  // routes γράφουν ήδη `ctx.globalRole` — αυτό ήταν το μοναδικό που απέκλινε.
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
  withAuth(
    async (request: NextRequest, ctx: AuthContext, _cache: PermissionCache) =>
      handle(request, ctx, true),
    { requiredGlobalRoles: BYPASS_ROLES },
  )
);

export const POST = withSensitiveRateLimit(
  withAuth(
    async (request: NextRequest, ctx: AuthContext, _cache: PermissionCache) =>
      handle(request, ctx, false),
    { requiredGlobalRoles: BYPASS_ROLES },
  )
);
