'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Folder, Eye } from "lucide-react";
import { useIconSizes } from '@/hooks/useIconSizes';

interface ProjectAttachmentsTabProps {
    data: {
        mapPath: string;
        floorPlanPath: string;
        percentagesPath: string;
    };
    setData: React.Dispatch<React.SetStateAction<any>>;
}

export function ProjectAttachmentsTab({ data, setData }: ProjectAttachmentsTabProps) {
    const iconSizes = useIconSizes();
    const handleFileSelect = (field: string) => {
        // This would open a file dialog in a real application
        console.log(`Selecting file for ${field}`);
    };

    return (
        <Card>
            <CardHeader className="pb-4">
                <div className="flex items-center gap-2">
                    <Folder className={`${iconSizes.md} text-primary`} />
                    <CardTitle className="text-lg">Συνημμένα Αρχεία</CardTitle>
                </div>
                <CardDescription>
                    Αρχεία και έγγραφα που σχετίζονται με το έργο
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="mapPath" className="text-sm font-medium">Χάρτης Περιοχής Έργου</Label>
                    <div className="flex items-center gap-2">
                        <Input
                            id="mapPath"
                            readOnly
                            value={data.mapPath}
                            className="h-10 bg-muted/30"
                        />
                        <Button variant="outline" size="icon" className="${iconSizes['2xl']} shrink-0" onClick={() => handleFileSelect('mapPath')}>
                            <Folder className={iconSizes.sm} />
                        </Button>
                        <Button variant="outline" size="icon" className="${iconSizes['2xl']} shrink-0">
                            <Eye className={iconSizes.sm} />
                        </Button>
                    </div>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="floorPlanPath" className="text-sm font-medium">Γενική Κάτοψη Έργου</Label>
                    <div className="flex items-center gap-2">
                        <Input
                            id="floorPlanPath"
                            readOnly
                            value={data.floorPlanPath}
                            className="h-10 bg-muted/30"
                        />
                         <Button variant="outline" size="icon" className="${iconSizes['2xl']} shrink-0" onClick={() => handleFileSelect('floorPlanPath')}>
                            <Folder className={iconSizes.sm} />
                        </Button>
                        <Button variant="outline" size="icon" className="${iconSizes['2xl']} shrink-0">
                            <Eye className={iconSizes.sm} />
                        </Button>
                    </div>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="percentagesPath" className="text-sm font-medium">Πίνακας Ποσοστών</Label>
                    <div className="flex items-center gap-2">
                        <Input
                            id="percentagesPath"
                            readOnly
                            value={data.percentagesPath}
                            className="h-10 bg-muted/30"
                        />
                         <Button variant="outline" size="icon" className="${iconSizes['2xl']} shrink-0" onClick={() => handleFileSelect('percentagesPath')}>
                            <Folder className={iconSizes.sm} />
                        </Button>
                        <Button variant="outline" size="icon" className="${iconSizes['2xl']} shrink-0">
                            <Eye className={iconSizes.sm} />
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
