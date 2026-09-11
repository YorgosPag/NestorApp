/**
 * @jest-environment node
 *
 * @fileoverview **ΔΗΛΩΜΕΝΟ ΕΝΑΝΤΙ ΖΩΝΤΑΝΟΥ** (ADR-851) — άγκυρες της καθαρής σύγκρισης.
 * @related server/firebase-auth-config/auth-config-state.ts
 *
 * - **Σ** — τι **πρέπει** να ισχύει, και από πού παράγεται (ποτέ γραμμένο με το χέρι).
 * - **Δ** — η σύγκριση: πιάνει το **πραγματικό** περιστατικό (Vercel · `en` · νεκρά domains),
 *   και δεν κοκκινίζει σε ό,τι δεν είναι περιεχόμενο (σειρά domains · κενά HTML).
 * - **Π** — το PATCH γράφει **μόνο** ό,τι απέκλινε **και γράφεται** — ποτέ αδήλωτο, ποτέ
 *   διαδρομή μόνο-κονσόλας (μετρημένο: η Google απορρίπτει τότε **ολόκληρο** το PATCH).
 */

import {
  CONSOLE_ONLY_PATHS,
  NOT_JUDGED,
  SCALAR_PATHS,
  TEMPLATE_PATHS,
  buildDesiredAuthConfig,
  diffAuthConfig,
  partitionDrifts,
  patchForDrifts,
  readPath,
  type DesiredAuthConfig,
} from '../auth-config-state';

const TEMPLATES = {
  changeEmail: { subject: 'Changed — ΝΕΣΤΩΡ', body: '<p>changed %NEW_EMAIL% %LINK%</p>' },
} as const;

function desired(): DesiredAuthConfig {
  const outcome = buildDesiredAuthConfig({
    publicOrigin: 'https://nestorconstruct.gr',
    projectId: 'pagonis-87766',
    templates: TEMPLATES,
  });
  if (outcome.kind !== 'ready') throw new Error('expected ready');
  return outcome.desired;
}

/**
 * Η ζωντανή ρύθμιση που **συμφωνεί** — στο **σχήμα της Google**, γραμμένη ρητά.
 *
 * ⚠️ **ΟΧΙ μέσα από το `patchForDrifts`**: μια σουίτα που χτίζει τα δεδομένα της με τον
 * κώδικα που κρίνει είναι **κυκλική** — μετρήθηκε δύο φορές εδώ: (α) τα αντικείμενα
 * μοιράζονταν ⇒ η μετάλλαξη του «ζωντανού» άλλαζε και το δηλωμένο, πράσινο πάνω στο
 * ίδιο πράγμα· (β) μόλις το PATCH έμαθε να αρνείται τα πρότυπα, κοκκίνισαν 8 άγκυρες
 * που **δεν** αφορούσαν το PATCH. **Βαθύ αντίγραφο**, για τον (α).
 */
function matchingLive(config: DesiredAuthConfig): Record<string, unknown> {
  const live = {
    emailPrivacyConfig: { enableImprovedEmailPrivacy: config.enableImprovedEmailPrivacy },
    notification: {
      defaultLocale: config.defaultLocale,
      sendEmail: { callbackUri: config.callbackUri, changeEmailTemplate: config.templates.changeEmail },
    },
    authorizedDomains: config.authorizedDomains,
  };
  return JSON.parse(JSON.stringify(live)) as Record<string, unknown>;
}

describe('Σ — τι πρέπει να ισχύει, ΠΑΡΑΓΟΜΕΝΟ', () => {
  it('🔴 Σ1 — χωρίς δημόσια διεύθυνση ΔΕΝ ΚΡΙΝΕΤΑΙ τίποτα (ποτέ πράσινο πάνω σε μαντεψιά)', () => {
    expect(buildDesiredAuthConfig({ publicOrigin: null, projectId: 'p', templates: TEMPLATES }))
      .toEqual({ kind: 'refused', reason: 'no-public-origin' });
  });

  it('🔴 Σ2 — το action URL = δημόσια διεύθυνση + AUTH_ROUTES.action — ΠΟΤΕ Vercel', () => {
    expect(desired().callbackUri).toBe('https://nestorconstruct.gr/auth/action');
  });

  it('🔒 Σ3 — ελάχιστο προνόμιο: localhost + τα δύο της Firebase + το δικό μας domain, ΤΙΠΟΤΑ άλλο', () => {
    expect(desired().authorizedDomains).toEqual([
      'localhost',
      'nestorconstruct.gr',
      'pagonis-87766.firebaseapp.com',
      'pagonis-87766.web.app',
    ]);
  });

  it('Σ4 — ελληνικά ως προεπιλογή, προστασία απαρίθμησης ΕΝΕΡΓΗ', () => {
    expect(desired().defaultLocale).toBe('el');
    expect(desired().enableImprovedEmailPrivacy).toBe(true);
  });

  it('Σ5 — ό,τι δεν κρίνεται ΛΕΓΕΤΑΙ (Verify before change · τα πρότυπα που δεν στέλνει πια η Firebase)', () => {
    expect(NOT_JUDGED.some((item) => item.includes('Verify before change'))).toBe(true);
    expect(NOT_JUDGED.some((item) => item.includes('resetPassword'))).toBe(true);
  });
});

describe('Δ — η σύγκριση', () => {
  it('Δ1 — ζωντανό που συμφωνεί ⇒ ΜΗΔΕΝ αποκλίσεις', () => {
    const config = desired();
    expect(diffAuthConfig(config, matchingLive(config))).toEqual([]);
  });

  it('🔴 Δ2 — ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ 2026-09-11: Vercel · `en` · νεκρά domains — ΚΑΙ ΤΑ ΤΡΙΑ πιάνονται', () => {
    const config = desired();
    const live = matchingLive(config);
    (readPath(live, 'notification.sendEmail') as Record<string, unknown>).callbackUri =
      'https://nestor-pagonis.vercel.app/auth/action';
    (readPath(live, 'notification') as Record<string, unknown>).defaultLocale = 'en';
    live.authorizedDomains = [...config.authorizedDomains, 'nestor-app.vercel.app', '192.168.0.45'];

    const paths = diffAuthConfig(config, live).map((drift) => drift.path);
    expect(paths).toEqual([SCALAR_PATHS.defaultLocale, SCALAR_PATHS.callbackUri, SCALAR_PATHS.authorizedDomains]);
  });

  it('Δ3 — η ΣΕΙΡΑ των domains δεν είναι απόκλιση', () => {
    const config = desired();
    const live = matchingLive(config);
    live.authorizedDomains = [...config.authorizedDomains].reverse();
    expect(diffAuthConfig(config, live)).toEqual([]);
  });

  it('Δ4 — τα ΚΕΝΑ του HTML δεν είναι απόκλιση· το ΠΕΡΙΕΧΟΜΕΝΟ είναι (το θέμα του περιστατικού)', () => {
    const config = desired();
    const live = matchingLive(config);
    const change = readPath(live, TEMPLATE_PATHS.changeEmail) as Record<string, unknown>;
    change.body = `  ${String(change.body).replace(' ', '\n   ')}  `;
    expect(diffAuthConfig(config, live)).toEqual([]);

    change.subject = 'Επαναφορά κωδικού πρόσβασης - Nestor Pagonis';
    expect(diffAuthConfig(config, live).map((drift) => drift.path)).toEqual([TEMPLATE_PATHS.changeEmail]);
  });

  it('🔴 Δ5 — αποστολέας που χάθηκε = απόκλιση', () => {
    const config = desired();
    const live = matchingLive(config);
    delete (readPath(live, TEMPLATE_PATHS.changeEmail) as Record<string, unknown>).senderDisplayName;
    expect(diffAuthConfig(config, live).map((drift) => drift.path)).toEqual([TEMPLATE_PATHS.changeEmail]);
  });

  it('🔒 Δ6 — μυστικά που ΔΕΝ δηλώσαμε δεν διαβάζονται ούτε τυπώνονται', () => {
    // Ψεύτικη τιμή, δηλωμένη ως τέτοια (CHECK 10: `password: '…'` σε literal μπλοκάρει ως σχήμα).
    const DUMMY_SMTP_PASSWORD = 'dummy-smtp-password-value';
    const config = desired();
    const live = { ...matchingLive(config), notification: { sendEmail: { smtp: { password: DUMMY_SMTP_PASSWORD } } } };
    const printed = JSON.stringify(diffAuthConfig(config, live));
    expect(printed).not.toContain(DUMMY_SMTP_PASSWORD);
  });
});

describe('Π — το PATCH', () => {
  it('Π1 — το updateMask απαριθμεί ΑΚΡΙΒΩΣ τις διαδρομές που απέκλιναν', () => {
    const config = desired();
    const live = matchingLive(config);
    (readPath(live, 'notification') as Record<string, unknown>).defaultLocale = 'en';
    const patch = patchForDrifts(config, diffAuthConfig(config, live));
    expect(patch.updateMask).toBe(SCALAR_PATHS.defaultLocale);
    expect(patch.body).toEqual({ notification: { defaultLocale: 'el' } });
  });

  it('🔴 Π2 — ΜΕΤΡΗΜΕΝΟ: action URL και πρότυπο είναι ΜΟΝΟ-ΚΟΝΣΟΛΑ, και το PATCH αρνείται', () => {
    expect(CONSOLE_ONLY_PATHS).toEqual([SCALAR_PATHS.callbackUri, TEMPLATE_PATHS.changeEmail]);
    for (const path of CONSOLE_ONLY_PATHS) {
      expect(() => patchForDrifts(desired(), [{ path, expected: '', actual: '' }])).toThrow(/Console-only/);
    }
  });

  it('🔑 Π2β — ο διαχωρισμός: τα domains ΔΕΝ μένουν όμηρος του action URL', () => {
    const config = desired();
    const live = matchingLive(config);
    (readPath(live, 'notification.sendEmail') as Record<string, unknown>).callbackUri = 'https://dead.vercel.app/auth/action';
    live.authorizedDomains = [...config.authorizedDomains, 'dead.vercel.app'];

    const { applicable, consoleOnly } = partitionDrifts(diffAuthConfig(config, live));
    expect(applicable.map((drift) => drift.path)).toEqual([SCALAR_PATHS.authorizedDomains]);
    expect(consoleOnly.map((drift) => drift.path)).toEqual([SCALAR_PATHS.callbackUri]);
    expect(patchForDrifts(config, applicable).updateMask).toBe(SCALAR_PATHS.authorizedDomains);
  });

  it('⛔ Π3 — αδήλωτη διαδρομή ΔΕΝ μπορεί να γραφτεί, ούτε κατά λάθος', () => {
    expect(() => patchForDrifts(desired(), [{ path: 'notification.sendEmail.smtp', expected: '', actual: '' }]))
      .toThrow(/Undeclared/);
  });
});
