/**
 * @module url-query-state
 * @description Το **ένα** σημείο που διαβάζει και γράφει κατάσταση στο query string.
 *
 * ## Γιατί υπάρχει
 * Όταν μια σελίδα θέλει να θυμάται «τι βλέπεις» (ποια επαφή είναι ανοιχτή, πού
 * είναι η κάμερα), υπάρχουν δύο δρόμοι: ένα δεύτερο δοχείο (`sessionStorage`,
 * store, React state) ή **το URL**. Το URL επιβιώνει reload, remount, Fast
 * Refresh, back/forward, bookmark, share και restore-tab **χωρίς καμία δικλείδα**
 * — γι' αυτό είναι το δοχείο που επιλέγουν τα εργαλεία με μόνιμο χώρο εργασίας.
 *
 * ## Γιατί `history.replaceState` και όχι `router.replace`
 * Ο App Router του Next δεν έχει shallow routing: κάθε `router.replace('?x=1')`
 * είναι πλοήγηση με γύρο στον server. Για κατάσταση που αλλάζει με κάθε κλικ
 * (επιλογή σε λίστα, pan/zoom) αυτό είναι λάθος εργαλείο.
 *
 * Η επίσημη διέξοδος είναι το native History API — και **δεν** σπάει την
 * αντιδραστικότητα:
 *
 * > «`pushState` and `replaceState` calls integrate into the Next.js Router,
 * > allowing you to sync with `usePathname` and `useSearchParams`.»
 * > — Next.js docs, *Linking and Navigating → Native History API*
 *
 * **Μετρήθηκε ζωντανά** (2026-07-26, production, Next 15.5.22): σκέτο
 * `history.replaceState(null, '', '?filter=Δοκιμή')` στη σελίδα Επαφών —
 * χωρίς καθόλου router — ενημέρωσε το `useSearchParams()`, το banner φίλτρου
 * εμφανίστηκε, η λίστα φιλτραρίστηκε 4→2 επαφές, και **η ανοιχτή καρτέλα με το
 * scroll της επιβίωσαν** (κανένα remount). Αυτή είναι η ίδια συμπεριφορά με την
 * προεπιλογή `shallow: true` του `nuqs` — χωρίς την εξάρτηση.
 *
 * ## Συμβόλαιο
 * - **Διατηρητικό**: η γραφή περνά από `mutate(params)` πάνω στα **ζωντανά**
 *   params, οπότε άσχετα κλειδιά (`?filter=`, `?tab=`) δεν χάνονται ποτέ. Ένα
 *   `router.replace('?contactId=x')` θα τα έσβηνε σιωπηλά.
 * - **Διατηρεί `pathname` + `hash`** — η γραφή αφορά **μόνο** το query string.
 * - **No-op στον server**: κάθε πρόσβαση σε `window` είναι φρουρημένη, ώστε το
 *   module να μπορεί να εισαχθεί και από κώδικα που τρέχει σε SSR.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-332 — D21 (επιλεγμένη επαφή)
 * @see docs/centralized-systems/reference/adrs/ADR-400 — viewport deep-link (2D/3D)
 */

/** Τα ζωντανά search params της σελίδας. Κενά στον server. */
export function currentSearchParams(): URLSearchParams {
  if (typeof window === 'undefined') return new URLSearchParams();
  return new URLSearchParams(window.location.search);
}

/**
 * Αντικαθιστά **ολόκληρο** το query string, χωρίς πλοήγηση.
 *
 * Για σελίδες όπου το query string **είναι** η κατάσταση στο σύνολό της (π.χ. ο
 * report builder κωδικοποιεί εκεί domain + φίλτρα + στήλες + ταξινόμηση), οπότε το
 * σβήσιμο των υπόλοιπων κλειδιών είναι η πρόθεση, όχι παρενέργεια. Για τα υπόλοιπα
 * χρησιμοποίησε το {@link replaceUrlSearchParams}, που **δεν** πειράζει τα άσχετα.
 *
 * 🔴 Το `history.state` περνά αυτούσιο. Ο App Router κρατά **εκεί** τη δική του
 * κατάσταση δρομολόγησης· ένα `replaceState(null, …)` τη σβήνει σιωπηλά.
 *
 * @param query - Το νέο query string, με ή χωρίς `?`. Κενό ⇒ καθαρό URL.
 */
export function replaceUrlQueryString(query: string): void {
  if (typeof window === 'undefined') return;

  const normalized = query.startsWith('?') ? query.slice(1) : query;
  const { pathname, hash } = window.location;
  const url = normalized ? `${pathname}?${normalized}${hash}` : `${pathname}${hash}`;
  window.history.replaceState(window.history.state, '', url);
}

/**
 * Γράφει query state **χωρίς πλοήγηση**: διάβασε τα ζωντανά params, άσε το
 * `mutate` να προσθέσει/αφαιρέσει κλειδιά, και γράψε το αποτέλεσμα διατηρώντας
 * `pathname`, `hash` και κάθε **άσχετο** κλειδί.
 *
 * `replaceState` (και όχι `pushState`) επειδή η κατάσταση θέασης δεν είναι
 * προορισμός: αλλιώς κάθε κλικ σε λίστα θα γέμιζε το ιστορικό και το κουμπί
 * «πίσω» θα ξετύλιγε επιλογές αντί να γυρίζει στην προηγούμενη σελίδα.
 *
 * @param mutate - Μεταλλάσσει τα params επί τόπου. Δεν επιστρέφει τίποτα.
 */
export function replaceUrlSearchParams(mutate: (params: URLSearchParams) => void): void {
  if (typeof window === 'undefined') return;

  const params = currentSearchParams();
  mutate(params);
  replaceUrlQueryString(params.toString());
}
