'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Building, Briefcase } from "lucide-react";

interface BasicProjectInfoTabProps {
    data: {
        name: string;
        licenseTitle: string;
        description: string;
        companyName: string;
    };
    setData: React.Dispatch<React.SetStateAction<any>>;
    isEditing: boolean;
}

export function BasicProjectInfoTab({ data, setData, isEditing }: BasicProjectInfoTabProps) {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setData((prev: any) => ({...prev, [e.target.name]: e.target.value}));
    };

    return (
        <Card>
            <CardHeader className="pb-4">
                <div className="flex items-center gap-2">
                    <Briefcase className="w-5 h-5 text-primary" />
                    <CardTitle className="text-lg">Βασικές Πληροφορίες Έργου</CardTitle>
                </div>
                <CardDescription>
                    Γενικά στοιχεία και περιγραφή του έργου
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="name" className="text-sm font-medium">Τίτλος Έργου</Label>
                        <Input id="name" name="name" value={data.name} onChange={handleChange} disabled={!isEditing} className="h-10" />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="licenseTitle" className="text-sm font-medium">Τίτλος Άδειας</Label>
                        <Input id="licenseTitle" name="licenseTitle" value={data.licenseTitle} onChange={handleChange} disabled={!isEditing} className="h-10" />
                    </div>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="companyName" className="text-sm font-medium">Εταιρεία</Label>
                     <div className="relative">
                        <Building className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input 
                            id="companyName" 
                            name="companyName" 
                            value={data.companyName} 
                            disabled 
                            className="h-10 bg-muted/50 pl-10 font-medium" 
                        />
                    </div>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="description" className="text-sm font-medium">Περιγραφή Έργου</Label>
                    <Textarea
                        id="description"
                        name="description"
                        rows={4}
                        className="resize-none"
                        value={data.description}
                        onChange={handleChange}
                        disabled={!isEditing}
                    />
                </div>
            </CardContent>
        </Card>
    );
}