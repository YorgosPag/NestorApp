#!/usr/bin/env node
/**
 * ADR-744 §4 — the reviewed part.
 *
 * Everything else in this folder is derived automatically; this file is where a
 * human states the handful of decisions a parser cannot make. Two of them earn
 * their place:
 *
 *   extraShellRoots     the walk cuts at `next/dynamic`. If evidence ever shows
 *                       a lazily-chunked surface flashing a raw key, name it
 *                       here instead of following every dynamic edge (which
 *                       measured 7.492 files / 2,93 MB — the whole application).
 *
 *   dynamicKeyPolicy    `t(step.titleKey)` cannot be resolved from its own file.
 *                       The generator REFUSES to emit until every such call site
 *                       is listed here with a reason. That refusal is the whole
 *                       design: an unclassified dynamic key is exactly how a raw
 *                       key reaches the screen, and silence would hide it.
 *
 * Defaults live in code, not in the JSON, so a deleted config file degrades to
 * "the documented behaviour" rather than to "no shell at all".
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { parseDeclaration, parseRouteDeclaration } = require('./ledger');
const { parseShellDeclaration, parseSeal } = require('./shell-census');

const CONFIG_FILE = '.i18n-shell-slice.json';

const DEFAULTS = Object.freeze({
  /**
   * What renders without a route transition to hide behind.
   *
   * A `**` pattern rather than a list, on purpose: a new nested layout joins the
   * shell the moment it is created, with no config edit. An enumerated list is
   * exactly the rot this ADR exists to remove — it would go stale the same way
   * `CRITICAL_NAMESPACES` did.
   *
   * Η **μία ΣΕΛΙΔΑ** του συνόλου δικαιολογείται από ένα κριτήριο, όχι από τη
   * διεύθυνσή της: είναι η **ψυχρή είσοδος** (URL `/`), όπου φτάνει κανείς **χωρίς
   * προηγούμενη πλοήγηση**, άρα τίποτα δεν κουβαλά κατάσταση φόρτωσης γι' αυτήν.
   * Βαθύτερες διαδρομές μένουν έξω — η κάλυψή τους σημαίνει per-route slices, που
   * αυτή η μηχανή ήδη υποστηρίζει (ADR-744 §8, Φ4).
   *
   * ⚠️ ADR-777 §8.12 — ΤΟ ΜΟΝΟΠΑΤΙ ΑΛΛΑΞΕ ΜΕ ΤΗ ΜΕΤΑΚΟΜΙΣΗ ΤΟΥ ΚΕΛΥΦΟΥΣ. Ένα route
   * group είναι ΦΑΚΕΛΟΣ και δεν εμφανίζεται στο URL. Το πρώτο pattern βρίσκει μόνο
   * του κάθε νέο layout· το δεύτερο είναι ΚΥΡΙΟΛΕΚΤΙΚΟ και ενημερώνεται με το χέρι —
   * και το `resolveRoots` (plan.js:76) **ΠΕΤΑΕΙ** «shell root not found» αν δεν
   * υπάρχει, δηλαδή η αστοχία είναι ΘΟΡΥΒΩΔΗΣ, όχι σιωπηλή. Μην αφαιρέσεις τον φρουρό.
   *
   * 🔴 **ADR-777 §8.13 — Η ΨΥΧΡΗ ΕΙΣΟΔΟΣ ΑΛΛΑΞΕ ΚΑΤΟΧΟ, ΟΧΙ ΚΡΙΤΗΡΙΟ.** Το `/`
   * σέρβιρε το ταμπλό (`(app)/page.tsx`) και ανακατεύθυνε κάθε ανώνυμο στη σύνδεση.
   * Πλέον σερβίρει τη **δημόσια** οθόνη αναζήτησης (`(light)/page.tsx`) — που είναι
   * **η πραγματική ψυχρή είσοδος του προϊόντος**: εκεί προσγειώνεται ο επισκέπτης του
   * nestorconstruct.gr, χωρίς καμία προηγούμενη πλοήγηση. Το `/dashboard` βγήκε από το
   * σύνολο **επίτηδες**: φτάνει κανείς μετά από σύνδεση, δηλαδή **με** μετάβαση, και
   * τα namespaces του (`common`·`navigation`·`dashboard`) ταξιδεύουν ούτως ή άλλως
   * ολόκληρα από το μητρώο μετανάστευσης — άρα η αφαίρεση κοστίζει **μηδέν bytes**.
   * ⚠️ Ο φρουρός **λειτούργησε**: η μετακίνηση του αρχείου έκανε τον generator να
   * **αρνηθεί** να παραγάγει, αντί να βγάλει σιωπηλά μικρότερο slice.
   */
  shellRoots: ['src/app/**/layout.tsx', 'src/app/(light)/page.tsx'],
  extraShellRoots: [],

  /**
   * Namespaces that ship whole regardless of what the closure derives.
   *
   * A MIGRATION LEDGER, NOT A SECOND LIST. Each entry is a namespace that was
   * synchronous before ADR-744 and that the derived closure does not reach, so
   * emitting the slice without it would trade one class of raw key for another.
   * It differs from the list this ADR deletes in the only way that matters: it
   * is small, it is reasoned, the generator prints its byte cost on every run,
   * and it is meant to reach zero when per-route slices land.
   */
  guaranteedNamespaces: {},

  /**
   * ADR-744 §23 — **ΤΟ ΑΛΛΟ ΜΙΣΟ ΤΟΥ ΚΕΛΥΦΟΥΣ.** Τα namespaces που ταξιδεύουν
   * **ΚΟΜΜΕΝΑ ΣΤΟ ΚΛΕΙΔΙ**, δηλαδή όσα φέρνει η **κλειστότητα** και όχι μια δήλωση.
   *
   * 🔴 Μέχρι τις 2026-09-04 ΔΕΝ ΤΑ ΦΥΛΑΓΕ ΚΑΝΕΙΣ: ο μόνος φρουρός μετρούσε τα
   * `wholeNs` (≤10), δηλαδή το **άλλο μισό**. Ένα `import` έριξε δύο ολόκληρα
   * namespaces στο κέλυφος με την πύλη πράσινη. Βλ. `shell-census.js`.
   *
   * ⚠️ Σχήμα `{ dragger, reason }` — **ποτέ bytes**: το key-sliced μέρος μεγαλώνει
   * ακριβώς όταν κάποιος **θεραπεύει** ωμό κλειδί.
   */
  shellNamespaces: {},

  /**
   * ADR-744 §23 — η **σφράγιση του πλήθους** (Κ2). Μέτρηση με ημερομηνία και λόγο,
   * ποτέ προτίμηση· **μόνο συρρικνώνεται**.
   */
  shellNamespacesSeal: { count: 0, at: '1970-01-01', why: 'αδήλωτο — ο generator δεν έχει τρέξει ποτέ με απογραφή' },

  // el ONLY, deliberately. `getInitialLanguage()` in src/i18n/config.ts returns
  // DEFAULT_LANGUAGE unconditionally (to avoid an SSR/CSR mismatch) and
  // fallbackLng is the same 'el', so the synchronous `en` half of today's
  // bootstrap — 147 KB of the 295 KB — can never be read before the async
  // preload has already replaced it. A language switch goes through
  // changeLanguage() → preloadCriticalNamespaces(), which awaits.
  languages: ['el'],

  localesDir: 'src/i18n/locales',
  outputDir: 'src/i18n/generated',

  // Registered constant trees whose leaves ARE i18n keys, so `t(CONST.a.b)`
  // resolves instead of forcing a whole-namespace fallback.
  //
  // ⚠️ ΖΕΙ ΕΔΩ, ΟΧΙ ΣΤΟ JSON, ΚΑΙ ΕΙΝΑΙ ΣΚΟΠΙΜΟ: το `loadConfig` κάνει **ρηχή**
  // συγχώνευση, οπότε ένα `keyConstants` στο `.i18n-shell-slice.json` θα ΑΝΤΙΚΑΘΙΣΤΟΥΣΕ
  // αυτόν τον πίνακα — δηλαδή θα έσβηνε σιωπηλά τις υπόλοιπες εγγραφές. Μια δεύτερη
  // λίστα που αποκλίνει από την πρώτη είναι ακριβώς το σχήμα των δύο λιστών namespace
  // (CHECK 3.34, απόκλιση 63). Μία λίστα, εδώ.
  //
  // 🔴 PROPERTY_TYPE_I18N_KEYS — ADR-777 §8.36 βήμα 1. Είναι
  // `Record<PropertyTypeCanonical, string>` (ΟΧΙ Partial) με **14 ΚΥΡΙΟΛΕΚΤΙΚΕΣ** τιμές,
  // όλες κάτω από `types.`· νέο κανονικό είδος **ΣΠΑΕΙ ΤΗ ΜΕΤΑΓΛΩΤΤΙΣΗ** αν δεν πάρει
  // γραμμή, άρα ο πίνακας δεν μπορεί να αποκλίνει σιωπηλά από το union. Ο μοναδικός
  // δυναμικός καταναλωτής του στο κέλυφος/τις φόρμες είναι το
  // `t(\`properties-enums:${PROPERTY_TYPE_I18N_KEYS[type]}\`)` — τα **14 ωμά κλειδιά**
  // που βάφουν οι τρεις οθόνες ακινήτου στο πρώτο καρέ.
  keyConstants: [
    { file: 'src/config/notification-keys.ts', exportName: 'NOTIFICATION_KEYS' },
    { file: 'src/constants/property-types.ts', exportName: 'PROPERTY_TYPE_I18N_KEYS' },
  ],

  // The i18n plumbing forwards `t(key, options)`; it is not a consumer, and its
  // doc comments contain example `useTranslation([...])` calls.
  excludeConsumers: ['src/i18n/'],

  dynamicKeyPolicy: {},

  /**
   * ADR-744 §8 Φ4 — PER-ROUTE SLICES. `{ '<page.tsx>': { reason } }`.
   *
   * Κάθε εγγραφή είναι **δήλωση με λόγο**: αυτή η σελίδα ζητά κλειδιά που το
   * κέλυφος δεν έχει, και το artifact της οφείλει να μένει φρέσκο. Το σύνολο
   * είναι **κλειστό επίτηδες** — η αυτόματη σάρωση «όλες οι σελίδες» μετρήθηκε
   * και δίνει **131** ανεπίλυτες δυναμικές `t()` που θα έπρεπε να δικαιολογηθούν
   * μία-μία (§8). Ο generator **ΑΡΝΕΙΤΑΙ** να εκπέμψει route slice με ανεπίλυτη
   * κλήση, ακριβώς όπως και για το κέλυφος.
   */
  routeSlices: {},
});

function readJsonIfPresent(file) {
  if (!fs.existsSync(file)) return {};
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    throw new Error(`${CONFIG_FILE} is not valid JSON: ${error.message}`);
  }
}

/** Rejects an unknown top-level field rather than ignoring it — a typo'd key must not read as "no policy". */
function assertKnownFields(raw) {
  const unknown = Object.keys(raw).filter(key => !(key in DEFAULTS) && !key.startsWith('$'));
  if (unknown.length > 0) {
    throw new Error(`${CONFIG_FILE}: unknown field(s) ${unknown.join(', ')}`);
  }
}

function loadConfig(projectRoot) {
  const raw = readJsonIfPresent(path.join(projectRoot, CONFIG_FILE));
  assertKnownFields(raw);
  const config = { ...DEFAULTS, ...raw };
  // ⚠️ ADR-777 §8.38 — το σχήμα του μητρώου κρίνεται ΕΔΩ, στη φόρτωση, ώστε ΚΑΘΕ
  // καταναλωτής (generator · CHECK 3.34 · tests) να παίρνει την ίδια άρνηση. Μια
  // δήλωση-συμβολοσειρά («~1,6 KB») δεν είναι προϋπολογισμός· βλ. ledger.js.
  for (const [namespace, value] of Object.entries(config.guaranteedNamespaces)) {
    parseDeclaration(namespace, value);
  }
  // ⚠️ ADR-777 §8.43 — ΤΟ ΙΔΙΟ ΓΙΑ ΤΟΝ ΑΔΕΛΦΟ. Το `routeSlices` δήλωνε μόνο `reason` ενώ
  // ο μηχανισμός του είναι ΑΦΑΙΡΕΣΗ: ένα slice που ξεπερνά το κέλυφος δεν είναι σελίδα,
  // είναι δεύτερο κέλυφος. Μετρημένο: το `/properties/[id]` θα ήταν 145,2% του κελύφους.
  // 🔴 ADR-744 §20 — ΚΑΙ ΤΟ ΣΧΗΜΑ ΤΟΥ ΑΛΛΑΞΕ: δηλώνεται ΜΕΤΡΗΣΗ (`sealed`) με αλυσίδα
  // αιτιολογίας (`history`) που ΚΛΕΙΝΕΙ αριθμητικά· το ταβάνι ΥΠΟΛΟΓΙΖΕΤΑΙ. Ένα σκέτο
  // `budget` απορρίπτεται ΕΔΩ, στη φόρτωση, ώστε καμία διαδρομή κώδικα να μη δει ποτέ
  // τα δύο σχήματα ταυτόχρονα — δύο σχήματα είναι δύο λίστες που αποκλίνουν.
  for (const [page, value] of Object.entries(config.routeSlices)) {
    parseRouteDeclaration(page, value);
  }
  // 🔴 ADR-744 §23 — ΚΑΙ ΤΟ ΤΡΙΤΟ ΚΑΤΑΣΤΙΧΟ, ΓΙΑ ΤΟΝ ΙΔΙΟ ΛΟΓΟ: η άρνηση ζει στη
  // ΦΟΡΤΩΣΗ, ώστε generator · CHECK 3.34 · tests να δουν την ΙΔΙΑ. Μια δήλωση χωρίς
  // `dragger` δεν διαψεύδεται ποτέ — είναι το «~1,6 KB» με άλλο ρούχο.
  for (const [namespace, value] of Object.entries(config.shellNamespaces)) {
    parseShellDeclaration(namespace, value);
  }
  parseSeal(config.shellNamespacesSeal);
  return config;
}

/** `{ns: 'x', key: 'a.b'}` from either `'x:a.b'` or a bare `'a.b'` (which means "every namespace the file declares"). */
function parsePolicyEntry(entry) {
  const cut = entry.indexOf(':');
  return cut === -1 ? { ns: null, key: entry } : { ns: entry.slice(0, cut), key: entry.slice(cut + 1) };
}

/**
 * The policy for one shell file, normalized. A file with unresolved dynamic
 * calls and no entry here yields `null`, which the generator treats as fatal.
 */
function policyFor(config, relFile) {
  const entry = config.dynamicKeyPolicy[relFile];
  if (!entry) return null;
  return {
    wholeNamespaces: entry.wholeNamespaces || [],
    prefixes: (entry.prefixes || []).map(parsePolicyEntry),
    keys: (entry.keys || []).map(parsePolicyEntry),
    reason: entry.reason || '',
  };
}

module.exports = { CONFIG_FILE, DEFAULTS, loadConfig, parsePolicyEntry, policyFor, assertKnownFields };
