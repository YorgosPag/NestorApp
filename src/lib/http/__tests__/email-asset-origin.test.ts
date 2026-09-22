/**
 * @fileoverview **Η ΔΙΕΥΘΥΝΣΗ ΤΩΝ ΔΥΑΔΙΚΩΝ** — άγκυρες Θ1-Θ4 του ADR-853 §19.
 *
 * 🔑 Η ερώτηση που φυλάνε: *«μπορεί να φύγει `<img src>` που ο proxy εικόνων της Google
 * **δεν θα φτάσει ποτέ**;»* — όχι «επιστρέφει η συνάρτηση κάτι».
 *
 * ⚠️ Κάθε περίπτωση δηλώνει **και** τι κάνει κόκκινη τη μετάλλαξη που την ακυρώνει.
 */

import { emailAssetOrigin, emailAssetUrl } from '../public-origin';

const ASSET_VAR = 'NEXT_PUBLIC_EMAIL_ASSET_ORIGIN';
const APP_VAR = 'NEXT_PUBLIC_APP_URL';

/** Θέτει το περιβάλλον **ρητά**: `null` σημαίνει «η μεταβλητή δεν υπάρχει καθόλου». */
function withEnv(asset: string | null, app: string | null, assertion: () => void): void {
  const originals = { asset: process.env[ASSET_VAR], app: process.env[APP_VAR] };
  try {
    if (asset === null) delete process.env[ASSET_VAR];
    else process.env[ASSET_VAR] = asset;
    if (app === null) delete process.env[APP_VAR];
    else process.env[APP_VAR] = app;
    assertion();
  } finally {
    if (originals.asset === undefined) delete process.env[ASSET_VAR];
    else process.env[ASSET_VAR] = originals.asset;
    if (originals.app === undefined) delete process.env[APP_VAR];
    else process.env[APP_VAR] = originals.app;
  }
}

describe('Θ — η διεύθυνση των δυαδικών δεν μαντεύεται ποτέ', () => {
  // Μετάλλαξη που κοκκινίζει: `return origin ?? ''` αντί για `null` στο `emailAssetUrl`.
  it('Θ1 — καμία ρύθμιση ⇒ null, ποτέ κενή συμβολοσειρά', () => {
    withEnv(null, null, () => {
      expect(emailAssetOrigin()).toBeNull();
      expect(emailAssetUrl('/images/nestor-app-logo.jpg')).toBeNull();
    });
  });

  // 🔴 Η ΚΑΡΔΙΑ ΤΟΥ Ε-Θ. Μετάλλαξη που κοκκινίζει: αφαίρεση του ελέγχου `https`/δημόσιου
  // host ⇒ θα επέστρεφε `http://localhost:3000/...`, που ο proxy της Google δεν φτάνει
  // ΠΟΤΕ — ούτε καν στη δική μας οθόνη.
  it('Θ2 — localhost στη διεύθυνση συνδέσμων ⇒ ΚΑΜΙΑ διεύθυνση assets', () => {
    withEnv(null, 'http://localhost:3000', () => {
      expect(emailAssetOrigin()).toBeNull();
    });
  });

  // Μετάλλαξη που κοκκινίζει: αφαίρεση της εφεδρείας στο `publicOrigin()` ⇒ η παραγωγή θα
  // έμενε ΧΩΡΙΣ λογότυπα την ημέρα της ανάπτυξης, μέχρι να ρυθμιστεί νέα μεταβλητή.
  it('Θ3 — η παραγωγή δουλεύει ΧΩΡΙΣ νέα ρύθμιση', () => {
    withEnv(null, 'https://nestorconstruct.gr', () => {
      expect(emailAssetOrigin()).toBe('https://nestorconstruct.gr');
      expect(emailAssetUrl('/images/nestor-app-logo.jpg'))
        .toBe('https://nestorconstruct.gr/images/nestor-app-logo.jpg');
    });
  });

  // Μετάλλαξη που κοκκινίζει: αντιστροφή της σειράς προτεραιότητας.
  it('Θ4 — η δηλωμένη διεύθυνση assets ΥΠΕΡΙΣΧΥΕΙ της διεύθυνσης συνδέσμων', () => {
    withEnv('https://assets.nestorconstruct.gr', 'https://nestorconstruct.gr', () => {
      expect(emailAssetOrigin()).toBe('https://assets.nestorconstruct.gr');
    });
  });

  it('Θ4β — τελική κάθετος δεν παράγει ποτέ διπλή', () => {
    withEnv('https://assets.nestorconstruct.gr///', null, () => {
      expect(emailAssetUrl('/images/x.png')).toBe('https://assets.nestorconstruct.gr/images/x.png');
    });
  });
});

describe('Θ-Κ — τι δεν περνά ποτέ για δημόσια διεύθυνση', () => {
  // Κάθε μία είναι πραγματική ρύθμιση που κάποιος ΘΑ βάλει: preview, docker, LAN, staging.
  const rejected: ReadonlyArray<readonly [string, string]> = [
    ['http, όχι https', 'http://nestorconstruct.gr'],
    ['μονο-ετικέτα (docker/container)', 'https://web'],
    ['localhost με θύρα', 'https://localhost:3000'],
    ['κυριολεκτική IPv4 σε LAN', 'https://192.168.1.10'],
    ['κυριολεκτική IPv4 δημόσια — όνομα μάρκας, όχι αριθμός', 'https://93.184.216.34'],
    ['κυριολεκτική IPv6', 'https://[::1]'],
    ['κατάληξη .local (mDNS)', 'https://nestor.local'],
    ['κατάληξη .internal', 'https://app.internal'],
    ['κατάληξη .test', 'https://nestor.test'],
    ['διαπιστευτήρια στο URL — σύγχυση parser', 'https://nestorconstruct.gr@evil.example'],
    ['παραμορφωμένο', 'όχι-url'],
  ];

  it.each(rejected)('απορρίπτεται: %s', (_label, value) => {
    // Και ως δηλωμένη ΚΑΙ ως εφεδρεία — μία τιμή, δύο δρόμοι, ίδια ετυμηγορία.
    withEnv(value, null, () => expect(emailAssetOrigin()).toBeNull());
    withEnv(null, value, () => expect(emailAssetOrigin()).toBeNull());
  });

  // Παρονομαστής: η λίστα απορρίψεων δεν απορρίπτει ΤΑ ΠΑΝΤΑ.
  it('παρονομαστής — μια πραγματικά δημόσια διεύθυνση περνά', () => {
    withEnv('https://nestorconstruct.gr', null, () => {
      expect(emailAssetOrigin()).toBe('https://nestorconstruct.gr');
    });
  });
});
