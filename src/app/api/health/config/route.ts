/**
 * @fileoverview **Η ΕΤΟΙΜΟΤΗΤΑ ΤΗΣ ΡΥΘΜΙΣΗΣ** — «λείπει κάτι που κάνει μια δυνατότητα να σιωπά;»
 * @related ADR-834 §6.5.στ · ADR-777 §8.35 · config/environment-contract.ts
 * @module app/api/health/config/route
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ — ΜΙΑ ΥΠΟΣΧΕΣΗ ΠΟΥ ΔΕΝ ΕΚΤΕΛΟΥΝΤΑΝ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το `config/environment-contract.ts` έγραφε — και δεσμευόταν — ότι *«η ετοιμότητα
 * είναι **δεύτερο ερώτημα** και παίρνει **δικό της** τελικό σημείο
 * (`/api/health/config`)»*. Ο φάκελος `src/app/api/health/` είχε **μόνο** `route.ts`:
 * **η πρόταση δεν εκτελούνταν** (μετρημένο 2026-08-31). Το σχόλιο ήταν προδιαγραφή
 * χωρίς υλοποίηση — ακριβώς η κλάση που το ADR-834 §7 ονομάζει.
 *
 * ⚠️ **Το `/api/health` ΔΕΝ αγγίζεται, και είναι δομικό**: εκείνο απαντά «ζει η
 * διεργασία;» (*liveness*) σε τρεις γραμμές, χωρίς να κοιτάξει τίποτα — και
 * **διαβάζεται** ως «όλα καλά». Δύο ερωτήματα, δύο πόρτες.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΓΙΑΤΙ 503 ΚΑΙ ΟΧΙ 200-ΜΕ-ΣΗΜΑΙΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ένα 200 με `{ ready: false }` μέσα είναι το **ίδιο σχήμα** που γεννά όλα τα
 * ελαττώματα αυτής της οικογένειας: κάθε αφελής παρακολούθηση βλέπει πράσινο, και το
 * «κανείς δεν κοίταξε» γίνεται δυσδιάκριτο από το «όλα καλά». Ο κωδικός **είναι** η
 * απάντηση, το σώμα είναι η εξήγηση.
 *
 * ⛔ **ΜΗΝ βάλεις αυτό το τελικό σημείο σε liveness probe.** Ένα 503 εδώ σημαίνει
 * «μία δυνατότητα σιωπά», **όχι** «σκότωσε τη διεργασία» — γι' αυτό είναι χωριστό
 * από το `/api/health`. Αν μπει σε liveness, μια απούσα μεταβλητή ενός χαρακτηριστικού
 * θα ανακυκλώνει το container επ' άπειρον.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΓΙΑΤΙ ΟΙ ΛΕΠΤΟΜΕΡΕΙΕΣ ΘΕΛΟΥΝ ΤΑΥΤΟΤΗΤΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ακολουθείται το πρότυπο του **Spring Boot Actuator** (`management.endpoint.health.
 * show-details = when-authorized`): ανώνυμα φεύγει **η ετυμηγορία και οι αριθμοί**·
 * τα **ονόματα** των ρυθμίσεων φεύγουν μόνο σε συνδεδεμένο άνθρωπο. Μια λίστα ονομάτων
 * ρυθμίσεων που λείπουν είναι χάρτης αναγνώρισης για τρίτον — και **δεν κοστίζει
 * τίποτα** στον διαχειριστή, που έτσι κι αλλιώς είναι συνδεδεμένος.
 *
 * ⛔ **ΚΑΜΙΑ ΤΙΜΗ, ΠΟΤΕ, ΣΕ ΚΑΜΙΑ ΒΑΘΜΙΔΑ.** Ο ελεγκτής (`environment-audit`) είναι
 * ήδη σχεδιασμένος έτσι — το `RequirementVerdict` κρατά **δήλωση και ετυμηγορία**,
 * ποτέ την τιμή. Αυτή η διαδρομή δεν διαβάζει `process.env` μόνη της· ρωτά τον
 * ελεγκτή, ώστε να μην υπάρχει δεύτερος δρόμος προς τα μυστικά.
 *
 * 🔑 **ΓΙΑΤΙ ΤΟ `missingFatal` ΔΕΝ ΤΑΞΙΔΕΥΕΙ**: αν λείπει `fatal` ρύθμιση, το
 * `assertEnvironmentContract` **πετά στο boot** (`instrumentation.ts`) και η εφαρμογή
 * δεν σερβίρει τίποτα — άρα **αν αυτή η διαδρομή απαντά, κανένα `fatal` δεν λείπει**.
 * Ένα πεδίο που είναι δομικά πάντα κενό θα ήταν υπόσχεση χωρίς περιεχόμενο. Ο αριθμός
 * `declared` κρατά τη λογιστική κλειστή.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { getAuthContext } from '@/lib/auth/middleware';
import { auditEnvironment } from '@/lib/environment/environment-audit';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';

// Διαβάζει `process.env` και κεφαλίδες αιτήματος — ποτέ προ-αποδιδόμενο.
export const dynamic = 'force-dynamic';

/** Τι ξέρει ο διαχειριστής για **μία** ρύθμιση που λείπει. **Ποτέ η τιμή της.** */
interface DegradedFeature {
  readonly name: string;
  readonly feature: string;
  readonly consequence: string;
}

/**
 * ⚠️ **Οι αριθμοί φεύγουν ΚΑΙ ανώνυμα, επίτηδες.** Χωρίς τον παρονομαστή
 * (`declared`) ένα `degraded: 0` σημαίνει «όλα ρυθμισμένα» **ή** «το μητρώο είναι
 * άδειο» — και τα δύο μοιάζουν ίδια. Η λογιστική κλείνει στο σύρμα.
 */
interface ConfigHealth {
  readonly ready: boolean;
  readonly declared: number;
  readonly configured: number;
  readonly degraded: number;
  /** Μόνο για συνδεδεμένο άνθρωπο — δες το πρότυπο Actuator στην κεφαλίδα. */
  readonly features?: readonly DegradedFeature[];
}

async function handler(request: NextRequest): Promise<NextResponse<ConfigHealth>> {
  const audit = auditEnvironment(process.env);
  const degraded = audit.missingFeature;
  const ready = degraded.length === 0;

  const body: ConfigHealth = {
    ready,
    declared: audit.declared,
    configured: audit.configured,
    degraded: degraded.length,
  };

  const identified = (await getAuthContext(request)) !== null;

  return NextResponse.json(
    identified
      ? {
          ...body,
          features: degraded.map(({ name, feature, consequence }) => ({
            name,
            feature,
            consequence,
          })),
        }
      : body,
    { status: ready ? 200 : 503 },
  );
}

/**
 * ⚠️ **Ρυθμιστής ρυθμού και σε τελικό σημείο υγείας.** Είναι ανώνυμο και φθηνό να
 * κληθεί — δηλαδή ακριβώς το σχήμα που ένας άγνωστος μπορεί να χτυπά επ' άπειρον.
 * Ίδια απόφαση με το `/api/mandate/[token]`.
 */
export const GET = withStandardRateLimit(handler);
