/**
 * ADR-770 **Στρώμα 2β** — περπάτημα των ΕΚΤΕΛΕΣΜΕΝΩΝ token modules.
 *
 * 🔑 ΓΙΑΤΙ ΥΠΑΡΧΕΙ ΞΕΧΩΡΙΣΤΑ ΑΠΟ ΤΟ `scripts/lib/contrast/ts-token-palette.js`:
 * εκείνο διαβάζει **τι γράφτηκε** (AST — άρα μόνο literal, δηλωμένο όριο Κ5 του CHECK
 * 3.39). Αυτό διαβάζει **τι παράγεται** όταν ο κώδικας **τρέξει**. Δεν είναι διπλότυπο:
 * ίδιο δέντρο, **άλλο μέσο, άλλο ερώτημα** — και η διαφορά των δύο απαντήσεων είναι
 * από μόνη της εύρημα (`ast-runtime-divergence`, βλ. `scripts/lib/contrast/runtime-matrix.js`).
 *
 * ⚠️ ΚΑΜΙΑ ΚΡΙΣΗ ΕΔΩ. Ούτε ταξινόμηση ρόλου, ούτε κατώφλι, ούτε φίλτρο σημασιολογίας:
 * αυτά ζουν **μία φορά**, στο Node, στον υπάρχοντα κριτή. Ο browser είναι
 * **αριθμομηχανή** — επιστρέφει τιμές, δεν έχει γνώμη. Κάθε γραμμή λογικής που
 * προσθέτεις εδώ γεννά δεύτερη αυθεντία για ερώτημα που έχει ήδη απάντηση.
 *
 * ⚠️ Το μονοπάτι παράγεται **ταυτόσημα** με το `ts-token-palette.walkObject`
 * (`exportName.key1.key2`), ώστε οι ταυτότητες των δύο στρωμάτων να **γεφυρώνονται**.
 * Αν αλλάξεις τη μορφή εδώ, σπάει η γεφύρωση σιωπηλά — το test `Ρ1` το φρουρεί.
 */

/** Ένα φύλλο-συμβολοσειρά του δέντρου των tokens, με το πλήρες μονοπάτι του. */
export interface TokenLeaf {
  /** `colors.text.primary` — ίδια μορφή με το `ts-token-palette` */
  readonly path: string;
  /** Η τιμή **όπως τη δηλώνει ο κώδικας** (`#1e293b`, `hsl(var(--card))`, `rgba(0,0,0,.5)`) */
  readonly raw: string;
}

/** Ένα δεύτερο μονοπάτι προς το **ίδιο** αντικείμενο (`designTokens.semanticColors` ≡ `semanticColors`). */
export interface TokenAlias {
  readonly path: string;
  readonly canonical: string;
}

/**
 * Το βάθος είναι φραγμένο επίτηδες. Τα token modules είναι δεδομένα, όχι γράφοι — ένα
 * αντικείμενο 12 επιπέδων σημαίνει σφάλμα, και ένας κυκλικός δεσμός θα κρέμαγε τη
 * σελίδα **σιωπηλά** (η χειρότερη αστοχία: το harness θα «δεν επέστρεφε τιμές»,
 * που μοιάζει με «καθαρό»).
 */
const MAX_DEPTH = 10;

/**
 * Μια τιμή string είναι υποψήφια για χρώμα μόνο αν **μπορεί** να είναι χρώμα.
 * Τα token modules περιέχουν και `'8px'`, `'1fr'`, `'0.2s ease'` — τα κρατάμε έξω
 * εδώ ΜΟΝΟ επειδή είναι δομικά αδύνατο να είναι χρώμα, όχι επειδή κρίνουμε ρόλο.
 *
 * ⚠️ Το `var(--x)` περνά **αναγκαστικά** — δεν μπορούμε να ξέρουμε αν το `--x` κρατά
 * χρώμα χωρίς να το λύσει ο browser. Μετρήθηκε ότι ΔΕΝ κρατά πάντα: το
 * `layoutUtilities.cssVars.contentContainer.padding = 'var(--spacing-4)'` πέρασε από εδώ
 * και ο browser επέστρεψε **χρώμα** — το κληρονομημένο, επειδή το declaration ήταν
 * άκυρο. Γι' αυτό το harness χρησιμοποιεί sentinel: το «άκυρο» πρέπει να **λέγεται**.
 */
const COLOR_SHAPED = /^(#|rgba?\(|hsla?\(|color-mix\(|var\(|oklch\(|lab\(|transparent$|currentColor$)/i;

export function isColorShaped(value: string): boolean {
  return COLOR_SHAPED.test(value.trim());
}

export interface CollectedLeaves {
  readonly leaves: readonly TokenLeaf[];
  /** Δεύτερα μονοπάτια προς το ίδιο αντικείμενο — καταγράφονται, δεν εξαφανίζονται. */
  readonly aliases: readonly TokenAlias[];
  readonly skippedFunctions: readonly string[];
  readonly skippedNonColorStrings: number;
  readonly truncatedAtDepth: readonly string[];
}

/** Το κανονικό μονοπάτι είναι το **κοντότερο** (μετά αλφαβητικά) — ντετερμινιστικό. */
function isShorter(candidate: readonly string[], incumbent: readonly string[]): boolean {
  if (candidate.length !== incumbent.length) return candidate.length < incumbent.length;
  return candidate.join('.') < incumbent.join('.');
}

/**
 * Περπάτησε ένα εξαγόμενο namespace (`import * as designTokens`) και μάζεψε κάθε
 * φύλλο-συμβολοσειρά που **μπορεί** να είναι χρώμα.
 *
 * ΔΥΟ ΠΕΡΑΣΜΑΤΑ, και ο λόγος είναι μετρημένος: το facade **ξανα-εξάγει** τα ίδια
 * αντικείμενα κάτω από δύο ονόματα (`designTokens.semanticColors.status.success` είναι
 * το **ίδιο** αντικείμενο με το `semanticColors.status.success`). Ένα καθολικό
 * `WeakSet` «είδα το αντικείμενο, προσπέρασε» θα κρατούσε **όποιο μονοπάτι τυχαίνει να
 * είναι πρώτο στη σειρά δήλωσης** — δηλαδή η ταυτότητα κάθε δήλωσης θα άλλαζε αν
 * κάποιος αναδιάταζε τα `export` στο facade, και η baseline θα κοκκίνιζε χωρίς αιτία.
 * Πρώτο πέρασμα: ποιο είναι το κανονικό μονοπάτι κάθε αντικειμένου. Δεύτερο: μάζεψε.
 *
 * Οι συναρτήσεις (style factories: `layoutUtilities.dxf.colors.backgroundColor(x)`)
 * **παραλείπονται ρητά** — δεν έχουν τιμή χωρίς ορίσματα, και το να τις καλέσουμε με
 * μαντεμένα ορίσματα θα παρήγαγε αριθμό που δεν αντιστοιχεί σε κανένα πραγματικό
 * σημείο χρήσης. Καταγράφονται ώστε το πλήθος τους να είναι **γραμμένο**, όχι σιωπηλό.
 */
export function collectColorLeaves(namespace: Record<string, unknown>): CollectedLeaves {
  const canonical = new Map<object, string[]>();
  const exportNames = Object.keys(namespace).sort();

  // ── Πέρασμα 1: κανονικό μονοπάτι ανά αντικείμενο ──────────────────────────
  const claim = (node: unknown, segments: readonly string[], depth: number): void => {
    if (node === null || typeof node !== 'object' || depth > MAX_DEPTH) return;
    const seen = canonical.get(node as object);
    if (seen && !isShorter(segments, seen)) return;
    canonical.set(node as object, [...segments]);
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      claim(value, [...segments, key], depth + 1);
    }
  };
  for (const name of exportNames) claim(namespace[name], [name], 1);

  // ── Πέρασμα 2: συλλογή, με ρητά ψευδώνυμα ─────────────────────────────────
  const leaves: TokenLeaf[] = [];
  const aliases: TokenAlias[] = [];
  const skippedFunctions: string[] = [];
  const truncatedAtDepth: string[] = [];
  let skippedNonColorStrings = 0;

  const walk = (node: unknown, segments: readonly string[]): void => {
    const path = segments.join('.');

    if (typeof node === 'string') {
      if (isColorShaped(node)) leaves.push({ path, raw: node });
      else skippedNonColorStrings++;
      return;
    }
    if (typeof node === 'function') {
      skippedFunctions.push(path);
      return;
    }
    if (node === null || typeof node !== 'object') return;

    const canon = canonical.get(node as object);
    if (canon && canon.join('.') !== path) {
      aliases.push({ path, canonical: canon.join('.') });
      return; // τα φύλλα είναι τα ίδια — καταγράφονται μία φορά, κάτω από το κανονικό
    }

    if (segments.length >= MAX_DEPTH) {
      truncatedAtDepth.push(path);
      return;
    }

    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      walk(value, [...segments, key]);
    }
  };
  for (const name of exportNames) walk(namespace[name], [name]);

  leaves.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  return {
    leaves,
    aliases: aliases.sort((a, b) => a.path.localeCompare(b.path)),
    skippedFunctions: skippedFunctions.sort(),
    skippedNonColorStrings,
    truncatedAtDepth: truncatedAtDepth.sort(),
  };
}
