/**
 * @fileoverview 🖼️ **ΤΟ ΚΟΥΤΙ ΤΗΣ ΕΠΙΚΑΛΥΨΗΣ ΕΙΝΑΙ Η ΕΙΚΟΝΑ** — κάθε επιφάνεια «εικόνα + SVG από πάνω» φορά το ΕΝΑ πλαίσιο.
 * @related ../image-overlay-frame.ts · ADR-897 §6 (01/10) · ADR-880 (24/09)
 *
 * Π1 — η σταθερά απαγορεύει το τέντωμα και στους δύο άξονες (`w-fit` + `self-start`), και **όχι** με `inline-block`;
 * Π2 — ο επεξεργαστής σημείων λήψης φορά το πλαίσιο;
 * Π3 — ο επιλογέας σημείου εστίασης φορά το πλαίσιο;
 *
 * ⚠️ Το jsdom **δεν** έχει διάταξη, άρα αυτό **δεν** μετρά το κουτί — καρφώνει την **αιτία**. Το σφάλμα μετρήθηκε
 * ζωντανά (01/10, Chrome, 2400 CSS px): `inline-block` μέσα σε `flex-col` ⇒ κουτί 1894 vs εικόνα 1176 ⇒ κλικ στο κέντρο
 * της κάτοψης γράφτηκε `x = 0,195`. Μετάλλαξη: πίσω στο `inline-block max-w-full` ⇒ Π2 κόκκινο.
 */

import React from 'react';
import { render } from '@testing-library/react';

import { IMAGE_OVERLAY_FRAME_CLASS } from '../image-overlay-frame';
import { CaptureSpotEditSurface } from '../capture-spots/CaptureSpotEditSurface';
import { FocalPointSurface } from '../focal-point/FocalPointSurface';

const SIZE = { width: 1200, height: 800 };
const noop = () => undefined;

function expectFramed(figure: Element | null) {
  expect(figure).not.toBeNull();
  for (const token of IMAGE_OVERLAY_FRAME_CLASS.split(' ')) expect(figure?.classList).toContain(token);
  expect(figure?.classList).not.toContain('inline-block');
}

describe('IMAGE_OVERLAY_FRAME_CLASS', () => {
  it('Π1 — κανένα τέντωμα σε κανέναν άξονα, ανεξάρτητα από τον γονέα', () => {
    const tokens = IMAGE_OVERLAY_FRAME_CLASS.split(' ');
    expect(tokens).toEqual(expect.arrayContaining(['relative', 'w-fit', 'self-start']));
    expect(tokens).not.toContain('inline-block');
  });

  it('Π2 — ο επεξεργαστής σημείων λήψης φορά το πλαίσιο', () => {
    const { container } = render(
      <CaptureSpotEditSurface src="blob:plan" alt="" size={SIZE} onSize={noop} onError={noop} floorplanId="plan"
        markers={[]} selectedPhotoId={null} selected={null} onSelect={noop} onChange={noop}
        labels={{ surface: 's', target: 't', fovEdge: 'f', northGlyph: 'N', northArrow: 'n' }}
        northRad={0} onNorth={noop} />,
    );
    expectFramed(container.querySelector('figure'));
  });

  it('Π3 — ο επιλογέας σημείου εστίασης φορά το πλαίσιο', () => {
    const handlers = { onPointerDown: noop, onPointerMove: noop, onPointerUp: noop, onKeyDown: noop };
    const { container } = render(
      <FocalPointSurface src="blob:photo" alt="" point={{ x: 0.5, y: 0.5 }} suggestion={null} size={SIZE}
        surfaceLabel="s" valueText="v" handlers={handlers} onSize={noop} onError={noop} />,
    );
    expectFramed(container.querySelector('figure'));
  });
});
