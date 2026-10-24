/**
 * `ribbon-icon-mep` — resolver for the MEP discipline-tab icons (ADR-444 §Icons).
 *
 * Same «one module per area» split as `ribbon-icon-table.tsx` (N.7.1): the big
 * `RibbonButtonIcon` switch only delegates. Returns `null` for any token that is not
 * a VALID `mep-icon:<subject>[:<badge>]` token, so a foreign key falls through and a
 * misspelt MEP token is caught by the coverage test instead of hiding behind a
 * plausible-looking icon.
 */

import * as React from 'react';
import { parseMepIconToken } from './mep-icon-tokens';
import { MepToolIcon } from './MepToolIcon';

export function resolveMepRibbonIcon(icon: string | undefined, className: string): React.ReactElement | null {
  const spec = parseMepIconToken(icon);
  if (!spec) return null;
  return <MepToolIcon subject={spec.subject} badge={spec.badge} className={className} />;
}
