/**
 * Το πρόγραμμα αυτόματης επανάληψης — χωρίς μνήμη ανάμεσα στις επαναφορτώσεις θα ήταν
 * βρόχος ανά 5″ για πάντα πάνω σε server που ήδη υποφέρει.
 */

import {
  BACKEND_RETRY_POLICY,
  readAttempt,
  recordAttempt,
  secondsUntilRetry,
  type AttemptStore,
} from '../backend-retry-schedule';

const memoryStore = (): AttemptStore & { readonly data: Map<string, string> } => {
  const data = new Map<string, string>();
  return { data, getItem: (key) => data.get(key) ?? null, setItem: (key, value) => void data.set(key, value) };
};

const NOW = 1_790_000_000_000;
const PATH = '/pro/grafeio';

describe('secondsUntilRetry', () => {
  it('μεγαλώνει εκθετικά ως το ταβάνι (χωρίς jitter: random=1 ⇒ το ανώτατο)', () => {
    const seconds = Array.from({ length: BACKEND_RETRY_POLICY.maxRetries }, (_, attempt) => secondsUntilRetry(attempt, () => 1));
    expect(seconds).toEqual([5, 10, 20, 40, 60]);
  });

  it('έχει jitter: ποτέ κάτω από το μισό — χίλιοι browsers δεν χτυπούν μαζί', () => {
    expect(secondsUntilRetry(0, () => 0)).toBe(3); // 2,5″ ⇒ στρογγυλοποίηση
    expect(secondsUntilRetry(4, () => 0)).toBe(30);
  });

  it('εξαντλείται: μετά το όριο αποφασίζει ο άνθρωπος', () => {
    expect(secondsUntilRetry(BACKEND_RETRY_POLICY.maxRetries)).toBeNull();
  });
});

describe('readAttempt / recordAttempt', () => {
  it('ο μετρητής επιβιώνει ανά διεύθυνση', () => {
    const store = memoryStore();
    recordAttempt(store, PATH, 2, NOW);
    expect(readAttempt(store, PATH, NOW + 1_000)).toBe(2);
    expect(readAttempt(store, '/pro/allo', NOW)).toBe(0);
  });

  it('μπαγιάτικος μετρητής (>5′) αγνοείται — παλιά βλάβη δεν καθυστερεί τη σημερινή πρώτη δοκιμή', () => {
    const store = memoryStore();
    recordAttempt(store, PATH, 4, NOW);
    expect(readAttempt(store, PATH, NOW + 5 * 60_000 + 1)).toBe(0);
  });

  it('χαλασμένο περιεχόμενο ⇒ 0, ποτέ εξαίρεση', () => {
    const store = memoryStore();
    store.setItem(`nestor:backend-retry:${PATH}`, '{not json');
    expect(readAttempt(store, PATH, NOW)).toBe(0);
  });

  it('αποθήκευση που πετά (ιδιωτικό παράθυρο) ⇒ η επανάληψη συνεχίζει χωρίς μνήμη', () => {
    const throwing: AttemptStore = {
      getItem: () => { throw new Error('SecurityError'); },
      setItem: () => { throw new Error('QuotaExceededError'); },
    };
    expect(readAttempt(throwing, PATH, NOW)).toBe(0);
    expect(() => recordAttempt(throwing, PATH, 1, NOW)).not.toThrow();
    expect(readAttempt(null, PATH, NOW)).toBe(0);
  });
});
