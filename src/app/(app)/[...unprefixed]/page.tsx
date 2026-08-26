/**
 * ΤΟ ΔΙΧΤΥ — η διεύθυνση χωρίς χώρο βρίσκει τον δρόμο της
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΤΙ ΛΥΝΕΙ (ADR-787 §5.3 ιβ)
 * ─────────────────────────────────────────────────────────────────────────────
 * Σελιδοδείκτες, διευθύνσεις γραμμένες με το χέρι, και ό,τι σημείο πλοήγησης δεν
 * έχει ακόμη περάσει από το σύνορο ({@link module:lib/workspace/navigation}).
 *
 * ⚠️ **ΕΙΝΑΙ ΔΙΧΤΥ, ΟΧΙ ΜΗΧΑΝΙΣΜΟΣ.** Κάθε πλοήγηση που φτάνει εδώ πληρώνει έναν
 * ολόκληρο γύρο διακομιστή. Ο μηχανισμός είναι το σύνορο· αυτό εδώ υπάρχει για
 * να μη χαθεί **κανείς** στο μεταξύ. Αν αρχίσει να δέχεται κίνηση από μέσα από
 * την εφαρμογή, το εύρημα δεν είναι εδώ — είναι ένα σημείο που παρακάμπτει το
 * σύνορο (CHECK 3.61).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 307, ΟΧΙ 308 — ΚΑΙ ΕΙΝΑΙ ΑΠΟΦΑΣΗ ΑΣΦΑΛΕΙΑΣ, ΟΧΙ ΠΡΟΤΙΜΗΣΗ
 * ─────────────────────────────────────────────────────────────────────────────
 * Η βιομηχανική πρακτική για μετανάστευση διευθύνσεων είναι **μόνιμη**
 * ανακατεύθυνση (301/308). **Εδώ θα ήταν λάθος**, και ο λόγος είναι ότι ο
 * προορισμός **εξαρτάται από το ποιος ρωτά**: το `/dashboard` πάει σε **άλλο**
 * γραφείο για κάθε άνθρωπο. Ένα 308 είναι **cacheable** ⇒ ο φυλλομετρητής (ή
 * ένας ενδιάμεσος) θα κλείδωνε `/dashboard → /o/<γραφείο του Α>/dashboard` και
 * θα το σέρβιρε στον **Β**.
 *
 * Η μονιμότητα ανήκει **μόνο** στη σχέση *ταυτότητα → ψευδώνυμο*, που **δεν**
 * εξαρτάται από τον αιτούντα (ADR-787 §5.3 ζ) — **εκεί** 308.
 *
 * ⚠️ Το `redirect()` του Next είναι **307**· το `permanentRedirect()` είναι 308.
 * ⛔ **ΜΗΝ το αλλάξεις σε `permanentRedirect`.**
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 ΔΥΟ ΦΡΟΥΡΟΙ, ΑΛΛΙΩΣ ΤΟ ΔΙΧΤΥ ΓΙΝΕΤΑΙ ΤΟ ΠΡΟΒΛΗΜΑ
 * ─────────────────────────────────────────────────────────────────────────────
 * 1. **Ήδη προθεματισμένη** ⇒ 404. Χωρίς αυτό, ένα `/o/nikos/τυπογραφικό` θα
 *    ανακατευθυνόταν **στον εαυτό του** — βρόχος.
 * 2. **Εκτός εμβέλειας χώρου** ⇒ 404. Χωρίς αυτό, **κάθε** τυπογραφικό λάθος θα
 *    γινόταν ανακατεύθυνση, και το `not-found.tsx` δεν θα ζωγράφιζε ποτέ ξανά:
 *    το δίχτυ θα **κατάπινε τα γνήσια 404**.
 */

import { notFound, redirect } from 'next/navigation';

import { readPageIdentity } from '@/server/auth/page-identity';
import { AUTH_ROUTES } from '@/lib/routes';
import { workspacePath } from '@/lib/workspace/workspace-path';
import { isInsideWorkspace } from '@/lib/workspace/workspace-scope';
import { PERSONAL_WORKSPACE_ALIAS } from '@/types/workspace-alias';

interface UnprefixedPageProps {
  /** ⚠️ Next.js 15: `params` και `searchParams` είναι **Promise**. */
  readonly params: Promise<{ readonly unprefixed: readonly string[] }>;
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * ⚠️ Το ερώτημα **επιβιώνει**: ένα `/contacts?filter=…` που χάνει το φίλτρο του
 * προσγειώνεται σε λάθος οθόνη και ο άνθρωπος δεν έχει τρόπο να καταλάβει γιατί.
 */
function rebuildQuery(searchParams: Record<string, string | string[] | undefined>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (Array.isArray(value)) for (const v of value) query.append(key, v);
    else if (value !== undefined) query.append(key, value);
  }
  const serialized = query.toString();
  return serialized ? `?${serialized}` : '';
}

export default async function UnprefixedCatchAll({ params, searchParams }: UnprefixedPageProps) {
  const { unprefixed } = await params;
  const path = `/${unprefixed.map(encodeURIComponent).join('/')}`;

  // Φρουρός 2 (καλύπτει και τον 1: ο δείκτης «o» είναι εγγραφή του κλειστού
  // συνόλου, άρα η ήδη προθεματισμένη διεύθυνση απαντιέται από τον ΙΔΙΟ κανόνα).
  if (!isInsideWorkspace(path)) notFound();

  const identity = await readPageIdentity();
  if (!identity.ok) redirect(AUTH_ROUTES.login);

  // 🔴 ADR-807 — ΑΥΤΟΣ Ο ΚΛΑΔΟΣ ΗΤΑΝ ΝΕΚΡΟΣ ΚΩΔΙΚΑΣ ΜΕΧΡΙ ΣΗΜΕΡΑ.
  //
  // Γραμμένος ειδικά για τον άνθρωπο χωρίς γραφείο, και **δομικά ανέφικτος**: το
  // `readPageIdentity` απέρριπτε την απουσία `companyId` ως αποτυχία ταυτότητας,
  // άρα το `ok:true` συνεπαγόταν `companyId.length > 0` και το `hasOrganization()`
  // ήταν **πάντα** αληθές. Ο φρουρός από πάνω (`if (!identity.ok) redirect(login)`)
  // έστελνε τον αυτόνομο επαγγελματία στη σύνδεση **ενώ ήταν συνδεδεμένος** —
  // ατέρμονος βρόχος `/dashboard → /login`, μετρημένος ζωντανά 2026-08-25.
  //
  // ⚠️ Ο έλεγχος είναι πλέον στο **`scope`** και όχι στο `hasOrganization(ctx)`:
  //    το `ctx` του προσωπικού χώρου **δεν έχει καν** πεδίο `companyId`, οπότε η
  //    ερώτηση «έχει οργανισμό;» πάνω του δεν είναι απλώς περιττή — είναι λάθος
  //    ερώτηση. Ο μεταγλωττιστής το επιβάλλει (`PersonalIdentityContext`).
  const alias =
    identity.scope === 'organization' ? identity.ctx.companyId : PERSONAL_WORKSPACE_ALIAS;

  redirect(`${workspacePath(alias, path)}${rebuildQuery(await searchParams)}`);
}
