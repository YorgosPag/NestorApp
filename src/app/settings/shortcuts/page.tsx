
'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { INTERACTIVE_PATTERNS } from '@/components/ui/effects';

const shortcutsList = {
    file: [
        { key: 'Ctrl+S', description: 'Αποθήκευση' },
        { key: 'Ctrl+O', description: 'Άνοιγμα αρχείου' },
        { key: 'Ctrl+N', description: 'Νέο project' },
    ],
    edit: [
        { key: 'Ctrl+Z', description: 'Αναίρεση' },
        { key: 'Ctrl+Y', description: 'Επανάληψη' },
        { key: 'Ctrl+C', description: 'Αντιγραφή' },
        { key: 'Ctrl+V', description: 'Επικόλληση' },
        { key: 'Delete', description: 'Διαγραφή' },
    ],
    view: [
        { key: 'Ctrl+0', description: 'Επαναφορά zoom' },
        { key: 'Ctrl+=', description: 'Μεγέθυνση' },
        { key: 'Ctrl+-', description: 'Σμίκρυνση' },
        { key: 'G', description: 'Εμφάνιση/Απόκρυψη πλέγματος' },
    ],
    tools: [
        { key: 'V', description: 'Εργαλείο επιλογής' },
        { key: 'P', description: 'Εργαλείο polygon' },
        { key: 'L', description: 'Εργαλείο γραμμής' },
        { key: 'M', description: 'Εργαλείο μέτρησης' },
    ],
};

const categories = {
    all: 'Όλα',
    file: 'Αρχείο',
    edit: 'Επεξεργασία',
    view: 'Προβολή',
    tools: 'Εργαλεία',
};

const formatKey = (key: string) => {
    return key
        .split('+')
        .map(part => {
            switch(part.toLowerCase()) {
                case 'ctrl': return '⌘/Ctrl';
                case 'shift': return '⇧';
                case 'alt': return '⌥/Alt';
                default: return part;
            }
        })
        .join(' + ');
};

export default function ShortcutsPage() {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('all');

    const filteredShortcuts = Object.entries(shortcutsList)
        .filter(([category]) => selectedCategory === 'all' || category === selectedCategory)
        .map(([category, shortcuts]) => ({
            category: categories[category as keyof typeof categories],
            shortcuts: shortcuts.filter(shortcut => 
                shortcut.description.toLowerCase().includes(searchTerm.toLowerCase()) || 
                shortcut.key.toLowerCase().includes(searchTerm.toLowerCase())
            )
        }))
        .filter(group => group.shortcuts.length > 0);

    return (
        <div className="p-4 sm:p-6 md:p-8 space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="text-2xl font-bold">Συντομεύσεις Πληκτρολογίου</CardTitle>
                    <CardDescription>Λίστα με όλες τις διαθέσιμες συντομεύσεις για γρηγορότερη πλοήγηση και χρήση της εφαρμογής.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col sm:flex-row gap-4 mb-6">
                        <Input
                            type="search"
                            placeholder="Αναζήτηση συντόμευσης..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="flex-1"
                        />
                        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                            <SelectTrigger className="w-full sm:w-[200px]">
                                <SelectValue placeholder="Επιλογή κατηγορίας" />
                            </SelectTrigger>
                            <SelectContent>
                                {Object.entries(categories).map(([key, label]) => (
                                    <SelectItem key={key} value={key}>{label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Button variant="outline">Εκτύπωση</Button>
                    </div>

                    <div className="space-y-8">
                        {filteredShortcuts.map(group => (
                            <div key={group.category}>
                                <h3 className="text-xl font-semibold mb-4 border-b pb-2">{group.category}</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
                                    {group.shortcuts.map(shortcut => (
                                        <div key={shortcut.key} className={`flex items-center justify-between p-2 rounded-md ${INTERACTIVE_PATTERNS.SUBTLE_HOVER}`}>
                                            <span className="text-sm text-foreground">{shortcut.description}</span>
                                            <kbd className="px-2 py-1 bg-muted border rounded text-xs font-mono text-muted-foreground">
                                                {formatKey(shortcut.key)}
                                            </kbd>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
