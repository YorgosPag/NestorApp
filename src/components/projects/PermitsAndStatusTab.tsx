'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FileText, Settings } from "lucide-react";
import { useIconSizes } from '@/hooks/useIconSizes';

interface PermitsAndStatusTabProps {
    data: {
        buildingBlock: string;
        protocolNumber: string;
        licenseNumber: string;
        issuingAuthority: string;
        status: string;
        showOnWeb: boolean;
    };
    setData: React.Dispatch<React.SetStateAction<any>>;
    isEditing: boolean;
}

export function PermitsAndStatusTab({ data, setData, isEditing }: PermitsAndStatusTabProps) {
    const iconSizes = useIconSizes();
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setData((prev: any) => ({...prev, [e.target.name]: e.target.value}));
    };

    const handleSelectChange = (value: string) => {
        setData((prev: any) => ({...prev, status: value}));
    };

    const handleCheckboxChange = (checked: boolean | "indeterminate") => {
        setData((prev: any) => ({...prev, showOnWeb: checked}));
    };

    return (
        <Card>
            <CardHeader className="pb-4">
                <div className="flex items-center gap-2">
                    <FileText className={`${iconSizes.md} text-primary`} />
                    <CardTitle className="text-lg">Άδειες & Κατάσταση</CardTitle>
                </div>
                <CardDescription>
                    Στοιχεία αδειών και τρέχουσα κατάσταση του έργου
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="buildingBlock" className="text-sm font-medium">Οικοδομικό Τετράγωνο</Label>
                        <Input id="buildingBlock" name="buildingBlock" value={data.buildingBlock} onChange={handleChange} disabled={!isEditing} className="h-10" />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="protocolNumber" className="text-sm font-medium">Αρ. Πρωτοκόλλου</Label>
                        <Input id="protocolNumber" name="protocolNumber" value={data.protocolNumber} onChange={handleChange} disabled={!isEditing} placeholder="Εισάγετε αριθμό..." className="h-10" />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="licenseNumber" className="text-sm font-medium">Αριθμός Άδειας</Label>
                        <Input id="licenseNumber" name="licenseNumber" value={data.licenseNumber} onChange={handleChange} disabled={!isEditing} className="h-10 text-primary font-medium" />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="issuingAuthority" className="text-sm font-medium">Αρχή Έκδοσης</Label>
                        <Input id="issuingAuthority" name="issuingAuthority" value={data.issuingAuthority} onChange={handleChange} disabled={!isEditing} placeholder="Εισάγετε αρχή..." className="h-10" />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                    <div className="space-y-2">
                        <Label className="text-sm font-medium">Κατάσταση Έργου</Label>
                        <Select value={data.status} onValueChange={handleSelectChange} disabled={!isEditing}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="constructed" className="text-popover-foreground">Κατασκευασμένα</SelectItem>
                                <SelectItem value="planning" className="text-popover-foreground">Σχεδιασμός</SelectItem>
                                <SelectItem value="in_progress" className="text-popover-foreground">Σε εξέλιξη</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label className="text-sm font-medium">Επιλογές</Label>
                        <div className="flex items-center space-x-2 h-10">
                            <Checkbox id="show-on-web" checked={data.showOnWeb} onCheckedChange={handleCheckboxChange} disabled={!isEditing} />
                            <Label htmlFor="show-on-web" className="text-sm">Προβολή στο διαδίκτυο</Label>
                        </div>
                    </div>
                    <div className="flex justify-start">
                        <Button variant="outline" className="h-10" disabled={!isEditing}>
                            <Settings className={`${iconSizes.sm} mr-2`} />
                            Επιλογή Έργου
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
