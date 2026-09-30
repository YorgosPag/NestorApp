/**
 * **Verified fake** — η σουίτα συμβολαίου του Firestore στον **πραγματικό** emulator (ADR-742 §7sexdecies).
 *
 * Ίδιοι ισχυρισμοί με το `src/test-utils/fake-firestore/__tests__/fake-firestore.contract.test.ts`. Εδώ δεν δηλώνεται
 * καμία απόκλιση: ό,τι κοκκινίζει εδώ είναι **λάθος του συμβολαίου** (ισχυρισμός που δεν ισχύει στο αληθινό), ποτέ
 * «απόκλιση του fake».
 *
 * Επαναχρησιμοποιεί τον harness του Admin SDK των functions-integration (`getAdminApp` · `clearFirestore` · `teardown`).
 */

import { clearFirestore, getAdminApp, teardown } from '../../functions-integration/_harness/emulator';
import { describeFirestoreContract } from '@/test-utils/fake-firestore/contract/firestore-contract';
import type { ContractDb } from '@/test-utils/fake-firestore/contract/firestore-contract-kit';

afterAll(() => teardown());

describeFirestoreContract({
  name: 'emulator',
  db: () => getAdminApp().firestore() as unknown as ContractDb,
  reset: () => clearFirestore(),
});
