'use client';

import React from 'react';
import { RulerTickLinesSettings } from './RulerTickLinesSettings';

export interface RulerMinorLinesSettingsProps {
  className?: string;
}

/** Δευτερεύουσες γραμμές χάρακα. Όλη η λογική ζει στο `RulerTickLinesSettings`. */
export const RulerMinorLinesSettings: React.FC<RulerMinorLinesSettingsProps> = ({ className }) => (
  <RulerTickLinesSettings tier="minor" className={className} />
);

export default RulerMinorLinesSettings;
