import React, { useState, useRef } from 'react';
import { Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { INTERACTIVE_PATTERNS, HOVER_BACKGROUND_EFFECTS } from '@/components/ui/effects';
import { dxfComponentStyles, dxfAccessibility } from '../styles/DxfZIndexSystem.styles';

interface DxfImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onImport: (file: File, encoding: string) => Promise<void>;
}

const DxfImportModal: React.FC<DxfImportModalProps> = ({ isOpen, onClose, onImport }) => {
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [encoding, setEncoding] = useState('windows-1253');
    const [isLoading, setIsLoading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files && event.target.files.length > 0) {
            setSelectedFile(event.target.files[0]);
        }
    };

    const handleFileButtonClick = () => {
        fileInputRef.current?.click();
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedFile) return;

        setIsLoading(true);
        try {
            await onImport(selectedFile, encoding);
            onClose();
            setSelectedFile(null);
        } catch (error) {
            console.error('Σφάλμα κατά την εισαγωγή DXF:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleClose = () => {
        setSelectedFile(null);
        setEncoding('windows-1253');
        setIsLoading(false);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <section
            className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[60]"
            style={dxfComponentStyles.importModal}
            {...dxfAccessibility.getModalProps('DXF Import')}
            onClick={handleClose}
        >
            <article
                className="bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-md mx-4"
                onClick={(e) => e.stopPropagation()}
                role="document"
                aria-labelledby="dxf-import-title"
            >
                <div className="flex justify-between items-center mb-4">
                    <h3 id="dxf-import-title" className="text-lg font-medium text-white">Εισαγωγή Αρχείου DXF</h3>
                    <button 
                        type="button" 
                        onClick={handleClose} 
                        className={`text-gray-400 ${INTERACTIVE_PATTERNS.TEXT_HIGHLIGHT} text-2xl`}
                        disabled={isLoading}
                    >
                        ×
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-3">
                            Αρχείο DXF
                        </label>

                        {/* Hidden file input */}
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".dxf"
                            onChange={handleFileChange}
                            disabled={isLoading}
                            className="hidden"
                        />

                        {/* Centralized Button for file selection */}
                        <Button
                            type="button"
                            onClick={handleFileButtonClick}
                            disabled={isLoading}
                            variant="outline"
                            className="w-full bg-gray-700 border-gray-600 text-white hover:bg-gray-600"
                        >
                            <Upload className="h-4 w-4 mr-2" />
                            {selectedFile ? selectedFile.name : 'Επιλογή αρχείου'}
                        </Button>

                        {!selectedFile && (
                            <p className="text-xs text-gray-400 mt-1">
                                Δεν επιλέχθηκε κανένα αρχείο.
                            </p>
                        )}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-3">
                            Κωδικοποίηση Χαρακτήρων
                        </label>

                        {/* Centralized Select Component */}
                        <Select value={encoding} onValueChange={setEncoding} disabled={isLoading}>
                            <SelectTrigger className="w-full bg-gray-700 border-gray-600 text-white">
                                <SelectValue placeholder="Επιλέξτε κωδικοποίηση" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="windows-1253">
                                    <span>Windows-1253 (Greek)</span>
                                </SelectItem>
                                <SelectItem value="UTF-8">
                                    <span>UTF-8 (Προεπιλογή)</span>
                                </SelectItem>
                                <SelectItem value="windows-1252">
                                    <span>Windows-1252 (Western)</span>
                                </SelectItem>
                                <SelectItem value="ISO-8859-7">
                                    <span>ISO-8859-7 (Greek)</span>
                                </SelectItem>
                            </SelectContent>
                        </Select>

                        <p className="text-xs text-gray-400 mt-1">
                            Επιλέξτε Windows-1253 αν τα Ελληνικά δεν εμφανίζονται σωστά.
                        </p>
                    </div>

                    <div className="flex justify-end space-x-3 pt-4">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={handleClose}
                            disabled={isLoading}
                        >
                            Ακύρωση
                        </Button>
                        <Button
                            type="submit"
                            disabled={!selectedFile || isLoading}
                        >
                            {isLoading ? 'Εισαγωγή...' : 'Εισαγωγή'}
                        </Button>
                    </div>
                </form>
            </article>
        </section>
    );
};

export default DxfImportModal;