'use client';

import React from 'react';
import { getCentroid } from '@/lib/geometry';
import type { Property } from '@/types/property-viewer';
import type { ConnectionType } from '@/types/connections';
import { CONNECTION_COLORS, CONNECTION_FALLBACK_COLOR } from '@/config/connection-config';

interface Props {
  prop1: Property;
  prop2: Property;
  type: ConnectionType;
}

export function ConnectionLine({ prop1, prop2, type }: Props) {
  const start = getCentroid(prop1.vertices);
  const end = getCentroid(prop2.vertices);
  const color = CONNECTION_COLORS[type] || CONNECTION_FALLBACK_COLOR;
  const isDashed = type === 'parking';

  return (
    <line
      x1={start.x}
      y1={start.y}
      x2={end.x}
      y2={end.y}
      stroke={color}
      strokeWidth="2"
      strokeDasharray={isDashed ? '5 5' : undefined}
      opacity={0.8}
      className="pointer-events-none"
    />
  );
}
