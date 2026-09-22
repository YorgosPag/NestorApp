/**
 * @fileoverview **Ο ΚΑΤΑΛΟΓΟΣ ΕΙΚΟΝΩΝ EMAIL** — άγκυρες Θ5/Θ6 του ADR-853 §19.
 *
 * 🔑 Η ερώτηση που φυλάνε: *«υπάρχει **πράγματι** στον δίσκο αυτό που υπόσχεται το μήνυμα;»*
 * Ανάμεσα σε μια συμβολοσειρά `/images/…` και σε ένα αρχείο του `public/` δεν στέκεται
 * **κανένα** άλλο εργαλείο: ο μεταγλωττιστής δεν βλέπει συμβολοσειρά, το `next build` δεν
 * ελέγχει το `public/`. Χωρίς αυτό το αρχείο, μια μετονομασία φαίνεται **στον παραλήπτη**.
 */

import { readFileSync, statSync } from 'node:fs';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

import {
  DEFAULT_COMPANY_LOGO,
  EMAIL_IMAGE_ASSETS,
  EMAIL_IMAGE_BYTE_BUDGET,
  NESTOR_APP_LOGO,
} from '../email-assets';

const PUBLIC_DIR = join(process.cwd(), 'public');
const TEMPLATES_DIR = join(process.cwd(), 'src', 'services', 'email-templates');

const EXTENSION_OF: Record<string, readonly string[]> = {
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
};

describe('Θ5 — η δήλωση ΕΙΝΑΙ η πραγματικότητα του δίσκου', () => {
  it('ο κατάλογος δεν είναι άδειος (παρονομαστής)', () => {
    expect(EMAIL_IMAGE_ASSETS.length).toBeGreaterThan(0);
    expect(EMAIL_IMAGE_ASSETS).toContain(NESTOR_APP_LOGO);
    expect(EMAIL_IMAGE_ASSETS).toContain(DEFAULT_COMPANY_LOGO);
  });

  // Μετάλλαξη που κοκκινίζει: μετονόμασε ένα αρχείο στο `public/images/`.
  it.each(EMAIL_IMAGE_ASSETS.map((a) => [a.publicPath, a] as const))(
    '%s — υπάρχει, με ΑΚΡΙΒΩΣ τα δηλωμένα bytes',
    (publicPath, asset) => {
      const onDisk = join(PUBLIC_DIR, publicPath.replace(/^\//, ''));
      expect(statSync(onDisk).isFile()).toBe(true);
      expect(statSync(onDisk).size).toBe(asset.byteSize);
    },
  );

  it.each(EMAIL_IMAGE_ASSETS.map((a) => [a.publicPath, a] as const))(
    '%s — ο δηλωμένος τύπος συμφωνεί με την κατάληξη',
    (publicPath, asset) => {
      const allowed = EXTENSION_OF[asset.mediaType];
      expect(allowed.some((ext) => publicPath.toLowerCase().endsWith(ext))).toBe(true);
    },
  );

  it.each(EMAIL_IMAGE_ASSETS.map((a) => [a.publicPath, a] as const))(
    '%s — απόλυτη διαδρομή, ποτέ σχετική',
    (publicPath) => expect(publicPath.startsWith('/')).toBe(true),
  );

  // 🔶 Ο προϋπολογισμός δεν ΜΠΛΟΚΑΡΕΙ — ΑΠΑΙΤΕΙ ΛΟΓΟ. Ένα 748 KB λογότυπο δεν είναι
  //    σφάλμα· είναι απόφαση, και οι αποφάσεις γράφονται.
  it.each(EMAIL_IMAGE_ASSETS.map((a) => [a.publicPath, a] as const))(
    '%s — πάνω από τον προϋπολογισμό ⇒ δηλωμένος λόγος',
    (_publicPath, asset) => {
      if (asset.byteSize > EMAIL_IMAGE_BYTE_BUDGET) {
        expect(asset.oversizeNote?.trim().length ?? 0).toBeGreaterThan(0);
      }
    },
  );
});

describe('Θ6 — καμία SVG φτάνει ποτέ σε πρόγραμμα email', () => {
  // Το Outlook σταμάτησε να τις αποδίδει (09/2025)· το Gmail ποτέ πλήρως. Ο τύπος το κάνει
  // αδύνατο στη μεταγλώττιση — εδώ κλείνει και ο δρόμος του `as`.
  it('κανένα αρχείο του καταλόγου δεν είναι .svg', () => {
    for (const asset of EMAIL_IMAGE_ASSETS) {
      expect(asset.publicPath.toLowerCase().endsWith('.svg')).toBe(false);
      expect(asset.mediaType).not.toBe('image/svg+xml');
    }
  });

  // 🔴 Η παγίδα ΥΠΑΡΧΕΙ στο δέντρο: `public/images/logo-email.svg`, με όνομα που προσκαλεί
  //    τη χρήση του. Η άγκυρα δεν το διαγράφει — απαγορεύει να **αναφερθεί**.
  it('κανένα πρότυπο email δεν αναφέρει .svg', () => {
    const templates = readdirSync(TEMPLATES_DIR).filter((f) => f.endsWith('.ts'));
    expect(templates.length).toBeGreaterThan(0); // παρονομαστής: όντως διαβάστηκαν αρχεία

    for (const file of templates) {
      const source = readFileSync(join(TEMPLATES_DIR, file), 'utf8');
      // Μόνο οι γραμμές κώδικα — τα σχόλια ΤΕΚΜΗΡΙΩΝΟΥΝ την απαγόρευση και θα
      // κοκκίνιζαν πάνω στην ίδια τους τη θεραπεία (μάθημα Κ7β / CHECK 3.50).
      const code = source
        .split('\n')
        .filter((line) => !line.trimStart().startsWith('*') && !line.trimStart().startsWith('//'))
        .join('\n');
      expect(code).not.toMatch(/\.svg/i);
    }
  });
});
