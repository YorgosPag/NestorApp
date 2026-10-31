/**
 * ADR-923 §5.6.1 — η κρίση του λογότυπου είναι κοινή σε φόρμα και γραφέα: ό,τι περνά εδώ πρέπει να μπορεί να τυπωθεί.
 */
import { isPublicationLogo } from '../publication-logo';

const logo = { role: 'logo', kind: 'image', fileId: 'file_1' } as const;

describe('isPublicationLogo', () => {
  it.each([
    ['png', 'image/png'],
    ['jpg', 'image/jpeg'],
    ['tif', 'image/tiff'],
  ])('δέχεται εικόνα που αποδίδεται: %s', (ext, contentType) => {
    expect(isPublicationLogo(logo, { ext, contentType })).toBe(true);
  });

  it('απορρίπτει SVG, γιατί δεν έχει αποδόσεις και η έκδοση θα έπεφτε σε renditionMissing', () => {
    expect(isPublicationLogo(logo, { ext: 'svg', contentType: 'image/svg+xml' })).toBe(false);
  });

  it('απορρίπτει φωτογραφία προϊόντος: ο ρόλος λέει τι είναι το μέσο', () => {
    expect(isPublicationLogo({ ...logo, role: 'photo' }, { ext: 'png', contentType: 'image/png' })).toBe(false);
  });

  it('απορρίπτει μέσο χωρίς αρχείο', () => {
    expect(isPublicationLogo({ ...logo, fileId: null }, null)).toBe(false);
    expect(isPublicationLogo(logo, null)).toBe(false);
  });
});
