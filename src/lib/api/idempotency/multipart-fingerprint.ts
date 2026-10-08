/**
 * @module lib/api/idempotency/multipart-fingerprint
 * @description **«Είναι αυτό το ίδιο ανέβασμα;»** — η κανονική μορφή ενός σώματος `multipart/form-data`
 * (ADR-872 §3 απόφαση 6β · ADR-909 Β2.0).
 *
 * 🔴 **ΓΙΑΤΙ ΟΧΙ ΤΟ ΩΜΟ ΣΩΜΑ**, όπως στο JSON: ο browser γεννά **νέο τυχαίο `boundary` σε κάθε αίτηση**. Δύο
 * αποστολές των **ίδιων** bytes διαφέρουν ως κείμενο, άρα αποτύπωμα πάνω στο ωμό σώμα θα απαντούσε
 * `KEY_REUSED` στην πρώτη κιόλας επανάληψη — ακριβώς στην περίπτωση που το κλειδί υπάρχει για να σώσει.
 *
 * | μέρος | μπαίνει στη μορφή ως |
 * |---|---|
 * | κείμενο | όνομα πεδίου · τιμή |
 * | αρχείο | όνομα πεδίου · `type` · μέγεθος · SHA-256 των **bytes** |
 *
 * ⛔ **Όχι το όνομα του αρχείου**: είναι ετικέτα του πελάτη, όχι περιεχόμενο — το ίδιο αρχείο με άλλο όνομα
 * είναι η **ίδια** πράξη. ⛔ **Όχι η σειρά των μερών**: το `FormData` δεν υπόσχεται σειρά μεταξύ υλοποιήσεων.
 *
 * ⚠️ **Καθαρό module** — καμία I/O πέρα από την ανάγνωση των ίδιων των μερών.
 */

import { sha256Hex } from '@/lib/hash/sha256';

/** Ένα μέρος, σε μορφή που δεν συγχέεται με κανένα άλλο (JSON πλειάδας — κανένας αυτοσχέδιος διαχωριστής). */
async function canonicalPartOf(name: string, value: FormDataEntryValue): Promise<string> {
  if (typeof value === 'string') return JSON.stringify(['text', name, value]);
  const digest = await sha256Hex(await value.arrayBuffer());
  return JSON.stringify(['file', name, value.type, value.size, digest]);
}

/**
 * **Η κανονική μορφή του σώματος** — ίδια για κάθε αποστολή των ίδιων μερών, ό,τι `boundary` κι αν έχει.
 *
 * 🔑 Τα μέρη ταξινομούνται **ως ολόκληρες γραμμές**: πεδίο που επαναλαμβάνεται μένει δύο φορές (πολυσύνολο),
 * και δύο σώματα με τα ίδια μέρη σε άλλη σειρά δίνουν την ίδια μορφή.
 */
export async function canonicalMultipartOf(form: FormData): Promise<string> {
  const parts = await Promise.all([...form.entries()].map(([name, value]) => canonicalPartOf(name, value)));
  return parts.sort().join('\n');
}
