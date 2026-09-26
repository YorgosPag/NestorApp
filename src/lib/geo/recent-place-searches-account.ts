/**
 * **Το ιστορικό αναζητήσεων τόπου ΤΟΥ ΛΟΓΑΡΙΑΣΜΟΥ** — ακολουθεί τον συνδεδεμένο άνθρωπο σε
 * κάθε συσκευή (ADR-882 Φάση 2, όπως Zillow/Google).
 *
 * @related `recent-place-searches-account-model` (ο κανόνας) · `…-transport` (το Firestore) ·
 *          `recent-place-searches` (η πρόσοψη που διαλέγει συσκευή ή λογαριασμό)
 *
 * Κύκλος ζωής — **ένας ιδιοκτήτης**, αυτή η μονάδα:
 * 1. `bindAccountPlaceSearches(uid)` — ιδεμποτικό (ίδιο uid ⇒ τίποτα)· ζωντανή ανάγνωση.
 * 2. Πρώτο στιγμιότυπο ⇒ **υιοθεσία** των πρόσφατων (24h) αναζητήσεων της συσκευής, και μόνο
 *    όταν ο server επιβεβαιώσει τη γραφή φεύγουν από τη συσκευή (καμία απώλεια αν κοπεί).
 * 3. Κάθε πράξη εφαρμόζεται **αμέσως** στη μνήμη (η οθόνη δεν περιμένει δίκτυο) και γράφεται
 *    στο παρασκήνιο· το στιγμιότυπο που επιστρέφει είναι το ίδιο αποτέλεσμα (ίδιος κανόνας).
 * 4. Αποσύνδεση (`auth:logout` ή `bind(null)`) ⇒ η μνήμη αδειάζει **αμέσως**.
 *
 * 🔒 **Ο ΛΟΓΑΡΙΑΣΜΟΣ ΔΕΝ ΓΡΑΦΕΙ ΠΟΤΕ ΣΤΟΝ ΔΙΣΚΟ**: μετά την αποσύνδεση ο επόμενος στην ίδια
 * συσκευή δεν βλέπει τι έψαξε ο προηγούμενος.
 *
 * 🛟 **Αν ο λογαριασμός δεν απαντά** (π.χ. κανόνες που δεν ανέβηκαν ακόμη ⇒ permission-denied),
 * η κατάσταση γίνεται `unavailable` και η πρόσοψη πέφτει **ήσυχα** στο ιστορικό της συσκευής.
 */

import { createExternalStore } from '@/lib/state/createExternalStore';
import { createModuleLogger } from '@/lib/telemetry';
import {
  NO_RECENT_PLACE_SEARCHES,
  placeSearchKey,
  type RecentPlaceSearch,
} from './recent-place-searches-model';
import { readDevicePlaceSearches, writeDevicePlaceSearches } from './recent-place-searches-device';
import {
  EMPTY_ACCOUNT_PLACE_SEARCHES,
  applyAccountPatch,
  clearAccountPatch,
  forgetAccountPatch,
  guestEntriesToAdopt,
  guestMergePatch,
  isEmptyAccountPatch,
  liveAccountPlaceSearches,
  parseAccountPlaceSearches,
  rememberAccountPatch,
  type AccountPatch,
  type AccountPlaceSearchState,
} from './recent-place-searches-account-model';

const logger = createModuleLogger('RecentPlaceSearchesAccount');

type Transport = typeof import('./recent-place-searches-account-transport');
type AccountStatus = 'unbound' | 'loading' | 'live' | 'unavailable';

interface Binding {
  readonly uid: string;
  status: AccountStatus;
  state: AccountPlaceSearchState;
  list: readonly RecentPlaceSearch[];
  adopted: boolean;
  unsubscribe: () => void;
}

let binding: Binding | null = null;
let logoutListenerInstalled = false;
const version = createExternalStore<number>(0);

function notify(): void {
  version.set(version.get() + 1);
}

function loadTransport(): Promise<Transport> {
  return import('./recent-place-searches-account-transport');
}

/** **Ενεργός** = ο λογαριασμός είναι η πηγή (φορτώνει ή ζει). Αλλιώς μιλά η συσκευή. */
export function isAccountPlaceSearchesActive(): boolean {
  return binding !== null && (binding.status === 'loading' || binding.status === 'live');
}

export function getAccountPlaceSearchesSnapshot(): readonly RecentPlaceSearch[] {
  return binding?.list ?? NO_RECENT_PLACE_SEARCHES;
}

export function subscribeAccountPlaceSearches(listener: () => void): () => void {
  return version.subscribe(listener);
}

function setState(target: Binding, state: AccountPlaceSearchState): void {
  target.state = state;
  const list = liveAccountPlaceSearches(state);
  target.list = list.length === 0 ? NO_RECENT_PLACE_SEARCHES : list;
}

function commit(patch: AccountPatch | null): Promise<void> {
  const target = binding;
  if (target === null || patch === null || isEmptyAccountPatch(patch)) return Promise.resolve();
  setState(target, applyAccountPatch(target.state, patch));
  notify();
  return loadTransport().then((transport) => transport.writeAccountPatch(target.uid, patch));
}

function report(action: string): (error: unknown) => void {
  return (error) => logger.warn('Account write failed', { action, error: String(error) });
}

/** Στη σύνδεση: ο λογαριασμός υιοθετεί τις πρόσφατες της συσκευής, και μετά αυτές φεύγουν από εκεί. */
function adoptGuestSearches(target: Binding): void {
  target.adopted = true;
  const now = Date.now();
  const guest = readDevicePlaceSearches();
  const adopted = new Set(guestEntriesToAdopt(guest, now).map((place) => placeSearchKey(place.label)));
  if (adopted.size === 0) return;
  const forgetOnDevice = () => {
    if (binding !== target) return;
    writeDevicePlaceSearches(readDevicePlaceSearches().filter((p) => !adopted.has(placeSearchKey(p.label))));
  };
  commit(guestMergePatch(target.state, guest, now)).then(forgetOnDevice, report('adopt'));
}

function onAccountDoc(target: Binding, raw: unknown): void {
  if (binding !== target) return;
  setState(target, parseAccountPlaceSearches(raw));
  target.status = 'live';
  notify();
  if (!target.adopted) adoptGuestSearches(target);
}

function onAccountError(target: Binding, error: Error): void {
  if (binding !== target) return;
  logger.warn('Account history unavailable — falling back to device', { error: error.message });
  target.status = 'unavailable';
  notify();
}

function installLogoutListener(): void {
  if (logoutListenerInstalled || typeof window === 'undefined') return;
  logoutListenerInstalled = true;
  // Belt-and-suspenders: η αποσύνδεση αδειάζει τη μνήμη ακόμη κι αν κανένα κουτί δεν είναι ανοιχτό.
  window.addEventListener('auth:logout', () => bindAccountPlaceSearches(null));
}

/** Ιδεμποτικό: ίδιο uid ⇒ τίποτα· άλλο ⇒ αποδέσμευση του παλιού, δέσμευση του νέου· `null` ⇒ ανώνυμος. */
export function bindAccountPlaceSearches(uid: string | null): void {
  if ((binding?.uid ?? null) === uid) return;
  binding?.unsubscribe();
  binding = null;
  if (uid !== null) {
    installLogoutListener();
    const target: Binding = {
      uid, status: 'loading', state: EMPTY_ACCOUNT_PLACE_SEARCHES,
      list: NO_RECENT_PLACE_SEARCHES, adopted: false, unsubscribe: () => undefined,
    };
    binding = target;
    let cancelled = false;
    target.unsubscribe = () => { cancelled = true; };
    loadTransport().then((transport) => {
      if (cancelled) return;
      const stop = transport.subscribeAccountDoc(uid, (raw) => onAccountDoc(target, raw), (error) => onAccountError(target, error));
      target.unsubscribe = stop;
    }, (error: unknown) => onAccountError(target, error instanceof Error ? error : new Error(String(error))));
  }
  notify();
}

export function rememberAccountPlaceSearch(entry: RecentPlaceSearch): void {
  if (binding === null) return;
  commit(rememberAccountPatch(binding.state, entry)).catch(report('remember'));
}

export function forgetAccountPlaceSearch(label: string): void {
  if (binding === null) return;
  commit(forgetAccountPatch(binding.state, label, Date.now())).catch(report('forget'));
}

export function clearAccountPlaceSearches(): void {
  if (binding === null) return;
  commit(clearAccountPatch(Date.now())).catch(report('clear'));
}
