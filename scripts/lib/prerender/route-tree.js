#!/usr/bin/env node
/**
 * =============================================================================
 * CHECK 3.55 (ADR-785) — Η ΙΕΡΑΡΧΙΑ ΤΗΣ ΔΙΑΔΡΟΜΗΣ
 * =============================================================================
 *
 * Απαντά **ένα** ερώτημα: *«όταν το Next προαποδίδει αυτή τη σελίδα, υπάρχει
 * ήδη όριο `<Suspense>` ΠΑΝΩ της;»* — πριν καν κοιτάξει κανείς το περιεχόμενό της.
 *
 * 🔴 **ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ ΓΕΝΝΗΘΗΚΕ ΑΠΟ ΜΕΤΡΗΣΗ ΠΟΥ ΑΝΕΤΡΕΨΕ ΤΟ ΠΡΟΦΑΝΕΣ ΚΡΙΤΗΡΙΟ.**
 * Το αφελές «περιέχει `<Suspense>` το αρχείο της σελίδας;» έδινε **8 ευρήματα**,
 * από τα οποία **7 ψευδώς θετικά (87%)**: οι επτά σελίδες `procurement` κάθονται
 * κάτω από το `src/app/(app)/loading.tsx`, και ένα `loading.tsx` **ΕΙΝΑΙ** όριο
 * `<Suspense>` — το δημιουργεί το ίδιο το Next γύρω από το τμήμα. Το build
 * συμφώνησε: ονόμασε **μόνο** το `/auth/action`, τη μοναδική από τις οκτώ που
 * ζει σε ομάδα (`(auth)`) **χωρίς** `loading.tsx`.
 *
 * Ο πήχης της Google για μπλοκάρουσα πύλη είναι **<10%** ψευδώς θετικά. Χωρίς
 * αυτό το αρχείο η πύλη θα γεννιόταν στο **87%** — δηλαδή θόρυβος, δηλαδή `SKIP_`.
 *
 * ⚠️ **Η ΟΜΑΔΑ ΔΙΑΔΡΟΜΗΣ ΕΙΝΑΙ ΦΑΚΕΛΟΣ, ΟΧΙ URL** (ίδιο μάθημα με το CHECK 3.52):
 * το `(app)` δεν εμφανίζεται ποτέ στη διεύθυνση, αλλά **ορίζει** ποιο `loading.tsx`
 * και ποιο `layout.tsx` τυλίγει τη σελίδα. Η ιεραρχία διαβάζεται από τον **ΔΙΣΚΟ**,
 * ποτέ από λίστα διαδρομών.
 * =============================================================================
 */

'use strict';

const path = require('node:path');

/** Η είσοδος της πύλης (ADR-924) — προεπιλογή ο δίσκος της ρίζας· ο εκτελεστής δίνει την όψη του commit. */
const inputOf = (root) => require('../gate-input').openGateInput({ root });

const APP_DIR = path.join('src', 'app');

const { toPosix } = require('../posix-path'); // SSoT (ADR-924 §8.9)

/**
 * ΟΙ ΡΙΖΕΣ ΠΟΥ ΠΡΟΑΠΟΔΙΔΟΝΤΑΙ — και ΓΙΑΤΙ δεν είναι μόνο οι σελίδες.
 *
 * 🔴 Η τεκμηρίωση του Next είναι ρητή και **αλλάζει το μοντέλο**: το `loading.js`
 * «*wraps `not-found.js`, `page.js`, and nested `layout.js` files*» αλλά «***does
 * not** wrap the `layout.js`, `template.js`, or `error.js` **in the same
 * segment***». Άρα ένα layout που καλεί το ίδιο εχθρικό API **δεν σώζεται** από
 * το `loading.tsx` του **δικού του** τμήματος — μόνο από πρόγονο. Μια πύλη που
 * κοιτάζει μόνο `page.tsx` θα ήταν **τυφλή** σε ολόκληρη αυτή την κλάση.
 */
const ROOT_KINDS = Object.freeze({
  page: { pattern: /^page\.[jt]sx$/, ownSegmentLoadingGuards: true },
  layout: { pattern: /^layout\.[jt]sx$/, ownSegmentLoadingGuards: false },
  template: { pattern: /^template\.[jt]sx$/, ownSegmentLoadingGuards: false },
  'not-found': { pattern: /^not-found\.[jt]sx$/, ownSegmentLoadingGuards: true },
});

/** Κάθε προαποδιδόμενη ρίζα κάτω από το `src/app`, με την αλυσίδα προγόνων της. */
function enumerateRoots(projectRoot, input = inputOf(projectRoot)) {
  // ADR-924 Φ3 — από την ΕΙΣΟΔΟ (ήταν δικός του `readdirSync`)· `abs` στη μορφή της πλατφόρμας, όπως πριν.
  const kindOf = name => Object.keys(ROOT_KINDS).find(k => ROOT_KINDS[k].pattern.test(name));
  const found = input.files([APP_DIR], { accept: rel => Boolean(kindOf(rel.slice(rel.lastIndexOf('/') + 1))) })
    .map(abs => ({ abs: path.resolve(abs), kind: kindOf(path.basename(abs)) }));
  return found.sort((a, b) => a.abs.localeCompare(b.abs)).map(item => describeRoot(projectRoot, item));
}

/** `src/app/(auth)/auth/action/page.tsx` → `{ file, kind, url, ancestors }`. */
function describeRoot(projectRoot, { abs, kind }) {
  const rel = toPosix(path.relative(projectRoot, abs));
  const segments = rel
    .replace(/^src\/app/, '')
    .replace(/\/[a-z-]+\.[jt]sx$/, '')
    .split('/')
    .filter(segment => segment !== '' && !/^\(.*\)$/.test(segment));
  const url = segments.length === 0 ? '/' : `/${segments.join('/')}`;
  return { file: rel, kind, url, ancestors: ancestorDirs(projectRoot, abs) };
}

/** Οι φάκελοι από το `src/app` μέχρι και τον φάκελο της σελίδας, σε σειρά. */
function ancestorDirs(projectRoot, absFile) {
  const appRoot = path.join(projectRoot, APP_DIR);
  const out = [];
  let dir = path.dirname(absFile);
  while (dir.length >= appRoot.length) {
    out.unshift(toPosix(path.relative(projectRoot, dir)));
    if (dir === appRoot) break;
    dir = path.dirname(dir);
  }
  return out;
}

function firstExisting(projectRoot, dirRel, basenames, input = inputOf(projectRoot)) {
  for (const base of basenames) {
    for (const ext of ['tsx', 'jsx']) {
      const rel = `${dirRel}/${base}.${ext}`;
      if (input.exists(rel)) return rel;
    }
  }
  return null;
}

/**
 * Ο φρουρός της διαδρομής, με **ονομασμένη αιτία** — ποτέ σκέτο boolean.
 *
 * Δύο νόμιμες πηγές, και οι δύο **πάνω** από τη σελίδα:
 *   · `loading.tsx` σε οποιοδήποτε πρόγονο τμήμα (το Next φτιάχνει το όριο)·
 *   · `layout.tsx` που γράφει το ίδιο `<Suspense>{children}</Suspense>`.
 *
 * @param {(rel: string) => object} readModule αναλυτής module (lazy, cached)
 */
function routeGuard(projectRoot, root, readModule, input = inputOf(projectRoot)) {
  const ownSegment = root.ancestors[root.ancestors.length - 1];
  const ownCounts = ROOT_KINDS[root.kind].ownSegmentLoadingGuards;
  for (const dir of root.ancestors) {
    const isOwn = dir === ownSegment;
    const loading = firstExisting(projectRoot, dir, ['loading'], input);
    if (loading && (ownCounts || !isOwn)) return { guarded: true, reason: `loading:${loading}` };
    // Ένα layout δεν φρουρεί ΤΟΝ ΕΑΥΤΟ ΤΟΥ: το `{children}` του είναι η σελίδα.
    if (isOwn && root.kind === 'layout') continue;
    const layout = firstExisting(projectRoot, dir, ['layout'], input);
    if (layout && layout !== root.file && layoutWrapsChildren(readModule(layout))) {
      return { guarded: true, reason: `layout-suspense:${layout}` };
    }
  }
  return { guarded: false, reason: null };
}

/**
 * `{children}` κάτω από `<Suspense>` οπουδήποτε μέσα στο layout.
 *
 * ⚠️ Κρίνεται η **θέση του `{children}`**, όχι η παρουσία `<Suspense>` στο αρχείο:
 * ένα layout που τυλίγει σε όριο **κάτι άλλο** (π.χ. μια μπάρα) δεν φρουρεί
 * τίποτα από τη σελίδα. Η διαφορά είναι ολόκληρη η ορθότητα της πύλης.
 */
function layoutWrapsChildren(mod) {
  if (!mod) return false;
  for (const local of mod.locals.values()) if (local.childrenGuarded) return true;
  return false;
}

/** `export const dynamic = 'force-dynamic'` στη ρίζα ή σε πρόγονο layout. */
function routeOptOut(projectRoot, root, readModule, input = inputOf(projectRoot)) {
  const own = readModule(root.file);
  if (own && own.dynamicOptOut) return root.file;
  for (const dir of root.ancestors) {
    const layout = firstExisting(projectRoot, dir, ['layout'], input);
    const mod = layout && layout !== root.file ? readModule(layout) : null;
    if (mod && mod.dynamicOptOut) return layout;
  }
  return null;
}

module.exports = {
  enumerateRoots, describeRoot, ancestorDirs, routeGuard, routeOptOut,
  layoutWrapsChildren, firstExisting, toPosix, APP_DIR, ROOT_KINDS,
};
