'use client';

import React from 'react';
import { RulerTickLinesSettings } from './RulerTickLinesSettings';

export interface RulerMajorLinesSettingsProps {
  className?: string;
}

/** Κύριες γραμμές χάρακα. Όλη η λογική ζει στο `RulerTickLinesSettings`. */
export const RulerMajorLinesSettings: React.FC<RulerMajorLinesSettingsProps> = ({ className }) => (
  <RulerTickLinesSettings tier="major" className={className} />
);

export default RulerMajorLinesSettings;
