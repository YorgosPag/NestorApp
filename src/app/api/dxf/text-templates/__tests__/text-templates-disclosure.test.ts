/**
 * ADR-742 Φάση Β — **η μεταμφίεση πρέπει να είναι πανομοιότυπη**.
 *
 * ΓΙΑΤΙ ΥΠΑΡΧΕΙ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ: η σιωπή απέναντι σε ξένο id αξίζει **μόνο** αν
 * ο καλών δεν μπορεί να ξεχωρίσει το «δεν σου ανήκει» από το «δεν υπάρχει». Αν
 * το γνήσιο 404 έλεγε `Text template "tpl_x" not found.` και το μεταμφιεσμένο
 * σκέτο `Not found`, **το ίδιο το κείμενο θα γινόταν μαντείο ύπαρξης** και όλη
 * η δουλειά θα ήταν διακοσμητική. Η αστοχία είναι **αόρατη σε κάθε άλλο
 * έλεγχο**: και τα δύο είναι «404», τα routes δουλεύουν, η οθόνη δείχνει κάτι
 * λογικό — μόνο ένας `toEqual` το πιάνει.
 *
 * Γι' αυτό ο κεντρικός ισχυρισμός δεν είναι «μοιάζει» αλλά **ίσο**.
 *
 * @see ADR-742 §3.3 (ο κανόνας αποκάλυψης) · §3.4 (η παγίδα)
 */

jest.mock('firebase-admin/firestore', () => ({ Timestamp: class {} }));
jest.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      body,
    }),
  },
}));

import { mapServiceError } from '../_helpers';
import {
  TextTemplateCrossTenantError,
  TextTemplateNotFoundError,
  TextTemplateValidationError,
} from '@/subapps/dxf-viewer/text-engine/templates/text-template.types';

const TEMPLATE_ID = 'tpl_text_01K9ZQ7X8N4M2P';
const CALLER_COMPANY = 'comp_kalonta';
const OWNER_COMPANY = 'comp_allou';

/** Ο κανονικός χρήστης — δεν μπορεί ποτέ να μάθει νόμιμα ότι υπάρχει ξένο id. */
const NORMAL_USER = { globalRole: 'internal_user' } as const;
/** Ο bypass ρόλος — έχει ήδη cross-tenant ορατότητα. */
const SUPER_ADMIN = { globalRole: 'super_admin' } as const;

const crossTenant = () =>
  new TextTemplateCrossTenantError(TEMPLATE_ID, CALLER_COMPANY, OWNER_COMPANY);

describe('ADR-742 §3.4 — μεταμφιεσμένο 404 για πρότυπα κειμένου', () => {
  it('🔴 είναι ΙΣΟ, όχι απλώς παρόμοιο, με το γνήσιο «δεν βρέθηκε»', () => {
    const foreign = mapServiceError(crossTenant(), NORMAL_USER);
    const missing = mapServiceError(new TextTemplateNotFoundError(TEMPLATE_ID), NORMAL_USER);

    // Ολόκληρη η απόκριση — status, κωδικός, κείμενο. Καμία διαφορά, πουθενά.
    expect(foreign).toEqual(missing);
  });

  it('δεν μαρτυρά τίποτα για την πραγματική εταιρεία-ιδιοκτήτη', () => {
    const { status, body } = mapServiceError(crossTenant(), NORMAL_USER);

    expect(status).toBe(404);
    expect(body.code).toBe('TEXT_TEMPLATE_NOT_FOUND');
    expect(body.error).not.toContain(OWNER_COMPANY);
    expect(body.error).not.toContain(CALLER_COMPANY);
    expect(body.error.toLowerCase()).not.toContain('belongs');
    expect(body.error.toLowerCase()).not.toContain('forbidden');
  });

  it('το κείμενο είναι αυτό του ίδιου constructor — όχι χειρόγραφο string', () => {
    const { body } = mapServiceError(crossTenant(), NORMAL_USER);

    expect(body.error).toBe(new TextTemplateNotFoundError(TEMPLATE_ID).message);
  });
});

describe('ADR-742 §3.3 — η εξαίρεση του bypass ρόλου', () => {
  it('ο super-admin παίρνει ειλικρινές 403 που του σώζει τη διάγνωση', () => {
    const { status, body } = mapServiceError(crossTenant(), SUPER_ADMIN);

    expect(status).toBe(403);
    expect(body.code).toBe('TEXT_TEMPLATE_CROSS_TENANT');
    // Η διάγνωση **είναι** η αξία: ποιανού είναι και ποιος ρώτησε.
    expect(body.error).toContain(OWNER_COMPANY);
    expect(body.error).toContain(CALLER_COMPANY);
  });

  it('οι δύο ρόλοι παίρνουν ΔΙΑΦΟΡΕΤΙΚΗ απάντηση για το ίδιο σφάλμα', () => {
    // Αν αυτό γίνει ίσο, ή η σιωπή έσπασε ή η εξαίρεση έπαψε να ισχύει.
    expect(mapServiceError(crossTenant(), SUPER_ADMIN)).not.toEqual(
      mapServiceError(crossTenant(), NORMAL_USER),
    );
  });
});

describe('τα υπόλοιπα σφάλματα δεν άλλαξαν συμπεριφορά', () => {
  it('validation → 400 με τα issues, ίδιο και για τους δύο ρόλους', () => {
    const err = new TextTemplateValidationError('Bad input', ['name is required']);

    const asUser = mapServiceError(err, NORMAL_USER);

    expect(asUser).toEqual({
      status: 400,
      body: {
        success: false,
        error: 'Bad input',
        code: 'TEXT_TEMPLATE_VALIDATION',
        details: ['name is required'],
      },
    });
    expect(mapServiceError(err, SUPER_ADMIN)).toEqual(asUser);
  });

  it('άγνωστο σφάλμα → 500 INTERNAL, χωρίς μεταμφίεση', () => {
    expect(mapServiceError(new Error('boom'), NORMAL_USER)).toEqual({
      status: 500,
      body: { success: false, error: 'boom', code: 'INTERNAL' },
    });
  });

  it('μη-Error τιμή → 500 χωρίς να σκάσει', () => {
    expect(mapServiceError('κάτι', NORMAL_USER)).toEqual({
      status: 500,
      body: { success: false, error: 'Unknown error', code: 'INTERNAL' },
    });
  });
});
