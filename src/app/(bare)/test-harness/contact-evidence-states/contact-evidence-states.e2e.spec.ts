import { expect, test, type Locator, type Page } from '@playwright/test';

import el from '@/i18n/locales/el/contacts-form.json';

import { CONTACT_EVIDENCE_CASE_ATTRIBUTE, type ContactEvidenceCaseId } from './contact-evidence-states-cases';

/**
 * 🔍 ADR-950 §8.19 — **οι καταστάσεις του πίνακα «Το έγγραφο ↔ η επαφή» που καμία ζωντανή ανάγνωση δεν παράγει
 * κατά παραγγελία** («Μήπως…» από λάθος ανάγνωση της AI · χάρτης που δεν απάντησε · τηλέφωνο στη «Συμπλήρωση κενών»).
 *
 * Τα κείμενα έρχονται από το **ίδιο** `el/contacts-form.json` που διαβάζει η εφαρμογή — καμία δεύτερη αλήθεια.
 * Ο πίνακας και ο διάλογος είναι οι **πραγματικοί**· η σελίδα δίνει μόνο σταθερές αναγνώσεις.
 */

const HARNESS = '/test-harness/contact-evidence-states';
const TEXT = el.documentEvidence;

const fill = (template: string, values: Readonly<Record<string, string>>): string =>
  Object.entries(values).reduce((text, [key, value]) => text.replace(`{${key}}`, value), template);

function caseOf(page: Page, id: ContactEvidenceCaseId): Locator {
  return page.locator(`[${CONTACT_EVIDENCE_CASE_ATTRIBUTE}="${id}"]`);
}

function rowOf(scope: Locator, label: string): Locator {
  return scope.getByRole('row').filter({ has: scope.page().getByRole('rowheader', { name: label, exact: true }) });
}

test.beforeEach(async ({ page }) => {
  await page.goto(HARNESS);
  await expect(caseOf(page, 'phone-fill')).toBeVisible({ timeout: 180_000 });
});

test.describe('ADR-950 §8.19 — ο πίνακας λέει την αλήθεια σε ό,τι η παραγωγή δεν ξαναπαράγει', () => {
  test('Κ1 🔴 §8.13 — «ΣΑΜΟΓΡΑΦΗΣ» ⇒ «Μήπως: …Σαμοθράκης…» και το τυπωμένο από κάτω', async ({ page }) => {
    const address = rowOf(caseOf(page, 'corrected-street'), TEXT.fields.address);
    await expect(address).toContainText(fill(TEXT.corroboration.correctedStreet, { street: 'Σαμοθράκης' }).replace(';', ''));
    await expect(address).toContainText(fill(TEXT.corroboration.printed, { value: 'ΣΑΜΟΓΡΑΦΗΣ' }));
    await expect(address).not.toContainText(TEXT.ungrounded.unverified);
  });

  test('Κ2 🔴 §8.16 — κανένας χάρτης δεν απάντησε ⇒ «Ο χάρτης δεν απάντησε», ποτέ «δεν επιβεβαιώθηκε»', async ({ page }) => {
    const address = rowOf(caseOf(page, 'map-unavailable'), TEXT.fields.address);
    await expect(address).toContainText(TEXT.ungrounded.mapUnavailable);
    await expect(address).not.toContainText(TEXT.ungrounded.unverified);
    await expect(address).not.toContainText('Σαμοθράκης');
  });

  test('Κ3 🔴 §8.14 — το τηλέφωνο στη «Συμπλήρωση κενών» = η ΙΔΙΑ μορφή με τον πίνακα', async ({ page }) => {
    const scope = caseOf(page, 'phone-fill');
    const readable = '231 055 9595';
    const printed = fill(TEXT.corroboration.printed, { value: '2310.55.95.95' });

    const phone = rowOf(scope, TEXT.fields.phone);
    await expect(phone).toContainText(readable);
    await expect(phone).toContainText(printed);

    await scope.getByRole('button', { name: /^Συμπλήρωση κεν/ }).click();
    const dialog = page.getByRole('dialog', { name: TEXT.fill.title });
    await expect(dialog).toBeVisible();
    const phoneItem = dialog.getByRole('listitem').filter({ hasText: TEXT.fields.phone });
    await expect(phoneItem).toContainText(readable);
    await expect(phoneItem).toContainText(printed);

    await dialog.getByRole('button', { name: TEXT.fill.cancel, exact: true }).click();
    await expect(dialog).toBeHidden();
  });
});
