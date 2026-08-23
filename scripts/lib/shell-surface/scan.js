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
    };
  }
  return null;
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
    const root = rootElementOf(cleanSource);
    if (!root) return null;
    if (/data-shell-surface|FullBleedSurface/.test(root.tag)) {
      return { state: 'declared-bleed', detail: where };
    }
    if (NEGATIVE_MARGIN.test(root.classAttr)) {
      return { state: 'negative-margin', detail: `${where}: <${root.tag} className="${root.classAttr}">` };
    }
    if (OUTER_PADDING.test(root.classAttr)) {
      return { state: where === 'page.tsx' ? 'page-padding' : 'content-padding',
               detail: `${where}: <${root.tag} className="${root.classAttr}">` };
    }
    return { state: 'clean', detail: where };
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
    if (verdict && verdict.state !== 'clean') return verdict;
    if (verdict) return verdict;
  }

  return own ?? { state: 'unresolved-root', detail: 'δεν βρέθηκε ρίζα JSX' };
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
  NEGATIVE_MARGIN,
  stripComments,
  namedImports,
  resolveAlias,
  rootElementOf,
  classifyPage,
  collectPages,
};
