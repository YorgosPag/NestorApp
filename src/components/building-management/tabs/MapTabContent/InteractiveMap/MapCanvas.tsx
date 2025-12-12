'use client';

import React from 'react';
import { Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { GROUP_HOVER_PATTERNS } from '@/components/ui/effects';
import { nearbyProjects } from './nearbyProjects';
import { NearbyProjectMarker } from './NearbyProjectMarker';

interface MapCanvasProps {
    buildingName: string;
    mapView: 'satellite' | 'street' | 'hybrid';
    showNearbyProjects: boolean;
    selectedLayer: 'all' | 'active' | 'completed';
}

export function MapCanvas({ buildingName, mapView, showNearbyProjects, selectedLayer }: MapCanvasProps) {
    const filteredProjects = nearbyProjects.filter(project => {
        if (selectedLayer === 'all') return true;
        return project.status === selectedLayer;
    });

    return (
        <div className="relative h-96 bg-gradient-to-br from-green-100 via-blue-50 to-green-100 rounded-lg border-2 border-dashed border-border overflow-hidden">
            {/* Simulated Map Background */}
            <div className="absolute inset-0">
                <div className="w-full h-full relative">
                    {/* Grid pattern to simulate map */}
                    <div className="absolute inset-0 opacity-10">
                        <div className="grid grid-cols-12 grid-rows-8 h-full w-full">
                            {Array.from({ length: 96 }).map((_, i) => (
                                <div key={i} className="border border-border/50"></div>
                            ))}
                        </div>
                    </div>

                    {/* Main Building Marker */}
                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-20">
                        <div className="relative group">
                            <div className="animate-bounce">
                                <div className="bg-red-500 p-3 rounded-full shadow-lg border-4 border-white">
                                    <Building2 className="w-6 h-6 text-white" />
                                </div>
                            </div>
                            <div className={`absolute top-14 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-75 text-white px-3 py-1 rounded text-sm whitespace-nowrap opacity-0 ${GROUP_HOVER_PATTERNS.SHOW_ON_GROUP} transition-opacity`}>
                                {buildingName}
                            </div>
                        </div>
                    </div>

                    {/* Nearby Projects */}
                    {showNearbyProjects && filteredProjects.map((project, index) => (
                        <NearbyProjectMarker
                            key={project.id}
                            project={project}
                            position={{
                                top: `${40 + (index * 15)}%`,
                                left: `${35 + (index * 20)}%`
                            }}
                        />
                    ))}

                    {/* Distance circles */}
                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                        <div className="w-32 h-32 border-2 border-blue-300 border-dashed rounded-full opacity-30"></div>
                        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-48 h-48 border-2 border-blue-200 border-dashed rounded-full opacity-20"></div>
                    </div>

                    {/* Scale indicator */}
                    <div className="absolute bottom-4 left-4 bg-white bg-opacity-90 px-3 py-2 rounded text-sm">
                        <div className="flex items-center gap-2">
                            <div className="w-16 h-1 bg-black"></div>
                            <span>100m</span>
                        </div>
                    </div>

                    {/* Map type indicator */}
                    <div className="absolute top-4 right-4 bg-white bg-opacity-90 px-3 py-2 rounded text-sm font-medium">
                        {mapView === 'street' ? 'Χάρτης δρόμων' :
                            mapView === 'satellite' ? 'Δορυφορική όψη' :
                                'Υβριδική όψη'}
                    </div>
                </div>
            </div>
        </div>
    );
}
