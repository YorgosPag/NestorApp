/**
 * @fileoverview **«Ποια είναι η δημόσια διεύθυνσή μας;»** — χωρίς αίτημα, χωρίς εξαρτήσεις.
 * @module lib/http/public-origin
 * @see lib/http/request-origin — η εκδοχή **με** αίτημα, που πέφτει και σε κεφαλίδα
 * @see ADR-848 — ο σύνδεσμος του email ειδοποίησης
 * @see ADR-853 §19 — **η διεύθυνση των ΔΥΑΔΙΚΩΝ είναι άλλο ερώτημα** από τη διεύθυνση των
 *      συνδέσμων· εδώ ζουν και οι δύο απαντήσεις, ώστε να μη γίνουν ποτέ δύο αρχεία
 *
 * 🔑 **ΓΙΑΤΙ ΞΕΧΩΡΙΣΤΟ ΑΡΧΕΙΟ ΑΠΟ ΤΟ `request-origin`**: εκείνο εισάγει το `next/server`
 * (για το `redirectTo`). Ο αποστολέας email, τα πρότυπα email και οι άγκυρές τους **δεν
 * έχουν** αίτημα και **δεν πρέπει** να τραβούν τον runtime του Next για να διαβάσουν μία
 * μεταβλητή περιβάλλοντος. Εδώ ζει ο **πυρήνας** — και το `request-origin` τον εισάγει,
 * ώστε ο κανόνας «env πρώτα, κόψε τις καθέτους» να είναι γραμμένος **μία** φορά.
 *
 * ⚠️ **ΜΗΝ το ενώσεις με το `getPublicBaseUrl()`** (`lib/oauth/oauth-config.ts`): εκείνο
 * **πετά** σε production, γιατί ένα token χωρίς issuer δεν έχει νόημα. Ένα email χωρίς
 * σύνδεσμο **έχει**: λέει ακόμη τι συνέβη.
 */

/**
 * **Η δημόσια διεύθυνση αυτής της εγκατάστασης, από το env** — ή `null`.
 *
 * ⚠️ **Το `null` ΕΙΝΑΙ Η ΥΠΗΡΕΣΙΑ.** Ο καλών οφείλει να φτιάξει email **χωρίς**
 * σύνδεσμο — ποτέ σχετικό (`/n/…` μέσα σε email δεν ανοίγει πουθενά) και ποτέ
 * μαντεμένο (`http://localhost:3000` μοιάζει έγκυρο και δεν ανοίγει ποτέ).
 */
export function publicOrigin(): string | null {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!configured) return null;

  const withoutSlash = configured.replace(/\/+$/, '');
  return withoutSlash.length > 0 ? withoutSlash : null;
}

/** Origin + διαδρομή με **ακριβώς μία** κάθετο ανάμεσα — ένας κανόνας, όλοι οι καταναλωτές. */
export function joinOrigin(origin: string, path: string): string {
  return path.startsWith('/') ? `${origin}${path}` : `${origin}/${path}`;
}

/** Απόλυτο URL πάνω στο {@link publicOrigin} — `null` αν δεν ξέρουμε ποιοι είμαστε. */
export function publicUrl(path: string): string | null {
  const origin = publicOrigin();
  return origin === null ? null : joinOrigin(origin, path);
}

/**
 * Η δημόσια διεύθυνση — ή **ορατή αποτυχία**, για πράξεις που **ΕΙΝΑΙ** ο σύνδεσμός τους.
 *
 * 🔑 **ΠΟΤΕ ΝΑ ΤΟ ΠΡΟΤΙΜΗΣΕΙΣ ΑΠΟ ΤΟ `publicOrigin()`**: όταν το αποτέλεσμα **χωρίς**
 * σύνδεσμο δεν έχει νόημα. Μια πρόσκληση προμηθευτή είναι ο σύνδεσμός της: δεν υπάρχει
 * «μισή πρόσκληση» να σταλεί. Ένα email ειδοποίησης **έχει** νόημα χωρίς σύνδεσμο — εκεί
 * χρησιμοποιείς το `publicOrigin()` και **παραλείπεις** τη γραμμή.
 *
 * ⛔ **Καλύτερα να κοκκινίσει η πράξη παρά να φύγουν άχρηστα email** — ίδιο δόγμα με το
 * `onboarding-reminder.job`, και ο λόγος που δεν επιστρέφουμε εδώ `null`: ένα `null` που
 * κανείς δεν κοιτάζει γίνεται σιωπηλά κενή συμβολοσειρά, δηλαδή **σχετικός** σύνδεσμος.
 *
 * ⚠️ **ΔΕΝ είναι το `getPublicBaseUrl()` του OAuth**: εκείνο πετά **μόνο σε production**
 * και ανήκει στη ροή έκδοσης token. Αυτό πετά **όποτε δεν ξέρουμε ποιοι είμαστε**, με
 * μήνυμα που ονομάζει **ποια** πράξη χάθηκε (ADR-853 §19.7).
 */
export function requirePublicOrigin(purpose: string): string {
  const origin = publicOrigin();
  if (origin === null) {
    throw new Error(
      `Η δημόσια διεύθυνση της εφαρμογής δεν έχει ρυθμιστεί (NEXT_PUBLIC_APP_URL) — ${purpose}`,
    );
  }
  return origin;
}

// ============================================================================
// ΤΑ ΔΥΑΔΙΚΑ — **ΑΛΛΟ ΕΡΩΤΗΜΑ** ΑΠΟ ΤΟΥΣ ΣΥΝΔΕΣΜΟΥΣ (ADR-853 §19)
// ============================================================================

/**
 * 🔑 **ΓΙΑΤΙ ΔΕΥΤΕΡΗ ΕΡΩΤΗΣΗ ΚΑΙ ΟΧΙ ΔΕΥΤΕΡΟΣ ΑΝΑΓΝΩΣΤΗΣ ΤΗΣ ΙΔΙΑΣ.**
 *
 * Το `publicOrigin()` απαντά *«πού στέλνω τον **άνθρωπο**;»*. Τα `<img src>` ενός email
 * ρωτούν *«από πού κατεβαίνουν τα **δυαδικά**;»*. Οι δύο απαντήσεις **συμπίπτουν μόνο
 * στην παραγωγή** — και επειδή τους συνδέσμους τους δοκιμάζει ο άνθρωπος, η κοινή
 * μεταβλητή ρυθμίζεται πάντα υπέρ τους *(στο dev: `http://localhost:3000`)*.
 *
 * 🔴 **Ο μηχανισμός που το κάνει μοιραίο**: το Gmail **δεν** ζητά την εικόνα από τον
 * παραλήπτη. Ο διακομιστής της Google την κατεβάζει με την άφιξη και τη σερβίρει από το
 * `googleusercontent.com`. Άρα η διεύθυνση πρέπει να είναι προσπελάσιμη **από τη Google**:
 * το `localhost` δεν αποτυγχάνει «στον παραλήπτη» — αποτυγχάνει **πάντα**, ακόμη και στη
 * δική σου οθόνη.
 */

/**
 * Είναι αυτή η διεύθυνση **δημόσια προσπελάσιμη πάνω από `https`**;
 *
 * ⚠️ **ΔΕΝ είναι διπλότυπο του `lib/security/outbound-url-guard`** *(ADR-853 §19.7)*:
 * εκείνο απαντά *«είναι ασφαλές να **κατεβάσω** URL που μου έδωσε **ξένος**;»* — είναι
 * **ασύγχρονο** *(λύνει DNS)*, `server-only`, και **δεν** κόβει καν το `localhost`
 * συντακτικά *(το πιάνει στην ανάλυση ονόματος)*. Εδώ η ερώτηση είναι **δική μας
 * ρύθμιση**, κρίνεται **σύγχρονα**, και το αρχείο αυτό είναι επίτηδες **χωρίς
 * εξαρτήσεις** — μια εισαγωγή `server-only` θα μόλυνε κάθε καταναλωτή του.
 *
 * 🏆 **Καμία κυριολεκτική IP** — ούτε καν δημόσια. Ένας asset host **μάρκας** είναι
 * **όνομα**, όχι αριθμός· και έτσι δεν χρειάζεται να κρατήσουμε **δεύτερο αντίγραφο**
 * του πίνακα ιδιωτικών ευρών που ήδη ζει στον φρουρό εξερχομένων.
 */
/** Καταλήξεις δεσμευμένες για ιδιωτική/δοκιμαστική χρήση — ποτέ δημόσια επιλύσιμες. */
const RESERVED_HOST_SUFFIXES: readonly string[] = [
  '.localhost', '.local', '.internal', '.intranet', '.private',
  '.home.arpa', '.test', '.invalid', '.example', '.lan',
];

function isPubliclyReachableHttps(candidate: string): boolean {
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return false;
  }

  // Το `http://` περνά καθαρό από τον proxy αλλά σημαδεύει το μήνυμα ως μη ασφαλές.
  if (url.protocol !== 'https:') return false;
  // `https://user:pass@host` διαβάζεται από άνθρωπο και μηχανή **διαφορετικά**.
  if (url.username !== '' || url.password !== '') return false;

  const host = url.hostname.toLowerCase();
  // Κυριολεκτική IPv6 *(σε αγκύλες)* ή IPv4 — απορρίπτεται ως όνομα μάρκας.
  if (host.startsWith('[') || /^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return false;
  // Χωρίς τελεία ⇒ μονο-ετικέτα: `localhost`, `intranet`, όνομα container.
  if (!host.includes('.')) return false;
  // Καταλήξεις που **εξ ορισμού** δεν λύνονται στο δημόσιο DNS (RFC 6761/8375).
  return !RESERVED_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix));
}

/**
 * **Η διεύθυνση από την οποία κατεβαίνουν οι εικόνες των email** — ή `null`.
 *
 * Ο κανόνας, γραμμένος **μία** φορά: το **πρώτο** από
 * `NEXT_PUBLIC_EMAIL_ASSET_ORIGIN` και {@link publicOrigin} που είναι **δημόσια
 * προσπελάσιμο https**.
 *
 * 🏆 **Η ίδια γραμμή δίνει σωστή παραγωγή ΚΑΙ σωστό dev, χωρίς να ρωτήσει ποτέ «ποιο
 * περιβάλλον;»** — κανένα `NODE_ENV`, κανένα `isDev`. Στην παραγωγή
 * *(`https://nestorconstruct.gr`)* η εφεδρεία **περνά** τον έλεγχο ⇒ τα email δουλεύουν
 * **την ημέρα της ανάπτυξης, χωρίς καμία νέα ρύθμιση**. Στο dev *(`http://localhost:3000`)*
 * **κόβεται** ⇒ παράλειψη. Η ερώτηση δεν είναι «πού τρέχω;» αλλά «**είναι αυτή η
 * διεύθυνση δημόσια;**» — και την απαντά η ίδια η διεύθυνση.
 *
 * ⚠️ **Η εφεδρεία ΔΕΝ είναι μαντεψιά**: δεν επινοεί host, **ελέγχει** τον δηλωμένο μας.
 * Καρφωμένη εφεδρεία ήταν **ακριβώς** η αιτία του Ε-Θ *(νεκρό `nestor-app.vercel.app`)*.
 */
export function emailAssetOrigin(): string | null {
  const declared = process.env.NEXT_PUBLIC_EMAIL_ASSET_ORIGIN?.trim().replace(/\/+$/, '');
  if (declared && isPubliclyReachableHttps(declared)) return declared;

  const fallback = publicOrigin();
  return fallback !== null && isPubliclyReachableHttps(fallback) ? fallback : null;
}

/**
 * Απόλυτο URL εικόνας email — `null` όταν **καμία** διεύθυνση δεν είναι δημόσια.
 *
 * ⛔ **Το `null` ΕΙΝΑΙ Η ΥΠΗΡΕΣΙΑ**: ο καλών οφείλει να **παραλείψει ολόκληρη την
 * `<img>`**. Ποτέ σχετική διαδρομή — μέσα σε email το `/images/x.png` λύνεται πάνω στο
 * `mail.google.com`, δηλαδή αίτημα σε **ξένο** origin. Ποτέ κενό `src` — ζητά την
 * **ίδια τη σελίδα** ως εικόνα.
 */
export function emailAssetUrl(path: string): string | null {
  const origin = emailAssetOrigin();
  return origin === null ? null : joinOrigin(origin, path);
}
