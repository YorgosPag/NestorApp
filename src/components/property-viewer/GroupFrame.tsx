'use client';

import React from 'react';
import type { Property } from '@/types/property-viewer';
import type { PropertyGroup } from '@/types/connections';
import { getCentroid } from '@/lib/geometry';

interface Props {
  group: PropertyGroup;
  properties: Property[];
}

export function GroupFrame({ group, properties }: Props) {
  const groupProperties = properties.filter(p => group.propertyIds.includes(p.id));
  if (groupProperties.length < 1) return null;

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  groupProperties.forEach(prop => {
    prop.vertices.forEach(({ x, y }) => {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    });
  });

  const padding = 20;
  minX -= padding;
  minY -= padding;
  maxX += padding;
  maxY += padding;

  return (
    <g className="group-frame pointer-events-none">
      <rect
        x={minX}
        y={minY}
        width={maxX - minX}
        height={maxY - minY}
        fill="transparent"
        stroke={group.color}
        strokeWidth="2"
        strokeDasharray="10 5"
        rx="10"
        ry="10"
        opacity={0.7}
      />
      <text
        x={minX + 10}
        y={minY - 10}
        fontSize="14"
        fontWeight="bold"
        fill={group.color}
        style={{
          paintOrder: 'stroke',
          stroke: 'white',
          strokeWidth: '4px',
          strokeLinejoin: 'round',
        }}
      >
        {group.name}
      </text>
    </g>
  );
}
