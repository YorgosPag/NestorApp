'use client';

/**
 * 🔴 ADR-828 Φ4β — **Η ΚΑΡΤΕΛΑ** των προσαρμοσμένων λιστών μέσα στο πάνελ ρυθμίσεων.
 *
 * Parity με το *File → Options → Advanced → Edit Custom Lists* του Excel και το
 * *Tools → Options → Calc → Sort Lists* του LibreOffice: οι λίστες είναι ρύθμιση **του
 * ανθρώπου**, όχι του σχεδίου, οπότε ζουν εκεί που ζουν οι ρυθμίσεις του.
 *
 * ⚠️ **Κέλυφος, όχι δεύτερη υλοποίηση**: όλο το περιεχόμενο είναι ο
 * {@link AutoFillListsManager}, ο ίδιος που αποδίδει και ο διάλογος του «Σειρά…». Δες την
 * κεφαλίδα εκείνου για το γιατί μία υλοποίηση με δύο πόρτες.
 *
 * @module subapps/dxf-viewer/ui/components/dxf-settings/categories/AutoFillListsCategory
 */

import React from 'react';
import { AutoFillListsManager } from '../../auto-fill-lists/AutoFillListsManager';

export interface AutoFillListsCategoryProps {
  className?: string;
}

export const AutoFillListsCategory: React.FC<AutoFillListsCategoryProps> = ({
  className = '',
}) => <AutoFillListsManager className={className} />;

export default AutoFillListsCategory;
