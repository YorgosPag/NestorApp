'use client';

/**
 * ADR-444 §Icons — composed MEP ribbon icon: plan-symbol SUBJECT × action BADGE.
 *
 * The subject is the element's own 2D plan symbol (same pure drawer the canvas uses,
 * see `mep-icon-subjects-plan.ts`), so the ribbon button shows exactly what will land
 * on the drawing. An optional badge (generate / accept / reject) marks the auto-design
 * triad; the subject is masked out under it so both stay legible at 16 and 28 px.
 *
 * Sizing follows `StructuralToolIcon`: no width/height here — the caller passes the
 * ribbon icon class (`dxf-ribbon-btn-icon-large|small`).
 *
 * @see ./mep-icon-tokens.ts · ./mep-icon-subjects.ts · ./mep-icon-badges.tsx
 */

import * as React from 'react';
import type { MepIconBadge, MepIconSubject } from './mep-icon-tokens';
import { resolveMepIconGeometry } from './mep-icon-subjects';
import { strokesToPathD } from './mep-icon-geometry';
import { MEP_BADGE_CUTOUT, MEP_BADGE_FRAGMENTS } from './mep-icon-badges';

interface MepToolIconProps {
  subject: MepIconSubject;
  badge?: MepIconBadge;
  className?: string;
}

/** Stroke weights (viewBox units): body = the ribbon icon norm, detail = plan-thin. */
const BODY_STROKE = 1.5;
const DETAIL_STROKE = 1;

export const MepToolIcon: React.FC<MepToolIconProps> = ({ subject, badge, className }) => {
  // useId yields ":r1:"-style ids; colons are stripped so `url(#…)` stays valid everywhere.
  const maskId = `mep-badge-cut-${React.useId().replace(/:/g, '')}`;
  const geometry = resolveMepIconGeometry(subject);
  const detailD = geometry.detail ? strokesToPathD(geometry.detail) : '';
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={BODY_STROKE}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      data-mep-icon={badge ? `${subject}:${badge}` : subject}
    >
      {badge && (
        <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24">
          <rect width="24" height="24" fill="white" />
          <circle cx={MEP_BADGE_CUTOUT.cx} cy={MEP_BADGE_CUTOUT.cy} r={MEP_BADGE_CUTOUT.r} fill="black" />
        </mask>
      )}
      <g mask={badge ? `url(#${maskId})` : undefined}>
        <path d={strokesToPathD(geometry.body)} />
        {detailD && <path d={detailD} strokeWidth={DETAIL_STROKE} />}
      </g>
      {badge && MEP_BADGE_FRAGMENTS[badge]}
    </svg>
  );
};
