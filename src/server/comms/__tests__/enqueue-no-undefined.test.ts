/**
 * @jest-environment node
 *
 * @fileoverview 🔴 **ΤΟ ΕΓΓΡΑΦΟ ΠΟΥ ΦΤΑΝΕΙ ΣΤΗ FIRESTORE ΔΕΝ ΚΟΥΒΑΛΑ `undefined`.**
 * @related ADR-834 §6.5.γ · server/comms/orchestrator.ts · utils/firestore-sanitize.ts
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΙ ΜΕΤΡΗΘΗΚΕ, ΚΑΙ ΓΙΑΤΙ ΚΑΝΕΝΑ ΠΡΑΣΙΝΟ ΔΕΝ ΤΟ ΕΙΧΕ ΔΕΙ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * 2026-08-31, ζωντανά: η συλλογή `messages` είχε **μηδέν** έγγραφα με
 * `direction: 'outbound'`. **Κανένα** εξερχόμενο μήνυμα δεν είχε γραφτεί ποτέ.
 *
 * Η ρίζα: το `metadata` παίρνει `templateId` / `campaignId` / `variables` **αυτούσια**
 * από τον καλούντα, και κάθε καλών που δεν τα δίνει *(π.χ. η πρόσκληση συγκατάθεσης
 * του ADR-834)* παράγει `undefined`. Το Admin SDK εδώ **δεν** έχει
 * `ignoreUndefinedProperties` ⇒ το `set` πετά ⇒ το `safeDbOperation` γυρίζει το
 * fallback ⇒ `success: false` ⇒ ο καλών το λέει `failed` **χωρίς κανείς να μάθει
 * γιατί**.
 *
 * 🔑 **Και η οθόνη το μετέφραζε σε ΨΕΜΑ**: ο κατάλογος εντολών έγραφε *«Η επαφή δεν
 * είχε διεύθυνση email τη στιγμή της καταχώρησης»* για επαφή που **είχε** email.
 *
 * ⚠️ **Η ερώτηση εδώ δεν είναι «γράφτηκε μήνυμα;» — είναι «ΜΠΟΡΕΙ να γραφτεί;»**. Οι
 * υπάρχουσες άγκυρες της αλληλογραφίας αντικαθιστούν το `enqueueMessage` **ολόκληρο**,
 * οπότε το σχήμα του εγγράφου δεν το κοίταξε ποτέ κανείς. Ίδια κλάση με το §9 του
 * ADR-834: *«η συνάρτηση ήταν σωστή — σε λάθος θέση»*, εδώ *«ο έλεγχος ήταν σωστός —
 * σε λάθος επίπεδο»*.
 */

import { Timestamp } from 'firebase-admin/firestore';

/** Ό,τι έφτασε στο `setDoc`, δηλαδή ό,τι θα δεχόταν η πραγματική Firestore. */
let written: Record<string, unknown> | null = null;

jest.mock('@/app/api/communications/webhooks/telegram/firebase/availability', () => ({
  isFirebaseAvailable: () => true,
}));

jest.mock('@/app/api/communications/webhooks/telegram/firebase/safe-op', () => ({
  safeDbOperation: async (operation: (db: unknown) => Promise<unknown>) => operation({}),
}));

jest.mock('@/app/api/communications/webhooks/telegram/firebase/helpers-lazy', () => ({
  getFirestoreHelpers: async () => ({
    collection: (name: string) => ({ name }),
    doc: (ref: unknown, id: string) => ({ ref, id }),
    setDoc: async (_ref: unknown, data: Record<string, unknown>) => {
      written = data;
    },
    Timestamp,
  }),
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { enqueueMessage } =
  require('@/server/comms/orchestrator') as typeof import('@/server/comms/orchestrator');

/** Τα μονοπάτια όπου κάθεται `undefined` — **ονομαστικά**, ώστε το κόκκινο να διδάσκει. */
function undefinedPaths(value: unknown, path = ''): string[] {
  if (value === undefined) return [path === '' ? '<ρίζα>' : path];
  if (value === null || typeof value !== 'object') return [];
  if (!(Object.getPrototypeOf(value) === Object.prototype)) return [];

  return Object.entries(value as Record<string, unknown>).flatMap(([key, item]) =>
    undefinedPaths(item, path === '' ? key : `${path}.${key}`),
  );
}

/**
 * ⚠️ **Ο ΕΛΑΧΙΣΤΟΣ καλών: μόνο τα υποχρεωτικά.** Ακριβώς αυτό κάνει η πρόσκληση
 * συγκατάθεσης — και ακριβώς αυτό έσπαγε. Ένας καλών που δίνει **τα πάντα** θα ήταν
 * πράσινος πάνω στο ελάττωμα.
 */
async function enqueueMinimal() {
  written = null;
  return enqueueMessage({
    channels: ['email'],
    to: 'kostas@example.gr',
    subject: 'θέμα',
    content: 'σώμα',
  });
}

describe('🔑 Χ — ο ΠΑΡΟΝΟΜΑΣΤΗΣ: η γραφή ΕΓΙΝΕ και το έγγραφο έχει περιεχόμενο', () => {
  it('Χ0 — το `setDoc` κλήθηκε, με τα πεδία που περιμένει ο αγωγός', async () => {
    const result = await enqueueMinimal();

    expect(result.success).toBe(true);
    expect(written).not.toBeNull();
    expect(written).toMatchObject({ channel: 'email', direction: 'outbound', status: 'pending' });
  });

  it('Χ1 — και ο ανιχνευτής ΜΠΟΡΕΙ να πει «βρήκα»', async () => {
    // 🔴 Χωρίς αυτό, το πράσινο του Ψ1 θα ήταν πράσινο πάνω σε ανιχνευτή που
    //    **δεν βρίσκει ποτέ τίποτα** — δηλαδή «0 = κανείς δεν κοίταξε».
    expect(undefinedPaths({ a: 1, b: { c: undefined } })).toEqual(['b.c']);
  });
});

describe('🔴 Ψ — ΚΑΜΙΑ τιμή `undefined` δεν φεύγει προς τη Firestore', () => {
  it('🔴 Ψ1 — ελάχιστος καλών ⇒ μηδέν `undefined` σε όλο το έγγραφο', async () => {
    await enqueueMinimal();
    expect(undefinedPaths(written)).toEqual([]);
  });

  it('🔑 Ψ2 — τα προαιρετικά που ΔΕΝ δόθηκαν έγιναν `null`, όχι κενά', async () => {
    // `null` και όχι «λείπει το κλειδί»: ο αγωγός που αδειάζει την ουρά διαβάζει
    // `metadata.templateId` και οφείλει να πάρει **ρητή απουσία**.
    await enqueueMinimal();
    expect((written as { metadata: Record<string, unknown> }).metadata).toMatchObject({
      templateId: null,
      campaignId: null,
      variables: null,
    });
  });
});
