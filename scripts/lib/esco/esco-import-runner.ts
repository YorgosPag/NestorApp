/**
 * ADR-132 — **Ο ΚΟΙΝΟΣ ΕΙΣΑΓΩΓΕΑΣ ESCO**: συγκομιδή → μετασχηματισμός →
 * **πύλη fail-closed** → γραφή → κλειστή λογιστική.
 *
 * ═════════════════════════════════════════════════════════════════════════════
 * 🔴 ΓΙΑΤΙ ΕΝΑΣ ΚΑΙ ΟΧΙ ΔΥΟ — ΤΟ ΙΔΙΟ ΕΛΑΤΤΩΜΑ ΗΤΑΝ ΓΡΑΜΜΕΝΟ ΔΥΟ ΦΟΡΕΣ
 *
 * Τα `import-esco-occupations.ts` και `import-esco-skills.ts` ήταν **δίδυμα**:
 * ίδιος τοκενιστής, ίδιο `uriToDocId`, ίδιο `delay`, ίδια αρχικοποίηση Admin SDK,
 * ίδιος γραφέας παρτίδων, ίδιο `main()`, **και ίδιος ελαττωματικός βρόχος
 * σελιδοποίησης**. Δηλαδή η βλάβη «σιωπηλή απώλεια που αναφέρεται ως επιτυχία»
 * υπήρχε **δύο** φορές, και μια διόρθωση **μόνο** στον έναν θα άφηνε τον άλλον
 * να λέει ψέματα — το κλασικό sibling clone του **N.18 / ADR-584**.
 *
 * ⚠️ Το `scripts/` **ΔΕΝ** μπαίνει στο Layer-2 ratchet του jscpd *(η ρίζα σάρωσης
 * είναι `src`, `check-jscpd-ratchet.js:71`)*. Άρα εδώ **δεν υπάρχει πύλη** που να
 * πιάσει το επόμενο δίδυμο: αν προσθέσεις τρίτο λεξιλόγιο ESCO, **επέκτεινε αυτό
 * το αρχείο** — μην αντιγράψεις κανένα από τα δύο σενάρια.
 * ═════════════════════════════════════════════════════════════════════════════
 * 🔑 Η ΠΥΛΗ: «ΑΤΕΛΕΣ» ΔΕΝ ΓΡΑΦΕΤΑΙ, ΚΑΙ ΔΕΝ ΤΥΠΩΝΕΙ `✅`
 *
 * Τρεις ανεξάρτητοι λόγοι άρνησης, **όλοι** πριν από οποιαδήποτε γραφή:
 *   1. η συγκομιδή δεν είναι `complete` *(χωρίς `--allow-partial`)*·
 *   2. η πηγή δήλωσε **μηδέν** έννοιες — αυτό δεν είναι άδειο λεξιλόγιο, είναι
 *      **ένδειξη βλάβης** *(το ESCO έχει ~2.942 occupations / ~13.485 skills)*·
 *   3. ο μετασχηματισμός δεν παρήγαγε **κανένα** έγγραφο.
 *
 * Το `--allow-partial` υπάρχει επειδή ένας άνθρωπος **μπορεί** να θέλει μερική
 * ενημέρωση· τυπώνει `⚠️`, **ποτέ** `✅`, και ονομάζει τι λείπει.
 *
 * @module scripts/lib/esco/esco-import-runner
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, type Firestore, type WriteBatch } from 'firebase-admin/firestore';
import * as path from 'path';
import * as fs from 'fs';

import {
  harvestEscoConcepts,
  describeHarvestVerdict,
  type HarvestRequest,
  type HarvestVerdict,
} from './esco-harvest';
import { ESCO_MAX_PAGE_SIZE, type EscoConceptType, type EscoSearchResult } from './esco-api';

/** Το όριο παρτίδας του Firestore είναι 500· κρατάμε περιθώριο. */
const FIRESTORE_BATCH_SIZE = 400;

/** Ευγενική καθυστέρηση ανάμεσα σε αιτήματα προς δημόσιο API της ΕΕ. */
const API_DELAY_MS = 500;

/** Ό,τι παρήγαγε ο μετασχηματισμός, **μαζί με τη λογιστική του**. */
export interface EscoTransformResult<TDoc> {
  readonly documents: readonly TDoc[];
  /** Γραμμές λογιστικής που τυπώνονται αυτούσιες *(π.χ. κατανομή ISCO)*. */
  readonly notes: readonly string[];
  /** Ευρήματα που κάνουν το τελικό banner `⚠️` αντί για `✅`. */
  readonly warnings: readonly string[];
}

/** Τι χρειάζεται ο δρομέας για **ένα** λεξιλόγιο ESCO. */
export interface EscoImportDescriptor<TDoc extends object> {
  readonly title: string;
  readonly conceptType: EscoConceptType;
  readonly scheme: string;
  readonly collection: string;
  /** Το πρόθεμα URI, για το εφεδρικό μονοπάτι του `uriToDocId`. */
  readonly uriPrefix: string;
  /** Ουσιαστικό στον πληθυντικό: «επαγγέλματα» / «δεξιότητες». */
  readonly noun: string;
  readonly transform: (concepts: readonly EscoSearchResult[]) => EscoTransformResult<TDoc>;
  /** Το URI κάθε εγγράφου — χρησιμοποιείται για το **ντετερμινιστικό** id. */
  readonly uriOf: (document: TDoc) => string;
}

/**
 * Σταθερό id εγγράφου από ESCO URI.
 *
 * Το UUID στο τέλος του URI είναι **σταθερό ανά έννοια**, άρα η επανεισαγωγή
 * είναι **ιδιοδύναμη**: ίδια έννοια → ίδιο έγγραφο, ποτέ διπλότυπο.
 */
export function uriToDocId(uri: string, uriPrefix: string): string {
  const match = uri.match(/\/([a-f0-9-]+)$/i);
  if (match) return match[1];
  return uri.replace(uriPrefix, '').replace(/[^a-zA-Z0-9-]/g, '_');
}

/**
 * Αρχικοποίηση Admin SDK: αρχείο υπηρεσίας αν υπάρχει, αλλιώς ADC.
 *
 * ⚠️ Η μεταβλητή `GOOGLE_APPLICATION_CREDENTIALS` διαβάζεται **σχετικά** με το
 * `cwd`, όπως και πριν — μην την αλλάξεις χωρίς να δεις πώς τρέχει ο Giorgio.
 */
function initializeAdmin(): Firestore {
  if (getApps().length === 0) {
    const credentialsPath = path.resolve(
      process.cwd(),
      process.env.GOOGLE_APPLICATION_CREDENTIALS ?? 'serviceAccountKey.json',
    );
    if (fs.existsSync(credentialsPath)) {
      initializeApp({ credential: cert(credentialsPath) });
      console.log(`\n🔑 Firebase Admin: αρχείο υπηρεσίας ${credentialsPath}`);
    } else {
      initializeApp();
      console.log('\n🔑 Firebase Admin: προεπιλεγμένα διαπιστευτήρια (ADC)');
    }
  }
  return getFirestore();
}

/** Γράφει τα έγγραφα σε παρτίδες, με `merge` ⇒ **ιδιοδύναμο** ξανατρέξιμο. */
async function writeDocuments<TDoc extends object>(
  db: Firestore,
  descriptor: EscoImportDescriptor<TDoc>,
  documents: readonly TDoc[],
): Promise<number> {
  console.log(`\n📤 Γραφή ${documents.length} ${descriptor.noun} → ${descriptor.collection}`);
  let written = 0;

  for (let offset = 0; offset < documents.length; offset += FIRESTORE_BATCH_SIZE) {
    const chunk = documents.slice(offset, offset + FIRESTORE_BATCH_SIZE);
    const batch: WriteBatch = db.batch();
    for (const document of chunk) {
      const docId = uriToDocId(descriptor.uriOf(document), descriptor.uriPrefix);
      batch.set(db.collection(descriptor.collection).doc(docId), document, { merge: true });
    }
    await batch.commit();
    written += chunk.length;
    console.log(`  📦 ${written}/${documents.length}`);
  }
  return written;
}

/** Πόσα δείγματα id δείχνει η προεπισκόπηση — αρκετά για έλεγχο, όχι dump. */
const PREVIEW_SAMPLE_SIZE = 5;

/**
 * **ΠΡΟΕΠΙΣΚΟΠΗΣΗ — ΜΗΔΕΝ ΓΡΑΦΕΣ.** Ίδια υπογραφή με τον `writeDocuments`, ώστε να
 * μπαίνει στην **ίδια** θέση του κύκλου: η συγκομιδή, ο μετασχηματισμός, η
 * λογιστική και η **πύλη fail-closed** τρέχουν **ακέραια**· μόνο ο γραφέας
 * αντικαθίσταται.
 *
 * ⚠️ **Γιατί υπάρχει** (ADR-132 §10, ADR-823): ο εισαγωγέας γράφει σε **παραγωγή**
 * και η μηχανή **δεν έχει δει ποτέ** το αληθινό API — και οι 95 άγκυρες τρέχουν με
 * πλαστό `fetch`. Κανένας εισαγωγέας που μεταλλάσσει δεδομένα δεν βγαίνει χωρίς
 * προεπισκόπηση· το πρώτο πραγματικό τρέξιμο **δεν επιτρέπεται** να είναι και η
 * πρώτη γραφή.
 *
 * 🔑 **ΔΕΝ αγγίζει το Admin SDK**: ο `initializeAdmin()` ζει **μέσα** στον
 * προεπιλεγμένο γραφέα, οπότε σε `--dry-run` δεν ανοίγει **καμία** σύνδεση και δεν
 * χρειάζεται **κανένα** διαπιστευτήριο. Άγκυρα: `esco-import-gate.test.ts`.
 */
function previewDocuments<TDoc extends object>(
  descriptor: EscoImportDescriptor<TDoc>,
  documents: readonly TDoc[],
): Promise<number> {
  console.log('\n🔍 ΠΡΟΕΠΙΣΚΟΠΗΣΗ (--dry-run) — ΚΑΜΙΑ ΓΡΑΦΗ ΔΕΝ ΘΑ ΓΙΝΕΙ');
  console.log(`   Προορισμός που ΘΑ γραφόταν: ${descriptor.collection}`);
  console.log(`   Έγγραφα που ΘΑ γράφονταν:   ${documents.length} ${descriptor.noun}`);
  console.log(`   Τρόπος γραφής:              set(..., { merge: true }) ⇒ ιδιοδύναμο`);

  const sample = documents.slice(0, PREVIEW_SAMPLE_SIZE);
  if (sample.length > 0) {
    console.log(`   Δείγμα id εγγράφων (${sample.length}/${documents.length}):`);
    for (const document of sample) {
      console.log(`     • ${uriToDocId(descriptor.uriOf(document), descriptor.uriPrefix)}`);
    }
  }
  console.log('   ℹ️  Η λογιστική παραπάνω είναι ΑΚΡΙΒΩΣ αυτή που θα ίσχυε στη γραφή.');
  return Promise.resolve(0);
}

/**
 * Τα **σημεία εισόδου** του κύκλου, ενέσιμα.
 *
 * ⚠️ Υπάρχουν για να μπορεί μια άγκυρα να αποδείξει τη **σειρά**: ότι ο γραφέας
 * **δεν καλείται ΚΑΘΟΛΟΥ** όταν η συγκομιδή είναι ατελής. Χωρίς αυτό, η
 * «fail-closed» θα ήταν ισχυρισμός σε σχόλιο — και δύο συνεδρίες πλήρωσαν
 * ακριβώς αυτό.
 */
export interface EscoImportPorts<TDoc extends object> {
  readonly harvest?: (request: HarvestRequest) => Promise<HarvestVerdict>;
  readonly write?: (
    descriptor: EscoImportDescriptor<TDoc>,
    documents: readonly TDoc[],
  ) => Promise<number>;
}

/** Οι λόγοι για τους οποίους **δεν** επιτρέπεται γραφή. Άδειος πίνακας = πράσινο. */
export function harvestRefusals<TDoc extends object>(
  verdict: HarvestVerdict,
  transformed: EscoTransformResult<TDoc>,
  allowPartial: boolean,
): string[] {
  const blocking: string[] = [];
  if (verdict.kind === 'incomplete' && !allowPartial) {
    blocking.push('Η συγκομιδή είναι ΑΤΕΛΗΣ — δες τους λόγους παραπάνω (--allow-partial για να προχωρήσεις εν γνώσει σου)');
  }
  if (verdict.kind === 'complete' && verdict.declaredTotal === 0) {
    blocking.push('Η πηγή δήλωσε ΜΗΔΕΝ έννοιες — αυτό είναι ένδειξη βλάβης, όχι άδειο λεξιλόγιο');
  }
  if (transformed.documents.length === 0) {
    blocking.push('Ο μετασχηματισμός δεν παρήγαγε ΚΑΝΕΝΑ έγγραφο');
  }
  return blocking;
}

/** Η **κλειστή λογιστική**: δηλωμένα → μοναδικά → έγγραφα, χωρίς κενά. */
function accountingLines<TDoc extends object>(
  verdict: HarvestVerdict,
  transformed: EscoTransformResult<TDoc>,
): string[] {
  const declared = verdict.declaredTotal === null ? 'ΑΓΝΩΣΤΟ' : String(verdict.declaredTotal);
  const skipped = verdict.concepts.length - transformed.documents.length;
  return [
    `📐 Λογιστική: δηλωμένα ${declared} · μοναδικά ${verdict.concepts.length} · ` +
      `έγγραφα ${transformed.documents.length} · παραλείφθηκαν ${skipped}`,
    ...transformed.notes.map((note) => `   ${note}`),
  ];
}

/**
 * Τρέχει **ολόκληρο** τον κύκλο ενός λεξιλογίου ESCO.
 *
 * ⚠️ Επιστρέφει κωδικό εξόδου· **δεν** καλεί `process.exit` — έτσι ο κύκλος
 * παραμένει δοκιμάσιμος από άγκυρα χωρίς να σκοτώνει τον runner του Jest.
 */
export async function runEscoImport<TDoc extends object>(
  descriptor: EscoImportDescriptor<TDoc>,
  argv: readonly string[] = process.argv.slice(2),
  ports: EscoImportPorts<TDoc> = {},
): Promise<number> {
  const allowPartial = argv.includes('--allow-partial');
  const dryRun = argv.includes('--dry-run');
  console.log('====================================================');
  console.log(`🇪🇺 ${descriptor.title}${dryRun ? '  [ΠΡΟΕΠΙΣΚΟΠΗΣΗ]' : ''}`);
  console.log('====================================================');
  console.log(`📅 ${new Date().toISOString()}`);
  console.log(`📍 Προορισμός: ${descriptor.collection}`);
  if (dryRun) console.log('🔍 --dry-run: θα εκτελεστούν ΟΛΑ τα βήματα ΕΚΤΟΣ από τη γραφή');

  console.log(`\n📥 Συγκομιδή ${descriptor.noun} από το concept-scheme…`);
  const harvest = ports.harvest ?? harvestEscoConcepts;
  const verdict = await harvest({
    conceptType: descriptor.conceptType,
    scheme: descriptor.scheme,
    pageSize: ESCO_MAX_PAGE_SIZE,
    politeDelayMs: API_DELAY_MS,
    onProgress: (line) => console.log(line),
  });
  for (const line of describeHarvestVerdict(verdict)) console.log(line);

  const transformed = descriptor.transform(verdict.concepts);
  for (const line of accountingLines(verdict, transformed)) console.log(line);

  const blocking = harvestRefusals(verdict, transformed, allowPartial);
  if (blocking.length > 0) {
    console.error('\n====================================================');
    console.error('⛔ Η ΕΙΣΑΓΩΓΗ ΣΤΑΜΑΤΗΣΕ — ΔΕΝ ΓΡΑΦΤΗΚΕ ΤΙΠΟΤΑ');
    console.error('====================================================');
    for (const reason of blocking) console.error(`  • ${reason}`);
    return 1;
  }

  // ⚠️ **Η ΣΕΙΡΑ ΕΧΕΙ ΣΗΜΑΣΙΑ**: το `--dry-run` επιλέγεται **ΜΕΤΑ** την πύλη
  // fail-closed. Δηλαδή μια ατελής συγκομιδή σταματά **ούτως ή άλλως**, και η
  // προεπισκόπηση δεν μπορεί ποτέ να δείξει κάτι που η πύλη θα απέρριπτε.
  // 🔑 **ΤΟ `--dry-run` ΝΙΚΑ ΤΟΝ ΕΝΕΜΕΝΟ ΓΡΑΦΕΑ, ΕΠΙΤΗΔΕΣ.** Σημαία που λέει «μη
  // γράψεις» δεν επιτρέπεται να παρακάμπτεται από κανένα σημείο εισόδου — αλλιώς
  // η υπόσχεση εξαρτάται από το ποιος καλεί. Και **ταυτόχρονα** αυτή η σειρά είναι
  // που κάνει την υπόσχεση **παρατηρήσιμη**: η άγκυρα ενίει γραφέα-κατάσκοπο, τρέχει
  // με `--dry-run`, και απαιτεί ο κατάσκοπος να **μην κληθεί ΠΟΤΕ**. Αν υπερίσχυε
  // το `ports.write`, καμία άγκυρα δεν θα μπορούσε να δει τη διαφορά.
  const write = dryRun
    ? previewDocuments
    : ports.write ??
      ((target: EscoImportDescriptor<TDoc>, documents: readonly TDoc[]) =>
        writeDocuments(initializeAdmin(), target, documents));
  const written = await write(descriptor, transformed.documents);
  const partial = verdict.kind === 'incomplete';
  const warned = partial || transformed.warnings.length > 0;

  console.log('\n====================================================');
  if (dryRun) console.log('🔍 ΠΡΟΕΠΙΣΚΟΠΗΣΗ ΟΛΟΚΛΗΡΩΘΗΚΕ — ΤΙΠΟΤΑ ΔΕΝ ΓΡΑΦΤΗΚΕ');
  else console.log(warned ? '⚠️  ΕΙΣΑΓΩΓΗ ΜΕ ΕΠΙΦΥΛΑΞΕΙΣ' : '✅ ΕΙΣΑΓΩΓΗ ΠΛΗΡΗΣ');
  console.log('====================================================');
  console.log(
    dryRun
      ? `📊 ΘΑ γράφονταν: ${transformed.documents.length} ${descriptor.noun}`
      : `📊 Γράφτηκαν: ${written} ${descriptor.noun}`,
  );
  if (partial) console.log('⚠️  ΜΕΡΙΚΗ συγκομιδή γράφτηκε κατ᾽ εντολή --allow-partial');
  for (const warning of transformed.warnings) console.log(`⚠️  ${warning}`);
  return 0;
}
