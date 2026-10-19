/**
 * ⚓ ADR-190 §Display — the ONE identity-image renderer, and what it downloads.
 *
 * The bucket env var is read when `identity-image-source` loads: it is set before the avatar is required, and
 * the source-only cases load a fresh copy of that one module.
 */

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import type * as SourceModule from '@/lib/media/identity-image-source';

const BUCKET = 'pagonis-87766.firebasestorage.app';
const OWN = `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/companies%2Fc1%2Flogo.jpg?alt=media&token=t1`;
const FOREIGN_BUCKET = 'https://firebasestorage.googleapis.com/v0/b/someone-else.appspot.com/o/x.jpg?alt=media&token=t2';

// Set BEFORE the avatar loads (the bucket is read at module load). `require` is not hoisted; `import` would be.
process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = BUCKET;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { EntityAvatar } = require('../EntityAvatar') as typeof import('../EntityAvatar');

/** A fresh copy of the source module — it has no React, so isolating it is safe (isolating React is not). */
function loadSource(): typeof SourceModule {
  let mod!: typeof SourceModule;
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mod = require('@/lib/media/identity-image-source') as typeof SourceModule;
  });
  return mod;
}

afterEach(() => {
  process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = BUCKET;
});

describe('identityImageSource — only OUR bucket goes through the optimizer', () => {
  it('own bucket ⇒ resized 1x/2x, never the original', () => {
    const source = loadSource();
    const result = source.identityImageSource(OWN, 40);
    expect(result.src).toContain('/_next/image?url=');
    expect(result.srcSet).toMatch(/w=48&q=\d+ 1x, .*w=96&q=\d+ 2x/);
  });

  it.each([
    ['another Firebase project', FOREIGN_BUCKET],
    ['another host', 'https://example.com/a.jpg'],
    ['an unsaved preview', 'data:image/png;base64,AAAA'],
    ['a blob preview', 'blob:http://localhost/123'],
  ])('%s ⇒ passed through untouched (the optimizer would 400)', (_label, url) => {
    const source = loadSource();
    expect(source.identityImageSource(url, 40)).toEqual({ src: url });
  });

  it('no bucket configured ⇒ nothing is optimizable', () => {
    delete process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
    const source = loadSource();
    expect(source.isOptimizableImageUrl(OWN)).toBe(false);
  });
});

describe('EntityAvatar', () => {
  it('no image ⇒ monogram (Greek initials without accents), decorative', () => {
    const { container } = render(<EntityAvatar name="Άλφα Τεχνική" seed="cont_1" kind="organization" />);
    expect(screen.getByText('ΑΤ')).toBeInTheDocument();
    expect(container.querySelector('[data-avatar-state="monogram"]')).toHaveAttribute('aria-hidden', 'true');
    expect(container.querySelector('img')).toBeNull();
  });

  it('a name with no letters ⇒ the kind silhouette, never an empty disc', () => {
    const { container } = render(<EntityAvatar name="" seed="cont_x" kind="person" />);
    expect(container.querySelector('[data-avatar-state="monogram"] svg')).not.toBeNull();
  });

  it('image ⇒ ONE lazy, async, sized <img> (no probe), monogram underneath until it paints', () => {
    const { container } = render(<EntityAvatar name="Γιώργος Νέστωρος" seed="cont_2" kind="person" imageUrl={OWN} />);
    const imgs = container.querySelectorAll('img');
    expect(imgs).toHaveLength(1);
    expect(imgs[0]).toHaveAttribute('loading', 'lazy');
    expect(imgs[0]).toHaveAttribute('decoding', 'async');
    expect(imgs[0]).toHaveAttribute('width', '40');
    expect(imgs[0].getAttribute('srcset')).toContain('2x');
    expect(screen.getByText('ΓΝ')).toBeInTheDocument();

    fireEvent.load(imgs[0]);
    expect(screen.queryByText('ΓΝ')).toBeNull();
    expect(container.querySelector('[data-avatar-state="loaded"]')).not.toBeNull();
  });

  it('broken image ⇒ back to the monogram, never a broken-image icon', () => {
    const { container } = render(<EntityAvatar name="Γιώργος Νέστωρος" seed="cont_2" kind="person" imageUrl={OWN} />);
    fireEvent.error(container.querySelector('img') as HTMLImageElement);
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByText('ΓΝ')).toBeInTheDocument();
  });

  it('person = circle + cover · organization = rounded square + contain (a logo is never cropped)', () => {
    const person = render(<EntityAvatar name="Α Β" seed="1" kind="person" imageUrl={OWN} />).container;
    const org = render(<EntityAvatar name="Α Β" seed="1" kind="organization" imageUrl={OWN} />).container;
    expect(person.querySelector('[data-entity-avatar]')).toHaveClass('rounded-full');
    expect(person.querySelector('img')).toHaveClass('object-cover');
    expect(org.querySelector('[data-entity-avatar]')).toHaveClass('rounded-md');
    expect(org.querySelector('img')).toHaveClass('object-contain');
  });

  it('onActivate ⇒ a real button with the caller’s accessible name', () => {
    const onActivate = jest.fn();
    render(<EntityAvatar name="Α Β" seed="1" kind="person" imageUrl={OWN} onActivate={onActivate} activateLabel="Προβολή φωτογραφίας: Α Β" />);
    fireEvent.click(screen.getByRole('button', { name: 'Προβολή φωτογραφίας: Α Β' }));
    expect(onActivate).toHaveBeenCalledTimes(1);
  });
});
