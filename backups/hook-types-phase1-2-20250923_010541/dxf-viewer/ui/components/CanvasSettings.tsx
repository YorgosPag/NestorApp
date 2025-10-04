'use client';

import React from 'react';

interface CanvasSettingsProps {
  className?: string;
}

export const CanvasSettings: React.FC<CanvasSettingsProps> = ({ className }) => {
  return (
    <div className={`bg-gray-800 text-white ${className}`}>
      <div className="p-4">
        {/* Header */}
        <div className="border-b border-gray-600 pb-3 mb-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            🖼️ Ρυθμίσεις Καμβά
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            Ρυθμίσεις εμφάνισης και συμπεριφοράς καμβά
          </p>
        </div>

        {/* Coming Soon Placeholder */}
        <div className="text-center py-8 text-gray-500">
          <div className="text-4xl mb-4">🎨</div>
          <h3 className="text-lg font-medium mb-2">Σύντομα Διαθέσιμο</h3>
          <p className="text-sm text-gray-400">
            Οι ρυθμίσεις καμβά θα περιλαμβάνουν:
          </p>
          <ul className="text-xs text-gray-400 mt-3 space-y-1">
            <li>• Χρώμα φόντου καμβά</li>
            <li>• Ρυθμίσεις zoom και pan</li>
            <li>• Εμφάνιση πλέγματος αναφοράς</li>
            <li>• Ρυθμίσεις rendering</li>
            <li>• Προσαρμογές performance</li>
          </ul>
        </div>
      </div>
    </div>
  );
};