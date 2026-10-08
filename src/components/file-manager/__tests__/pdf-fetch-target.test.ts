/**
 * ADR-901 §14.9 — «από πού φέρνει ο PDF viewer τα bytes, και με ποια διαπιστευτήρια;»
 *
 * 🔴 Το περιστατικό (παραγωγή, 2026-10-08): ο υπογεγραμμένος σύνδεσμος τεκμηρίου τυλιγόταν στον proxy
 *    `/api/download?url=` ⇒ 401 στον επαγγελματία χωρίς εταιρεία, και ο σύνδεσμος ταξίδευε ως παράμετρος.
 */

import { API_ROUTES } from '@/config/domain-constants';

import { pdfFetchTarget } from '../pdf-fetch-target';

const SIGNED = 'https://storage.googleapis.com/bucket/companies/c_1/entities/x/file.pdf?GoogleAccessId=a&Expires=1&Signature=s';
const TOKEN_URL = 'https://firebasestorage.googleapis.com/v0/b/bucket/o/companies%2Fc_1%2Ff.pdf?alt=media&token=t';

describe('pdfFetchTarget', () => {
  describe('Α — απευθείας παράδοση (το URL είναι η άδεια)', () => {
    it('Α1: ζητά τον υπογεγραμμένο σύνδεσμο ΟΠΩΣ ΕΙΝΑΙ — ποτέ μέσα από τον proxy', () => {
      const target = pdfFetchTarget({ url: SIGNED, urlDelivery: 'direct' });
      expect(target.url).toBe(SIGNED);
      expect(target.url).not.toContain(API_ROUTES.DOWNLOAD);
    });

    it('Α2: δεν στέλνει cookie σε τρίτο host', () => {
      expect(pdfFetchTarget({ url: SIGNED, urlDelivery: 'direct' }).credentials).toBe('omit');
    });

    it('Α3: η δήλωση νικά ακόμη και το fileId — ο εκδότης της άδειας έκρινε ήδη', () => {
      expect(pdfFetchTarget({ url: SIGNED, fileId: 'file_1', urlDelivery: 'direct' }).url).toBe(SIGNED);
    });
  });

  describe('Β — χωρίς δήλωση, τίποτα δεν αλλάζει (ADR-862 Φ0 Β8)', () => {
    it('Β1: το fileId νικά το url και περνά από τον proxy με ταυτότητα', () => {
      expect(pdfFetchTarget({ url: TOKEN_URL, fileId: 'file a/1' })).toEqual({
        url: `${API_ROUTES.DOWNLOAD}?fileId=file%20a%2F1`,
        credentials: 'same-origin',
      });
    });

    it('Β2: σχετικό URL ζητείται όπως είναι (π.χ. σελίδα κοινοποίησης)', () => {
      expect(pdfFetchTarget({ url: '/api/shared/tok/pdf' })).toEqual({
        url: '/api/shared/tok/pdf',
        credentials: 'same-origin',
      });
    });

    it('Β3: απόλυτο URL χωρίς δήλωση πάει στον φρουρούμενο proxy `?url=`', () => {
      const target = pdfFetchTarget({ url: TOKEN_URL });
      const parsed = new URL(target.url, 'https://nestor.test');
      expect(parsed.pathname).toBe(API_ROUTES.DOWNLOAD);
      expect(parsed.searchParams.get('url')).toBe(TOKEN_URL);
      expect(parsed.searchParams.get('filename')).toBe('preview.pdf');
      expect(target.credentials).toBe('same-origin');
    });

    it('Β4: ρητό `proxied` ισοδυναμεί με απουσία — ο υπογεγραμμένος σύνδεσμος ΔΕΝ γίνεται απευθείας από μόνος του', () => {
      expect(pdfFetchTarget({ url: SIGNED, urlDelivery: 'proxied' })).toEqual(pdfFetchTarget({ url: SIGNED }));
      expect(pdfFetchTarget({ url: SIGNED }).url).toContain(API_ROUTES.DOWNLOAD);
    });
  });
});
