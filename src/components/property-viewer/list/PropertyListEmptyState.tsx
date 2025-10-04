"use client";

import { Home } from "lucide-react";

export function PropertyListEmptyState() {
    return (
        <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4">
            <Home className="h-8 w-8 mb-2" />
            <p className="text-sm">Δεν βρέθηκαν ακίνητα</p>
            <p className="text-xs">Δοκιμάστε να αλλάξετε τα φίλτρα</p>
        </div>
    );
}
