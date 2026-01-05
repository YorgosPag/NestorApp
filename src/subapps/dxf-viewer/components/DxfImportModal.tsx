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
import {
  UploadModalContainer,
  ModalFormSection,
  ModalField,
  ModalActions
} from './modal/ModalContainer';
import { useTypography } from '@/hooks/useTypography';
import { getModalColorScheme, getModalIconColor } from '../config/modal-colors';
import { MODAL_FLEX_PATTERNS, getIconSize } from '../config/modal-layout';
import { getSelectStyles, getEncodingOptions } from '../config/modal-select';
// 🏢 ENTERPRISE: Centralized spacing tokens
import { PANEL_LAYOUT } from '../config/panel-tokens';

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
                    <DialogTitle className={MODAL_FLEX_PATTERNS.ROW.centerWithGap}>
                        <Upload className={`${getIconSize('title')} ${getModalIconColor('upload')}`} />
                        Εισαγωγή Αρχείου DXF
                    </DialogTitle>
                </DialogHeader>

                <form id="dxf-import-form" onSubmit={handleSubmit}>
                    <ModalFormSection>
                        <ModalField
                            label="Αρχείο DXF"
                            required
                            description={!selectedFile ? "Δεν επιλέχθηκε κανένα αρχείο." : undefined}
                        >
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
                                className={getSelectStyles().trigger}
                            >
                                <Upload className={`${getIconSize('field')} ${PANEL_LAYOUT.MARGIN.RIGHT_SM} ${getModalIconColor('upload')}`} />
                                {selectedFile ? selectedFile.name : 'Επιλογή αρχείου'}
                            </Button>
                        </ModalField>

                        <ModalField
                            label="Κωδικοποίηση Χαρακτήρων"
                            description="Επιλέξτε Windows-1253 αν τα Ελληνικά δεν εμφανίζονται σωστά."
                        >
                            {/* Centralized Select Component */}
                            <Select value={encoding} onValueChange={setEncoding} disabled={isLoading}>
                                <SelectTrigger className={getSelectStyles().trigger}>
                                    <SelectValue placeholder="Επιλέξτε κωδικοποίηση" />
                                </SelectTrigger>
                                <SelectContent>
                                    {getEncodingOptions().map((option) => (
                                        <SelectItem key={option.value} value={option.value}>
                                            <span>{option.label}</span>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </ModalField>
                    </ModalFormSection>
                </form>

                <DialogFooter>
                    <ModalActions alignment="right">
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
                    </ModalActions>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default DxfImportModal;