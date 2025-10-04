'use client';

import React from 'react';
import { createPortal } from 'react-dom';
import { SIMPLE_COLORS } from '../../../../config/color-config';

interface ColorPickerModalProps {
  title: string;
  onColorSelect: (color: string) => void;
  onClose: () => void;
}

export const ColorPickerModal = ({ 
  title, 
  onColorSelect, 
  onClose 
}: ColorPickerModalProps) => {
  if (typeof window === 'undefined') return null;
  
  return createPortal(
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-[9998]"
        onClick={onClose}
      />
      {/* Color Picker Modal */}
      <div 
        className="fixed bg-gray-900 border-2 border-gray-400 rounded-lg p-4 shadow-2xl z-[9999]"
        style={{ 
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.9), 0 12px 24px -8px rgba(0, 0, 0, 0.6)',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          minWidth: '320px',
          maxWidth: '400px'
        }}>
        <div className="text-lg text-gray-300 mb-4 font-medium text-center">{title}</div>
        <div className="grid grid-cols-5 gap-2">
          {SIMPLE_COLORS.map((color) => (
            <button
              key={color}
              onClick={(e) => {
                e.stopPropagation();
                onColorSelect(color);
                onClose();
              }}
              className="w-12 h-12 rounded-lg border-2 border-gray-600 hover:scale-110 transition-all hover:ring-3 hover:ring-blue-400 hover:border-blue-300"
              style={{ backgroundColor: color }}
              title={color}
            />
          ))}
        </div>
        <div className="mt-4 text-sm text-gray-400 text-center">Κλικ έξω για κλείσιμο</div>
      </div>
    </>,
    document.body
  );
};