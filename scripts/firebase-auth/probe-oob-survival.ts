#!/usr/bin/env tsx
/**
 * **ΕΠΙΖΕΙ Ο ΕΚΚΡΕΜΗΣ ΚΩΔΙΚΟΣ ΑΛΛΑΓΗΣ EMAIL;** — ADR-844 §13.8, η εκτελέσιμη απόδειξη.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ΕΚΤΕΛΕΣΗ (ΜΟΝΟ ΠΑΡΑΓΩΓΗ)
 * ═══════════════════════════════════════════════════════════════════════════
 *   npm run firebase-auth:probe:oob
 *
 * Φτιάχνει **throwaway** λογαριασμούς `probe-<run>-*@example.com` (καμία παράδοση email σε
 * άνθρωπο), παράγει κωδικό `VERIFY_AND_CHANGE_EMAIL` προς διεύθυνση «επιτιθέμενου», κάνει
 * μια πράξη, και ρωτά: **εφαρμόζεται ακόμη;** Κάθε λογαριασμός σβήνεται στο `finally`.
 * Exit 1 αν **οποιοδήποτε** σενάριο απαντήσει διαφορετικά από το αναμενόμενο — δηλαδή αν
 * η Firebase άλλαξε σημασιολογία κάτω από τα πόδια μας.
 *
 * ⛔ **ΑΡΝΕΙΤΑΙ ΝΑ ΤΡΕΞΕΙ ΣΕ EMULATOR, ΚΑΙ ΕΙΝΑΙ ΤΟ ΚΕΝΤΡΟ ΤΟΥ ΑΡΧΕΙΟΥ.** Μετρημένο
 * 2026-09-11: ο emulator απάντησε **ανάποδα** στα κρίσιμα σενάρια (η παλιά διεκδίκηση
 * «σκότωνε» τον κωδικό· η επαναδημιουργία «όχι»). Μια σουίτα στον emulator θα ήταν
 * **πράσινη ακριβώς πάνω στην τρύπα**.
 *
 * 🔑 Το σενάριο **Δ** τρέχει την **πραγματική** `reprovisionAuthAccount` — δεν αποδεικνύει
 * μόνο ότι «η διαγραφή σκοτώνει τον κωδικό», αποδεικνύει ότι **ο κώδικάς μας** το κάνει.
 *
 * @see src/server/auth/account-reprovision.ts
 */

import { applyEnvLocal } from '../_shared/loadEnvLocal';

applyEnvLocal();

type Expected = 'survives' | 'dies';

interface Scenario {
  readonly id: string;
  readonly expected: Expected;
  readonly act: (uid: string, email: string) => Promise<void>;
}

const RUN = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

async function main(): Promise<void> {
  if (process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    throw new Error('⛔ Ο emulator απαντά ΑΝΑΠΟΔΑ σε αυτή τη σημασιολογία (ADR-844 §13.8) — μόνο παραγωγή.');
  }
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!apiKey) throw new Error('Λείπει NEXT_PUBLIC_FIREBASE_API_KEY');

  const { getAdminAuth } = await import('@/lib/firebaseAdmin');
  const { reprovisionAuthAccount } = await import('@/server/auth/account-reprovision');
  const auth = getAdminAuth();

  const legacyClaim = async (uid: string) => {
    await auth.updateUser(uid, { emailVerified: true, providersToUnlink: ['password'] });
    await auth.revokeRefreshTokens(uid);
  };
  const linkAttackerGoogle = async (uid: string) => {
    await auth.updateUser(uid, {
      providerToLink: { providerId: 'google.com', uid: `probe-google-${RUN}-${uid.slice(0, 6)}`, email: `probe-${RUN}-trojan@example.com` },
    });
  };

  const scenarios: readonly Scenario[] = [
    { id: 'Α τίποτα (baseline)', expected: 'survives', act: async () => undefined },
    { id: 'Β παλιά διεκδίκηση', expected: 'survives', act: legacyClaim },
    { id: 'Γ Google επιτιθέμενου + παλιά διεκδίκηση', expected: 'survives', act: async (uid) => { await linkAttackerGoogle(uid); await legacyClaim(uid); } },
    { id: 'Δ reprovisionAuthAccount (ο ΚΩΔΙΚΑΣ ΜΑΣ)', expected: 'dies', act: async (uid, email) => { await reprovisionAuthAccount(uid, email); } },
    { id: 'Ε Google επιτιθέμενου + reprovisionAuthAccount', expected: 'dies', act: async (uid, email) => { await linkAttackerGoogle(uid); await reprovisionAuthAccount(uid, email); } },
  ];

  const created = new Set<string>();
  const emails = new Set<string>();
  let failures = 0;
  try {
    for (const [index, scenario] of scenarios.entries()) {
      const email = `probe-${RUN}-${index}@example.com`;
      const attacker = `probe-${RUN}-${index}-attacker@example.com`;
      emails.add(email).add(attacker);
      const user = await auth.createUser({ email, password: `Probe-${RUN}-x9!Aa`, emailVerified: false });
      created.add(user.uid);

      const link = await auth.generateVerifyAndChangeEmailLink(email, attacker);
      const oobCode = new URL(link).searchParams.get('oobCode');
      await scenario.act(user.uid, email);

      const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:update?key=${apiKey}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', referer: 'https://nestorconstruct.gr/' },
        body: JSON.stringify({ oobCode }),
      });
      const actual: Expected = response.ok ? 'survives' : 'dies';
      const verdict = actual === scenario.expected ? '✅' : '❌';
      if (actual !== scenario.expected) failures += 1;
      const after = await auth.getUser(user.uid)
        .then((u) => u.providerData.map((p) => p.providerId).join('+') || 'none')
        .catch(() => 'gone');
      console.log(`${verdict} ${scenario.id.padEnd(48)} κωδικός: ${actual.padEnd(8)} (αναμενόταν ${scenario.expected}) · πάροχοι: ${after}`);
    }
  } finally {
    for (const email of emails) {
      const owner = await auth.getUserByEmail(email).then((u) => u.uid).catch(() => null);
      if (owner) created.add(owner);
    }
    await auth.deleteUsers([...created]);
    console.log(`\nΚαθαρισμός: ${created.size} throwaway λογαριασμοί σβήστηκαν.`);
  }

  process.exitCode = failures === 0 ? 0 : 1;
  console.log(failures === 0 ? '✅ Η σημασιολογία της Firebase είναι αυτή που προϋποθέτει ο κώδικας.' : `❌ ${failures} σενάρια άλλαξαν — ΞΑΝΑΚΡΙΝΕ το ADR-844 §13.8.`);
}

main().catch((error: unknown) => {
  console.error('❌', error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
