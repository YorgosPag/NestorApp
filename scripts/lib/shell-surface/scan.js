/**
 * ΣΑΡΩΤΗΣ ΤΟΥ ΔΙΑΔΡΟΜΟΥ — «ποιος δηλώνει κενό που δεν του ανήκει;» (ADR-797)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΤΟ ΚΡΙΤΗΡΙΟ, ΚΑΙ ΓΙΑΤΙ ΕΙΝΑΙ ΑΥΤΟ
 * ─────────────────────────────────────────────────────────────────────────────
 * Κρίνεται **ΜΟΝΟ η ΡΙΖΑ** — το εξωτερικότερο JSX στοιχείο που επιστρέφει η
 * σελίδα ή το πρώτο της component περιεχομένου. Και ο λόγος είναι **μετρημένος**:
 * μια πρώτη, χονδροειδής γραφή έψαχνε `p-*` **οπουδήποτε** στο δέντρο εισαγωγών
 * και έδωσε **18 ευρήματα**, από τα οποία τα περισσότερα ήταν ψευδώς θετικά —
 * `FrameworkAgreementFormDialog` (**διάλογος**), `MaterialDetail` (**πλαϊνό
 * ταμπλό**), και δύο που «βρήκαν» το `p-*` μέσα στο ίδιο το `lib/design-system.ts`.
 *
 * Το κενό **μέσα** σε κάρτα, διάλογο ή ταμπλό είναι `spacing.component.*` και
 * είναι **σωστό**. Παραβίαση είναι μόνο το κενό **γύρω** από τη σελίδα, γιατί
 * εκείνο το δίνει ήδη το κέλυφος: *«outer spacing is a layout concern, not a
 * component one»*.
 *
 * ⚠️ **ΜΗΝ** το χαλαρώσεις σε «ψάξε παντού»: μετρήθηκε >60% ψευδώς θετικά, πολύ
 * πάνω από τον πήχη <10% για **μπλοκάρουσα** πύλη.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΔΗΛΩΜΕΝΟ ΟΡΙΟ
 * ─────────────────────────────────────────────────────────────────────────────
 * Ακολουθεί **ΕΝΑ άλμα** (σελίδα → πρώτο component περιεχομένου), ποτέ μεταβατικό
 * κλείσιμο. Μια σελίδα που τυλίγει το περιεχόμενό της σε **τρίτο** ενδιάμεσο
 * component με δικό του `p-*` **δεν** πιάνεται. Αυτό μετριέται, δεν κρύβεται:
 * η κατάσταση `unresolved-root` το λέει με **όνομα**.
 *
 * ⚠️ Το `stripComments` **αφαιρεί**, δεν προσθέτει — γι' αυτό είναι ασφαλές να
 * τρέξει πριν το κριτήριο: τα σχόλια αυτού του repo τεκμηριώνουν τη βλάβη με τη
 * λέξη-δείκτη μέσα τους, και χωρίς αφαίρεση η πύλη θα κοκκίνιζε πάνω στη
 * **θεραπεία** (μάθημα CHECK 3.50 / άγκυρα Κ7β).
 */

'use strict';

const fs = require('fs');
const path = require('path');

/** Κλάσεις που δηλώνουν **εξωτερικό** κενό. Το `py-*` ΔΕΝ είναι εδώ: ο κάθετος
 *  ρυθμός μιας σελίδας είναι δική της απόφαση και δεν ανταγωνίζεται την μπάρα. */
const OUTER_PADDING = /(?:^|[\s"'`{])(p|px|pl|pr)-(?:\d+|\[[^\]]+\])/;

/**
 * Χειρόγραφο ταβάνι πλάτους στη **ρίζα** μιας σελίδας (ADR-797 ΦΑΣΗ Β).
 *
 * 🔑 **ΔΕΥΤΕΡΟΣ, ΑΝΕΞΑΡΤΗΤΟΣ ΑΞΟΝΑΣ — ΟΧΙ ΑΛΛΗ ΚΑΤΑΣΤΑΣΗ.** Μια σελίδα μπορεί
 * να είναι **καθαρή** ως προς το κενό και ταυτόχρονα να γράφει δικό της πλάτος·
 * αν οι δύο ερωτήσεις μοιράζονταν μία κατάσταση, η μία θα **έκρυβε** την άλλη
 * (μάθημα CHECK 3.41, και ακριβώς το σφάλμα που το `Κ2` του CHECK 3.64 φυλά).
 *
 * ⚠️ Μετρημένο 2026-08-25: **17 από 143** ρίζες (11,9%) — άρα **ratchet**, όχι
 * zero-tolerance. Οκτώ διακριτές τιμές (`xs`·`md`·`lg`·`2xl`·`3xl`·`5xl`·`6xl`·
 * `7xl`) χωρίς καμία κλίμακα από πίσω. ⚠️ Η πιο συχνή (`3xl`) δίνει **80,1ch**
 * καθαρού κειμένου — ΟΧΙ «85 χαρακτήρες»: το 85 ήταν το **ΔΟΧΕΙΟ** (768px, μαζί
 * με το `p-6`), και το `ch` δεν είναι χαρακτήρας ούτως ή άλλως (ADR-797 §Β.11).
 * Το ζητούμενο εδώ **δεν** είναι το πλάτος αλλά **ποιος το αποφασίζει**: οκτώ
 * χειρόγραφες τιμές είναι οκτώ ευκαιρίες να αποκλίνουν.
 */
const HANDWRITTEN_MEASURE = /(?:^|[\s"'`{])(max-w-(?:\[[^\]]+\]|[a-z0-9]+))/;

/**
 * Η υπογραφή μιας **ΚΑΡΤΑΣ**: περίγραμμα **και** στρογγυλεμένη γωνία.
 *
 * 🔑 ΓΙΑΤΙ ΧΡΕΙΑΖΕΤΑΙ ΞΕΧΩΡΙΣΤΗ ΚΑΤΑΣΤΑΣΗ (ADR-797 ΦΑΣΗ Β)
 * Ο κανόνας του ADR είναι *«outer spacing is a **layout** concern»*. Όταν όμως η
 * ρίζα μιας σελίδας **ΕΙΝΑΙ** μια κάρτα (`/mandate/[token]`: όλο το περιεχόμενο
 * είναι ένα πλαίσιο συγκατάθεσης), το `p-6` της **δεν** είναι εξωτερικό κενό —
 * είναι το εσωτερικό κενό της κάρτας, δηλαδή `spacing.component.*`, δηλαδή
 * **σωστό**. Να το κατηγορήσεις σημαίνει να ζητάς από κάποιον να το σβήσει, και
 * τότε το κείμενο ακουμπά το **περίγραμμα**.
 *
 * ⚠️ Μετρημένο 2026-08-25 πριν προστεθεί: **1 στις 15** μπλοκάρουσες (6,7%) —
 * δηλαδή ήταν **γνήσιο** ψευδώς θετικό, όχι υποθετικό. Και τα άλλα 14 έχουν ρίζα
 * **κουτί διάταξης** (`container`, `mx-auto max-w-*`, `min-h-screen`), κανένα
 * με περίγραμμα.
 *
 * ⚠️ Απαιτούνται **ΚΑΙ ΤΑ ΔΥΟ** (`border` + `rounded-*`), επίτηδες συντηρητικά:
 * με σκέτο `bg-card` θα έπιανε κάθε επιφάνεια που απλώς βάφεται, και η εξαίρεση
 * θα γινόταν **έξοδος διαφυγής** αντί για διάκριση.
 */
const CARD_ROOT = /(?:^|[\s"'`{])border(?:-|$|[\s"'`}])/;
const ROUNDED = /(?:^|[\s"'`{])rounded-/;

/** Κλάσεις που τραβούν το περιεχόμενο **έξω** από τον διάδρομο — σιωπηλό opt-out. */
const NEGATIVE_MARGIN = /(?:^|[\s"'`{])-m(?:x|l|r)?-(?:\d+|\[[^\]]+\])/;

/**
 * Αφαιρεί σχόλια block και γραμμής, κρατώντας το μήκος-γραμμών ουδέτερο ως προς
 * το κριτήριο (δεν χρειάζεται να διατηρηθούν θέσεις — κρίνεται περιεχόμενο).
 */
function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
}

/** Τα named imports ενός αρχείου, με τη σειρά που εμφανίζονται. */
function namedImports(source) {
  const out = [];
  const re = /import\s*(?:type\s*)?\{([^}]+)\}\s*from\s*['"]([^'"]+)['"]/g;
  let m;
  while ((m = re.exec(source))) {
    const names = m[1]
      .split(',')
      .map((s) => s.trim().split(/\s+as\s+/)[0].trim())
      .filter(Boolean);
    out.push({ names, spec: m[2] });
  }
  return out;
}

/** Λύνει ένα `@/...` σε πραγματικό αρχείο, ή `null`. */
function resolveAlias(spec, repoRoot) {
  if (!spec.startsWith('@/')) return null;
  const base = path.join(repoRoot, 'src', spec.slice(2));
  for (const ext of ['.tsx', '.ts', `${path.sep}index.tsx`, `${path.sep}index.ts`]) {
    const candidate = base + ext;
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

/**
 * Το τέλος του σώματος μιας δήλωσης: η **επόμενη δήλωση σε στήλη 0**, ή το EOF.
 *
 * 🔴 Η ΠΡΩΤΗ ΓΡΑΦΗ ΕΨΑΧΝΕ «`}` ΣΕ ΣΤΗΛΗ 0» ΚΑΙ ΕΣΠΑΣΕ ΑΜΕΣΩΣ. Ο prettier
 * γράφει το κλείσιμο ενός **πολυγραμμικού destructuring παραμέτρων** επίσης σε
 * στήλη 0:
 *
 *     function ListingDetailBody({
 *       listing,
 *       backHref,
 *     }: {                      ← αυτό το `}` δεν είναι το τέλος του σώματος
 *
 * Αποτέλεσμα: σώμα **53 χαρακτήρων** αντί για ολόκληρο το component, άρα καμία
 * ρίζα, άρα σιωπηλή πτώση πίσω στην παλιά — λάθος — συμπεριφορά. Το έπιασε
 * μόνο η μέτρηση, γιατί τίποτα δεν έσπασε: η πύλη απλώς **δεν κοίταξε**.
 */
function bodyEnd(cleanSource, start) {
  const rest = cleanSource.slice(start + 1);
  const next = rest.search(/^(?:export\s|(?:async\s+)?function\s|const\s|interface\s|type\s)/m);
  return next < 0 ? cleanSource.length : start + 1 + next;
}

/**
 * Το σώμα του **εξαγόμενου** component ενός αρχείου: `[αρχή, τέλος)`.
 *
 * 🔴 ΓΙΑΤΙ ΧΡΕΙΑΣΤΗΚΕ — ΜΕΤΡΗΜΕΝΟ ΨΕΥΔΩΣ ΘΕΤΙΚΟ (ADR-797 ΦΑΣΗ Β)
 * Η ΦΑΣΗ Α έκρινε το **τελευταίο `return` του ΑΡΧΕΙΟΥ**, με ρητή παραδοχή ότι
 * «τα βοηθητικά γράφονται από πάνω και το default export κλείνει το αρχείο».
 * Η παραδοχή μετρήθηκε: ως προς την **ετυμηγορία** ισχύει σε **155 από 156**
 * αρχεία — αλλά όχι ως προς **ποιο στοιχείο κατηγορείται**. Στο
 * `ListingDetailContent.tsx` το τελευταίο `return` του αρχείου είναι το
 * `ListingOffers`: μια **ΚΑΡΤΑ**, της οποίας το `p-4` είναι `spacing.component.*`
 * και είναι **απολύτως σωστό**. Μόλις η πραγματική ρίζα καθαρίστηκε, η πύλη
 * συνέχισε να κοκκινίζει — **πάνω στη θεραπεία**.
 *
 * Ένας φρουρός που κατηγορεί νόμιμο κώδικα είναι ο δρόμος προς το `SKIP_`.
 */
function exportedBody(cleanSource) {
  const hits = [...cleanSource.matchAll(/^export\s+(?:default\s+)?(?:async\s+)?function\s+(\w*)/gm)];
  if (hits.length === 0) return null;
  // Προτίμηση στο `export default` — είναι το component της διαδρομής.
  const chosen = hits.find((h) => /export\s+default/.test(h[0])) ?? hits[0];
  return { name: chosen[1], start: chosen.index, end: bodyEnd(cleanSource, chosen.index) };
}

/** Το σώμα ενός **τοπικού** component του ίδιου αρχείου, ή `null`. */
function localBody(cleanSource, name) {
  const re = new RegExp(`^(?:export\\s+)?(?:async\\s+)?function\\s+${name}\\b`, 'm');
  const m = cleanSource.match(re);
  if (!m || m.index === undefined) return null;
  return { name, start: m.index, end: bodyEnd(cleanSource, m.index) };
}

/**
 * Βρίσκει το **πρώτο** JSX άνοιγμα μετά το τελευταίο `return (` ενός αρχείου —
 * δηλαδή τη ρίζα που αποδίδεται.
 *
 * Επιστρέφει `{ tag, classAttr }` ή `null` αν δεν βρεθεί ρίζα.
 */
function rootElementOf(cleanSource) {
  // 🔴 Η ΠΡΩΤΗ ΓΡΑΦΗ ΕΨΑΧΝΕ ΜΟΝΟ `return (` ΚΑΙ ΗΤΑΝ ΤΥΦΛΗ ΣΤΟ 67%.
  //    Μετρημένο σε 139 σελίδες: **93 `unresolved-root`** — δηλαδή η πύλη θα
  //    γεννιόταν σχεδόν ανενεργή, και το «δεν βρήκα» θα διαβαζόταν «καθαρό».
  //    Αιτία: το κυρίαρχο ιδίωμα εδώ είναι `return <Foo />;` **χωρίς**
  //    παρενθέσεις — και μια σελίδα-κέλυφος δύο γραμμών δεν τις χρειάζεται.
  const returns = [...cleanSource.matchAll(/\breturn\s*(?=[(<])/g)];
  if (returns.length === 0) return null;

  // Κρίνεται το **τελευταίο** `return` του αρχείου: τα βοηθητικά components
  // γράφονται από πάνω και το default export κλείνει το αρχείο. Ρητή παραδοχή —
  // όταν δεν ισχύει, το χειρότερο που συμβαίνει είναι να κριθεί βοηθητικό
  // component, το οποίο **επίσης** δεν επιτρέπεται να δηλώνει εξωτερικό κενό.
  for (let i = returns.length - 1; i >= 0; i -= 1) {
    const tail = cleanSource.slice(returns[i].index);
    // Το πρώτο άνοιγμα στοιχείου μετά το `return`, αγνοώντας fragments (`<>`):
    // ένα fragment δεν φέρει className, οπότε η ρίζα είναι το πρώτο του παιδί.
    const open = tail.match(/<\s*([A-Za-z][\w.]*)\b([^>]*?)\/?>/);
    if (!open) continue;

    const attrs = open[2] || '';
    const cls = attrs.match(
      /className\s*=\s*(?:"([^"]*)"|'([^']*)'|\{`([^`]*)`\}|\{([^}]*)\})/,
    );
    return {
      tag: open[1],
      classAttr: cls ? (cls[1] ?? cls[2] ?? cls[3] ?? cls[4] ?? '') : '',
      // ⚠️ ΤΑ ΩΜΑ ATTRIBUTES ΤΑΞΙΔΕΥΟΥΝ ΜΑΖΙ, ΚΑΙ ΕΙΝΑΙ ΑΠΑΡΑΙΤΗΤΑ: η δήλωση
      //    `data-shell-surface="bleed"` δεν είναι κλάση ούτε όνομα στοιχείου.
      //    Η ΦΑΣΗ Α την αναγνώριζε **μόνο** από το tag (`<FullBleedSurface>`) ή
      //    από σάρωση όλου του `page.tsx` — οπότε μια σελίδα που τη δήλωνε στο
      //    **component περιεχομένου** της (ο χάρτης του `/search/results`)
      //    διαβαζόταν ως απλή σελίδα και θα έπαιρνε διάδρομο πάνω στον καμβά.
      attrs: attrs.trim(),
    };
  }
  return null;
}

/**
 * Η ρίζα που αποδίδει ο **εξαγόμενος** component, με **ΕΝΑ** άλμα εντός αρχείου.
 *
 * Το άλμα υπάρχει γιατί το ιδίωμα εδώ είναι `return <Body … />` σε τοπικό
 * component — γραμμένο ρητά ώστε ο ενορχηστρωτής να απαντά *«σε ποια κατάσταση
 * είμαστε;»* και το σώμα *«πώς μοιάζει»* (όριο 40 γραμμών, N.7.1). Χωρίς το άλμα
 * η πύλη θα έκρινε τον **ενορχηστρωτή**, που δεν φέρει ποτέ κλάσεις διάταξης.
 *
 * ⚠️ **ΕΝΑ άλμα, ΠΟΤΕ σταθερό σημείο** — ίδιο συμβόλαιο με το άλμα ανάμεσα σε
 * αρχεία. Αλυσίδα δύο ενδιαμέσων παραμένει `unresolved-root`: **δηλωμένο** τυφλό
 * σημείο με αριθμό, ποτέ σιωπηλό «καθαρό».
 */
function exportedRootOf(cleanSource) {
  const body = exportedBody(cleanSource);
  if (!body) return null;

  const slice = cleanSource.slice(body.start, body.end);
  const root = rootElementOf(slice);
  if (!root) return null;

  // Άλμα: η ρίζα είναι τοπικό component του ΙΔΙΟΥ αρχείου (κεφαλαίο αρχικό).
  if (/^[A-Z]/.test(root.tag) && !root.classAttr) {
    const inner = localBody(cleanSource, root.tag);
    if (inner && inner.start !== body.start) {
      const innerRoot = rootElementOf(cleanSource.slice(inner.start, inner.end));
      if (innerRoot) return innerRoot;
    }
  }
  return root;
}

/**
 * Κρίνει ΕΝΑ page.tsx.
 *
 * Καταστάσεις:
 *   `clean`            — η ρίζα δεν δηλώνει εξωτερικό κενό.
 *   `page-padding`     — η ίδια η σελίδα δηλώνει `p-*`/`px-*`.
 *   `content-padding`  — το component περιεχομένου της το δηλώνει.
 *   `negative-margin`  — σιωπηλό opt-out με αρνητικό περιθώριο.
 *   `declared-bleed`   — δηλωμένο opt-out (νόμιμο).
 *   `unresolved-root`  — ΔΕΝ βρέθηκε ρίζα· δηλωμένο τυφλό σημείο, ΟΧΙ «καθαρό».
 */
function classifyPage(pageFile, repoRoot) {
  const raw = fs.readFileSync(pageFile, 'utf8');
  const src = stripComments(raw);

  if (/data-shell-surface\s*=\s*["']bleed["']|<\s*FullBleedSurface\b/.test(src)) {
    return { state: 'declared-bleed', detail: 'το ίδιο το page.tsx δηλώνει bleed' };
  }

  const judge = (cleanSource, where) => {
    // Πρώτα η ρίζα **κατά εξαγωγή**· πτώση πίσω στην παλιά συμπεριφορά όταν το
    // αρχείο δεν ακολουθεί τη σύμβαση μορφοποίησης — ποτέ χειρότερα από πριν.
    const root = exportedRootOf(cleanSource) ?? rootElementOf(cleanSource);
    if (!root) return null;
    if (/FullBleedSurface/.test(root.tag)
        || /data-shell-surface\s*=\s*["']bleed["']/.test(root.attrs || '')) {
      return { state: 'declared-bleed', detail: where };
    }
    if (NEGATIVE_MARGIN.test(root.classAttr)) {
      return { state: 'negative-margin', detail: `${where}: <${root.tag} className="${root.classAttr}">` };
    }
    // 🔑 Ο ΔΕΥΤΕΡΟΣ ΑΞΟΝΑΣ ΤΑΞΙΔΕΥΕΙ ΜΑΖΙ, ΠΟΤΕ ΩΣ ΚΑΤΑΣΤΑΣΗ. Το χειρόγραφο
    //    πλάτος δεν αποκλείει το χειρόγραφο κενό, ούτε το αντίστροφο· μία
    //    κατάσταση για τα δύο θα έκρυβε το ένα πίσω από το άλλο.
    const mw = HANDWRITTEN_MEASURE.exec(root.classAttr);
    const measure = mw ? { klass: mw[1], where, tag: root.tag } : null;

    if (OUTER_PADDING.test(root.classAttr)) {
      // ⚠️ Η ΣΕΙΡΑ ΚΡΙΣΗΣ ΕΙΝΑΙ ΣΥΜΒΟΛΑΙΟ: η κάρτα κρίνεται **πριν** ονομαστεί
      //    παραβίαση. Αντίστροφα, μια σελίδα-κάρτα θα κατηγορούνταν για το
      //    εσωτερικό της κενό, και η «διόρθωση» θα κολλούσε το κείμενο στο
      //    περίγραμμα — φρουρός που ζητά χειροτέρευση.
      if (CARD_ROOT.test(root.classAttr) && ROUNDED.test(root.classAttr)) {
        return { state: 'component-root', detail: `${where}: <${root.tag}> είναι ΚΑΡΤΑ — το κενό της είναι spacing.component`, measure };
      }
      return { state: where === 'page.tsx' ? 'page-padding' : 'content-padding',
               detail: `${where}: <${root.tag} className="${root.classAttr}">`, measure };
    }
    return { state: 'clean', detail: where, measure };
  };

  const own = judge(src, 'page.tsx');
  if (own && own.state !== 'clean') return own;

  // ΕΝΑ άλμα: το πρώτο component περιεχομένου που εισάγει η σελίδα.
  for (const imp of namedImports(src)) {
    const target = resolveAlias(imp.spec, repoRoot);
    if (!target) continue;
    const used = imp.names.some((n) => new RegExp(`<\\s*${n}\\b`).test(src));
    if (!used) continue;

    const childSrc = stripComments(fs.readFileSync(target, 'utf8'));
    const verdict = judge(childSrc, path.relative(repoRoot, target).split(path.sep).join('/'));
    // ⚠️ Το ταβάνι πλάτους της **σελίδας** δεν χάνεται όταν την κρίση την παίρνει
    //    το παιδί: κρατιέται ό,τι βρέθηκε πρώτο (η σελίδα υπερισχύει).
    if (verdict) return { ...verdict, measure: own?.measure ?? verdict.measure };
  }

  return own ?? { state: 'unresolved-root', detail: 'δεν βρέθηκε ρίζα JSX', measure: null };
}

/** Απαριθμεί τα `page.tsx` κάτω από μια ρίζα. */
function collectPages(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) collectPages(p, out);
    else if (e.name === 'page.tsx') out.push(p);
  }
  return out;
}

module.exports = {
  OUTER_PADDING,
  HANDWRITTEN_MEASURE,
  CARD_ROOT,
  ROUNDED,
  exportedBody,
  localBody,
  exportedRootOf,
  NEGATIVE_MARGIN,
  stripComments,
  namedImports,
  resolveAlias,
  rootElementOf,
  classifyPage,
  collectPages,
};
