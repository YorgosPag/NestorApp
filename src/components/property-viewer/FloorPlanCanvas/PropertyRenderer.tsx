'use client';

import React from 'react';
import { PropertyPolygon } from './PropertyPolygon';
import { ConnectionLine } from '../ConnectionLine';
import { GroupFrame } from '../GroupFrame';
import type { Property } from '@/types/property-viewer';
import type { Connection, PropertyGroup } from '@/types/connections';
import type { LayerState } from '../SidebarPanel';


interface PropertyRendererProps {
    properties: Property[];
    groups: PropertyGroup[];
    connections: Connection[];
    layerStates: Record<string, LayerState>;
    selectedPropertyIds: string[];
    hoveredProperty: string | null;
    isNodeEditMode: boolean;
    onHover: (propertyId: string | null) => void;
    onSelect: (propertyId: string, isShiftClick: boolean) => void;
    onNavigateLevels: (property: Property) => void;
    showMeasurements: boolean;
    showLabels: boolean;
    scale: number;
    isConnecting: boolean;
    firstConnectionPoint: Property | null;
}

export function PropertyRenderer({
    properties,
    groups,
    connections,
    layerStates,
    selectedPropertyIds,
    hoveredProperty,
    isNodeEditMode,
    onHover,
    onSelect,
    onNavigateLevels,
    showMeasurements,
    showLabels,
    scale,
    isConnecting,
    firstConnectionPoint
}: PropertyRendererProps) {
    return (
        <g>
            {/* Render groups first so they are in the back */}
            {groups.map((group) => (
                <GroupFrame key={group.id} group={group} properties={properties} />
            ))}
            
            {/* Render connections */}
            {connections.map((connection) => {
                const prop1 = properties.find(p => p.id === connection.from);
                const prop2 = properties.find(p => p.id === connection.to);
                if (!prop1 || !prop2) return null;
                return <ConnectionLine key={connection.id} prop1={prop1} prop2={prop2} type={connection.type} />
            })}
            
            {/* Render temporary connection line */}
            {isConnecting && firstConnectionPoint && (
                <ConnectionLine prop1={firstConnectionPoint} prop2={{...firstConnectionPoint, vertices: [{x: 0, y: 0}]}} type="related" />
            )}

            {properties.map((property) => {
                const layerState = layerStates[property.id] || { visible: true, opacity: 0.3, locked: false };
                return (
                    <PropertyPolygon
                        key={property.id}
                        property={property}
                        isSelected={selectedPropertyIds.includes(property.id)}
                        isHovered={hoveredProperty === property.id}
                        isNodeEditMode={isNodeEditMode && selectedPropertyIds.includes(property.id)}
                        onHover={onHover}
                        onSelect={onSelect}
                        onNavigateLevels={onNavigateLevels}
                        showMeasurements={showMeasurements}
                        showLabels={showLabels}
                        scale={scale}
                        visible={layerState.visible}
                        opacity={layerState.opacity ?? 0.3}
                        isConnecting={isConnecting}
                        isFirstConnectionPoint={firstConnectionPoint?.id === property.id}
                    />
                );
            })}
        </g>
    );
}
