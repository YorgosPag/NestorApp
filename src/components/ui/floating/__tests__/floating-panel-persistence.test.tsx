/**
 * ADR-723 — «Να θυμάται τη θέση».
 *
 * Δύο επίπεδα, γιατί το ένα χωρίς το άλλο είναι επικίνδυνο:
 *
 *   • **Round trip** — ό,τι γράφτηκε, διαβάζεται· ό,τι είναι σκουπίδια, απορρίπτεται.
 *   • **Επαναφορά στο ζωντανό component** — η αποθηκευμένη γεωμετρία φτάνει όντως στο DOM
 *     ΚΑΙ περνά από τη διάσωση. Ένα persist που επαναφέρει παλέτα εκτός οθόνης είναι
 *     **χειρότερο** από καθόλου persist: ο χρήστης χάνει το εργαλείο και δεν ξέρει γιατί.
 *     Αυτό ακριβώς είναι το τεκμηριωμένο «palette lost off-screen» του AutoCAD.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import {
  readPanelGeometry,
  writePanelGeometry,
  clearPanelGeometry,
} from '../floating-panel-persistence';
import { FloatingPanel } from '../FloatingPanel';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'el' } }),
}));

const PANEL_ID = 'test.panel';
const STORAGE_KEY = `nestor:floating-panel-geometry:v1:${PANEL_ID}`;

beforeEach(() => {
  window.localStorage.clear();
});

describe('round trip', () => {
  it('γράφει και διαβάζει την ίδια γεωμετρία', () => {
    writePanelGeometry(PANEL_ID, { x: 120, y: 80, width: 640, height: 480 });
    expect(readPanelGeometry(PANEL_ID)).toEqual({ x: 120, y: 80, width: 640, height: 480 });
  });

  it('χωρίς αποθηκευμένη τιμή ⇒ null (ο καλών πέφτει στις προεπιλογές)', () => {
    expect(readPanelGeometry('never.written')).toBeNull();
  });

  it('χρησιμοποιεί κλειδί ΜΕ έκδοση σχήματος', () => {
    writePanelGeometry(PANEL_ID, { x: 1, y: 2, width: 3, height: 4 });
    expect(window.localStorage.getItem(STORAGE_KEY)).not.toBeNull();
  });

  it('το `clear` επαναφέρει στο «καμία προτίμηση»', () => {
    writePanelGeometry(PANEL_ID, { x: 1, y: 2, width: 3, height: 4 });
    clearPanelGeometry(PANEL_ID);
    expect(readPanelGeometry(PANEL_ID)).toBeNull();
  });

  it('κατεστραμμένο JSON ⇒ null, χωρίς exception', () => {
    window.localStorage.setItem(STORAGE_KEY, '{ not json');
    expect(readPanelGeometry(PANEL_ID)).toBeNull();
  });

  it('έγκυρο JSON με λάθος σχήμα ⇒ null (καμία μερική «διόρθωση»)', () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ x: 'left', y: null }));
    expect(readPanelGeometry(PANEL_ID)).toBeNull();
  });

  it('δύο παλέτες δεν πατούν η μία την άλλη', () => {
    writePanelGeometry('dxf.a', { x: 10, y: 10, width: 300, height: 300 });
    writePanelGeometry('dxf.b', { x: 90, y: 90, width: 500, height: 500 });
    expect(readPanelGeometry('dxf.a')?.x).toBe(10);
    expect(readPanelGeometry('dxf.b')?.x).toBe(90);
  });
});

describe('επαναφορά στο ζωντανό FloatingPanel', () => {
  const renderPanel = (): HTMLElement => {
    render(
      <FloatingPanel
        persistenceKey={PANEL_ID}
        resizable
        dimensions={{ width: 400, height: 300 }}
        minSize={{ width: 280, height: 160 }}
        data-testid="panel"
      >
        <FloatingPanel.Header title="τίτλος" />
        <FloatingPanel.Content>περιεχόμενο</FloatingPanel.Content>
      </FloatingPanel>,
    );
    return screen.getByTestId('panel');
  };

  it('εφαρμόζει την αποθηκευμένη θέση ΚΑΙ το αποθηκευμένο μέγεθος', () => {
    writePanelGeometry(PANEL_ID, { x: 220, y: 140, width: 610, height: 420 });
    const panel = renderPanel();
    expect(panel.style.left).toBe('220px');
    expect(panel.style.top).toBe('140px');
    expect(panel.style.width).toBe('610px');
    expect(panel.style.height).toBe('420px');
  });

  it('χωρίς αποθηκευμένη τιμή, πέφτει στις προεπιλογές του καταναλωτή', () => {
    const panel = renderPanel();
    expect(panel.style.width).toBe('400px');
    expect(panel.style.height).toBe('300px');
  });

  it('ΔΙΑΣΩΣΗ: θέση από οθόνη που δεν υπάρχει πια δεν φτάνει ποτέ στο DOM', () => {
    // jsdom viewport = 1024×768. Το `x: 5000` προέρχεται από δεύτερη οθόνη που αποσυνδέθηκε.
    writePanelGeometry(PANEL_ID, { x: 5000, y: 3000, width: 400, height: 300 });
    const panel = renderPanel();

    const left = Number.parseInt(panel.style.left, 10);
    const top = Number.parseInt(panel.style.top, 10);
    // Το αναλλοίωτο: μένει ορατή λωρίδα ≥ 40px — δηλαδή η παλέτα πιάνεται.
    expect(left).toBeLessThanOrEqual(window.innerWidth - 40);
    expect(top).toBeLessThanOrEqual(window.innerHeight - 40);
    expect(top).toBeGreaterThanOrEqual(0);
  });

  it('ΔΙΑΣΩΣΗ: μέγεθος μεγαλύτερο από την οθόνη συρρικνώνεται στο viewport', () => {
    writePanelGeometry(PANEL_ID, { x: 0, y: 0, width: 9000, height: 9000 });
    const panel = renderPanel();
    expect(Number.parseInt(panel.style.width, 10)).toBeLessThanOrEqual(window.innerWidth);
    expect(Number.parseInt(panel.style.height, 10)).toBeLessThanOrEqual(window.innerHeight);
  });

  it('χωρίς `persistenceKey` δεν γράφεται ΤΙΠΟΤΑ (οι 17 υπάρχουσες παλέτες μένουν άθικτες)', () => {
    render(
      <FloatingPanel dimensions={{ width: 400, height: 300 }} data-testid="ephemeral">
        <FloatingPanel.Header title="τίτλος" />
        <FloatingPanel.Content>περιεχόμενο</FloatingPanel.Content>
      </FloatingPanel>,
    );
    expect(window.localStorage.length).toBe(0);
  });

  it('χωρίς `persistenceKey`/`resizable` το ύψος ΔΕΝ επιβάλλεται (συμβατότητα προς τα πίσω)', () => {
    render(
      <FloatingPanel dimensions={{ width: 400, height: 300 }} data-testid="legacy">
        <FloatingPanel.Header title="τίτλος" />
        <FloatingPanel.Content>περιεχόμενο</FloatingPanel.Content>
      </FloatingPanel>,
    );
    const panel = screen.getByTestId('legacy');
    // Οι υπάρχουσες παλέτες παίρνουν ύψος από το περιεχόμενό τους — αν επιβαλλόταν ρητό
    // height, καθεμία τους θα άλλαζε σιωπηλά διάταξη.
    expect(panel.style.height).toBe('');
    expect(panel.style.width).toBe('');
    expect(panel.style.left).toBe('100px');
  });
});
