/**
 * ADR-444 §Icons — Tests for the composed MEP ribbon icon (plan-symbol subject × badge).
 *
 * Guarantees: every subject renders a non-empty, aria-hidden <svg> (alone and with
 * every badge); subjects produce pairwise-distinct geometry (no icon collision); the
 * badge masks the subject; the token vocabulary round-trips and rejects garbage; and
 * the resolver hands foreign tokens back (`null`) instead of claiming them.
 */

import React from 'react';
import { render } from '@testing-library/react';
import { MepToolIcon } from '../MepToolIcon';
import {
  MEP_ICON_BADGES, MEP_ICON_SUBJECTS, mepIconToken, parseMepIconToken,
} from '../mep-icon-tokens';
import { resolveMepIconGeometry } from '../mep-icon-subjects';
import { strokesToPathD } from '../mep-icon-geometry';
import { resolveMepRibbonIcon } from '../ribbon-icon-mep';

function subjectPath(container: HTMLElement): string {
  return container.querySelector('svg > g > path')?.getAttribute('d') ?? '';
}

describe('ADR-444 §Icons — MepToolIcon', () => {
  it('renders an aria-hidden <svg> with a non-empty body for every subject × badge', () => {
    for (const subject of MEP_ICON_SUBJECTS) {
      for (const badge of [undefined, ...MEP_ICON_BADGES]) {
        const { container } = render(<MepToolIcon subject={subject} badge={badge} />);
        const svg = container.querySelector('svg');
        expect(svg?.getAttribute('aria-hidden')).toBe('true');
        expect({ subject, badge, d: subjectPath(container).length > 0 }).toEqual({ subject, badge, d: true });
      }
    }
  });

  it('keeps every subject geometrically DISTINCT (no two subjects draw the same icon)', () => {
    const paths = MEP_ICON_SUBJECTS.map((s) => {
      const g = resolveMepIconGeometry(s);
      return strokesToPathD([...g.body, ...(g.detail ?? [])]);
    });
    expect(new Set(paths).size).toBe(MEP_ICON_SUBJECTS.length);
  });

  it('stays inside the 24×24 viewBox', () => {
    for (const subject of MEP_ICON_SUBJECTS) {
      const g = resolveMepIconGeometry(subject);
      for (const p of [...g.body, ...(g.detail ?? [])].flat()) {
        expect({ subject, inside: p.x >= 0 && p.x <= 24 && p.y >= 0 && p.y <= 24 }).toEqual({ subject, inside: true });
      }
    }
  });

  it('masks the subject under a badge and adds no mask without one', () => {
    const plain = render(<MepToolIcon subject="socket" />).container;
    expect(plain.querySelector('mask')).toBeNull();
    const badged = render(<MepToolIcon subject="socket" badge="accept" />).container;
    const maskId = badged.querySelector('mask')?.getAttribute('id');
    expect(maskId).toMatch(/^mep-badge-cut-[^:]+$/);
    expect(badged.querySelector('svg > g')?.getAttribute('mask')).toBe(`url(#${maskId})`);
  });

  it('applies the caller-provided sizing className', () => {
    const { container } = render(<MepToolIcon subject="luminaire" className="dxf-ribbon-btn-icon-large" />);
    expect(container.querySelector('svg')?.getAttribute('class')).toBe('dxf-ribbon-btn-icon-large');
  });
});

describe('ADR-444 §Icons — MEP icon tokens', () => {
  it('round-trips every subject × badge', () => {
    for (const subject of MEP_ICON_SUBJECTS) {
      expect(parseMepIconToken(mepIconToken(subject))).toEqual({ subject });
      for (const badge of MEP_ICON_BADGES) {
        expect(parseMepIconToken(mepIconToken(subject, badge))).toEqual({ subject, badge });
      }
    }
  });

  it.each([
    undefined, '', 'bim-socket', 'mep-icon', 'mep-icon:plug', 'mep-icon:socket:approve',
    'mep-icon:socket:accept:extra', 'other:socket',
  ])('rejects %p', (token) => {
    expect(parseMepIconToken(token)).toBeNull();
  });

  it('resolver claims only MEP tokens', () => {
    expect(resolveMepRibbonIcon('bim-socket', 'c')).toBeNull();
    expect(resolveMepRibbonIcon(mepIconToken('socket', 'reject'), 'c')).not.toBeNull();
  });
});
