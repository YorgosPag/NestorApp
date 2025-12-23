'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Ruler, ZoomIn, ZoomOut } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';

interface MapControlsProps {
    showNearbyProjects: boolean;
    setShowNearbyProjects: (show: boolean) => void;
    selectedLayer: 'all' | 'active' | 'completed';
    setSelectedLayer: (layer: 'all' | 'active' | 'completed') => void;
}

export function MapControls({
    showNearbyProjects,
    setShowNearbyProjects,
    selectedLayer,
    setSelectedLayer,
}: MapControlsProps) {
    const iconSizes = useIconSizes();
    return (
        <div className="mt-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                    <Checkbox
                        id="nearby-projects"
                        checked={!!showNearbyProjects}
                        onCheckedChange={(checked) => setShowNearbyProjects(!!checked)}
                    />
                    <Label htmlFor="nearby-projects" className="text-sm">
                        Εμφάνιση γειτονικών έργων
                    </Label>
                </div>

                <div className="flex items-center gap-2">
                    <Label className="text-sm">Φίλτρο:</Label>
                    <Select value={selectedLayer} onValueChange={(value) => setSelectedLayer(value as any)}>
                        <SelectTrigger className={`w-[180px] ${iconSizes.xl} text-sm`}>
                            <SelectValue placeholder="Επιλογή φίλτρου" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Όλα τα έργα</SelectItem>
                            <SelectItem value="active">Ενεργά μόνο</SelectItem>
                            <SelectItem value="completed">Ολοκληρωμένα μόνο</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="flex items-center gap-2">
                <Button variant="outline" size="sm">
                    <ZoomIn className={`${iconSizes.sm} mr-2`} /> Zoom In
                </Button>
                <Button variant="outline" size="sm">
                    <ZoomOut className={`${iconSizes.sm} mr-2`} /> Zoom Out
                </Button>
                <Button variant="outline" size="sm">
                    <Ruler className={`${iconSizes.sm} mr-2`} /> Μέτρηση απόστασης
                </Button>
            </div>
        </div>
    );
}
