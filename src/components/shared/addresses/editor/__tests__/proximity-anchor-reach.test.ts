/**
 * @fileoverview **ΦΤΑΝΕΙ Η ΑΦΕΤΗΡΙΑ ΕΓΓΥΤΗΤΑΣ ΣΕ ΚΑΘΕ ΟΘΟΝΗ;** — ADR-332 **D25**.
 * @related ADR-332 D22 · D23 · utils/address/address-list-center
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΕΥΡΗΜΑ ΠΟΥ ΓΕΝΝΗΣΕ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ — μετρημένο 2026-09-05
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το **D23** έδωσε στον `AddressEditor` αφετηρία εγγύτητας, ώστε ο κατάλογος προτάσεων
 * να ανεβάζει **πρώτη** την πιο κοντινή υποψήφια διεύθυνση. Την έδωσε σε **ένα** από τα
 * σημεία μονταρίσματος. Τα υπόλοιπα την είχαν διαθέσιμη και **δεν την περνούσαν** —
 * δηλαδή το χαρακτηριστικό ήταν, για εκείνες τις οθόνες, **αόρατο**: η μόνη διαφορά από
 * το ανύπαρκτο ήταν ο κώδικας που συντηρούσαμε γι' αυτό.
 *
 * Και η μία καλωδίωση που **υπήρχε** ήταν **αφύλακτη**: αν κάποιος έσβηνε το
 * `suggestions={{ proximityAnchor }}`, **όλα έμεναν πράσινα** και η εγγύτητα ξαναπέθαινε
 * σιωπηλά — **ακριβώς ο τρόπος με τον οποίο πέθανε την πρώτη φορά**.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΓΙΑΤΙ **ΜΙΑ** ΠΥΛΗ ΚΑΙ ΟΧΙ ΕΞΙ ΑΓΚΥΡΕΣ ΑΠΟΔΟΣΗΣ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Έξι χειρόγραφες άγκυρες φυλάνε **έξι** οθόνες· ο **έβδομος** καταναλωτής γεννιέται
 * αφύλακτος και κανείς δεν το μαθαίνει. Αυτό εδώ παράγει τη λίστα **από το δέντρο**,
 * οπότε ένα νέο σημείο μονταρίσματος καλύπτεται **την ημέρα που γράφεται**.
 *
 * ⚠️ Η αστοχία που το ίδιο αυτό σχήμα έχει ήδη πληρώσει **δύο φορές** σε αυτό το repo
 * είναι η **άδεια σάρωση που αναφέρει «καθαρό»**. Γι' αυτό η **πρώτη** διαβεβαίωση εδώ
 * είναι ότι η σάρωση βρήκε καν τα σημεία μονταρίσματος.
 *
 * ⚠️ **Και το «δεν περνά αφετηρία» ΔΕΝ είναι πάντα λάθος** — ο μηχανισμός δηλωμένων
 * εξαιρέσεων μένει για καταναλωτή που **πραγματικά** δεν μπορεί. Ως τις 2026-09-11 εκεί
 * ζούσαν οι δύο οθόνες επαφών (το `CompanyAddress` δεν αποθήκευε θέση)· το ADR-332 D27
 * Β-ΙΙ του έδωσε θέση και τις καλώδιωσε. Η τελευταία ενότητα φυλάει πλέον ότι **έχει**.
 *
 * **Τι ΔΕΝ αποδεικνύει**: ότι η τιμή που περνιέται είναι όντως σημείο (στατικός
 * έλεγχος). Αυτό το αποδεικνύουν οι άγκυρες που **εκτελούν** τη διαδρομή:
 * `ProjectLocationsTab.proximity.test.tsx` · `FrontageAddressCreateDialog.proximity.test.tsx`
 * · `AddressEditor.integration.test.tsx` (D23) · και, για τα κτίρια,
 * `building-addresses-card-project-anchor.test.tsx` (D24).
 */

import * as fs from 'fs';
import * as path from 'path';

const SRC_ROOT = path.join(process.cwd(), 'src');

/**
 * Το άνοιγμα ετικέτας του συντονιστή.
 *
 * ⚠️ Το αρνητικό lookahead **δεν είναι διακόσμηση**: χωρίς αυτό, το
 * `<AddressEditorContext.Provider>` μέσα στον ίδιο τον `AddressEditor.tsx` μετριέται ως
 * σημείο μονταρίσματος και η πύλη απαιτεί αφετηρία από τον **ορισμό** του component.
 */
const MOUNT_TAG = /<AddressEditor(?![A-Za-z0-9_])/g;

/** Η ομάδα ρυθμίσεων που κουβαλά την αφετηρία (`AddressEditorSuggestionOptions`). */
const DECLARES_ANCHOR = /\bsuggestions\s*=/;

/**
 * Πόσα σημεία μονταρίσματος υπήρχαν όταν γράφτηκε η πύλη (μετρημένα 05/09).
 *
 * Είναι **κατώφλι μη-κενότητας**, όχι κλειδωμένο πλήθος: νέος καταναλωτής **επιτρέπεται**
 * (και τότε η πύλη τον ρωτά για αφετηρία). Αν η σάρωση πέσει κάτω από αυτό, το πιθανό
 * αίτιο είναι **σπασμένος σαρωτής**, όχι καθαρό δέντρο.
 */
const KNOWN_MOUNT_SITE_COUNT = 6;

// ============================================================================
// ΟΙ ΔΗΛΩΜΕΝΕΣ ΕΞΑΙΡΕΣΕΙΣ — καθεμία με λόγο που ΕΛΕΓΧΕΤΑΙ, όχι με σχόλιο
// ============================================================================

/**
 * Γιατί ένα σημείο μονταρίσματος **δεν μπορεί** να δηλώσει αφετηρία.
 *
 * ⛔ Δεν υπάρχει τιμή «δεν πρόλαβα» ή «αργότερα». Μια εξαίρεση χωρίς λόγο που να
 * μπορεί να **πάψει να ισχύει** είναι απλώς η παράλειψη, γραμμένη πιο επίσημα.
 */
type ExemptionReason = 'no-position-in-model';

interface Exemption {
  readonly reason: ExemptionReason;
  readonly why: string;
}

/**
 * 📜 **ΙΣΤΟΡΙΚΟ (05/09 → 11/09/2026)** — εδώ ζούσαν δύο εξαιρέσεις, με τον λόγο που ακολουθεί.
 * Το ADR-332 D27 Β-ΙΙ τον κατάργησε (βλ. τη γραμμή αμέσως μετά το σχόλιο).
 *
 * 🔴 **ΟΙ ΔΥΟ ΟΘΟΝΕΣ ΕΠΑΦΩΝ — και γιατί καλωδίωση εκεί θα ήταν ΧΕΙΡΟΤΕΡΗ από την απουσία.**
 *
 * Μετρημένο 05/09: το `CompanyAddress` (`src/types/ContactFormTypes.ts`) **δεν έχει
 * πεδίο θέσης**. Ούτε το ίδιο, ούτε το `PostalAddressFields` που επεκτείνει, ούτε η
 * διοικητική ιεραρχία. Οι πινέζες του `ContactAddressMapPreview` γεννιούνται
 * γεωκωδικοποιώντας **κείμενο** τη στιγμή της απόδοσης, και η απάντηση **πετιέται**
 * *(είναι ο καταναλωτής #1 του πίνακα στο `lib/geocoding/address-position.ts`)*.
 *
 * ⇒ Ένα `addressListCenter(companyAddresses)` εδώ θα επέστρεφε **πάντα `undefined`**.
 * Θα ήταν **σκέλος που δεν τρέχει**, ντυμένο ως χαρακτηριστικό — το ακριβές σχήμα που
 * το D22 και το D23 πλήρωσαν να ξεμπερδέψουν *(42 και 13 πράσινες άγκυρες αντίστοιχα,
 * πάνω σε νεκρό κώδικα)*. **Η σιωπή είναι η τίμια απάντηση· η ψεύτικη καλωδίωση όχι.**
 *
 * 🔑 **Τι πρέπει να γίνει πρώτα** *(δεν είναι δουλειά αυτής της αλυσίδας)*: οι
 * διευθύνσεις επαφών να αποκτήσουν αποθηκευμένη θέση μέσω του **ενός γραφέα**
 * (`lib/geocoding/address-position.ts`), όπως ήδη έχουν οι διευθύνσεις έργου. Την ημέρα
 * που θα συμβεί, η τελευταία ενότητα αυτού του αρχείου **κοκκινίζει** και ζητά την
 * καλωδίωση — δεν χρειάζεται να το θυμηθεί κανείς.
 */
// 🟢 ADR-332 D27 Β-ΙΙ (2026-09-11): ο λόγος ΕΠΑΨΕ να ισχύει — το `CompanyAddress` κληρονομεί
// `StoredAddressPosition` (τη γράφει ο ένας γραφέας θέσης), και οι δύο οθόνες καλωδιώθηκαν με
// `addressListCenter` πάνω στις αδελφές διευθύνσεις. Καμία εξαίρεση δεν απομένει.
const EXEMPTIONS: ReadonlyMap<string, Exemption> = new Map();

// ============================================================================
// Η ΣΑΡΩΣΗ
// ============================================================================

interface MountSite {
  /** Διαδρομή σχετική με τη ρίζα, με `/` — ίδια γραφή με το μητρώο εξαιρέσεων. */
  readonly file: string;
  /** Το άνοιγμα ετικέτας, από το `<AddressEditor` ως το `>` που το κλείνει. */
  readonly openingTag: string;
}

function collectSourceFiles(dir: string, found: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== '__tests__' && entry.name !== 'node_modules') {
        collectSourceFiles(full, found);
      }
    } else if (entry.name.endsWith('.tsx')) {
      found.push(full);
    }
  }
  return found;
}

/**
 * Ο κώδικας **χωρίς** σχόλια και συμβολοσειρές, με το ίδιο μήκος *(αντικαθίστανται με
 * κενά, οι αλλαγές γραμμής μένουν)*.
 *
 * 🔴 **Δεν είναι βελτιστοποίηση — είναι ορθότητα, και μετρήθηκε.** Η πρώτη εκδοχή
 * σάρωνε το ωμό κείμενο και ανέφερε **τέσσερα** ψευδή σημεία μονταρίσματος: το
 * `AddressFormSection.tsx` και το `AddressEditorContext.tsx` γράφουν `<AddressEditor>`
 * μέσα σε **σχόλια** και σε μήνυμα σφάλματος. Μια πύλη που κοκκινίζει για σχόλιο
 * μαθαίνει τους ανθρώπους να την αγνοούν, και τότε δεν φυλάει τίποτα.
 *
 * ⚠️ Και το ίδιο πέρασμα λύνει τη **δεύτερη** αστοχία: η απόστροφος της ελληνικής
 * *(«γι' αυτό»)* μέσα σε σχόλιο JSX άνοιγε συμβολοσειρά που δεν έκλεινε ποτέ, οπότε η
 * ετικέτα καταβροχθιζόταν και ένα υπαρκτό `suggestions=` **δεν φαινόταν**.
 */
/** Κωδικοί χαρακτήρων — γραμμένοι έτσι ώστε καμία διαφυγή να μη χρειάζεται. */
const LINE_FEED = 10;
const BACKSLASH = 92;

function blankCommentsAndStrings(source: string): string {
  const out = source.split('');
  const n = source.length;
  const blank = (i: number): void => {
    if (source.charCodeAt(i) !== LINE_FEED) out[i] = ' ';
  };
  let i = 0;
  while (i < n) {
    const ch = source[i];
    const next = source[i + 1];
    if (ch === '/' && next === '/') {
      while (i < n && source.charCodeAt(i) !== LINE_FEED) blank(i++);
      continue;
    }
    if (ch === '/' && next === '*') {
      blank(i++); blank(i++);
      while (i < n && !(source[i] === '*' && source[i + 1] === '/')) blank(i++);
      if (i < n) { blank(i++); blank(i++); }
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      blank(i++);
      while (i < n) {
        if (source.charCodeAt(i) === BACKSLASH) {
          blank(i++);
          if (i < n) blank(i++);
          continue;
        }
        if (source[i] === ch) { blank(i++); break; }
        blank(i++);
      }
      continue;
    }
    i++;
  }
  return out.join('');
}

/**
 * Το άνοιγμα ετικέτας JSX που ξεκινά στο `start`.
 *
 * ⚠️ **Μετρά αγκύλες**, δεν σταματά στο πρώτο `>`: μια prop όπως
 * `onSave={() => save(a > b)}` θα έκοβε την ετικέτα στη μέση και η πύλη θα έχανε ένα
 * `suggestions=` που **υπάρχει**.
 */
function readOpeningTag(source: string, start: number): string {
  let depth = 0;
  for (let i = start; i < source.length; i++) {
    const ch = source[i];
    if (ch === '{') depth++;
    else if (ch === '}') depth--;
    else if (ch === '>' && depth === 0) return source.slice(start, i + 1);
  }
  return source.slice(start);
}

function collectMountSites(): MountSite[] {
  const sites: MountSite[] = [];
  for (const absolute of collectSourceFiles(SRC_ROOT)) {
    const source = blankCommentsAndStrings(fs.readFileSync(absolute, 'utf8'));
    const file = path.relative(process.cwd(), absolute).split(path.sep).join('/');
    for (const match of source.matchAll(MOUNT_TAG)) {
      sites.push({ file, openingTag: readOpeningTag(source, match.index ?? 0) });
    }
  }
  return sites;
}

const MOUNT_SITES = collectMountSites();

// ============================================================================
// ΟΙ ΔΙΑΒΕΒΑΙΩΣΕΙΣ
// ============================================================================

describe('ADR-332 D25 — η αφετηρία εγγύτητας φτάνει σε κάθε οθόνη που τη ζητά', () => {
  it('η σάρωση βρίσκει τα σημεία μονταρίσματος (κανάρι άδειας σάρωσης)', () => {
    expect(MOUNT_SITES.length).toBeGreaterThanOrEqual(KNOWN_MOUNT_SITE_COUNT);
  });

  it('κάθε σημείο μονταρίσματος ή δηλώνει αφετηρία, ή είναι δηλωμένη εξαίρεση', () => {
    const undeclared = MOUNT_SITES
      .filter((site) => !DECLARES_ANCHOR.test(site.openingTag))
      .map((site) => site.file)
      .filter((file) => !EXEMPTIONS.has(file));

    expect(undeclared).toEqual([]);
  });

  it('καμία εξαίρεση δεν έχει μπαγιατέψει — κάθε μία δείχνει σε υπαρκτό σημείο μονταρίσματος', () => {
    const mountedFiles = new Set(MOUNT_SITES.map((site) => site.file));
    const stale = [...EXEMPTIONS.keys()].filter((file) => !mountedFiles.has(file));

    expect(stale).toEqual([]);
  });

  it('καμία εξαίρεση δεν αντιφάσκει — εξαιρεμένος που ΠΕΡΝΑ αφετηρία σημαίνει «σβήσε την εξαίρεση»', () => {
    const contradicting = MOUNT_SITES
      .filter((site) => EXEMPTIONS.has(site.file) && DECLARES_ANCHOR.test(site.openingTag))
      .map((site) => site.file);

    expect(contradicting).toEqual([]);
  });
});

// ============================================================================
// Ο ΛΟΓΟΣ ΤΗΣ ΠΑΛΙΑΣ ΕΞΑΙΡΕΣΗΣ ΕΠΑΨΕ — και η ΑΝΤΙΣΤΡΟΦΗ του φυλάγεται
// ============================================================================

/**
 * 🔑 Ως τις 2026-09-11 εδώ **εκτελούνταν** ο λόγος των δύο εξαιρέσεων («το `CompanyAddress`
 * δεν έχει θέση»). ⚠️ Με την κληρονομιά `extends StoredAddressPosition` εκείνη η regex
 * (πεδίο `coordinates:` **μέσα** στο σώμα) θα έμενε **πράσινη** — σιωπηλό ψέμα. Γι' αυτό
 * αντικαταστάθηκε από την **αντίστροφη** διαβεβαίωση: οι διευθύνσεις επαφών **έχουν** θέση,
 * άρα κάθε οθόνη επαφών **οφείλει** αφετηρία (και η πρώτη ενότητα το ελέγχει).
 */
describe('ADR-332 D27 Β-ΙΙ — οι διευθύνσεις επαφών ΚΡΑΤΟΥΝ θέση', () => {
  it('το CompanyAddress κληρονομεί StoredAddressPosition ⇒ καμία οθόνη επαφών δεν εξαιρείται', () => {
    const source = fs.readFileSync(path.join(SRC_ROOT, 'types', 'ContactFormTypes.ts'), 'utf8');
    expect(source).toMatch(/export interface CompanyAddress\s+extends[^{]*\bStoredAddressPosition\b/);
    expect([...EXEMPTIONS.keys()].filter((file) => file.includes('/contacts/'))).toEqual([]);
  });
});
