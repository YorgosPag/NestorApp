/**
 * @jest-environment node
 *
 * ADR-241 — **D4: η επιφάνεια της πλήρους οθόνης αποδίδεται στον server χωρίς να πετάει.**
 *
 * Ο σταθερός ξενιστής των παιδιών είναι στοιχείο που δημιουργείται στον **browser** (`document.createElement`) και τα
 * παιδιά μπαίνουν σε αυτόν με `createPortal` — που ο server renderer του React **δεν** υποστηρίζει (πετά). Οι 13
 * καταναλωτές είναι client components, αλλά αποδίδονται **και** στον server: ένα `createPortal` στο πρώτο πέρασμα θα
 * έριχνε ολόκληρη τη σελίδα στο `global-error`. Το πρώτο πέρασμα οφείλει να είναι σκέτο placeholder.
 */

import React from 'react';
import { renderToString } from 'react-dom/server';

import { FullscreenOverlay } from '@/core/containers/FullscreenOverlay';

describe('D4 — αποδίδεται στον server', () => {
  test.each([false, true])('isFullscreen=%s ⇒ renderToString δεν πετά', (isFullscreen) => {
    expect(() =>
      renderToString(
        <FullscreenOverlay isFullscreen={isFullscreen} onToggle={() => undefined} ariaLabel="Δοκιμή">
          <p>περιεχόμενο</p>
        </FullscreenOverlay>,
      ),
    ).not.toThrow();
  });
});
