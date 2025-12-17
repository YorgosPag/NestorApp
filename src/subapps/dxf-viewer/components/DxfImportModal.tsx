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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { INTERACTIVE_PATTERNS, HOVER_BACKGROUND_EFFECTS } from '@/components/ui/effects';
import { getModalConfig } from '../config/modal-config';

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

    // Get enterprise modal configuration for nested modals
    const modalConfig = getModalConfig('DXF_IMPORT');

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
            <DialogContent
                className={modalConfig.className}
                style={{ zIndex: modalConfig.zIndex }}
            >
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Upload className="h-5 w-5 text-orange-500" />
                        Εισαγωγή Αρχείου DXF
                    </DialogTitle>
                </DialogHeader>

                <form id="dxf-import-form" onSubmit={handleSubmit} className="space-y-6">
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

                </form>

                <DialogFooter>
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
                        form="dxf-import-form"
                        disabled={!selectedFile || isLoading}
                    >
                        {isLoading ? 'Εισαγωγή...' : 'Εισαγωγή'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default DxfImportModal;