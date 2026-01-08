
'use client';

import { cn } from '@/lib/utils';
import { Rocket, Zap, Palette, Target, ClipboardList } from 'lucide-react';
// 🏢 ENTERPRISE: Using centralized entity config for Building icon
import { NAVIGATION_ENTITIES } from '@/components/navigation/config/navigation-entities';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

export const milestones = [
    {
        id: 1,
        title: "Έναρξη Έργου",
        description: "Υπογραφή συμβολαίου και έναρξη εργασιών",
        date: "2006-05-02",
        status: "completed",
        progress: 100,
        type: "start"
    },
    {
        id: 2,
        title: "Θεμέλια & Υπόγειο",
        description: "Ολοκλήρωση εκσκαφών και κατασκευή θεμελίων",
        date: "2006-08-15",
        status: "completed",
        progress: 100,
        type: "construction"
    },
    {
        id: 3,
        title: "Κατασκευή Φέροντα Οργανισμού",
        description: "Σκελετός κτιρίου - όροφοι 1-7",
        date: "2007-12-20",
        status: "completed",
        progress: 100,
        type: "construction"
    },
    {
        id: 4,
        title: "Τοιχοποιίες & Στεγανοποίηση",
        description: "Κλείσιμο κτιρίου και στεγανότητα",
        date: "2008-06-30",
        status: "completed",
        progress: 100,
        type: "construction"
    },
    {
        id: 5,
        title: "Ηλ/Μηχ Εγκαταστάσεις",
        description: "Ηλεκτρολογικές και μηχανολογικές εγκαταστάσεις",
        date: "2008-11-15",
        status: "in-progress",
        progress: 85,
        type: "systems"
    },
    {
        id: 6,
        title: "Τελικές Εργασίες",
        description: "Χρωματισμοί, δάπεδα, διακοσμητικά στοιχεία",
        date: "2009-01-30",
        status: "pending",
        progress: 45,
        type: "finishing"
    },
    {
        id: 7,
        title: "Παράδοση Έργου",
        description: "Τελικός έλεγχος και παράδοση στον πελάτη",
        date: "2009-02-28",
        status: "pending",
        progress: 0,
        type: "delivery"
    }
];

export const getStatusColor = (status: string) => {
    const colors = useSemanticColors();

    switch (status) {
        case 'completed': return `${colors.status.success.bg} ${colors.status.success.border}`;
        case 'in-progress': return `${colors.status.info.bg} ${colors.status.info.border}`;
        case 'pending': return `${colors.status.muted.bg} ${colors.status.muted.border}`;
        case 'delayed': return `${colors.status.error.bg} ${colors.status.error.border}`;
        default: return `${colors.status.muted.bg} ${colors.status.muted.border}`;
    }
};

export const getStatusText = (status: string) => {
    switch (status) {
        case 'completed': return 'Ολοκληρώθηκε';
        case 'in-progress': return 'Σε εξέλιξη';
        case 'pending': return 'Εκκρεμεί';
        case 'delayed': return 'Καθυστέρηση';
        default: return 'Άγνωστο';
    }
};

export const getTypeIcon = (type: string) => {
    switch (type) {
        case 'start': return Rocket;
        case 'construction': return NAVIGATION_ENTITIES.building.icon;
        case 'systems': return Zap;
        case 'finishing': return Palette;
        case 'delivery': return Target;
        default: return ClipboardList;
    }
};
