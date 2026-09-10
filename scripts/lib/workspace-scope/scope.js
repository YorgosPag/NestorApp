/**
 * ΤΟ ΚΛΕΙΣΤΟ ΣΥΝΟΛΟ ΤΗΣ ΕΜΒΕΛΕΙΑΣ — ADR-787 §5.3 γ (CHECK 3.60)
 *
 * Απαντά **δύο** ερωτήματα, και τα δύο **παραγόμενα**:
 *   1. *«ποιο είναι το πρόθεμα;»*  → από το **TS SSoT**, ποτέ γραμμένο εδώ
 *   2. *«ποιες διαδρομές είναι εντός εμβέλειας;»* → από το **δέντρο** μείον τις
 *      δηλωμένες εξαιρέσεις
 *
 * ⚠️ **Η ΠΡΟΕΠΙΛΟΓΗ ΕΙΝΑΙ «ΕΝΤΟΣ».** Ό,τι δεν δηλώνεται εξαίρεση, μπαίνει πίσω από
 * το πρόθεμα. Η αντίστροφη κατεύθυνση (λίστα των «εντός») απέτυχε μετρημένα
 * τέσσερις φορές σε αυτό το repo — δες `$whyInverted` στο `.workspace-scope.json`.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..');

/**
 * ⚠️ **Οι διαδρομές είναι ΠΑΡΑΜΕΤΡΙΚΕΣ ως προς τη ρίζα**, και δεν είναι πολυτέλεια:
 * οι άγκυρες μεταλλάσσουν **τις ΕΙΣΟΔΟΥΣ** σε μίνι-repo από **πραγματικά** αρχεία.
 * Με σκληρές διαδρομές, κάθε μετάλλαξη θα διάβαζε το **αληθινό** δέντρο και θα
 * έβγαινε πράσινη **χωρίς να δοκιμάσει τίποτα**.
 */
const scopeFileOf = (root) => path.join(root, '.workspace-scope.json');
const prefixSsotOf = (root) => path.join(root, 'src', 'lib', 'workspace', 'workspace-path.ts');
const appGroupOf = (root) => path.join(root, 'src', 'app', '(app)');

const SCOPE_FILE = scopeFileOf(PROJECT_ROOT);
const PREFIX_SSOT = prefixSsotOf(PROJECT_ROOT);

const toPosix = (p) => p.split(path.sep).join('/');

/**
 * Το πρόθεμα, **διαβασμένο από την αυθεντία**.
 *
 * 🔑 Ίδια κίνηση με το CHECK 3.42, που ρωτά το **ίδιο** το Tailwind αντί να κρατά
 * χάρτη: η αυθεντία απαντά, η πύλη δεν επαναλαμβάνει. Μια δεύτερη γραφή του
 * προθέματος θα ήταν δεύτερη αλήθεια που **αποκλίνει σιωπηλά** (ADR-749).
 *
 * ⚠️ Άρνηση σε αποτυχία, **ποτέ προεπιλογή**: ένα `?? 'o'` θα έκανε την πύλη να
 * κρίνει με φανταστικό πρόθεμα τη μέρα που το SSoT μετακομίσει — δηλαδή θα ήταν
 * πράσινη πάνω σε δέντρο που δεν κοίταξε.
 */
function readPrefix(root = PROJECT_ROOT) {
  const ssot = prefixSsotOf(root);
  const src = fs.readFileSync(ssot, 'utf8');
  const match = src.match(/export const WORKSPACE_PATH_PREFIX\s*=\s*'([^']+)'/);
  if (!match) {
    throw new Error(
      `CHECK 3.60: δεν βρέθηκε το WORKSPACE_PATH_PREFIX στο ${toPosix(path.relative(root, ssot))} — ` +
        'η αυθεντία μετακόμισε ή μετονομάστηκε. ΜΗΝ γράψεις προεπιλογή εδώ.',
    );
  }
  return match[1];
}

/**
 * Οι δηλωμένες εξαιρέσεις, με **υποχρεωτικό λόγο** ανά εγγραφή.
 *
 * ⚠️ Πρότυπο CHECK 3.35/3.50: μια εξαίρεση χωρίς γραμμένο λόγο είναι **σιωπηλή
 * παράλειψη με άλλο όνομα**, και ο επόμενος δεν έχει τρόπο να ξέρει αν ισχύει.
 */
function readScope(root = PROJECT_ROOT) {
  const raw = JSON.parse(fs.readFileSync(scopeFileOf(root), 'utf8'));
  const entries = raw.outsideWorkspace ?? {};
  const outside = new Map();

  for (const [segment, decl] of Object.entries(entries)) {
    const why = decl && typeof decl.why === 'string' ? decl.why.trim() : '';
    if (!why) {
      throw new Error(`CHECK 3.60: η εξαίρεση «${segment}» δεν έχει λόγο — μια δήλωση χωρίς λόγο είναι παράκαμψη με άλλο όνομα`);
    }
    outside.set(segment, why);
  }
  return outside;
}

/** Κάθε `page.tsx` του group `(app)`, ως διαδρομή URL + πρώτο τμήμα. */
function enumerateAppPages(root = PROJECT_ROOT) {
  const appGroup = appGroupOf(root);
  const pages = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name === 'page.tsx') pages.push(full);
    }
  };
  if (!fs.existsSync(appGroup)) return [];
  walk(appGroup);

  return pages.map((file) => {
    const rel = toPosix(path.relative(appGroup, file)).replace(/\/page\.tsx$/, '');
    const segments = rel.split('/').filter((s) => s && !/^\(.*\)$/.test(s) && !/^@/.test(s));
    return {
      file: toPosix(path.relative(root, file)),
      url: `/${segments.join('/')}`,
      firstSegment: segments[0] ?? '',
    };
  });
}

/**
 * Η πλήρης εικόνα: πρόθεμα · εξαιρέσεις · ποιες σελίδες είναι εντός/εκτός.
 *
 * ⚠️ Επιστρέφει και τα **ορφανά**: εξαίρεση δηλωμένη για φάκελο που **δεν
 * υπάρχει** πια. Χωρίς αυτό, το κλειστό σύνολο θα μεγάλωνε για πάντα με νεκρές
 * γραμμές, και κάθε νεκρή γραμμή είναι ένα όνομα που ο χρήστης **δεν** μπορεί
 * να πάρει χωρίς λόγο.
 */
function buildScope(root = PROJECT_ROOT) {
  const prefix = readPrefix(root);
  const outside = readScope(root);
  const pages = enumerateAppPages(root);

  const inside = [];
  const excluded = [];
  const seenSegments = new Set();

  for (const page of pages) {
    seenSegments.add(page.firstSegment);
    if (outside.has(page.firstSegment)) excluded.push(page);
    else inside.push(page);
  }

  const orphanDeclarations = [...outside.keys()].filter((s) => !seenSegments.has(s));

  return { prefix, outside, pages, inside, excluded, orphanDeclarations };
}

/**
 * Ο **μετασχηματισμός ταυτότητας**: `/x/y` → `/o/{alias}/x/y`, **μόνο** εντός εμβέλειας.
 *
 * 🔑 Είναι ο **ίδιος** κανόνας που εφαρμόζει το `workspacePath()` του TS SSoT.
 * Ο ισομορφισμός (CHECK 3.60) τον χρησιμοποιεί για να ξεχωρίσει τη **ΜΕΤΑΚΙΝΗΣΗ**
 * από την **ΠΑΛΙΝΔΡΟΜΗΣΗ**: αν κάθε παλιά ταυτότητα αντιστοιχεί σε ακριβώς μία
 * νέα και αντίστροφα, τίποτα δεν κρύφτηκε.
 *
 * ⚠️ Ένα `url` που είναι **ήδη** προθεματισμένο επιστρέφεται ως έχει — αλλιώς η
 * επαναληπτική εφαρμογή θα έδινε `/o/a/o/a/x` και ο ισομορφισμός θα κατήγγελλε
 * παλινδρόμηση πάνω σε **σωστό** δέντρο.
 */
function shiftUrl(url, { prefix, outside, alias }) {
  const segments = url.split('/').filter(Boolean);
  if (segments[0] === prefix) return url;
  if (!segments.length) return url;
  if (outside.has(segments[0])) return url;
  return `/${prefix}/${alias}${url}`;
}

// =============================================================================
// Κ3 — ΕΝΑ ΤΜΗΜΑ, ΕΝΑΣ ΙΔΙΟΚΤΗΤΗΣ (ADR-843 §10.19 · ADR-787)
// =============================================================================

const appDirOf = (root) => path.join(root, 'src', 'app');

/** `(group)` — φάκελος οργάνωσης, **δεν** εμφανίζεται ποτέ στη διεύθυνση. */
const isRouteGroup = (name) => /^\(.*\)$/.test(name);
/** `[id]` · `[...rest]` · `[[...opt]]` — **σχήμα** διαδρομής, ποτέ κυριολεκτικό τμήμα. */
const isDynamicSegment = (name) => name.startsWith('[');
/** `_folder` — ιδιωτικός φάκελος του Next.js: **έξω από τις διαδρομές**. */
const isPrivateFolder = (name) => name.startsWith('_');

/**
 * Τα **κυριολεκτικά** τμήματα διαδρομής ακριβώς κάτω από `dir`, με τους φακέλους που
 * τα γεννούν (`Map<τμήμα, διαδρομές-φακέλων>`).
 *
 * ⚠️ **Κατεβαίνει ΜΕΣΑ στα route groups** αντί να τα μετρήσει: το `(me)/first-contacts`
 * σερβίρει `/first-contacts`. Ίδια σύμβαση με την άγκυρα Ε1 του
 * `src/lib/workspace/__tests__/workspace-scope.test.ts` — και ίδιο μάθημα με τη CHECK
 * 3.52, που ήταν δομικά τυφλή στο `(light)` επειδή έκρινε `pathname`.
 */
function literalSegmentsUnder(dir, root = PROJECT_ROOT) {
  const found = new Map();
  if (!fs.existsSync(dir)) return found;

  const walk = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const full = path.join(current, entry.name);
      if (isRouteGroup(entry.name)) {
        walk(full);
        continue;
      }
      if (isDynamicSegment(entry.name) || isPrivateFolder(entry.name)) continue;
      const homes = found.get(entry.name) ?? [];
      homes.push(toPosix(path.relative(root, full)));
      found.set(entry.name, homes);
    }
  };
  walk(dir);
  return found;
}

/**
 * Ο φάκελος του **χώρου**: `(app)/<πρόθεμα>/<το ΕΝΑ δυναμικό τμήμα>` — `null` αν δεν
 * υπάρχει ακόμη (μίνι-repo χωρίς χώρο).
 *
 * ⚠️ **Το όνομα της παραμέτρου ΔΕΝ γράφεται εδώ** (`[workspace]`): βρίσκεται από τον
 * δίσκο, όπως το πρόθεμα από το TS SSoT. **Άρνηση** αν δεν είναι ακριβώς ένα — δύο
 * δυναμικά τμήματα κάτω από το πρόθεμα θα σήμαιναν ότι δεν ξέρουμε **ποιο** είναι ο
 * χώρος, και μια μαντεψιά θα έκανε την πύλη πράσινη πάνω σε λάθος δέντρο.
 */
function workspaceTreeOf(root = PROJECT_ROOT, prefix = readPrefix(root)) {
  const prefixDir = path.join(appGroupOf(root), prefix);
  if (!fs.existsSync(prefixDir)) return null;

  const dynamic = fs
    .readdirSync(prefixDir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && isDynamicSegment(e.name));
  if (dynamic.length !== 1) {
    throw new Error(
      `CHECK 3.60: κάτω από το /${prefix} περιμένω ΑΚΡΙΒΩΣ ένα δυναμικό τμήμα (το ψευδώνυμο του χώρου) — ` +
        `βρέθηκαν ${dynamic.length}. ΜΗΝ μαντέψεις ποιο είναι ο χώρος.`,
    );
  }
  return path.join(prefixDir, dynamic[0].name);
}

/**
 * **Τμήματα με ΔΥΟ ιδιοκτήτες** — κορυφαίο τμήμα **έξω** από τον χώρο που υπάρχει
 * **και** ως παιδί του χώρου.
 *
 * 🔴 **ΓΙΑΤΙ ΥΠΑΡΧΕΙ — ΖΩΝΤΑΝΗ ΒΛΑΒΗ 2026-09-04 → 09-10**: το `(me)/contacts` πήρε το
 * τμήμα των επαφών του **γραφείου** (`o/[workspace]/contacts`). Ο κριτής χρόνου
 * εκτέλεσης (`isInsideWorkspace`) απαντά **ανά τμήμα**, άρα ένας από τους δύο χάνει
 * **πάντα**: έχανε το γραφείο, και ο υπάλληλος έβλεπε τις ιδιωτικές του επαφές.
 * ⚠️ **Το Next.js ΔΕΝ το πιάνει**: μπλοκάρει μόνο **ίδιο URL** σε δύο groups
 * (`/contacts` ≠ `/o/x/contacts`). Οι πέντε άγκυρες που το έπιασαν ζούσαν μόνο στο CI,
 * που ήταν ήδη μονίμως κόκκινο — **άγκυρα χωρίς πύλη είναι σχόλιο** (ADR-587 §6.1).
 */
function routeSegmentCollisions(root = PROJECT_ROOT) {
  const tree = workspaceTreeOf(root);
  if (tree === null) return [];

  const inside = literalSegmentsUnder(tree, root);
  const tops = literalSegmentsUnder(appDirOf(root), root);

  const collisions = [];
  for (const [segment, outsideHomes] of tops) {
    if (!inside.has(segment)) continue;
    collisions.push({ segment, outside: outsideHomes, inside: inside.get(segment) });
  }
  return collisions.sort((a, b) => a.segment.localeCompare(b.segment));
}

module.exports = {
  PROJECT_ROOT,
  SCOPE_FILE,
  PREFIX_SSOT,
  scopeFileOf,
  prefixSsotOf,
  appGroupOf,
  readPrefix,
  readScope,
  enumerateAppPages,
  buildScope,
  shiftUrl,
  literalSegmentsUnder,
  workspaceTreeOf,
  routeSegmentCollisions,
};
