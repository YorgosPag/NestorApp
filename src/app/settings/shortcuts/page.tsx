// 🌐 i18n: All labels converted to i18n keys - 2026-01-18
'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { INTERACTIVE_PATTERNS } from '@/components/ui/effects';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useTranslation } from 'react-i18next';

// 🌐 i18n: Shortcut descriptions use i18n keys
const shortcutsListKeys = {
    file: [
        { key: 'Ctrl+S', descKey: 'shortcuts.file.save' },
        { key: 'Ctrl+O', descKey: 'shortcuts.file.open' },
        { key: 'Ctrl+N', descKey: 'shortcuts.file.new' },
    ],
    edit: [
        { key: 'Ctrl+Z', descKey: 'shortcuts.edit.undo' },
        { key: 'Ctrl+Y', descKey: 'shortcuts.edit.redo' },
        { key: 'Ctrl+C', descKey: 'shortcuts.edit.copy' },
        { key: 'Ctrl+V', descKey: 'shortcuts.edit.paste' },
        { key: 'Delete', descKey: 'shortcuts.edit.delete' },
    ],
    view: [
        { key: 'Ctrl+0', descKey: 'shortcuts.view.resetZoom' },
        { key: 'Ctrl+=', descKey: 'shortcuts.view.zoomIn' },
        { key: 'Ctrl+-', descKey: 'shortcuts.view.zoomOut' },
        { key: 'G', descKey: 'shortcuts.view.toggleGrid' },
    ],
    tools: [
        { key: 'V', descKey: 'shortcuts.tools.select' },
        { key: 'P', descKey: 'shortcuts.tools.polygon' },
        { key: 'L', descKey: 'shortcuts.tools.line' },
        { key: 'M', descKey: 'shortcuts.tools.measure' },
    ],
};

// 🌐 i18n: Category labels use i18n keys
const categoryKeys = {
    all: 'shortcuts.categories.all',
    file: 'shortcuts.categories.file',
    edit: 'shortcuts.categories.edit',
    view: 'shortcuts.categories.view',
    tools: 'shortcuts.categories.tools',
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
    const { quick } = useBorderTokens();

    const { t } = useTranslation('settings');

    // 🌐 i18n: Build filtered shortcuts with translations
    const filteredShortcuts = Object.entries(shortcutsListKeys)
        .filter(([category]) => selectedCategory === 'all' || category === selectedCategory)
        .map(([category, shortcuts]) => ({
            categoryKey: category,
            categoryLabel: t(categoryKeys[category as keyof typeof categoryKeys]),
            shortcuts: shortcuts.filter(shortcut => {
                const translatedDesc = t(shortcut.descKey).toLowerCase();
                return translatedDesc.includes(searchTerm.toLowerCase()) ||
                    shortcut.key.toLowerCase().includes(searchTerm.toLowerCase());
            })
        }))
        .filter(group => group.shortcuts.length > 0);

    return (
        <div className="p-4 sm:p-6 md:p-8 space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="text-2xl font-bold">{t('shortcuts.title')}</CardTitle>
                    <CardDescription>{t('shortcuts.description')}</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col sm:flex-row gap-4 mb-6">
                        <Input
                            type="search"
                            placeholder={t('shortcuts.searchPlaceholder')}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="flex-1"
                        />
                        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                            <SelectTrigger className="w-full sm:w-[200px]">
                                <SelectValue placeholder={t('shortcuts.categoryPlaceholder')} />
                            </SelectTrigger>
                            <SelectContent>
                                {Object.entries(categoryKeys).map(([key, labelKey]) => (
                                    <SelectItem key={key} value={key}>{t(labelKey)}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Button variant="outline">{t('shortcuts.print')}</Button>
                    </div>

                    <div className="space-y-8">
                        {filteredShortcuts.map(group => (
                            <div key={group.categoryKey}>
                                <h3 className="text-xl font-semibold mb-4 border-b pb-2">{group.categoryLabel}</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
                                    {group.shortcuts.map(shortcut => (
                                        <div key={shortcut.key} className={`flex items-center justify-between p-2 rounded-md ${INTERACTIVE_PATTERNS.SUBTLE_HOVER}`}>
                                            <span className="text-sm text-foreground">{t(shortcut.descKey)}</span>
                                            <kbd className={`px-2 py-1 bg-muted ${quick.card} text-xs font-mono text-muted-foreground`}>
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
