'use strict';
/**
 * =============================================================================
 * Χ — ΤΟ ΧΤΥΠΗΜΑ ΚΑΙ Η ΚΡΙΣΗ **ΜΙΑΣ** ΔΙΑΔΡΟΜΗΣ (CHECK 3.51 Χ · ADR-781 §6)
 * =============================================================================
 *
 * Εδώ ζει ό,τι αφορά **μία** διαδρομή: η εξαγωγή των επιφανειών από το HTML, η
 * κρίση τους και το ίδιο το χτύπημα. Η απαρίθμηση των διαδρομών και το σύμπαν
 * των κλειδιών ζουν στον `oracle.js`, που εισάγει **αυτό** το αρχείο — ποτέ το
 * αντίστροφο.
 *
 * ⚠️ Η ομάδα εξαγωγής (`extractSurfaces` κ.λπ.) είναι **εδώ** και όχι στον
 * `oracle.js` επειδή τη χρειάζεται το `judgeHtml`. Αν έμενε εκεί, το αρχείο
 * αυτό θα έπρεπε να εισάγει τον `oracle.js` ενώ εκείνος εισάγει αυτό —
 * **κύκλος**, τον οποίο **κανένα gate δεν φυλάει κάτω από το `scripts/`**.
 * =============================================================================
 */

const { declaredBackendUnavailable } = require('./backend-contract');
const { anyControlRendered } = require('./controls');
const { decodeEntities } = require('./html-entities');
const { declaredSoftRedirect } = require('./redirect-contract');
const { X_STATES, SYNTHETIC_SEGMENT } = require('./states');
const { routeIdOf, isLoginRedirect } = require('./identity');

// ---------------------------------------------------------------------------
// 1. Η εξαγωγή — δύο επιφάνειες
// ---------------------------------------------------------------------------

/** Attributes που καταλήγουν σε ανθρώπινα μάτια ή σε αναγνώστη οθόνης. */
const HUMAN_ATTRIBUTES = ['title', 'placeholder', 'aria-label', 'aria-description', 'alt', 'aria-placeholder'];

function stripScripts(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');
}

/**
 * 🔑 **ΤΟ `<head>` ΔΕΝ ΕΙΝΑΙ ΑΠΟΔΟΘΕΙΣΑ ΕΠΙΦΑΝΕΙΑ** (ADR-790).
 *
 * Χωρίς αυτόν τον διαχωρισμό **κάθε** έγγραφο του Next.js έχει τουλάχιστον έναν
 * κόμβο κειμένου — τον `<title>` — άρα το ερώτημα «**ζωγράφισε κάτι** αυτή η
 * σελίδα;» δεν μπορούσε ποτέ να απαντηθεί «όχι». Μια σελίδα που αποδίδει
 * **μηδέν** στον server (όλο το σώμα της μέσα σε `<Suspense fallback={null}>` —
 * μετρημένα το `/oauth/consent`) θα φαινόταν να έχει «μία επιφάνεια», και το
 * «μία» δεν ξεχωρίζει από το «λίγες»: η κατάσταση θα γεννιόταν με **μαγικό
 * κατώφλι** αντί για απόδειξη.
 *
 * ⚠️ Ο `<title>` **δεν χάνεται** — επιστρέφεται ρητά και κρίνεται για ωμά κλειδιά
 * ως επιφάνεια `document-title`: ένα ωμό κλειδί στην καρτέλα του browser είναι
 * εξίσου ορατό. Μετρημένο 2026-08-22 στις 154 διαδρομές της παραγωγής, το κόστος
 * του διαχωρισμού σε ωμά κλειδιά είναι **207 → 207**, δηλαδή **μηδέν**.
 */
function stripHead(html) {
  return html.replace(/<head[\s\S]*?<\/head>/i, ' ');
}

/** Ο τίτλος του εγγράφου — μεταδεδομένο, ΟΧΙ απόδειξη ότι αποδόθηκε σελίδα. */
function extractDocumentTitle(html) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!match) return null;
  const value = decodeEntities(match[1].replace(/<[^>]+>/g, ' ')).trim();
  return value || null;
}

/**
 * @returns {{texts: string[], attributes: Array<{attribute: string, value: string}>, title: string|null, bodyCount: number}}
 */
function extractSurfaces(html) {
  const title = extractDocumentTitle(html);
  const body = stripHead(stripScripts(html));

  const attributes = [];
  for (const attribute of HUMAN_ATTRIBUTES) {
    const pattern = new RegExp(`\\s${attribute}\\s*=\\s*"([^"]*)"`, 'gi');
    let match;
    while ((match = pattern.exec(body)) !== null) {
      const value = decodeEntities(match[1]).trim();
      if (value) attributes.push({ attribute, value });
    }
  }

  const texts = decodeEntities(body.replace(/<[^>]+>/g, '\n'))
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  return { texts, attributes, title, bodyCount: texts.length + attributes.length };
}

// ---------------------------------------------------------------------------
// 2. Η κρίση μιας σελίδας
// ---------------------------------------------------------------------------

/**
 * **ΔΥΟ ΑΠΟΔΕΙΞΕΙΣ, ΟΧΙ ΜΙΑ** — και ποτέ μία με «ή» (μάθημα CHECK 3.41):
 *
 *   `shellProven` «απάντησε ο server με μεταφρασμένη εφαρμογή;»
 *   `pageProven`  «αποδόθηκε περιεχόμενο **πέρα από το κέλυφος**;»
 *
 * Μέχρι το ADR-788 υπήρχε **μόνο** το πρώτο, με το όνομα του δεύτερου. Το
 * κέλυφος ζωγραφίζεται σε **κάθε** διαδρομή, άρα το πρώτο ήταν πάντα `true`
 * και το δεύτερο **δεν ρωτήθηκε ποτέ** (βλ. `controls.js`).
 *
 * @param {string} html
 * @param {{universe: Set<string>, shellControls: Set<string>, pageControls: Set<string>}} oracle
 * @returns {{shellProven: boolean, pageProven: boolean, hits: Array<{key: string, surface: string}>}}
 */
function judgeHtml(html, oracle) {
  const { texts, attributes, title, bodyCount } = extractSurfaces(html);
  const hits = new Map();

  for (const text of texts) {
    if (oracle.universe.has(text)) hits.set(`text|${text}`, { key: text, surface: 'text' });
  }
  // ⚠️ Ο τίτλος κρίνεται ΞΕΧΩΡΙΣΤΑ: είναι ορατός στην καρτέλα του browser, αλλά
  //    ΔΕΝ μετράει ως «η σελίδα ζωγράφισε κάτι» (βλ. `stripHead`).
  const judged = title ? attributes.concat([{ attribute: 'document-title', value: title }]) : attributes;
  for (const { attribute, value } of judged) {
    if (oracle.universe.has(value)) hits.set(`${attribute}|${value}`, { key: value, surface: attribute });
  }

  // Οι αποδείξεις ψάχνονται σε ΟΛΕΣ τις επιφάνειες: μια σελίδα μπορεί κάλλιστα
  // να έχει όλο της το μεταφρασμένο κείμενο μέσα σε `aria-label`.
  const haystack = texts.concat(attributes.map((item) => item.value));

  return {
    shellProven: anyControlRendered(oracle.shellControls, haystack),
    pageProven: anyControlRendered(oracle.pageControls, haystack),
    bodyCount,
    hits: [...hits.values()],
  };
}

/**
 * Η ΜΗΧΑΝΗ ΚΑΤΑΣΤΑΣΕΩΝ ΜΙΑΣ ΣΕΛΙΔΑΣ ΠΟΥ ΑΠΑΝΤΗΣΕ 200.
 *
 * ⚠️ **Η ΣΕΙΡΑ ΕΙΝΑΙ ΤΟ ΣΥΜΒΟΛΑΙΟ**, όχι στυλ: πάνω σε ακρίτη επιφάνεια το
 * «**βρήκα** ωμό κλειδί» παραμένει αληθές, ενώ το «**δεν** βρήκα» δεν αποδεικνύει
 * τίποτα. Γι΄ αυτό το `raw-key` κρίνεται **πριν** από τις καταστάσεις επιφάνειας.
 *
 * @param {{dynamic: boolean}} route
 * @param {{shellProven: boolean, pageProven: boolean, hits: Array}} verdict
 * @param {null | {target: string} | {malformed: string}} [redirect] ο δείκτης του DOM
 *   (`redirect-contract.js`), με τον προορισμό **ήδη κανονικοποιημένο**.
 * @returns {{state: string, detail?: string}}
 */
function classifySurface(route, verdict, redirect = null) {
  // 🔴 1. ΩΜΟ ΚΛΕΙΔΙ ΠΡΩΤΑ — ΚΑΙ ΕΙΝΑΙ ΤΟ ΙΔΙΟ Η ΑΠΟΔΕΙΞΗ (ADR-790).
  //    Ένα κλειδί του **δικού μας** κλειστού σύμπαντος, τυπωμένο σε κόμβο του
  //    HTML, δεν μπορεί να το βάλει εκεί τίποτε άλλο από τον δικό μας κώδικα.
  //    Άρα «βρήκα ωμό κλειδί» **είναι** η ισχυρότερη δυνατή απόδειξη ότι ο
  //    χρησμός κοίταξε δική μας αποδοθείσα επιφάνεια.
  //    ⚠️ Μέχρι το ADR-788 το `!shellProven` προηγούνταν, οπότε το
  //    `/mandate/ssr-probe` — που βάφει **δύο ωμά κλειδιά και τίποτε άλλο**,
  //    επειδή ακριβώς λείπει το namespace του — αναφερόταν ⛔ «δεν κοίταξα»
  //    και **μπλόκαρε τη φωτογραφία**. Η κεφαλίδα δήλωνε την ασυμμετρία· η
  //    σειρά την ακύρωνε.
  if (verdict.hits.length > 0) return { state: X_STATES.RAW_KEY };

  // 🔴 2. ΔΗΛΩΜΕΝΗ ΕΚΤΟΣ ΠΑΡΑΓΩΓΗΣ, ΑΛΛΑ Ο SERVER ΑΠΑΝΤΗΣΕ 200.
  //    Δεν είναι «σερβίρεται»: το `notFound()` **έτρεξε**, αλλά ρίχτηκε **μετά**
  //    την έναρξη της ροής, οπότε ο κωδικός κατάστασης δεν αλλάζει πια. Η τεκμη-
  //    ρίωση του Next.js το λέει ρητά: 200 για streamed απαντήσεις, 404 για μη
  //    streamed. Μετρημένο φυσικό πείραμα (2026-08-22, nestorconstruct.gr): οι
  //    **τρεις** διαδρομές του group `(app)` — που έχει `loading.tsx`, άρα
  //    Suspense — απαντούν **200**· οι **δύο** του `(bare)`, που δεν έχει,
  //    απαντούν **404**. Ίδιος φρουρός, ίδιο SSoT, **αντίθετος** κωδικός.
  if (route.withheld) {
    return {
      state: X_STATES.WITHHELD_ANSWERED,
      detail: `δηλωμένη εκτός παραγωγής (${route.withheld.mechanism}) αλλά ο server απαντά 200 — το notFound() ρίχτηκε ΜΕΤΑ την έναρξη της ροής`,
    };
  }

  // 🔴 3. ΑΝΑΚΑΤΕΥΘΥΝΣΗ ΠΟΥ ΔΕΝ ΜΠΟΡΕΣΕ ΝΑ ΓΙΝΕΙ ΚΩΔΙΚΟΣ (ADR-781 §14) — ο δίδυμος
  //    του 2: το `redirect()` ρίχτηκε ΜΕΤΑ την έναρξη της ροής. Ό,τι βάφτηκε είναι
  //    κέλυφος + σκελετός φόρτωσης, ΟΧΙ η σελίδα ⇒ ΠΡΙΝ από τις καταστάσεις
  //    επιφάνειας, αλλιώς πέφτει στο 🔶 και εξατμίζεται (§13.2). ΜΕΤΑ το raw-key:
  //    κλειδί ζωγραφισμένο στο κέλυφος παραμένει αληθές.
  //    ⚠️ Χαλασμένος δείκτης ⇒ ⛔: ξέρουμε ότι ανακατεύθυνε, όχι πού.
  if (redirect && redirect.malformed !== undefined) {
    return { state: X_STATES.PROBE_UNPROVEN, detail: `δείκτης ανακατεύθυνσης με άγνωστο σχήμα: ${redirect.malformed}` };
  }
  if (redirect) return { state: X_STATES.REDIRECTED, detail: redirectDetail(redirect.target) };

  // ⛔/🔴 4. ΤΙΠΟΤΑ ΔΕΝ ΑΠΕΔΕΙΞΕ ΟΤΙ ΑΠΑΝΤΗΣΕ Η ΕΦΑΡΜΟΓΗ ΜΑΣ.
  //    ⚠️ ΔΥΟ ΠΟΛΥ ΔΙΑΦΟΡΕΤΙΚΕΣ ΑΙΤΙΕΣ, ΚΑΙ ΤΟ ΝΑ ΤΙΣ ΛΕΣ ΜΕ ΕΝΑ ΟΝΟΜΑ ΕΙΝΑΙ
  //    ΤΟ ΛΑΘΟΣ: (α) το σώμα έχει **μηδέν** αποδοθείσες επιφάνειες ⇒ η σελίδα
  //    δεν αποδίδει τίποτα στον server (client-only), γεγονός **για τη σελίδα**
  //    και **επαληθεύσιμο**· (β) το σώμα έχει επιφάνειες αλλά **καμία** δεν
  //    είναι δική μας ⇒ ο server απάντησε **κάτι άλλο** (proxy, σελίδα σφάλματος,
  //    αμετάφραστη απόδοση) και ο χρησμός **δεν επιτρέπεται** να αποφανθεί.
  //    Το (α) είναι ratchet — καταγράφεται, δεν μπλοκάρει για πάντα. Το (β)
  //    μένει ⛔: «δεν κοίταξα» δεν έχει πρόοδο.
  if (!verdict.shellProven && !verdict.pageProven) {
    if (verdict.bodyCount === 0) {
      return {
        state: X_STATES.NOT_RENDERED,
        detail: 'μηδέν αποδοθείσες επιφάνειες στο σώμα — η σελίδα δεν αποδίδει ΤΙΠΟΤΑ στον server (client-only)',
      };
    }
    return { state: X_STATES.PROBE_UNPROVEN, detail: 'καμία μεταφρασμένη τιμή στη σελίδα — ο χρησμός ΔΕΝ απέδειξε ότι κοίταξε' };
  }

  // 🔶 5. Δυναμική διαδρομή με ΣΥΝΘΕΤΙΚΟ id: ό,τι κι αν βάφτηκε, δεν είναι η σελίδα.
  if (route.dynamic) {
    return {
      state: X_STATES.SYNTHETIC_ID,
      detail: `το τμήμα «${SYNTHETIC_SEGMENT}» δεν αντιστοιχεί σε υπαρκτή οντότητα — η επιφάνεια της σελίδας ΔΕΝ κρίθηκε`,
    };
  }

  // 🔴 6. Στατική διαδρομή που έβαψε ΜΟΝΟ λεξιλόγιο κελύφους.
  //    ⚠️ «Λεξιλόγιο κελύφους», ΟΧΙ «το κέλυφος»: μια σελίδα του `(auth)`/`(light)`
  //    δεν φοράει κέλυφος (CHECK 3.52) και όμως προσγειώνεται εδώ, γιατί ό,τι
  //    βάφει ζει ολόκληρο μέσα στο αποστελλόμενο slice. Η κατάσταση λέει
  //    «**το περιεχόμενό της δεν έφτασε στο SSR HTML**» — και αυτό είναι αληθές
  //    και στις δύο περιπτώσεις.
  if (!verdict.pageProven) {
    return { state: X_STATES.SHELL_ONLY, detail: 'μόνο λεξιλόγιο κελύφους αποδόθηκε — καμία τιμή πέρα από αυτό' };
  }
  return { state: X_STATES.CLEAN };
}

// ---------------------------------------------------------------------------
// 3. Ο προορισμός μιας ανακατεύθυνσης — ΜΕΡΟΣ ΤΗΣ ΤΑΥΤΟΤΗΤΑΣ, άρα σταθερός
// ---------------------------------------------------------------------------

/**
 * 🔑 **Ο ΠΡΟΟΡΙΣΜΟΣ ΜΠΑΙΝΕΙ ΣΤΗΝ ΤΑΥΤΟΤΗΤΑ ΤΟΥ RATCHET**, άρα **δεν επιτρέπεται να
 * περιέχει τίποτα εφήμερο**: αν έμπαινε η θύρα του CI, η baseline θα άλλαζε σε κάθε
 * εκτέλεση και το ratchet θα ήταν θόρυβος αντί για φρουρός.
 *
 * ⚠️ **ΜΕΤΡΗΜΕΝΟ**: το Next 15.5.22 γράφει το `Location` **σχετικό** — ό,τι ακριβώς
 * δόθηκε στο `redirect()` (`app-render.js`, `setHeader('location', …)` πάνω στο
 * `getURLFromRedirectError`). Η κανονικοποίηση είναι **αμυντική**, για proxy ή
 * μελλοντική αλλαγή — όχι διόρθωση παρατηρημένου προβλήματος.
 *
 * ⚠️ **ΤΟ QUERY ΔΕΝ ΑΦΑΙΡΕΙΤΑΙ.** Δύο διαδρομές ανακατευθύνουν με `loginHref(...)`
 * ⇒ `/login?next=…`. Είναι **καθαρή συνάρτηση** της διαδρομής (καμία χρονοσφραγίδα,
 * κανένα token), άρα σταθερό· και είναι **ακριβώς** ό,τι τις ξεχωρίζει από τις 110
 * του χώρου, που δίνουν σκέτο `/login`. Αφαίρεσή του θα τις συγχώνευε σε μία ταυτότητα.
 *
 * ⚠️ **Εξωτερικός προορισμός μένει ΟΛΟΚΛΗΡΟΣ**: μια ανακατεύθυνση εκτός του server
 * μας είναι **διαφορετικό γεγονός**, και το να το κόβαμε σε διαδρομή θα το έκανε να
 * μοιάζει εσωτερικό.
 */
function normaliseRedirectTarget(location, baseUrl) {
  const raw = String(location).trim();
  let resolved;
  let origin = null;
  try {
    resolved = new URL(raw, baseUrl);
  } catch {
    return raw;
  }
  try {
    origin = new URL(baseUrl).origin;
  } catch {
    return raw;
  }
  return resolved.origin === origin ? `${resolved.pathname}${resolved.search}` : resolved.href;
}

/**
 * Η λεπτομέρεια — άρα η ταυτότητα — του `route-redirected`. **ΜΙΑ** μορφή για τις
 * **δύο** μεταφορές (3xx + `Location` · 200 + δείκτης DOM): το ίδιο γεγονός από
 * άλλο κανάλι πρέπει να δίνει **την ίδια** ταυτότητα, αλλιώς μια αλλαγή μεταφοράς
 * (π.χ. αφαίρεση ενός `loading.tsx`) θα διαβαζόταν ως ανταλλαγή ευρημάτων.
 */
function redirectDetail(normalisedTarget) {
  return `→ ${normalisedTarget}`;
}

/** Ο δείκτης του DOM, με τον προορισμό κανονικοποιημένο **όπως** το `Location`. */
function softRedirectOf(html, baseUrl) {
  const declared = declaredSoftRedirect(html);
  if (!declared || declared.malformed !== undefined) return declared;
  return { target: normaliseRedirectTarget(declared.target, baseUrl) };
}

/**
 * Η συνεδρία μιας διαδρομής persona (ADR-875). Διαδρομή χωρίς persona ⇒ ανώνυμη, όπως πάντα.
 * ⚠️ Persona ΧΩΡΙΣ συνεδρία ⇒ ⛔, **ποτέ** ανώνυμο αίτημα στη θέση της: αυτό θα ήταν
 *    ακριβώς η τύφλωση του §13 — 110 ανακατευθύνσεις με όνομα «κρίθηκε ως persona».
 */
function sessionFor(route, options) {
  if (!route.persona) return {};
  const cookie = options.sessions?.get(route.persona);
  if (cookie) return { cookie };
  const why = options.identityFailures?.get(route.persona) || `καμία συνεδρία για την κλάση ${route.persona}`;
  return { refusal: { state: X_STATES.IDENTITY_UNPROVEN, status: null, keys: [], detail: why } };
}

/**
 * Η ΜΙΑ μορφή εγγραφής. Η ταυτότητα (`route`) περιέχει την κλάση persona (`routeIdOf`)·
 * το cookie **δεν** μπορεί να μπει εδώ, γιατί δεν υπάρχει ποτέ στο `route`.
 *
 * 🔴 Ανακατεύθυνση **στη σύνδεση** ενώ κρατούσαμε συνεδρία ⇒ ⛔ `identity-unproven`, ΟΧΙ
 *    🔴 `route-redirected`: η εικόνα δεν τίμησε τη συνεδρία, άρα ο χρησμός είναι
 *    ξανά ανώνυμος χωρίς να το ξέρει (ADR-875 §4).
 */
function settle(route, result, redirectTarget) {
  const record = { ...route, route: routeIdOf(route), ...result };
  const refused = route.persona && result.state === X_STATES.REDIRECTED && typeof redirectTarget === 'string' && isLoginRedirect(redirectTarget);
  if (!refused) return record;
  return { ...record, state: X_STATES.IDENTITY_UNPROVEN, detail: `η εικόνα ΔΕΝ τίμησε τη συνεδρία της κλάσης ${route.persona} (${result.detail})` };
}

/**
 * Χτυπάει ΜΙΑ διαδρομή. **Ποτέ δεν επιστρέφει «καθαρό» χωρίς απόδειξη.**
 *
 * @returns {{route: string, file: string, dynamic: boolean, state: string, status: number|null, keys: Array, detail?: string}}
 */
async function probeRoute(route, options) {
  const { baseUrl, userAgent, oracle, timeoutMs = 120000 } = options;
  if (!userAgent) throw new Error('CHECK 3.51 Χ: το userAgent είναι ΥΠΟΧΡΕΩΤΙΚΟ (βλ. κεφαλίδα §1)');
  const identity = sessionFor(route, options);
  if (identity.refusal) return settle(route, identity.refusal);

  let response;
  let html;
  try {
    response = await fetch(`${baseUrl}${route.url}`, {
      headers: { 'user-agent': userAgent, accept: 'text/html', ...(identity.cookie ? { cookie: identity.cookie } : {}) },
      // 🔑 `manual`, ΠΟΤΕ `follow` — ADR-781 §13. Με `follow` ο χρησμός κρίνει τη
      //    σελίδα ΣΤΟΝ ΠΡΟΟΡΙΣΜΟ και καταγράφει το πόρισμα με το όνομα της
      //    διαδρομής ΠΟΥ ΖΗΤΗΣΕ — η ονομασμένη αστοχία του Lighthouse («audits
      //    the login page instead of the target»)· αρχή του Google Search
      //    Console: η πηγή παίρνει **δική της** κατάσταση, `Page with redirect`.
      //    ⚠️ ΔΙΟΡΘΩΣΗ (ADR-781 §14): οι 110 `/o/[workspace]/**` ΔΕΝ έκριναν τη
      //    σελίδα σύνδεσης — δεν ανακατευθύνουν με 3xx ΠΟΤΕ (streaming ⇒ 200).
      //    Τις πιάνει ο δείκτης DOM (`softRedirectOf`), όχι αυτή η γραμμή.
      redirect: 'manual',
      signal: AbortSignal.timeout(timeoutMs),
    });
    html = await response.text();
  } catch (error) {
    return settle(route, { state: X_STATES.UNREACHABLE, status: null, keys: [], detail: error.message });
  }

  const declared = response.status >= 500 && options.backendContract
    ? declaredBackendUnavailable(html, options.backendContract)
    : null;
  if (declared !== null) {
    return settle(route, { state: X_STATES.BACKEND_UNAVAILABLE, status: response.status, keys: [], detail: `δηλωμένη αδυναμία backend: ${declared}` });
  }

  // 🔴 ΑΝΑΚΑΤΕΥΘΥΝΣΗ — ΠΡΙΝ από τον έλεγχο `!response.ok`, ΕΠΙΤΗΔΕΣ.
  //    Ένα 3xx **είναι** `!ok`· χωρίς αυτόν τον κλάδο εδώ, κάθε ανακατεύθυνση θα
  //    γινόταν ⛔ `route-unreachable`, δηλαδή «ο server δεν απάντησε» — ψέμα: ο
  //    server απάντησε, και μάλιστα **μας είπε πού να πάμε**.
  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get('location');
    // ⚠️ 3xx ΧΩΡΙΣ `Location` δεν είναι ανακατεύθυνση — είναι χαλασμένη απάντηση.
    //    Δεν μπορούμε καν να σχηματίσουμε ταυτότητα, άρα μένει ⛔.
    if (!location) {
      return settle(route, { state: X_STATES.UNREACHABLE, status: response.status, keys: [], detail: `HTTP ${response.status} ΧΩΡΙΣ κεφαλίδα Location` });
    }
    const target = normaliseRedirectTarget(location, baseUrl);
    return settle(route, { state: X_STATES.REDIRECTED, status: response.status, keys: [], detail: redirectDetail(target) }, target);
  }

  if (!response.ok) {
    // 🔶 ΔΗΛΩΜΕΝΗ ΠΑΡΑΚΡΑΤΗΣΗ + Ο SERVER ΣΥΜΦΩΝΗΣΕ = ΤΟ ΣΥΜΒΟΛΑΙΟ ΤΗΡΗΘΗΚΕ.
    //    Δεν είναι «δεν κοίταξα»: είναι «δεν υπάρχει τίποτα να κοιτάξω, και ο
    //    λόγος είναι γραμμένος». ⚠️ Χωρίς δήλωση, το 404 παραμένει ⛔ — ο Κ2
    //    (`served-surface.js`) είναι ανεξάρτητος κανόνας, ποτέ ο ίδιος με «ή».
    const state = route.withheld ? X_STATES.WITHHELD : X_STATES.UNREACHABLE;
    const why = route.withheld ? ` — δηλωμένη εκτός παραγωγής (${route.withheld.mechanism})` : '';
    return settle(route, { state, status: response.status, keys: [], detail: `HTTP ${response.status}${html.trim() === '' ? ' (ΚΕΝΟ σώμα)' : ''}${why}` });
  }
  if (html.trim() === '') {
    return settle(route, { state: X_STATES.UNREACHABLE, status: response.status, keys: [], detail: 'ΚΕΝΟ σώμα με 200' });
  }

  const verdict = judgeHtml(html, oracle);
  const soft = softRedirectOf(html, baseUrl);
  const { state, detail } = classifySurface(route, verdict, soft);
  return settle(route, { state, status: response.status, keys: verdict.hits, ...(detail ? { detail } : {}) }, soft?.target);
}

module.exports = {
  HUMAN_ATTRIBUTES,
  decodeEntities,
  stripScripts,
  stripHead,
  extractDocumentTitle,
  extractSurfaces,
  judgeHtml,
  classifySurface,
  normaliseRedirectTarget,
  redirectDetail,
  probeRoute,
};
