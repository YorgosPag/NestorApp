/**
 * @jest-environment node
 *
 * @fileoverview ADR-915 §45 Φ3 — **το email της υπενθύμισης παράδοσης** — άγκυρες.
 * @related services/email-templates/issuance-invitation-email.ts (`delivery-reminder`) · issuance-invitation-email-texts.ts
 *
 * Κάθε άρνηση με τον **παρονομαστή** της: η ίδια είσοδος, αλλάζοντας **μόνο** το κρίσιμο πεδίο. Συνθετικά δεδομένα.
 */

jest.mock('server-only', () => ({}));

import { DELIVERY_REMINDER_MOMENTS } from '@/lib/document-validity/issuance-delivery-reminder';
import { buildIssuanceEmail, type IssuanceEmailInput } from '../issuance-invitation-email';
import { ISSUANCE_EMAIL_TEXTS } from '../issuance-invitation-email-texts';

type ReminderInput = Extract<IssuanceEmailInput, { kind: 'delivery-reminder' }>;

const SPACE = 'https://nestorconstruct.gr/engagements/eng_1';

function build(overrides: Partial<ReminderInput> = {}) {
  return buildIssuanceEmail({
    kind: 'delivery-reminder',
    language: 'el',
    facts: {
      officeName: 'Γραφείο Συνθετικό', propertyLabel: 'Διαμέρισμα Α1', documentKind: 'energy-certificate',
      professionalName: 'Επιθεωρητής Συνθετικός', credential: { qualification: 'energy-inspector-registered', registryNumber: 'ΥΠΕΝ-1' }, note: null,
    },
    moment: 'overdue',
    dueOn: '2026-11-12',
    spaceLink: SPACE,
    ...overrides,
  });
}

describe('ADR-915 §45 Φ3 — υπενθύμιση παράδοσης: χώρος ή όχι', () => {
  it('με χώρο ⇒ ΕΝΑ κουμπί «Άνοιγμα χώρου» προς τον χώρο του', () => {
    const email = build();
    expect(email.html).toContain(SPACE);
    expect(email.html).toContain(ISSUANCE_EMAIL_TEXTS.el.deliveryReminder.cta);
    expect(email.text).toContain(ISSUANCE_EMAIL_TEXTS.el.deliveryReminder.nextInSpace);
  });

  it('χωρίς χώρο ⇒ κανένας σύνδεσμος, μόνο «παραδώστε ή ενημερώστε το γραφείο»', () => {
    const email = build({ spaceLink: null });
    expect(email.html).not.toContain(SPACE);
    expect(email.html).not.toContain(ISSUANCE_EMAIL_TEXTS.el.deliveryReminder.cta);
    expect(email.text).toContain(ISSUANCE_EMAIL_TEXTS.el.deliveryReminder.nextNoSpace);
    expect(email.text).toContain(ISSUANCE_EMAIL_TEXTS.el.deliveryReminder.footnote);
  });
});

describe('ADR-915 §45 Φ3 — η στιγμή αλλάζει θέμα και επικεφαλίδα', () => {
  it.each(DELIVERY_REMINDER_MOMENTS)('%s', (moment) => {
    const email = build({ moment });
    expect(email.subject).toContain(ISSUANCE_EMAIL_TEXTS.el.deliveryReminder.subject[moment]('', 'Διαμέρισμα Α1').trim().split(' —')[0]);
    expect(email.html).toContain(ISSUANCE_EMAIL_TEXTS.el.deliveryReminder.heading[moment]);
  });

  it('η προθεσμία λέγεται όταν υπάρχει· χωρίς προθεσμία δεν επινοείται', () => {
    expect(build().text).toContain(ISSUANCE_EMAIL_TEXTS.el.deliveryReminder.dueLabel);
    expect(build({ dueOn: null, moment: 'no-due-date' }).text).not.toContain(ISSUANCE_EMAIL_TEXTS.el.deliveryReminder.dueLabel);
  });

  it('στη γλώσσα του παραλήπτη', () => {
    expect(build({ language: 'en' }).subject).toContain('Delivery is overdue');
    expect(build().subject).toContain('Η παράδοση καθυστερεί');
  });
});

describe('ADR-915 §45 — μία τελεία στο τέλος πρότασης (ζωντανό εύρημα 2026-11-16: «95 τ.μ..»)', () => {
  const facts = (propertyLabel: string): ReminderInput['facts'] => ({
    officeName: 'Γραφείο Συνθετικό', propertyLabel, documentKind: 'energy-certificate',
    professionalName: 'Επιθεωρητής Συνθετικός', credential: { qualification: 'energy-inspector-registered', registryNumber: 'ΥΠΕΝ-1' }, note: null,
  });

  it('τιμή που λήγει σε «.» απορροφά την τελεία της φράσης — και στο κείμενο και στο HTML', () => {
    const email = build({ moment: 'no-due-date', dueOn: null, facts: facts('Διαμέρισμα 95 τ.μ.') });
    expect(email.text).toContain('Διαμέρισμα 95 τ.μ.\n');
    expect(email.text).not.toContain('τ.μ..');
    expect(email.html).toContain('<strong>Διαμέρισμα 95 τ.μ.</strong></p>');
    expect(email.html).not.toContain('τ.μ.</strong>.');
  });

  it('παρονομαστής: τιμή χωρίς τελεία κρατά την τελεία της φράσης', () => {
    const email = build({ moment: 'no-due-date', dueOn: null, facts: facts('Διαμέρισμα Α1') });
    expect(email.html).toContain('<strong>Διαμέρισμα Α1</strong>.');
  });

  it('τελεία στη ΜΕΣΗ της φράσης (όχι αμέσως μετά την τιμή) δεν αγγίζεται', () => {
    const email = build({ moment: 'overdue', facts: facts('Διαμέρισμα 95 τ.μ.') });
    expect(email.text).toContain('Διαμέρισμα 95 τ.μ. πέρασε.');
  });
});
