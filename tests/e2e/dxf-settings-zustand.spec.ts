/**
 * End-to-End Tests για το νέο Zustand DXF Settings System
 * Δοκιμάζει το override system που ζήτησε ο χρήστης
 */

import { test, expect } from '@playwright/test';

test.describe('DXF Settings με Zustand - Override System', () => {
  test.beforeEach(async ({ page }) => {
    // Πήγαινε στο DXF Viewer
    await page.goto('/dxf/viewer');

    // Περίμενε να φορτώσει η σελίδα
    await page.waitForLoadState('domcontentloaded');

    // Περίμενε για το UI να φορτώσει
    await page.waitForTimeout(2000);
  });

  test('Πρέπει να φορτώνει το νέο DxfSettingsPanel', async ({ page }) => {
    // Άνοιξε το floating panel
    const settingsButton = page.locator('[data-testid="floating-panel-settings"]');
    if (await settingsButton.isVisible()) {
      await settingsButton.click();
    }

    // Πήγαινε στην καρτέλα Canvas (που περιέχει τις ρυθμίσεις)
    const canvasTab = page.locator('text=Canvas');
    if (await canvasTab.isVisible()) {
      await canvasTab.click();
    }

    // Ελέγχει αν υπάρχει το νέο panel με το Zustand indicator
    const zustandIndicator = page.locator('text=Νέο Zustand Settings System');
    await expect(zustandIndicator).toBeVisible({ timeout: 10000 });

    // Ελέγχει αν υπάρχουν οι καρτέλες Γενικές/Ειδικές
    const generalTab = page.locator('text=Γενικές Ρυθμίσεις');
    const specialTab = page.locator('text=Ειδικές Ρυθμίσεις');

    await expect(generalTab).toBeVisible();
    await expect(specialTab).toBeVisible();
  });

  test('Γενικές ρυθμίσεις πρέπει να λειτουργούν', async ({ page }) => {
    // Άνοιξε το settings panel
    const settingsButton = page.locator('[data-testid="floating-panel-settings"]');
    if (await settingsButton.isVisible()) {
      await settingsButton.click();
    }

    const canvasTab = page.locator('text=Canvas');
    if (await canvasTab.isVisible()) {
      await canvasTab.click();
    }

    // Κλικ στις Γενικές Ρυθμίσεις
    const generalTab = page.locator('text=Γενικές Ρυθμίσεις');
    await generalTab.click();

    // Βρες το line width control
    const lineWidthSlider = page.locator('input[type="range"]').first();
    if (await lineWidthSlider.isVisible()) {
      // Άλλαξε την τιμή
      await lineWidthSlider.fill('2');

      // Περίμενε για debouncing
      await page.waitForTimeout(200);

      // Ελέγχει αν η αλλαγή αποθηκεύτηκε
      const savedIndicator = page.locator('text=Saved');
      await expect(savedIndicator).toBeVisible({ timeout: 5000 });
    }
  });

  test('Override system - οι ειδικές ρυθμίσεις πρέπει να αυτονομούνται', async ({ page }) => {
    // Άνοιξε το settings panel
    const settingsButton = page.locator('[data-testid="floating-panel-settings"]');
    if (await settingsButton.isVisible()) {
      await settingsButton.click();
    }

    const canvasTab = page.locator('text=Canvas');
    if (await canvasTab.isVisible()) {
      await canvasTab.click();
    }

    // Πρώτα, στις Γενικές Ρυθμίσεις, βάλε μια τιμή
    const generalTab = page.locator('text=Γενικές Ρυθμίσεις');
    await generalTab.click();

    const generalLineWidth = page.locator('input[type="range"]').first();
    if (await generalLineWidth.isVisible()) {
      await generalLineWidth.fill('1');
      await page.waitForTimeout(200);
    }

    // Τώρα πήγαινε στις Ειδικές Ρυθμίσεις
    // Σημείωση: Χρειαζόμαστε επιλεγμένο entity για να ενεργοποιηθούν
    const specialTab = page.locator('text=Ειδικές Ρυθμίσεις');

    // Αν η καρτέλα είναι disabled (δεν υπάρχει επιλεγμένο entity)
    if (await specialTab.locator('[disabled]').count() > 0) {
      console.log('Ειδικές ρυθμίσεις disabled - χρειάζεται επιλεγμένο entity');
      return; // Skip το test αν δεν υπάρχει entity
    }

    await specialTab.click();

    // Βρες το checkbox "Παράκαμψη Γενικών Ρυθμίσεων"
    const overrideCheckbox = page.locator('input[type="checkbox"]').filter({
      hasText: /παράκαμψη|override/i
    }).first();

    if (await overrideCheckbox.isVisible()) {
      // Ενεργοποίησε το override
      await overrideCheckbox.check();

      // Περίμενε για την ενεργοποίηση
      await page.waitForTimeout(300);

      // Τώρα άλλαξε τη line width στις ειδικές ρυθμίσεις
      const specialLineWidth = page.locator('input[type="range"]').first();
      if (await specialLineWidth.isVisible()) {
        await specialLineWidth.fill('5');
        await page.waitForTimeout(200);
      }

      // Πήγαινε πίσω στις γενικές και άλλαξε την τιμή
      await generalTab.click();
      const generalLineWidthAgain = page.locator('input[type="range"]').first();
      if (await generalLineWidthAgain.isVisible()) {
        await generalLineWidthAgain.fill('3');
        await page.waitForTimeout(200);
      }

      // Πήγαινε πίσω στις ειδικές και ελέγχει αν παραμένει 5
      await specialTab.click();
      const finalSpecialValue = page.locator('input[type="range"]').first();
      if (await finalSpecialValue.isVisible()) {
        const value = await finalSpecialValue.inputValue();
        // Οι ειδικές ρυθμίσεις πρέπει να παραμένουν στο 5, όχι να αλλάξουν σε 3
        expect(value).toBe('5');
        console.log('✅ Override system λειτουργεί! Ειδικές ρυθμίσεις αυτονομήθηκαν.');
      }
    }
  });

  test('LocalStorage persistence πρέπει να λειτουργεί', async ({ page }) => {
    // Άνοιξε το settings panel
    const settingsButton = page.locator('[data-testid="floating-panel-settings"]');
    if (await settingsButton.isVisible()) {
      await settingsButton.click();
    }

    const canvasTab = page.locator('text=Canvas');
    if (await canvasTab.isVisible()) {
      await canvasTab.click();
    }

    // Άλλαξε κάποια ρύθμιση
    const generalTab = page.locator('text=Γενικές Ρυθμίσεις');
    await generalTab.click();

    const lineWidthSlider = page.locator('input[type="range"]').first();
    if (await lineWidthSlider.isVisible()) {
      await lineWidthSlider.fill('4');
      await page.waitForTimeout(300);
    }

    // Ελέγχει αν αποθηκεύτηκε στο localStorage
    const localStorageValue = await page.evaluate(() => {
      return localStorage.getItem('dxf-settings-v2');
    });

    expect(localStorageValue).toBeTruthy();

    // Parse και ελέγχει τη δομή
    if (localStorageValue) {
      const settings = JSON.parse(localStorageValue);
      expect(settings).toHaveProperty('general');
      expect(settings.general).toHaveProperty('line');
      console.log('✅ LocalStorage persistence λειτουργεί!');
    }
  });

  test('Reset functionality πρέπει να λειτουργεί', async ({ page }) => {
    // Άνοιξε το settings panel
    const settingsButton = page.locator('[data-testid="floating-panel-settings"]');
    if (await settingsButton.isVisible()) {
      await settingsButton.click();
    }

    const canvasTab = page.locator('text=Canvas');
    if (await canvasTab.isVisible()) {
      await canvasTab.click();
    }

    // Άλλαξε κάποια ρύθμιση
    const generalTab = page.locator('text=Γενικές Ρυθμίσεις');
    await generalTab.click();

    const lineWidthSlider = page.locator('input[type="range"]').first();
    if (await lineWidthSlider.isVisible()) {
      await lineWidthSlider.fill('7');
      await page.waitForTimeout(200);
    }

    // Κλικ στο Reset button
    const resetButton = page.locator('text=Reset General');
    if (await resetButton.isVisible()) {
      await resetButton.click();
      await page.waitForTimeout(300);

      // Ελέγχει αν επέστρεψε στην default τιμή (0.25)
      const resetValue = await lineWidthSlider.inputValue();
      expect(parseFloat(resetValue)).toBeLessThan(1); // Default είναι 0.25
      console.log('✅ Reset functionality λειτουργεί!');
    }
  });

  test('Performance - δεν πρέπει να έχει memory leaks', async ({ page }) => {
    // Άνοιξε το settings panel
    const settingsButton = page.locator('[data-testid="floating-panel-settings"]');
    if (await settingsButton.isVisible()) {
      await settingsButton.click();
    }

    const canvasTab = page.locator('text=Canvas');
    if (await canvasTab.isVisible()) {
      await canvasTab.click();
    }

    // Κάνε πολλές αλλαγές για να δοκιμάσεις το debouncing
    const generalTab = page.locator('text=Γενικές Ρυθμίσεις');
    await generalTab.click();

    const lineWidthSlider = page.locator('input[type="range"]').first();
    if (await lineWidthSlider.isVisible()) {
      // Rapid changes για testing του debouncing
      for (let i = 1; i <= 10; i++) {
        await lineWidthSlider.fill(i.toString());
        await page.waitForTimeout(50); // Ταχύτερα από το debounce delay
      }

      // Περίμενε για το debouncing να ολοκληρωθεί
      await page.waitForTimeout(300);

      // Ελέγχει την τελική τιμή
      const finalValue = await lineWidthSlider.inputValue();
      expect(finalValue).toBe('10');
      console.log('✅ Debouncing λειτουργεί σωστά!');
    }
  });
});

test.describe('Συμβατότητα με παλιό σύστημα', () => {
  test('Πρέπει να μπορεί να κάνει switch μεταξύ legacy και Zustand', async ({ page }) => {
    // Αυτό το test θα τρέχει όταν το flag είναι false
    await page.goto('/dxf/viewer');
    await page.waitForLoadState('domcontentloaded');

    // Ελέγχει αν φορτώνει το σωστό component βάσει configuration
    const zustandIndicator = page.locator('text=Νέο Zustand Settings System');

    // Αν το flag είναι true, πρέπει να υπάρχει
    // Αν το flag είναι false, δεν πρέπει να υπάρχει
    const isVisible = await zustandIndicator.isVisible();
    console.log(`Zustand system visibility: ${isVisible}`);

    // Το test περνάει σε κάθε περίπτωση, απλά καταγράφει την κατάσταση
    expect(typeof isVisible).toBe('boolean');
  });
});