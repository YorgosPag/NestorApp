/**
 * ADR-724 Φ4 §9.1 — Η πυκνότητα της παλέτας απαντά στο **δικό της** πλάτος.
 *
 * ⚠️ ΤΙ ΔΕΝ ΑΠΟΔΕΙΚΝΥΟΥΝ ΑΥΤΑ ΤΑ TESTS — ΔΙΑΒΑΣΕ ΤΟ ΠΡΙΝ ΤΑ ΕΜΠΙΣΤΕΥΤΕΙΣ:
 *
 * Το jsdom **δεν έχει διάταξη και δεν υλοποιεί `@container`**. Καμία γραμμή εδώ δεν αποδεικνύει
 * ότι κάτι φαίνεται σε δύο στήλες. Επιπλέον το jest αντικαθιστά το CSS module με stub
 * (`__mocks__/cssModuleStub.js`) ⇒ `styles.palette === 'palette'`: το **περιεχόμενο** του
 * `.module.css` δεν εκτελείται ποτέ. Άρα ένα test που απλώς έκανε render θα ήταν πράσινο ακόμη
 * κι αν το αρχείο CSS ήταν **άδειο** — το κλασικό «πράσινο test σε νεκρή δυνατότητα».
 *
 * Γι' αυτό η §1 διαβάζει το CSS **ως κείμενο**: είναι το μόνο όργανο που μπορεί να κοκκινίσει αν
 * σβηστεί ένα κατώφλι. Και η §2 φυλάει την **προϋπόθεση**, όχι το αποτέλεσμα.
 *
 * Η οπτική επαλήθευση ανήκει στον Giorgio, ζωντανά, σέρνοντας το διαχωριστικό.
 */

import fs from 'fs';
import path from 'path';
import React from 'react';
import { render, screen } from '@testing-library/react';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'el' } }),
}));

import { EntityPropertySection } from '../entity-properties/EntityPropertyRow';
import { PaletteGroupSection, PaletteFieldRow } from '../components/palette-primitives';
import type { EntityPropertyGroup } from '../entity-properties/entity-property-fields';

const CSS_PATH = path.join(__dirname, '..', 'workspace-palette-density.module.css');
const CONTAINER_PATH = path.join(__dirname, '..', 'FloatingPanelContainer.tsx');

const css = fs.readFileSync(CSS_PATH, 'utf8');
const containerSource = fs.readFileSync(CONTAINER_PATH, 'utf8');

/** Αφαιρεί τα σχόλια: ένα κατώφλι που ζει ΜΟΝΟ σε σχόλιο δεν ισχύει για τον browser. */
const activeCss = css.replace(/\/\*[\s\S]*?\*\//g, '');

/**
 * Η γραμμή JSX που **είναι** η ρίζα της παλέτας — αναγνωρίζεται από τον container της.
 *
 * ⚠️ Γιατί ΟΧΙ αναζήτηση σε ΟΛΟ το αρχείο: θα έπιανε (α) τα ίδια τα σχόλια που εξηγούν γιατί
 * έφυγε το `PANEL_LG` — δηλαδή η τεκμηρίωση της διόρθωσης θα κοκκίνιζε το test της — και
 * (β) το `WIDTH.PANEL_SM` του «Loading translations…», που είναι `fixed` overlay και επιστρέφει
 * **πριν** φτάσει η ροή στη ρίζα, άρα δεν μπορεί να κλειδώσει κανέναν container.
 * Ερώτηση: «κλειδώνει πλάτος **η ρίζα**;» — όχι «υπάρχει η λέξη κάπου στο αρχείο;».
 */
const paletteRootLine =
  containerSource.split('\n').find((line) => line.includes('styles.palette')) ?? '';

describe('ADR-724 Φ4 §9.1 — §1 Το συμβόλαιο του CSS (το jsdom δεν το εκτελεί ποτέ)', () => {
  it('ορίζει τον container — χωρίς αυτόν ΚΑΘΕ @container παρακάτω είναι νεκρό γράμμα', () => {
    expect(activeCss).toMatch(/container-type:\s*inline-size/);
    expect(activeCss).toMatch(/container-name:\s*dxf-palette/);
  });

  it('ρωτά τον ΠΡΟΓΟΝΟ (@container) και ποτέ το παράθυρο (@media)', () => {
    // Ένα `@media` εδώ θα ήταν σιωπηλά λάθος: η παλέτα αλλάζει πλάτος ΧΩΡΙΣ να αλλάξει το
    // viewport (σύρσιμο διαχωριστικού, αλλαγή πλευράς) ⇒ θα έδινε πάντα την ίδια απάντηση.
    expect(activeCss).not.toMatch(/@media/);
    expect(activeCss.match(/@container\s+dxf-palette/g)).toHaveLength(2);
  });

  it('υλοποιεί ΚΑΙ ΤΑ ΔΥΟ κατώφλια του §9.1 (320 και 520)', () => {
    expect(activeCss).toMatch(/@container\s+dxf-palette\s*\(max-width:\s*319px\)/);
    expect(activeCss).toMatch(/@container\s+dxf-palette\s*\(min-width:\s*520px\)/);
  });

  it('η μεσαία ζώνη 320–520px ΔΕΝ έχει κανόνα — η μονόστηλη μορφή είναι η προεπιλογή', () => {
    // Αν κάποιος προσθέσει τρίτο query, η μεσαία ζώνη έπαψε να είναι «μην κάνεις τίποτα».
    expect(activeCss.match(/@container/g)).toHaveLength(2);
  });

  it('κρύβει την ετικέτα ΟΠΤΙΚΑ, όχι από τον αναγνώστη οθόνης', () => {
    // Το εικονίδιο είναι <svg> χωρίς <title> ⇒ η ετικέτα είναι το μοναδικό προσβάσιμο όνομα.
    // Ένα `display: none` θα άφηνε οκτώ ανώνυμα tab — ανταλλαγή 40px με τη χρηστικότητα.
    const iconOnlyBlock = activeCss.split('max-width: 319px')[1] ?? '';
    expect(iconOnlyBlock).toMatch(/clip-path:\s*inset\(50%\)/);
    expect(iconOnlyBlock).not.toMatch(/display:\s*none/);
    expect(iconOnlyBlock).not.toMatch(/visibility:\s*hidden/);
  });

  it('οι δύο στήλες είναι grid (κρατά τη σειρά DOM) και όχι columns (τεμαχίζει)', () => {
    const twoColBlock = activeCss.split('min-width: 520px')[1] ?? '';
    expect(twoColBlock).toMatch(/grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
    expect(twoColBlock).not.toMatch(/column-count/);
  });

  it('ορίζει ΡΗΤΑ και τα δύο gap — το `gap-1` του Tailwind είναι shorthand', () => {
    // Χωρίς το ρητό `column-gap`, το shorthand του Tailwind θα άφηνε 4px ανάμεσα στις στήλες.
    const twoColBlock = activeCss.split('min-width: 520px')[1] ?? '';
    expect(twoColBlock).toMatch(/column-gap:/);
    expect(twoColBlock).toMatch(/row-gap:/);
  });
});

describe('ADR-724 Φ4 §9.1 — §2 Η ΠΡΟΫΠΟΘΕΣΗ: κανένα δεύτερο κλείδωμα πλάτους', () => {
  /**
   * Αυτή είναι η ΜΟΝΗ αστοχία που θα σκότωνε σιωπηλά ολόκληρο το §9.1 και θα άφηνε κάθε άλλο
   * test πράσινο: με σταθερό πλάτος σε πρόγονο, ο container μετρά πάντα την ίδια τιμή, το
   * κατώφλι των 520px δεν ενεργοποιείται ΠΟΤΕ, και η οθόνη δεν αλλάζει.
   *
   * Ακριβώς αυτό συνέβαινε πριν τη Φ4: το `WIDTH.PANEL_LG` (= `w-96` = 384px) επιβίωσε της Φ1.
   */
  it('η ρίζα της παλέτας υπάρχει και είναι μονοσήμαντη', () => {
    // Αν σπάσει αυτό, κάθε επόμενο assertion της §2 θα εξέταζε άδεια συμβολοσειρά — δηλαδή θα
    // ήταν πράσινο χωρίς να έχει κοιτάξει τίποτα.
    expect(paletteRootLine).not.toBe('');
    expect(containerSource.match(/styles\.palette/g)).toHaveLength(1);
  });

  it('η ρίζα της παλέτας δεν καρφώνει πλάτος', () => {
    expect(paletteRootLine).not.toMatch(/WIDTH\.PANEL_LG/);
    expect(paletteRootLine).not.toMatch(/WIDTH\.PANEL_SM/);
    expect(paletteRootLine).not.toMatch(/\bw-\d+\b/);
    expect(paletteRootLine).not.toMatch(/\bw-\[/);
    expect(paletteRootLine).not.toMatch(/\bmax-w-/);
  });

  it('η ρίζα της παλέτας γεμίζει το πλάτος που της δίνει η Φ1', () => {
    expect(paletteRootLine).toMatch(/WIDTH\.FULL/);
  });

  it('η ζώνη των καρτελών και η ζώνη περιεχομένου έχουν η καθεμία την εμβέλειά της', () => {
    // Χωρίς αυτά, οι κανόνες υπάρχουν αλλά δεν έχουν σε τι να εφαρμοστούν.
    expect(containerSource).toMatch(/styles\.tabStrip/);
    expect(containerSource).toMatch(/styles\.content/);
  });
});

describe('ADR-724 Φ4 §9.1 — §3 Η ρητή συγκατάθεση στις δύο στήλες', () => {
  const EMPTY_GROUP: EntityPropertyGroup = { fields: [] } as unknown as EntityPropertyGroup;

  it('το group ομοιόμορφων γραμμών δηλώνει `data-palette-rows`', () => {
    render(
      <EntityPropertySection
        title="Γεωμετρία"
        group={EMPTY_GROUP}
        getComboboxState={() => undefined as never}
        onComboboxChange={() => undefined}
      />,
    );
    const section = screen.getByRole('heading', { name: 'Γεωμετρία' }).parentElement;
    expect(section).toHaveAttribute('data-palette-rows');
  });

  it('η συγκατάθεση είναι ΟΠΤ-ΙΝ — χωρίς `uniformRows` δεν εκπέμπεται τίποτα', () => {
    // Αυτό είναι το test που κρατά τα 4 μη-δικαιούμενα group έξω (ADR-724 §14.6.3α). Αν η
    // προεπιλογή γυρίσει σε `true`, το `<ul>` του PartsSection φεύγει ολόκληρο στη 2η στήλη.
    render(<PaletteGroupSection title="Υλικό">{'περιεχόμενο'}</PaletteGroupSection>);
    const section = screen.getByRole('heading', { name: 'Υλικό' }).parentElement;
    expect(section).not.toHaveAttribute('data-palette-rows');
  });

  it('ο τίτλος μένει επικεφαλίδα και όχι πρώτο κελί της πρώτης στήλης', () => {
    // Ο κανόνας `grid-column: 1 / -1` δεν εκτελείται στο jsdom· ελέγχεται στο CSS ότι υπάρχει
    // και για τα δύο επίπεδα επικεφαλίδας που χρησιμοποιούν τα panel της παλέτας.
    const twoColBlock = activeCss.split('min-width: 520px')[1] ?? '';
    expect(twoColBlock).toMatch(/>\s*h3/);
    expect(twoColBlock).toMatch(/>\s*h4/);
    expect(twoColBlock).toMatch(/grid-column:\s*1\s*\/\s*-1/);
  });
});

describe('ADR-724 §14.7 — §4 Το κοινό λεξιλόγιο: οι τρεις διαφορές που ΔΕΝ ισοπεδώθηκαν', () => {
  /**
   * Η κεντρικοποίηση αντικατέστησε 6 group + 6 γραμμές με ένα ζευγάρι components. Ο κίνδυνος
   * ενός τέτοιου merge δεν είναι να σπάσει — είναι να **ισοπεδώσει** σιωπηλά μια πραγματική
   * διαφορά, και να το ανακαλύψει ο χρήστης. Τα τρία tests παρακάτω είναι ακριβώς οι τρεις
   * διαφορές που κρατήθηκαν ως props (βλ. `palette-primitives.tsx`).
   */

  it('(1) το επίπεδο επικεφαλίδας είναι δομή εγγράφου, όχι στυλ — h3 ΚΑΙ h4', () => {
    const { unmount } = render(<PaletteGroupSection title="Ρίζα" headingLevel={3}>x</PaletteGroupSection>);
    expect(screen.getByRole('heading', { name: 'Ρίζα', level: 3 })).toBeInTheDocument();
    unmount();

    // Η προεπιλογή είναι 4: τα advanced panels φωλιάζουν κάτω από τίτλο καρτέλας.
    render(<PaletteGroupSection title="Φωλιασμένο">x</PaletteGroupSection>);
    expect(screen.getByRole('heading', { name: 'Φωλιασμένο', level: 4 })).toBeInTheDocument();
  });

  it('(2) ο τόνος `overline` του ADR-683 επιβιώνει — δεν έγινε «όλα ίδια»', () => {
    const { unmount } = render(<PaletteGroupSection title="Απλό">x</PaletteGroupSection>);
    expect(screen.getByRole('heading', { name: 'Απλό' })).not.toHaveClass('uppercase');
    unmount();

    render(<PaletteGroupSection title="Τονισμένο" tone="overline">x</PaletteGroupSection>);
    const overline = screen.getByRole('heading', { name: 'Τονισμένο' });
    expect(overline).toHaveClass('uppercase');
    expect(overline).toHaveClass('text-muted-foreground');
  });

  it('(3) η επικεφαλίδα είναι ΑΜΕΣΟ παιδί — το `<header>` wrapper θα έσπαγε το §9.1', () => {
    // Τρία από τα σημεία που αντικαταστάθηκαν τύλιγαν την επικεφαλίδα σε `<header>`. Ο κανόνας
    // `[data-palette-rows] > h3, > h4` χρειάζεται σχέση άμεσου παιδιού για να απλώσει τον τίτλο
    // και στις δύο στήλες — ένα wrapper θα τον άφηνε σιωπηλά στην πρώτη.
    render(<PaletteGroupSection title="Δομικά" uniformRows>x</PaletteGroupSection>);
    const heading = screen.getByRole('heading', { name: 'Δομικά' });
    expect(heading.parentElement?.tagName).toBe('SECTION');
    expect(heading.parentElement).toHaveAttribute('data-palette-rows');
  });

  it('η γραμμή κρατά το `truncate` — αυτό την κάνει ανθεκτική στο στένεμα', () => {
    // Ήταν αντιγραμμένο 6 φορές· έξι ευκαιρίες να ξεχαστεί. Χωρίς αυτό, μια μακριά ετικέτα
    // σπρώχνει το χειριστήριο εκτός της στενής παλέτας.
    render(<PaletteFieldRow label="Πάχος στρώσης"><input aria-label="Πάχος στρώσης" /></PaletteFieldRow>);
    expect(screen.getByText('Πάχος στρώσης')).toHaveClass('truncate');
  });
});
