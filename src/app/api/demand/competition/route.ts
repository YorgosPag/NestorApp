/**
 * @fileoverview **«ΠΟΣΟΙ ΑΛΛΟΙ ΖΗΤΟΥΝ ΤΟ ΙΔΙΟ»** — η μόνη έξοδος από το επίπεδο Β.
 * @related ADR-777 §7 (Α9 · Α12) · SPEC-777A §14.2 (επίπεδο Γ) · SPEC-777B §12.6 · §12.7
 * @module app/api/demand/competition/route
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΑΥΤΟ ΔΕΝ ΜΠΟΡΕΙ ΝΑ ΓΙΝΕΙ ΣΤΟΝ ΠΕΛΑΤΗ — ΚΑΙ ΕΙΝΑΙ ΚΑΛΟ ΠΟΥ ΔΕΝ ΜΠΟΡΕΙ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο κανόνας του `property_demands` δίνει `read` **μόνο** στον `authorUserId`. Άρα ο
 * πελάτης **δομικά δεν βλέπει** τις ζητήσεις άλλων — και το δεύτερο σκέλος του §12.6
 * (*«πόσοι άλλοι ζητούν το ίδιο»*) είναι, εξ ορισμού, ερώτηση που **μόνο** ο
 * διακομιστής μπορεί να απαντήσει.
 *
 * 🔑 **Αυτό δεν είναι εμπόδιο· είναι η αρχιτεκτονική.** Το `demand-aggregate.ts` το
 * γράφει ονομαστικά: *«Η ΜΟΝΗ επιτρεπτή έξοδος από το επίπεδο Β προς οποιονδήποτε
 * τρίτο … Αυτή η συνάρτηση τρέχει **στον διακομιστή**, πάνω σε δεδομένα που ο
 * πελάτης δεν μπορεί να δει»*. Αυτή η διαδρομή **είναι** αυτή η μία έξοδος.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΙ ΦΕΥΓΕΙ ΑΠΟ ΕΔΩ: **ΕΝΑΣ ΑΡΙΘΜΟΣ, Ή ΤΙΠΟΤΑ**
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Επιστρέφεται **αυτούσιο** το {@link DemandDisclosure}: `audience` · `count`
 * (**`null` κάτω από το κατώφλι**) · `minCount`. Και τίποτε άλλο.
 *
 * ⚠️ **ΜΗΝ προσθέσεις εδώ τη λογιστική** ({@link DemandCensus}). Το `counted` της
 * είναι ο **ωμός αριθμός** — ακριβώς αυτό που το κατώφλι υπάρχει για να κρύψει — και
 * το `demand-aggregate.ts` προειδοποιεί κατά λέξη: *«ένα αντικείμενο λογιστικής που
 * ταξιδεύει δίπλα σε μια κρυμμένη τιμή **ακυρώνει** την απόκρυψη, και το χειρότερο
 * είναι ότι θα φαινόταν σωστό: η πύλη θα έλεγε “suppressed: true” ενώ ο αριθμός θα
 * ήταν δύο πεδία παρακάτω»*.
 *
 * ⚠️ **Ούτε λίστα κριτηρίων, ούτε ταυτότητες, ούτε ημερομηνίες.** Το §12.7(α)
 * απαγορεύει κάθε διαδρομή που γίνεται **εργαλείο πίεσης**, και δύο κριτήρια μαζί
 * (περιοχή + προϋπολογισμός) περιγράφουν **ένα πρόσωπο** σε μικρή γειτονιά.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 Ο ΑΙΤΩΝ ΑΠΟΔΕΙΚΝΥΕΙ ΟΤΙ Η ΖΗΤΗΣΗ ΕΙΝΑΙ **ΔΙΚΗ ΤΟΥ**
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η διαδρομή δέχεται **ταυτότητα ζήτησης**, ποτέ κριτήρια. Αν δεχόταν κριτήρια, θα
 * ήταν **ελεύθερο ερωτητήριο πάνω στη ζήτηση όλης της χώρας**: οποιοσδήποτε
 * συνδεδεμένος θα μπορούσε να σαρώσει τετράγωνο-τετράγωνο και να ανασυνθέσει τον
 * θερμοχάρτη που πουλάμε ως **Ε2** — δωρεάν, και χωρίς κανείς να το προσέξει.
 *
 * Με ταυτότητα, ο αιτών μπορεί να ρωτήσει **μόνο για τη δική του** εντολή (ο έλεγχος
 * `authorUserId === ctx.uid` είναι ρητός παρακάτω), δηλαδή μαθαίνει **μόνο** τη θέση
 * του στην αγορά που ο ίδιος διάλεξε.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { withAuth } from '@/lib/auth/middleware';
import type { AuthContext } from '@/lib/auth/types';
import { COLLECTIONS } from '@/config/firestore-collections';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { nowISO } from '@/lib/date-local';
import { createModuleLogger } from '@/lib/telemetry';
import { discloseCompetition, type DemandDisclosure } from '@/lib/demand/demand-aggregate';
import { selectSimilarDemands } from '@/lib/demand/demand-similarity';
import { readLiveDemands } from '@/services/demand/live-demands.reader';
import type { PropertyDemand } from '@/types/property-demand';

const logger = createModuleLogger('api/demand/competition');

/** Ό,τι φεύγει. **Ένα πεδίο**, και είναι ήδη λογοκριμένο από το κατώφλι. */
interface CompetitionResponse {
  readonly disclosure: DemandDisclosure;
}

async function handler(
  request: NextRequest,
  ctx: AuthContext,
): Promise<NextResponse<CompetitionResponse | { error: string }>> {
  const demandId = request.nextUrl.searchParams.get('demandId')?.trim() ?? '';
  if (demandId === '') {
    return NextResponse.json({ error: 'MISSING_DEMAND_ID' }, { status: 400 });
  }

  const db = getAdminFirestore();

  const own = await db.collection(COLLECTIONS.PROPERTY_DEMANDS).doc(demandId).get();
  const demand = own.data() as PropertyDemand | undefined;

  // 🔴 «Δεν υπάρχει» και «δεν είναι δική σου» απαντώνται **ΤΟ ΙΔΙΟ**, επίτηδες. Μια
  // ξεχωριστή απάντηση 403 θα **επιβεβαίωνε** ότι η ταυτότητα υπάρχει — δηλαδή θα
  // διέρρεε το επίπεδο Β μέσω του κωδικού λάθους, που είναι η κλασική διαρροή μέσω
  // άρνησης. Ίδιο συμβόλαιο με το `MyDemandLookup.absent` στον πελάτη.
  if (demand === undefined || demand.authorUserId !== ctx.uid) {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  }

  try {
    const disclosure = await discloseFor(db, demand);
    return NextResponse.json({ disclosure });
  } catch (error) {
    logger.error('Ο ανταγωνισμός δεν υπολογίστηκε', {
      data: { demandId },
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'AGGREGATE_FAILED' }, { status: 500 });
  }
}

/** Η ανάγνωση + η κρίση + η αποκάλυψη. Χωριστά, ώστε ο χειριστής να μένει λέξιμος. */
async function discloseFor(
  db: ReturnType<typeof getAdminFirestore>,
  demand: PropertyDemand,
): Promise<DemandDisclosure> {
  // 🔑 Η ανάγνωση ζει στον **κοινό** αναγνώστη (`live-demands.reader.ts`): την ίδια
  // δεξαμενή τη χρειάζεται και το δόλωμα του ιδιοκτήτη (`/api/demand/interest`), και
  // δύο αντίγραφα θα μπορούσαν να αποκλίνουν στο όριο ή στο φίλτρο κύκλου ζωής —
  // δηλαδή να δώσουν **ασύμβατους αριθμούς** για το ίδιο επίπεδο Γ (N.18).
  const { demands: candidates } = await readLiveDemands(db, 'demand/competition');

  // ⚠️ `nowIso` περνιέται **ρητά** στη μηχανή· η ανάγνωση του ρολογιού γίνεται εδώ,
  // στο σύνορο, μέσω του **SSoT** `nowISO()` (CHECK 3.7 `date-local`) — ποτέ ωμό
  // `new Date().toISOString()`, ώστε η κρίση φρεσκάδας να μένει καθαρή και δοκιμάσιμη.
  return discloseCompetition(demand, selectSimilarDemands(demand, candidates), nowISO());
}

export const GET = withAuth(handler);
