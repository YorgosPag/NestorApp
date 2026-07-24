/**
 * MaterialSwatch tests (ADR-413 §2D Phase 2 — appearance override precedence).
 *
 * Asserts that a user-uploaded `thumbnailUrl` WINS over the resolved albedo/
 * category swatch, and that the flat-colour fallback still applies when there is
 * neither a thumbnail nor a texture-mapped slug.
 */

import React from 'react';
import { fireEvent, render } from '@testing-library/react';
import { MaterialSwatch } from '../MaterialSwatch';

describe('MaterialSwatch — thumbnailUrl override', () => {
  it('renders the uploaded image directly when thumbnailUrl is provided', () => {
    const { container } = render(
      <MaterialSwatch category="concrete" thumbnailUrl="https://storage.example/custom.png" />,
    );
    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(img?.getAttribute('src')).toBe('https://storage.example/custom.png');
  });

  it('falls back to the flat-colour chip when neither thumbnail nor slug resolves', () => {
    // category 'other' maps to a null slug → no albedo → flat colour <span>.
    const { container } = render(<MaterialSwatch category="other" />);
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('span')).not.toBeNull();
  });

  it('ignores an empty thumbnailUrl and uses the fallback', () => {
    const { container } = render(<MaterialSwatch category="other" thumbnailUrl="" />);
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('span')).not.toBeNull();
  });
});

/**
 * ADR-691 Φ3 — μετρημένο σε πραγματική εισαγωγή (`abricos_gerbera`, 2026-07-24): ένα `bmat_*` με
 * ανεβασμένη υφή αλλά `appearance: null` έδειχνε **γκρι μπαλάκι** στη μπάρα «Υλικά όψης», επειδή η
 * σφαίρα-fallback του χρώματος κατηγορίας προηγούνταν της πραγματικής φωτογραφίας της υφής.
 */
describe('MaterialSwatch — άχρωμη σφαίρα δεν κρύβει πραγματική υφή (ADR-691 Φ3)', () => {
  const ALBEDO = 'https://storage.example/bmat_1/albedo.jpg';

  it('sphere + χωρίς appearance + χωρίς φορτωμένη υφή → δείχνει το albedo, όχι τη γκρι σφαίρα', () => {
    const { container } = render(
      <MaterialSwatch sphere materialId="bmat_1" category="other" albedoUrl={ALBEDO} />,
    );
    expect(container.querySelector('img')?.getAttribute('src')).toBe(ALBEDO);
  });

  it('χωρίς albedo και χωρίς τίποτα να λυθεί → flat chip όπως πριν, καμία παλινδρόμηση', () => {
    const { container } = render(<MaterialSwatch sphere category="other" />);
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('span')).not.toBeNull();
  });
});

/**
 * ADR-693 Γ3 — το τελευταίο δίχτυ. Ο χρήστης είδε **broken-image icon** σε δύο swatches (Giorgio,
 * browser 2026-07-24). Ό,τι κι αν σπάσει (ληγμένο signed URL, σβησμένο αρχείο, εκφυλισμένο data URL
 * από χαμένο GL context), το chip πρέπει να δείχνει ΧΡΩΜΑ — ένα σπασμένο εικονίδιο διαβάζεται ως
 * κατεστραμμένο υλικό, ενώ το υλικό είναι μια χαρά.
 */
describe('MaterialSwatch — καμία σπασμένη εικόνα ποτέ (ADR-693 Γ3)', () => {
  it('σε onError πέφτει στο flat colour chip αντί για broken-image icon', () => {
    const { container } = render(
      <MaterialSwatch category="other" thumbnailUrl="https://storage.example/deleted.png" />,
    );
    const img = container.querySelector('img');
    expect(img).not.toBeNull();

    fireEvent.error(img!);

    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('span')).not.toBeNull();
  });

  it('μετά την αποτυχία δείχνει το ΠΡΑΓΜΑΤΙΚΟ χρώμα του υλικού, όχι γκρι σκυροδέματος', () => {
    const { container } = render(
      <MaterialSwatch
        sphere
        materialId="bmat_01HQ"
        category="other"
        thumbnailUrl="https://storage.example/deleted.png"
        appearance={{ baseColorHex: '#e83030', metalness: 0, roughness: 1 }}
      />,
    );
    fireEvent.error(container.querySelector('img')!);
    expect(container.querySelector('span')).toHaveStyle({ backgroundColor: '#e83030' });
  });

  it('μια ΝΕΑ εικόνα ξαναδοκιμάζεται — η αποτυχία δεν κολλάει στο component', () => {
    const { container, rerender } = render(
      <MaterialSwatch category="other" thumbnailUrl="https://storage.example/deleted.png" />,
    );
    fireEvent.error(container.querySelector('img')!);
    expect(container.querySelector('img')).toBeNull();

    rerender(<MaterialSwatch category="other" thumbnailUrl="https://storage.example/fresh.png" />);
    expect(container.querySelector('img')?.getAttribute('src')).toBe('https://storage.example/fresh.png');
  });
});

/**
 * ADR-693 §2.2 — ένα `bmat_*` δεν έχει ΠΟΤΕ DNA prefix, οπότε ο παλιός `resolveMaterialKey`
 * το κατέρριπτε σε σκυρόδεμα: ζητούσε την υφή του σκυροδέματος ως swatch, και το flat fallback
 * έδινε το ΓΚΡΙ του σκυροδέματος ενώ το υλικό κουβαλούσε δικό του χρώμα.
 */
describe('MaterialSwatch — υλικό βιβλιοθήκης δεν πέφτει σε σκυρόδεμα (ADR-693 Α2)', () => {
  it('δεν ζητά την υφή σκυροδέματος για `bmat_*` χωρίς δικές του υφές', () => {
    const { container } = render(<MaterialSwatch materialId="bmat_01HQ" category="other" />);
    const src = container.querySelector('img')?.getAttribute('src') ?? '';
    expect(src).not.toContain('concrete');
  });

  it('το flat chip παίρνει το χρώμα του appearance, όχι το #b0b0b0 του σκυροδέματος', () => {
    const { container } = render(
      <MaterialSwatch
        materialId="bmat_01HQ"
        category="other"
        appearance={{ baseColorHex: '#cccccc', metalness: 0, roughness: 1 }}
      />,
    );
    const chip = container.querySelector('span');
    if (chip) expect(chip).toHaveStyle({ backgroundColor: '#cccccc' });
  });
});
