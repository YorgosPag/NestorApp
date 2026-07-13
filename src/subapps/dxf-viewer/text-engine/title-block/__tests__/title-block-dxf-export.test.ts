/**
 * ADR-651 Φάση ΣΤ — η πινακίδα εξάγεται ως **πραγματικό DXF BLOCK/INSERT**.
 *
 * Δεν γράφτηκε κανένας νέος writer: η πινακίδα είναι `BlockEntity` (Φάση Β) και ο υπάρχων
 * professional writer (ADR-636/644/648) την εξάγει ήδη ως `BLOCK` ορισμό + `INSERT` αναφορά —
 * όπως ακριβώς κάνουν AutoCAD/Revit με τα title-block families. Αυτό το test **κλειδώνει**
 * αυτή τη συμπεριφορά (regression guard· αν κάποιος «απλοποιήσει» τον writer, σπάει εδώ).
 */

import { writeDxfAscii } from '../../../export/core/dxf-ascii-writer';
import { buildBlockEntityFromDef } from '../../../bim/block-library/place-block-from-library';
import { buildTitleBlockDef, TITLE_BLOCK_BLOCK_NAME, hasTitleBlockEntity } from '../title-block-def';
import { titleBlockPreset } from '../title-block-presets';
import type { Entity } from '../../../types/entities';
import type { PlaceholderScope } from '../../templates/resolver/scope.types';

const SCOPE: PlaceholderScope = {
  project: { name: 'Οικία Παπαδοπούλου', location: 'Λάρισα', client: 'Γ. Παπαδόπουλος' },
  user: { fullName: 'Νέστωρ Παγώνης', licenseNumber: '12345' },
  drawing: { scale: '1:50' },
  formatting: { locale: 'el' },
};

function titleBlockEntity() {
  const def = buildTitleBlockDef(titleBlockPreset('permit').templates.el, SCOPE, {
    scaleFactor: 50,
    layout: {
      paper: { size: 'A3', orientation: 'landscape' },
      withFrame: true,
      withStampBox: true,
      stampLabel: 'ΣΦΡΑΓΙΔΑ',
    },
  });
  return buildBlockEntityFromDef(def, { position: { x: 0, y: 0 }, layerId: '0' });
}

describe('title block → DXF export (ADR-636/644/648, reuse)', () => {
  it('γράφεται ως BLOCK ορισμός + INSERT αναφορά με το όνομα της πινακίδας', () => {
    const dxf = writeDxfAscii([titleBlockEntity() as Entity], {
      tableLayers: [{ id: '0', name: '0', color: '#ffffff', visible: true }],
    });

    expect(dxf).toContain('BLOCKS');
    expect(dxf).toContain('INSERT');
    // Το όνομα ταξιδεύει στον ορισμό ΚΑΙ στην αναφορά (BLOCK record ⇄ INSERT).
    const occurrences = dxf.split(TITLE_BLOCK_BLOCK_NAME).length - 1;
    expect(occurrences).toBeGreaterThanOrEqual(2);
  });

  it('τα λυμένα στοιχεία του έργου φτάνουν στο DXF (zero-config auto-fill)', () => {
    const dxf = writeDxfAscii([titleBlockEntity() as Entity], {
      tableLayers: [{ id: '0', name: '0', color: '#ffffff', visible: true }],
    });
    expect(dxf).toContain('Οικία Παπαδοπούλου');
    expect(dxf).toContain('Λάρισα');
    expect(dxf).toContain('12345');
  });

  it('η ανίχνευση «λείπει πινακίδα» βλέπει το block με το όνομά του (Απόφαση #10β)', () => {
    expect(hasTitleBlockEntity([])).toBe(false);
    expect(hasTitleBlockEntity([titleBlockEntity() as Entity])).toBe(true);
  });
});
