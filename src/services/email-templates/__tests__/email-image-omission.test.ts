/**
 * @fileoverview **Η ΠΑΡΑΛΕΙΨΗ ΓΡΑΦΕΤΑΙ ΣΤΟ HTML** — άγκυρα Θ3 του ADR-853 §19, στο **προϊόν**.
 *
 * 🔑 Γιατί δεν αρκεί η άγκυρα της συνάρτησης: το `emailAssetUrl()` μπορεί να επιστρέφει
 * σωστά `null` και το πρότυπο να γράφει **ούτως ή άλλως** `<img src="">` ή
 * `<img src="undefined">`. Η ερώτηση εδώ είναι *«τι **φεύγει** στον παραλήπτη;»* —
 * και απαντιέται **μόνο** πάνω στο παραγόμενο HTML.
 */

import { wrapInBrandedTemplate } from '../base-email-template';

const ASSET_VAR = 'NEXT_PUBLIC_EMAIL_ASSET_ORIGIN';
const APP_VAR = 'NEXT_PUBLIC_APP_URL';
const CONTENT = '<p>Η πρόσκλησή σας είναι έτοιμη.</p>';

function htmlWith(asset: string | null, app: string | null): string {
  const originals = { asset: process.env[ASSET_VAR], app: process.env[APP_VAR] };
  try {
    if (asset === null) delete process.env[ASSET_VAR];
    else process.env[ASSET_VAR] = asset;
    if (app === null) delete process.env[APP_VAR];
    else process.env[APP_VAR] = app;
    return wrapInBrandedTemplate({ contentHtml: CONTENT });
  } finally {
    if (originals.asset === undefined) delete process.env[ASSET_VAR];
    else process.env[ASSET_VAR] = originals.asset;
    if (originals.app === undefined) delete process.env[APP_VAR];
    else process.env[APP_VAR] = originals.app;
  }
}

describe('Θ3 — χωρίς δημόσια διεύθυνση, καμία <img> δεν γράφεται', () => {
  // 🔴 Μετάλλαξη που κοκκινίζει: επιστροφή `''` αντί `null`, ή `<img src="${src ?? ''}">`.
  it('dev (localhost) ⇒ ΚΑΜΙΑ <img>, και το μήνυμα λέει ακόμη τι συνέβη', () => {
    const html = htmlWith(null, 'http://localhost:3000');

    expect(html).not.toContain('<img');
    // Παρονομαστής: το ίδιο HTML **έχει** περιεχόμενο — η παράλειψη είναι της εικόνας,
    // όχι του μηνύματος. Ένα κενό HTML θα περνούσε το `not.toContain` σιωπηλά.
    expect(html).toContain(CONTENT);
  });

  it('καμία ρύθμιση καθόλου ⇒ ΚΑΜΙΑ <img>', () => {
    const html = htmlWith(null, null);
    expect(html).not.toContain('<img');
    expect(html).toContain(CONTENT);
  });

  // 🔴 Η ΑΚΡΙΒΗΣ ΑΣΤΟΧΙΑ ΠΟΥ ΔΙΟΡΘΩΘΗΚΕ: `''` + `/images/…` = σχετική διαδρομή, που μέσα
  //    σε Gmail λύνεται πάνω στο `mail.google.com` — αίτημα σε **ξένο** origin.
  it('ποτέ σχετική διαδρομή εικόνας, ποτέ κενό src', () => {
    for (const html of [htmlWith(null, null), htmlWith(null, 'http://localhost:3000')]) {
      expect(html).not.toContain('src="/images/');
      expect(html).not.toContain('src=""');
    }
  });
});

describe('Θ3β — με δημόσια διεύθυνση, η εικόνα είναι ΑΠΟΛΥΤΗ https', () => {
  it('παραγωγή ⇒ <img> με απόλυτο https URL', () => {
    const html = htmlWith(null, 'https://nestorconstruct.gr');

    expect(html).toContain('<img');
    expect(html).toContain('src="https://nestorconstruct.gr/images/');
    expect(html).not.toContain('src="/images/');
  });

  it('η δηλωμένη διεύθυνση assets φαίνεται στο HTML', () => {
    const html = htmlWith('https://assets.nestorconstruct.gr', 'http://localhost:3000');
    expect(html).toContain('src="https://assets.nestorconstruct.gr/images/');
  });

  // Οι διαστάσεις κρατούν τον χώρο όσο η εικόνα είναι μπλοκαρισμένη — έρχονται από τον
  // κατάλογο, άρα μια αλλαγή τους εκεί πρέπει να φαίνεται εδώ.
  it('κάθε <img> δηλώνει width ΚΑΙ height', () => {
    const html = htmlWith(null, 'https://nestorconstruct.gr');
    const images = html.match(/<img[^>]*>/g) ?? [];

    expect(images.length).toBeGreaterThan(0);
    for (const tag of images) {
      expect(tag).toMatch(/\swidth="\d+"/);
      expect(tag).toMatch(/\sheight="\d+"/);
    }
  });
});
