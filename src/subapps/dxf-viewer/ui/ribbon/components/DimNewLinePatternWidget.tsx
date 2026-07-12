'use client';

/**
 * ADR-362 (Path B) — «＋ Νέος τύπος γραμμής» ribbon launcher for the Dimension tab.
 *
 * Thin wrapper over the shared `LinePatternLauncherButton` (SSoT). No `onCreated`:
 * the editor registers the user-created linetype in `LinetypeRegistry`, and because
 * the ribbon «Τύπος» dropdown reads that live registry, the new pattern appears
 * there automatically — no selection/override plumbing needed here. Sits right
 * beside «Τύπος» (what it creates), on the Dimension contextual tab.
 */

import React from 'react';
import { LinePatternLauncherButton } from './LinePatternLauncherButton';

export const DimNewLinePatternWidget: React.FC = () => (
  <LinePatternLauncherButton labelKey="ribbon.commands.dimNewLineType" />
);
