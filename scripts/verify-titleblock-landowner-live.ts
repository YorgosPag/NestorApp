/**
 * ΖΩΝΤΑΝΗ ΕΠΑΛΗΘΕΥΣΗ — ο οικοπεδούχος της πινακίδας, πάνω σε **αληθινό διακομιστή**
 * και **αληθινή βάση** (ADR-745 Φ3β, το σκέλος που η σουίτα ραφής ΔΕΝ μπορεί να δει).
 *
 * ## Γιατί υπάρχει, αφού υπάρχει ήδη η σουίτα υπηρεσίας
 *
 * Το `tests/service-integration/` απαντά στο **PATCH που έστειλε ο κώδικας** με σταθερό
 * `{ success: true }`, γιατί σε εκείνη τη διεργασία **δεν υπάρχει διακομιστής**. Άρα
 * αποδεικνύει *τι στάλθηκε*, ποτέ *τι έγινε δεκτό*. Για τους στόχους που γράφουν μέσω
 * HTTP — `landowner` και `project-address` — αυτό αφήνει ακριβώς το επικίνδυνο ερώτημα
 * αναπάντητο:
 *
 *   🔴 **Επιβιώνει το `bartexPercentage`;**
 *
 * Ο καμβάς **δεν έχει γνώμη** για την αντιπαροχή, οπότε το `buildLandownersUpdate(...,
 * 'preserve')` **παραλείπει** το πεδίο. Το ερώτημα «παράλειψη = διατήρηση ή = σβήσιμο;»
 * απαντιέται **μόνο** από τον πραγματικό δρομολογητή πάνω στην πραγματική βάση. Ήταν η
 * **τρίτη απώλεια δεδομένων** αυτού του ADR και βρέθηκε από τον αντίπαλο κριτικό **πριν**
 * γραφτεί κώδικας· αυτό το script είναι η εκτέλεση της απόδειξης.
 *
 * ## Τι είναι κώδικας παραγωγής εδώ και τι όχι — διαβάσου το πριν εμπιστευτείς το πράσινο
 *
 * **Παραγωγής** (εισάγονται, δεν αντιγράφονται): `mergeLandowner` (Γ5), `toPropertyOwners`
 * + `toLandownerEntries` (η ΕΝΙΑΙΑ κατανομή χιλιοστών), `buildLandownersUpdate` (Γ4 — τα
 * τρία πεδία που ταξιδεύουν μαζί), και ο **πραγματικός δρομολογητής** `PATCH /api/projects/{id}`.
 *
 * **Του script**: η μεταφορά HTTP. Το `applyLandownerTarget` ΔΕΝ εισάγεται, γιατί σέρνει
 * `enterprise-api-client`, που σε Node πετάει ρητά «API client cannot run on server». Άρα
 * αναπαράγεται εδώ **η σειρά κλήσεων**, όχι η λογική — και η διαφορά δηλώνεται αντί να
 * σιωπηθεί.
 *
 * ## Δεν είναι πύλη, και δεν πρέπει να γίνει
 *
 * Απαιτεί emulator + dev server + σπαρμένο μισθωτή. Ένα CI job που τα στήνει όλα αυτά θα
 * ήταν αργό και εύθραυστο· η φθηνή, μόνιμη πύλη είναι το `service-integration.yml`. Αυτό
 * εδώ είναι το **όργανο του ανθρώπου** για τα δύο σκέλη που καμία πύλη δεν βλέπει.
 *
 * Προϋποθέσεις:
 *   1. `npm run emulator`
 *   2. `npm run emulator:seed-demo`
 *   3. `npm run dev:emulator -- --port 3001`
 *   4. `npx tsx scripts/verify-titleblock-landowner-live.ts`
 *
 * @module scripts/verify-titleblock-landowner-live
 */

process.env.FIRESTORE_EMULATOR_HOST ??= 'localhost:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST ??= 'localhost:9099';

import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

import {
  buildLandownersUpdate,
  mergeLandowner,
  toLandownerEntries,
  toPropertyOwners,
} from '@/components/projects/tabs/landowners/landowner-form-model';
import type { AcquisitionStatus, LandownerEntry } from '@/types/ownership-table';

const PROJECT_FIREBASE_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? 'pagonis-87766';
const APP_ORIGIN = process.env.LIVE_APP_ORIGIN ?? 'http://localhost:3001';
const AUTH_HOST = 'localhost:9099';

const DEMO_EMAIL = 'demo@nestor.local';
const DEMO_PASSWORD = process.env.DEMO_SEED_PASSWORD ?? 'demo1234';
const PROJECT_ID = 'proj_demo_emulator';

/** Ο υπάρχων οικοπεδούχος — αυτός που ΔΕΝ πρέπει να πειραχθεί. */
const INCUMBENT_CONTACT = 'cont_pappas_existing';
/** Ο νέος, «ΕΡΓΟΔΟΤΗΣ: ΖΕΡΒΑ ΓΕΩΡΓΙΑ» της πινακίδας. */
const INCOMING_CONTACT = 'cont_zerva_titleblock';
const INCOMING_NAME = 'ΖΕΡΒΑ ΓΕΩΡΓΙΑ';

/** Η τιμή που πρέπει να επιβιώσει. Ο καμβάς δεν την ξέρει και δεν τη στέλνει. */
const BARTEX_BEFORE = 35;

interface Report {
  readonly label: string;
  readonly ok: boolean;
  readonly detail: string;
}

const results: Report[] = [];
const check = (label: string, ok: boolean, detail: string) => {
  results.push({ label, ok, detail });
  console.log(`${ok ? '   ✅' : '   ❌'} ${label}\n      ${detail}`);
};

function db() {
  if (getApps().length === 0) initializeApp({ projectId: PROJECT_FIREBASE_ID });
  return getFirestore();
}

/** Κανένα βήμα δεν τρέχει αν ο διακομιστής δεν απαντά — αλλιώς το «απέτυχε» είναι θόρυβος. */
async function assertServerUp(): Promise<void> {
  try {
    await fetch(`${APP_ORIGIN}/api/health`, { signal: AbortSignal.timeout(4000) });
  } catch {
    try {
      await fetch(APP_ORIGIN, { signal: AbortSignal.timeout(8000) });
    } catch {
      throw new Error(`Ο διακομιστής δεν απαντά στο ${APP_ORIGIN}. Τρέξε: npm run dev:emulator -- --port 3001`);
    }
  }
}

/**
 * Ξετύλιγμα του κανονικού φακέλου `{ success, data }` → `data`.
 *
 * ⚠️ Το **μόνο** κομμάτι συμπεριφοράς παραγωγής που αναπαράγεται εδώ, και δηλώνεται γιατί
 * με κόστισε: ο δρομολογητής απαντά `{ success, data: { project } }`, ενώ το
 * `readProjectSnapshot` διαβάζει `payload.project` — φαινομενικά ασύμφωνα. Δεν είναι: το
 * `enterprise-api-client.ts:318-325` ξετυλίγει το `data` **πριν** το δει ο καλών. Η πρώτη
 * εκτέλεση αυτού του script έκανε ωμό `fetch`, είδε `landowners=απών` και **παραλίγο να
 * αναφερθεί ως ελάττωμα παραγωγής**. Ήταν ελάττωμα του οργάνου — η ίδια παγίδα με το
 * «μέτρα με MCP ενώ γράφεις σε emulator» (§13(ιδ) Α5): **λάθος όργανο, όχι λάθος κώδικας**.
 */
function unwrap<T>(body: unknown): T {
  if (body && typeof body === 'object' && 'success' in body && 'data' in body) {
    return (body as { data: T }).data;
  }
  return body as T;
}

/** Πραγματικό ID token από τον Auth emulator — ο δρομολογητής το επαληθεύει κανονικά. */
async function signIn(): Promise<string> {
  const url = `http://${AUTH_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=emulator`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: DEMO_EMAIL, password: DEMO_PASSWORD, returnSecureToken: true }),
  });
  const payload = (await res.json()) as { idToken?: string; error?: { message?: string } };
  if (!payload.idToken) {
    throw new Error(`Αποτυχία σύνδεσης demo χρήστη: ${payload.error?.message ?? res.status}`);
  }
  return payload.idToken;
}

/**
 * Η αφετηρία: έργο με έναν οικοπεδούχο ΚΑΙ δηλωμένη αντιπαροχή.
 *
 * Γράφεται με Admin SDK επίτηδες — είναι το «όπως το άφησε ο άνθρωπος στην καρτέλα», όχι
 * κάτι που παράγει η διαδρομή υπό εξέταση.
 */
async function seedStartingState(): Promise<void> {
  const incumbent: LandownerEntry = {
    contactId: INCUMBENT_CONTACT,
    name: 'ΠΑΠΠΑΣ ΔΗΜΗΤΡΙΟΣ',
    landOwnershipPct: 60,
    allocatedShares: 1000,
    acquisitionStatus: 'secured' as AcquisitionStatus,
  };

  await db().collection('projects').doc(PROJECT_ID).set(
    {
      landowners: [incumbent],
      landownerContactIds: [INCUMBENT_CONTACT],
      bartexPercentage: BARTEX_BEFORE,
    },
    { merge: true },
  );
}

async function readProject(): Promise<Record<string, unknown>> {
  const snap = await db().collection('projects').doc(PROJECT_ID).get();
  return (snap.data() ?? {}) as Record<string, unknown>;
}

/** Η ίδια αλληλουχία που εκτελεί το `apply-landowner.ts` — με τις ΔΙΚΕΣ ΤΟΥ συναρτήσεις. */
function reapportion(entries: readonly LandownerEntry[]): LandownerEntry[] {
  const statuses: Record<string, AcquisitionStatus> = {};
  for (const e of entries) {
    if (e.contactId && e.acquisitionStatus) statuses[e.contactId] = e.acquisitionStatus;
  }
  return toLandownerEntries(toPropertyOwners(entries), statuses);
}

async function main(): Promise<void> {
  console.log('══════════════════════════════════════════════════════════════');
  console.log('ΖΩΝΤΑΝΗ ΕΠΑΛΗΘΕΥΣΗ — οικοπεδούχος πινακίδας (ADR-745 Φ3β)');
  console.log('══════════════════════════════════════════════════════════════');

  await assertServerUp();
  const token = await signIn();
  console.log(`🔑 Συνδέθηκε ως ${DEMO_EMAIL} (company_admin)\n`);

  await seedStartingState();
  const before = await readProject();
  console.log(`📋 Αφετηρία: ${(before.landowners as unknown[])?.length} οικοπεδούχος, bartexPercentage=${String(before.bartexPercentage)}\n`);

  // ── 1. Η ΑΝΑΓΝΩΣΗ ΤΗ ΣΤΙΓΜΗ ΤΟΥ ΚΛΙΚ (Γ5) — μέσω του ΠΡΑΓΜΑΤΙΚΟΥ δρομολογητή ──
  const getRes = await fetch(`${APP_ORIGIN}/api/projects/${PROJECT_ID}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const getBody = unwrap<{ project?: { landowners?: LandownerEntry[] } }>(await getRes.json());
  check(
    'Ο δρομολογητής GET /api/projects/{id} απαντά με το έργο',
    getRes.ok && Boolean(getBody.project),
    `HTTP ${getRes.status} · landowners=${getBody.project?.landowners?.length ?? 'απών'}`,
  );
  if (!getBody.project) throw new Error('Χωρίς στιγμιότυπο έργου δεν έχει νόημα να συνεχίσω.');

  const snapshotLandowners = getBody.project.landowners ?? [];

  // ── 2. Η ΣΥΓΧΩΝΕΥΣΗ ΚΑΙ ΤΟ ΦΟΡΤΙΟ — κώδικας παραγωγής, αυτούσιος ──
  const incoming: LandownerEntry = {
    contactId: INCOMING_CONTACT,
    name: INCOMING_NAME,
    landOwnershipPct: 40,
    allocatedShares: 0,
    acquisitionStatus: 'prospective' as AcquisitionStatus,
  };
  const merged = mergeLandowner(snapshotLandowners, incoming);
  check(
    'Ο νέος οικοπεδούχος δεν υπάρχει ήδη (η συγχώνευση τον προσθέτει)',
    !merged.alreadyPresent && merged.entries.length === 2,
    `alreadyPresent=${merged.alreadyPresent} · σύνολο=${merged.entries.length}`,
  );

  /**
   * ΑΡΝΗΤΙΚΟΣ ΜΑΡΤΥΡΑΣ — `SIMULATE_NAIVE_BARTEX=1` αναπαράγει το ελάττωμα (β).
   *
   * 🔑 **Ένα πράσινο που δεν έχει αποδείξει ότι μπορεί να κοκκινίσει δεν είναι απόδειξη.**
   * Το `{ set: null }` είναι **ακριβώς** ό,τι θα έστελνε ο κοινός `buildLandownersUpdate(
   * entries, bartexPct)` που είχε προταθεί πρώτα: ο καμβάς δεν έχει γνώμη για την
   * αντιπαροχή, άρα θα περνούσε `null`. Με τη σημαία, ο έλεγχος «το bartexPercentage
   * ΕΠΙΒΙΩΣΕ» **οφείλει να κοκκινίσει** — αλλιώς δεν κοιτάζει τίποτα.
   *
   * Είναι ενσωματωμένος και όχι χειροκίνητη μετάλλαξη επίτηδες: το δέντρο μοιράζεται με
   * άλλον agent και μια μετάλλαξη αρχείου **εξαφανίστηκε μέσα σε τρέξιμο** (§13(ιε)).
   */
  const bartexIntent = process.env.SIMULATE_NAIVE_BARTEX === '1'
    ? ({ set: null } as const)
    : ('preserve' as const);
  if (process.env.SIMULATE_NAIVE_BARTEX === '1') {
    console.log('   ⚠️  ΑΡΝΗΤΙΚΟΣ ΜΑΡΤΥΡΑΣ ΕΝΕΡΓΟΣ — αναμένεται ΑΠΟΤΥΧΙΑ στο bartexPercentage\n');
  }

  const updates = buildLandownersUpdate(reapportion(merged.entries), bartexIntent);
  check(
    'Το φορτίο ΔΕΝ περιέχει καθόλου bartexPercentage (σηματοδότης «preserve»)',
    ('bartexPercentage' in updates) === (bartexIntent !== 'preserve'),
    `κλειδιά φορτίου: ${Object.keys(updates).join(', ')}`,
  );

  // ── 3. ΤΟ ΑΛΗΘΙΝΟ PATCH ──
  const patchRes = await fetch(`${APP_ORIGIN}/api/projects/${PROJECT_ID}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  const patchText = await patchRes.text();
  check(
    'Ο δρομολογητής PATCH /api/projects/{id} δέχτηκε την εγγραφή',
    patchRes.ok,
    `HTTP ${patchRes.status} · ${patchText.slice(0, 160)}`,
  );

  // ── 4. Η ΜΕΤΡΗΣΗ ΣΤΗ ΒΑΣΗ — όχι στην απάντηση, όχι στην οθόνη ──
  const after = await readProject();
  const owners = (after.landowners ?? []) as LandownerEntry[];
  const ids = (after.landownerContactIds ?? []) as string[];

  check(
    '🔴 ΤΟ ΚΡΙΣΙΜΟ — το bartexPercentage ΕΠΙΒΙΩΣΕ',
    after.bartexPercentage === BARTEX_BEFORE,
    `πριν=${BARTEX_BEFORE} · μετά=${String(after.bartexPercentage)}`,
  );
  check(
    'Ο νέος οικοπεδούχος γράφτηκε',
    owners.some((o) => o.contactId === INCOMING_CONTACT),
    `ονόματα: ${owners.map((o) => o.name).join(' | ') || '(κανένα)'}`,
  );
  check(
    'Ο ΥΠΑΡΧΩΝ οικοπεδούχος δεν χάθηκε ούτε υποβαθμίστηκε',
    owners.some((o) => o.contactId === INCUMBENT_CONTACT && o.acquisitionStatus === 'secured'),
    `κατάσταση υπάρχοντος: ${owners.find((o) => o.contactId === INCUMBENT_CONTACT)?.acquisitionStatus ?? '(χάθηκε)'}`,
  );
  check(
    'Ο φύλακας διαγραφής βλέπει ΚΑΙ ΤΟΥΣ ΔΥΟ (landownerContactIds)',
    ids.includes(INCUMBENT_CONTACT) && ids.includes(INCOMING_CONTACT),
    `ids: ${ids.join(', ') || '(κενό)'}`,
  );
  check(
    'Τα χιλιοστά αθροίζουν σε 1000 (ενιαία κατανομή, όχι ανά γραμμή)',
    owners.reduce((s, o) => s + (o.allocatedShares ?? 0), 0) === 1000,
    `άθροισμα=${owners.reduce((s, o) => s + (o.allocatedShares ?? 0), 0)} · ${owners.map((o) => `${o.name}:${o.allocatedShares}`).join(' | ')}`,
  );
  check(
    'Το Project.client ΔΕΝ αγγίχτηκε (ο ΕΡΓΟΔΟΤΗΣ δεν είναι πελάτης)',
    after.client === undefined || after.client === before.client,
    `client=${String(after.client)}`,
  );

  console.log('\n══════════════════════════════════════════════════════════════');
  const failed = results.filter((r) => !r.ok);
  console.log(failed.length === 0
    ? `✅ ΟΛΑ ΠΕΡΑΣΑΝ — ${results.length}/${results.length}`
    : `❌ ΑΠΕΤΥΧΑΝ ${failed.length}/${results.length}: ${failed.map((f) => f.label).join(' · ')}`);
  console.log('══════════════════════════════════════════════════════════════');
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(`\n💥 ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
