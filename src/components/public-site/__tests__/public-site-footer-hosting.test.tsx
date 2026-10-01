/**
 * 🏠 **ΤΟ ΥΠΟΣΕΛΙΔΟ ΤΟ ΦΙΛΟΞΕΝΕΙ Η ΚΛΕΙΔΩΜΕΝΗ ΕΠΙΦΑΝΕΙΑ** — άγκυρα του ADR-896 §7Α.8.
 *
 * Εύρημα (στιγμιότυπα Giorgio, στενό, σκοτεινό): στο `/search/results` το υποσέλιδο του κάδρου έτρωγε
 * τον πυθμένα της κλειδωμένης οθόνης, και το φύλλο αποτελεσμάτων κοβόταν πάνω από αυτό. Η θεραπεία
 * είναι **τρία κομμάτια που πρέπει να συμφωνούν**: το γνώρισμα του υποσέλιδου, η δήλωση της
 * επιφάνειας και ο κανόνας του κελύφους. Το jsdom δεν εκτελεί το `:has()` του CSS, οπότε εδώ
 * κλειδώνεται η **συμφωνία** τους. Η εμφάνιση μετριέται ζωντανά.
 */

import fs from 'fs';
import path from 'path';
import React from 'react';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom';

import { PublicSiteFooter, SHELL_FOOTER_HOSTED, SITE_FOOTER_ATTRIBUTE } from '../PublicSiteFooter';

jest.mock('@/components/legal/LegalLinksNav', () => ({ LegalLinksNav: () => <nav data-testid="legal" /> }));
jest.mock('@/components/objective-value/ObjectiveValueLink', () => ({ ObjectiveValueLink: () => <a href="#ov">ov</a> }));

const ROOT = path.resolve(__dirname, '../../../..');
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const [HOSTED_ATTR, HOSTED_VALUE] = Object.entries(SHELL_FOOTER_HOSTED)[0];

describe('ΥΣ1 — το υποσέλιδο φέρει το γνώρισμα που ζητά το κέλυφος', () => {
  it('🔴 `<footer data-site-footer>` με τους νομικούς συνδέσμους μέσα', () => {
    const { container, getByTestId } = render(<PublicSiteFooter />);
    const footer = container.querySelector('footer');
    expect(footer).toHaveAttribute(SITE_FOOTER_ATTRIBUTE);
    expect(footer).toContainElement(getByTestId('legal'));
  });
});

describe('ΥΣ2 — ο κανόνας του κελύφους μιλά για τα ΙΔΙΑ γνωρίσματα', () => {
  it('🔴 το `shell-surface.css` κρύβει `[data-site-footer]` όταν η επιφάνεια δηλώνει hosted', () => {
    const css = read('src/app/shell-surface.css').replace(/\s+/g, ' ');
    const selector =
      `[data-shell-frame]:has(> [data-shell-surface] > [data-shell-viewport][${HOSTED_ATTR}='${HOSTED_VALUE}']) ` +
      `> [${SITE_FOOTER_ATTRIBUTE}] { display: none; }`;
    expect(css).toContain(selector);
  });
});

describe('ΥΣ3 — ένα υποσέλιδο, δύο θέσεις, καμία χειρόγραφη τρίτη', () => {
  it('🔴 το κάδρο του `(light)` αποδίδει το κοινό component, όχι δικό του `<footer>`', () => {
    const layout = read('src/app/(light)/layout.tsx');
    expect(layout).toContain('<PublicSiteFooter />');
    expect(layout).not.toMatch(/<footer[\s>]/);
  });

  it('🔴 το `/search/results` δηλώνει hosted ΚΑΙ φιλοξενεί, στο ίδιο αρχείο', () => {
    const screen = read('src/components/search-results/SearchResultsContent.tsx');
    // Στο ΙΔΙΟ στοιχείο: ανάμεσα στο `<main` και στο `data-shell-viewport`, πριν κλείσει η ετικέτα.
    const start = screen.indexOf('<main');
    // Το γνώρισμα ως ΓΡΑΜΜΗ JSX (όχι μέσα σε σχόλιο που το αναφέρει).
    const main = screen.slice(start, start + screen.slice(start).search(/^\s*data-shell-viewport\s*$/m));
    expect(main).toContain('{...SHELL_FOOTER_HOSTED}');
    expect(main).not.toMatch(/^\s*>\s*$/m); // η ετικέτα `<main` δεν έχει κλείσει ενδιάμεσα
    expect(screen).toContain('footer={<PublicSiteFooter />}');
  });

  it('🔴 η λίστα βάζει το υποσέλιδο ΜΕΣΑ στο δοχείο κύλισης, τελευταίο', () => {
    const list = read('src/components/search-results/ResultsList.tsx');
    expect(list).toMatch(/data-list-scroll[^>]*>[\s\S]*\{footer\}\s*<\/div>/);
  });
});
