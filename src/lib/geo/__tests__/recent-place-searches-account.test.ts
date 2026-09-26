/**
 * @jest-environment jsdom
 *
 * ADR-882 Φάση 2 — η πρόσοψη με συνδεδεμένο άνθρωπο: ο λογαριασμός είναι η πηγή, η συσκευή
 * δεν αγγίζεται, η υιοθεσία ανεβάζει και μετά αφαιρεί, η αποσύνδεση αδειάζει αμέσως, και ο
 * λογαριασμός που δεν απαντά πέφτει ήσυχα στη συσκευή.
 */

import {
  bindAccountPlaceSearches,
  clearPlaceSearches,
  getRecentPlaceSearchesSnapshot,
  readRecentPlaceSearches,
  rememberPlaceSearch,
} from '../recent-place-searches';
import type { AccountPatch } from '../recent-place-searches-account-model';

const mockWrite = jest.fn<Promise<void>, [string, AccountPatch]>();
const mockSubscribe = jest.fn<() => void, [string, (raw: unknown) => void, (error: Error) => void]>();

jest.mock('../recent-place-searches-account-transport', () => ({
  writeAccountPatch: (uid: string, patch: AccountPatch) => mockWrite(uid, patch),
  subscribeAccountDoc: (uid: string, onData: (raw: unknown) => void, onError: (error: Error) => void) =>
    mockSubscribe(uid, onData, onError),
}));

const CENTER = { lat: 37.98, lng: 23.73 };
const UID = 'user-1';

let deliver: (raw: unknown) => void = () => undefined;
let fail: (error: Error) => void = () => undefined;

async function flush(): Promise<void> {
  for (let i = 0; i < 5; i += 1) await Promise.resolve();
}

async function signIn(doc: unknown = null): Promise<void> {
  bindAccountPlaceSearches(UID);
  await flush();
  deliver(doc);
  await flush();
}

beforeEach(() => {
  window.localStorage.clear();
  mockWrite.mockReset().mockResolvedValue(undefined);
  mockSubscribe.mockReset().mockImplementation((_uid, onData, onError) => {
    deliver = onData;
    fail = onError;
    return () => undefined;
  });
});

afterEach(() => bindAccountPlaceSearches(null));

it('συνδεδεμένος: γράφει στον λογαριασμό, ΟΧΙ στη συσκευή, και η οθόνη αλλάζει αμέσως', async () => {
  await signIn();
  rememberPlaceSearch('Αθήνα', CENTER, 1000);
  expect(getRecentPlaceSearchesSnapshot().map((p) => p.label)).toEqual(['Αθήνα']);
  expect(readRecentPlaceSearches()).toEqual([]);
  await flush();
  expect(mockWrite).toHaveBeenCalledWith(UID, expect.objectContaining({ put: { 'αθηνα': expect.objectContaining({ label: 'Αθήνα' }) } }));
});

it('η αλλαγή από άλλη συσκευή φτάνει ζωντανά', async () => {
  await signIn();
  deliver({ entries: { 'πατρα': { label: 'Πάτρα', center: CENTER, savedAt: 5 } } });
  expect(getRecentPlaceSearchesSnapshot().map((p) => p.label)).toEqual(['Πάτρα']);
});

it('υιοθεσία: οι πρόσφατες της συσκευής ανεβαίνουν, και φεύγουν από τη συσκευή ΜΟΝΟ μετά την επιβεβαίωση', async () => {
  rememberPlaceSearch('Βόλος', CENTER, Date.now());
  let confirm: () => void = () => undefined;
  mockWrite.mockImplementationOnce(() => new Promise<void>((resolve) => { confirm = resolve; }));
  await signIn();
  expect(mockWrite).toHaveBeenCalledWith(UID, expect.objectContaining({ put: { 'βολος': expect.anything() } }));
  expect(readRecentPlaceSearches().map((p) => p.label)).toEqual(['Βόλος']);
  confirm();
  await flush();
  expect(readRecentPlaceSearches()).toEqual([]);
});

it('αποσύνδεση (auth:logout): το ιστορικό του λογαριασμού φεύγει αμέσως από την οθόνη', async () => {
  await signIn({ entries: { 'πατρα': { label: 'Πάτρα', center: CENTER, savedAt: 5 } } });
  window.dispatchEvent(new CustomEvent('auth:logout'));
  expect(getRecentPlaceSearchesSnapshot()).toEqual([]);
});

it('«Καθαρισμός» στον λογαριασμό σβήνει στον server, όχι στη συσκευή', async () => {
  await signIn({ entries: { 'πατρα': { label: 'Πάτρα', center: CENTER, savedAt: 5 } } });
  clearPlaceSearches();
  expect(getRecentPlaceSearchesSnapshot()).toEqual([]);
  await flush();
  expect(mockWrite).toHaveBeenCalledWith(UID, expect.objectContaining({ clearedAt: expect.any(Number) }));
});

it('λογαριασμός που δεν απαντά ⇒ ήσυχη πτώση στο ιστορικό της συσκευής', async () => {
  bindAccountPlaceSearches(UID);
  await flush();
  fail(new Error('permission-denied'));
  rememberPlaceSearch('Χανιά', CENTER, 1000);
  expect(readRecentPlaceSearches().map((p) => p.label)).toEqual(['Χανιά']);
  expect(getRecentPlaceSearchesSnapshot().map((p) => p.label)).toEqual(['Χανιά']);
  expect(mockWrite).not.toHaveBeenCalled();
});
