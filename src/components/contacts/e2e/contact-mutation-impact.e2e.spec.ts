import { expect, test } from '@playwright/test';

const harnessPath = '/test-harness/contact-mutation';

async function openIndividualWarnRoute(page: import('@playwright/test').Page) {
  await page.route('**/api/contacts/contact_e2e_individual/identity-impact-preview', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          mode: 'warn',
          changes: [
            {
              field: 'firstName',
              category: 'display',
              oldValue: 'Maria',
              newValue: 'Marina',
              isCleared: false,
            },
          ],
          dependencies: [
            { id: 'projectLinks', count: 2, mode: 'warn' },
          ],
          affectedDomains: ['linkedProjects'],
          messageKey: 'identityImpact.messages.warn',
          blockingCount: 0,
          warningCount: 1,
        },
      }),
    });
  });

  await page.goto(`${harnessPath}?scenario=individual`);
}

test.describe('Contact mutation impact browser flows', () => {
  test('individual warn flow cancels without saving', async ({ page }) => {
    await openIndividualWarnRoute(page);

    await page.getByRole('button', { name: /Edit|Επεξεργασία/ }).click();
    await page.locator('input[name="firstName"]').fill('Marina');
    await page.getByRole('button', { name: /^Save$|^Αποθήκευση$/ }).click();

    await expect(page.getByRole('heading', { name: /Individual identity change impact|Επίδραση αλλαγής στοιχείων φυσικού προσώπου/ })).toBeVisible();
    await page.getByRole('button', { name: /^Cancel$|^Ακύρωση$/ }).click();

    await expect(page.getByTestId('save-count')).toHaveText('saves:0');
    await expect(page.getByTestId('last-save')).toHaveText('no-save');
  });

  test('individual warn flow confirms and completes save', async ({ page }) => {
    await openIndividualWarnRoute(page);

    await page.getByRole('button', { name: /Edit|Επεξεργασία/ }).click();
    await page.locator('input[name="firstName"]').fill('Marina');
    await page.getByRole('button', { name: /^Save$|^Αποθήκευση$/ }).click();

    await expect(page.getByRole('button', { name: /Continue with impact awareness|Συνέχεια με επίγνωση επιπτώσεων/ })).toBeVisible();
    await page.getByRole('button', { name: /Continue with impact awareness|Συνέχεια με επίγνωση επιπτώσεων/ }).click();

    await expect(page.getByTestId('save-count')).toHaveText('saves:1');
    await expect(page.getByTestId('last-save')).toContainText('Marina');
    await expect(page.getByTestId('update-events')).toHaveText('updates:1');
  });

  test('company preview failure blocks save and shows fail-closed dialog', async ({ page }) => {
    await page.route('**/api/contacts/contact_e2e_company/company-identity-impact-preview', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, error: 'preview unavailable' }),
      });
    });

    await page.goto(`${harnessPath}?scenario=company`);

    await page.getByRole('button', { name: /Edit|Επεξεργασία/ }).click();
    await page.locator('input[name="companyName"]').fill('Acme Construction Group');
    await page.getByRole('button', { name: /^Save$|^Αποθήκευση$/ }).click();

    await expect(page.getByRole('heading', { name: /Company identity change blocked|Η αλλαγή στοιχείων εταιρείας μπλοκαρίστηκε/ })).toBeVisible();
    await page.getByRole('button', { name: /^Understood$|^Το κατάλαβα$/ }).click();

    await expect(page.getByTestId('save-count')).toHaveText('saves:0');
    await expect(page.getByTestId('last-save')).toHaveText('no-save');
  });
});
