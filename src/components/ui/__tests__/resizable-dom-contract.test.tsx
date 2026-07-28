/**
 * @tests ADR-724 §14.4 — το συμβόλαιο DOM ανάμεσα στο `ui/resizable` και το
 * `react-resizable-panels` v4.
 *
 * ── ΓΙΑΤΙ ΥΠΑΡΧΕΙ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ ──
 *
 * Το `resizable.tsx` έστυλιζε με ονόματα attributes της **v2/v3** (`data-panel-group-direction`,
 * `data-resize-handle-active`) πάνω σε εγκατεστημένη **v4**, που τα έχει μετονομάσει. Τρεις
 * σελίδες φαίνονταν να έχουν ένδειξη ενεργού συρσίματος και **δεν είχαν**.
 *
 * Το ελάττωμα έζησε γιατί **ένας selector που δεν ταιριάζει δεν είναι σφάλμα — είναι σιωπή**:
 * καμία προειδοποίηση build, καμία εξαίρεση, κανένα κόκκινο test. Το ίδιο θα ξανασυμβεί στην
 * επόμενη major της βιβλιοθήκης.
 *
 * ⛔ **ΜΗΝ το μετατρέψεις σε έλεγχο συμβολοσειράς** («περιέχει το className το X;»). Αυτό θα
 * κλείδωνε τη *διατύπωσή* μας, όχι το συμβόλαιο. Ο έλεγχος εδώ είναι **διασταυρωτικός**:
 * διαβάζει ποια attributes **στοχεύει** το className μας και απαιτεί να **υπάρχουν όντως** στο
 * DOM που παράγει η βιβλιοθήκη. Μετονομασία στη βιβλιοθήκη ⇒ κόκκινο, χωρίς να ξέρουμε εκ των
 * προτέρων το νέο όνομα.
 */

import * as React from 'react';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom';

import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '../resizable';

/** Οι καταστάσεις που τεκμηριώνει η v4.7.2 για το `data-separator`. */
const SEPARATOR_STATES = ['inactive', 'hover', 'active', 'disabled'];

/** Τα ονόματα της v2/v3 που έμειναν νεκρά στο στυλ επί μήνες — απαγορευμένα ονομαστικά. */
const RETIRED_ATTRIBUTES = ['data-panel-group-direction', 'data-resize-handle-active'];

/**
 * Βγάζει τα ονόματα attributes που στοχεύει ένα className του Tailwind.
 *
 * ⚠️ **ΤΕΣΣΕΡΙΣ μορφές, όχι δύο** — και οι δύο που λείπουν είναι ακριβώς αυτές που έκρυψαν το
 * ελάττωμα όταν γράφτηκε αυτό το αρχείο. Ο πρώτος parser απαιτούσε `=`, οπότε η μορφή
 * **παρουσίας** περνούσε αόρατη και το test έμενε πράσινο πάνω στην παλινδρόμηση:
 *
 * | Μορφή | Παράδειγμα | Attribute |
 * |---|---|---|
 * | data, τιμή | `data-[separator=active]:bg-ring` | `data-separator` |
 * | data, **παρουσία** | `data-[resize-handle-active]:bg-ring` | `data-resize-handle-active` |
 * | ωμός selector, τιμή | `[&[aria-orientation=horizontal]]:h-px` | `aria-orientation` |
 * | ωμός selector, **παρουσία** | `[&[data-foo]]:h-px` | `data-foo` |
 */
function targetedAttributes(className: string): string[] {
  const found = new Set<string>();
  for (const [, name] of className.matchAll(/(?:^|[\s:])data-\[([a-z-]+)(?:=|\])/g)) {
    found.add(`data-${name}`);
  }
  for (const [, name] of className.matchAll(/\[&\[([a-z-]+)(?:=|\])/g)) {
    found.add(name);
  }
  return [...found];
}

function renderGroup(orientation: 'horizontal' | 'vertical'): HTMLElement {
  const { container } = render(
    <ResizablePanelGroup orientation={orientation}>
      <ResizablePanel id="a" />
      <ResizableHandle withHandle />
      <ResizablePanel id="b" />
    </ResizablePanelGroup>
  );
  return container;
}

function separatorOf(container: HTMLElement): HTMLElement {
  const el = container.querySelector('[role="separator"]');
  if (!el) throw new Error('Δεν βρέθηκε στοιχείο με role="separator"');
  return el as HTMLElement;
}

describe('ui/resizable — συμβόλαιο DOM με react-resizable-panels v4', () => {
  describe('τι εκπέμπει πραγματικά η βιβλιοθήκη', () => {
    it('το Group φέρει data-group', () => {
      expect(renderGroup('horizontal').querySelector('[data-group]')).not.toBeNull();
    });

    it('τα Panels φέρουν data-panel', () => {
      expect(renderGroup('horizontal').querySelectorAll('[data-panel]')).toHaveLength(2);
    });

    it('ο Separator φέρει data-separator με τεκμηριωμένη κατάσταση', () => {
      const state = separatorOf(renderGroup('horizontal')).getAttribute('data-separator');
      expect(SEPARATOR_STATES).toContain(state);
    });

    it.each([
      ['horizontal', 'vertical'],
      ['vertical', 'horizontal'],
    ])(
      'ομάδα %s ⇒ ο separator δηλώνει aria-orientation=%s (η γραμμή, όχι η ομάδα)',
      (groupOrientation, expected) => {
        const sep = separatorOf(renderGroup(groupOrientation as 'horizontal' | 'vertical'));
        expect(sep).toHaveAttribute('aria-orientation', expected);
      }
    );
  });

  describe('ΤΟ ΚΡΙΣΙΜΟ — κάθε attribute που στοχεύουμε πρέπει να υπάρχει στο DOM', () => {
    it('ο separator φέρει όλα τα attributes που στοχεύει το className του', () => {
      const container = renderGroup('horizontal');
      const sep = separatorOf(container);
      const targeted = targetedAttributes(sep.className);

      // Δικλείδα της ίδιας της δικλείδας: αν ο parser δεν βρήκε τίποτα, ο έλεγχος από κάτω
      // θα περνούσε κενός — δηλαδή θα ήταν πράσινος πάνω σε τίποτα (το λάθος του ADR-724 §14.2).
      expect(targeted.length).toBeGreaterThan(0);

      for (const attribute of targeted) {
        expect(sep.hasAttribute(attribute)).toBe(true);
      }
    });

    it.each(RETIRED_ATTRIBUTES)(
      'το αποσυρμένο %s δεν εκπέμπεται πουθενά — μη το ξαναστοχεύσεις',
      (retired) => {
        const container = renderGroup('horizontal');
        const group = container.querySelector('[data-group]');

        expect(container.querySelector(`[${retired}]`)).toBeNull();

        // ⛔ ΟΧΙ `className.toContain(retired)`: το Tailwind γράφει `data-[resize-handle-active]`
        // **με αγκύλη**, οπότε η ωμή σύγκριση συμβολοσειράς δεν ταιριάζει ποτέ και ο έλεγχος
        // είναι διακοσμητικός. Συγκρίνουμε στα **κανονικοποιημένα** ονόματα.
        expect(targetedAttributes(separatorOf(container).className)).not.toContain(retired);
        expect(targetedAttributes(group?.className ?? '')).not.toContain(retired);
      }
    );
  });

  describe('η κατεύθυνση της ομάδας διαβάζεται από το prop, όχι από selector', () => {
    it('κάθετη ομάδα ⇒ flex-col στο Group', () => {
      expect(renderGroup('vertical').querySelector('[data-group]')).toHaveClass('flex-col');
    });

    it('οριζόντια ομάδα ⇒ χωρίς flex-col', () => {
      expect(renderGroup('horizontal').querySelector('[data-group]')).not.toHaveClass('flex-col');
    });
  });
});
