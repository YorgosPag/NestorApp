/**
 * ⚓ ADR-190 §Display — ONE answer to "which identity image does this contact have?", for every screen.
 */

import type { Contact } from '@/types/contacts';

import { CONTACT_IMAGE_VERSION_PARAM, contactImageSourceUrl, resolveContactIdentityImage } from '../contact-identity-image';

const FIREBASE_URL =
  'https://firebasestorage.googleapis.com/v0/b/demo.firebasestorage.app/o/companies%2Fc1%2Flogo.jpg?alt=media&token=6e9ece47-tok';

function contact(fields: Record<string, unknown>): Contact {
  return { id: 'cont_1', updatedAt: { seconds: 1791311079, nanoseconds: 0 }, ...fields } as unknown as Contact;
}

describe('resolveContactIdentityImage', () => {
  it('person → photoURL, drawn as a person', () => {
    const spec = resolveContactIdentityImage(contact({ type: 'individual', firstName: 'Γιώργος', lastName: 'Νέστωρος', photoURL: FIREBASE_URL }));
    expect(spec).toEqual({ name: 'Γιώργος Νέστωρος', seed: 'cont_1', imageUrl: FIREBASE_URL, kind: 'person' });
  });

  it.each(['company', 'service'])('%s → logoURL, drawn as an organization (never photoURL)', (type) => {
    const spec = resolveContactIdentityImage(contact({ type, companyName: 'ALFA', serviceName: 'ALFA', logoURL: FIREBASE_URL, photoURL: 'https://other/rep.jpg' }));
    expect(spec.imageUrl).toBe(FIREBASE_URL);
    expect(spec.kind).toBe('organization');
  });

  it('no image ⇒ imageUrl undefined (the avatar falls back to initials), blanks count as none', () => {
    expect(resolveContactIdentityImage(contact({ type: 'company', companyName: 'ALFA', logoURL: '   ' })).imageUrl).toBeUndefined();
    expect(resolveContactIdentityImage(contact({ type: 'individual', firstName: 'Α' })).imageUrl).toBeUndefined();
  });

  it('the seed is the id — stable across renames', () => {
    const a = resolveContactIdentityImage(contact({ type: 'individual', firstName: 'Α' }));
    const b = resolveContactIdentityImage(contact({ type: 'individual', firstName: 'Β' }));
    expect(a.seed).toBe(b.seed);
  });
});

describe('cache version (the bug the header shipped)', () => {
  const versioned = () =>
    resolveContactIdentityImage(contact({ type: 'individual', firstName: 'Α', photoURL: FIREBASE_URL, multiplePhotoURLs: [] })).imageUrl ?? '';

  it('keeps the Firebase token INTACT — it used to become `token=…?v=…`', () => {
    const url = new URL(versioned());
    expect(url.searchParams.get('token')).toBe('6e9ece47-tok');
    expect(url.searchParams.get('alt')).toBe('media');
  });

  it('the version is the numeric updatedAt, never `[object Object]`', () => {
    expect(new URL(versioned()).searchParams.get(CONTACT_IMAGE_VERSION_PARAM)).toBe(String(1791311079 * 1000));
  });

  it('a photo with a gallery is not versioned; contactImageSourceUrl is always the raw URL', () => {
    const withGallery = contact({ type: 'individual', firstName: 'Α', photoURL: FIREBASE_URL, multiplePhotoURLs: [FIREBASE_URL] });
    expect(resolveContactIdentityImage(withGallery).imageUrl).toBe(FIREBASE_URL);
    expect(contactImageSourceUrl(contact({ type: 'individual', photoURL: FIREBASE_URL, multiplePhotoURLs: [] }))).toBe(FIREBASE_URL);
  });

  it('a data: URL (unsaved preview) is passed through untouched', () => {
    const data = 'data:image/png;base64,AAAA';
    expect(resolveContactIdentityImage(contact({ type: 'individual', photoURL: data, multiplePhotoURLs: [] })).imageUrl).toBe(data);
  });
});
