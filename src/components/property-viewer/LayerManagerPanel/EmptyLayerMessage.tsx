'use client';

import { Home } from "lucide-react";

interface EmptyLayerMessageProps {
  searchQuery: string;
}

export function EmptyLayerMessage({ searchQuery }: EmptyLayerMessageProps) {
  return (
    <div className="text-center py-8 text-muted-foreground">
      <Home className="h-8 w-8 mx-auto mb-2" />
      <p className="text-sm">Δεν βρέθηκαν layers</p>
      {searchQuery ? (
        <p className="text-xs mt-1 italic">
          Δεν βρέθηκαν αποτελέσματα για "{searchQuery}"
        </p>
      ) : (
        <p className="text-xs">Δοκιμάστε να αλλάξετε τα φίλτρα</p>
      )}
    </div>
  );
}
