/**
 * SSoT — **basename ενός asset που δηλώνει ένα ξένο αρχείο** (ADR-736).
 *
 * Κάθε format που εισάγουμε αναφέρει τα βοηθητικά του αρχεία ως **διαδρομές γραμμένες σε
 * άλλο μηχάνημα**: το COLLADA `<init_from>` (ADR-690/691), το DXF `IMAGEDEF` group 1
 * (ADR-736). Ο browser **δεν μπορεί να ανοίξει** καμία από αυτές — δεν έχει πρόσβαση σε
 * `F:\` ή `Z:\`. Άρα η διαδρομή είναι **δύο πράγματα και τίποτα άλλο**:
 *   1. κείμενο προς εμφάνιση («από πού ήρθε»), και
 *   2. ένα **basename** που αντιστοιχίζεται με τα `File` που έδωσε ο χρήστης.
 *
 * ⚠️ **Δεν είναι path sanitizer.** Το `lib/security/path-sanitizer.ts` είναι `server-only`
 * και επικυρώνει **Firebase Storage** διαδρομές έναντι allowlist (`companies/`…), απορρίπτοντας
 * κάθε backslash. Είναι σωστό για τον σκοπό του και **δομικά ακατάλληλο** εδώ: ούτε εισάγεται
 * σε Web Worker/browser, ούτε δέχεται `Z:\Jobs\…`. Η διάκριση είναι ουσιώδης — εδώ **ποτέ δεν
 * αγγίζεται filesystem**, οπότε δεν υπάρχει επιφάνεια path traversal· υπάρχει μόνο ταύτιση
 * ονόματος. Ό,τι καταλήγει σε Storage path περνά από τους `buildXxxPath` builders.
 *
 * **Γιατί υπάρχει (N.0.2, μετρημένο 2026-07-30):** η ίδια συνάρτηση ήταν γραμμένη **τρεις
 * φορές**, με **τρεις διαφορετικές απαντήσεις** στην ίδια ερώτηση:
 *   · `collada-to-glb.textureBasename`        — regex, lowercase, **χωρίς decode, χωρίς `file://`**
 *   · `import-foreign-textures.baseNameDecoded` — decode, **χωρίς `file://`**
 *   · `dae-material-parse.baseName`            — decode + `file://` + backslashes  ← η πλήρης
 * Και δύο δίδυμα ευρετηρίου (`indexImagesByBasename` / `indexImagesByName`). Το DXF θα ήταν το
 * **τέταρτο** — γι' αυτό η ερώτηση απαντιέται εδώ, μία φορά.
 *
 * ⚠️ **Η ενοποίηση είναι διόρθωση, όχι ισοπέδωση:** το `textureBasename` έχανε το decode, ενώ
 * ο `ColladaLoader` δίνει **percent-encoded URL**. Δηλαδή ελληνικό ή με-κενό όνομα υφής
 * (`Ξερό-bark 21.jpg` → `%CE%9E…%2021.jpg`) **δεν ταίριαζε ποτέ** με το OS-decoded `File.name`
 * → σιωπηλά άβαφη όψη. Ακριβώς η κλάση σφάλματος που το ADR-691 τεκμηρίωνε στο *άλλο* μονοπάτι.
 *
 * @see io/mesh3d-roundtrip/collada-to-glb.ts        — καταναλωτής (.dae → .glb)
 * @see io/mesh3d-material-import/import-foreign-textures.ts — καταναλωτής (υφές → υλικά)
 * @see io/dxf-external-reference-resolver.ts        — καταναλωτής (DXF συνημμένα)
 */

/**
 * Το τελευταίο segment μιας ξένης διαδρομής/URI, **με την πεζότητά του άθικτη** (για εμφάνιση).
 *
 * Τρία βήματα, με αυτή τη σειρά:
 *  1. **decode** percent-encoding — το COLLADA `<init_from>` είναι URI κατά RFC 3986 και ο C4D
 *     γράφει `my%20wood.png` / `%CE%BE…`. Malformed `%` → κρατά το raw (guarded, ποτέ throw).
 *  2. αφαίρεση `file://` prefix — ο C4D γράφει `file:///F:/…`.
 *  3. κανονικοποίηση `\` → `/` και λήψη του τελευταίου segment — καλύπτει Windows (`Z:\a\b.jpg`),
 *     UNC (`\\NAS\Public\b.jpg`) και POSIX (`textures/b.jpg`) με έναν κανόνα.
 *
 * Κενό αποτέλεσμα (διαδρομή που τελειώνει σε διαχωριστικό) → επιστρέφει την είσοδο αυτούσια,
 * ώστε ο καλών να έχει πάντα κάτι να δείξει.
 */
export function foreignAssetBasename(pathOrUri: string): string {
  let decoded = pathOrUri;
  try {
    decoded = decodeURIComponent(pathOrUri);
  } catch {
    /* malformed % → κράτα το raw· η ταύτιση ονόματος αξίζει περισσότερο από ένα throw */
  }
  const clean = decoded.replace(/^file:\/+/i, '').replace(/\\/g, '/');
  const parts = clean.split('/');
  return parts[parts.length - 1] || pathOrUri;
}

/**
 * Το ίδιο basename **σε πεζά** — το κλειδί ταύτισης `δηλωμένο όνομα ↔ File.name`.
 *
 * Τα Windows filesystems είναι case-insensitive, οπότε ο τοπογράφος γράφει `dianomi_1.JPG` και
 * στέλνει `dianomi_1.jpg` χωρίς να το αντιληφθεί. Χωρίς πεζοποίηση, η ταύτιση αποτυγχάνει σε
 * αρχείο που **υπάρχει** — η χειρότερη μορφή αποτυχίας, γιατί μοιάζει με «λείπει».
 */
export function foreignAssetBasenameKey(pathOrUri: string): string {
  return foreignAssetBasename(pathOrUri).toLowerCase();
}

/**
 * `basename (πεζά) → File`, από τα αρχεία που επέλεξε ο χρήστης δίπλα στο κύριο αρχείο.
 *
 * Σε διπλό basename (δύο φάκελοι, ίδιο όνομα) **κερδίζει το τελευταίο** — συνειδητή επιλογή:
 * το ευρετήριο είναι για ταύτιση ονόματος, και η επιλογή μεταξύ ομωνύμων δεν λύνεται εδώ αλλά
 * από τον καλούντα (π.χ. ο DXF resolver πέφτει σε ταύτιση διαστάσεων όταν το όνομα διφορούμενο).
 */
export function indexFilesByBasename(files: readonly File[]): Map<string, File> {
  const byName = new Map<string, File>();
  for (const file of files) byName.set(foreignAssetBasenameKey(file.name), file);
  return byName;
}
