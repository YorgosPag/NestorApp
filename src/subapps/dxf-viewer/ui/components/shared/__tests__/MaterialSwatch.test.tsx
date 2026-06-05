/**
 * MaterialSwatch tests (ADR-413 §2D Phase 2 — appearance override precedence).
 *
 * Asserts that a user-uploaded `thumbnailUrl` WINS over the resolved albedo/
 * category swatch, and that the flat-colour fallback still applies when there is
 * neither a thumbnail nor a texture-mapped slug.
 */

import React from 'react';
import { render } from '@testing-library/react';
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
