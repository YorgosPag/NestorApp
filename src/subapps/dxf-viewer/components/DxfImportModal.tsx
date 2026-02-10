import React, { useState, useRef } from 'react';
import { Upload, FileText } from 'lucide-react';
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
import { getModalConfig } from '../config/modal-config';
import {
  ModalFormSection,
  ModalField,
  ModalActions
} from './modal/ModalContainer';
import { getModalIconColor } from '../config/modal-colors';
import { MODAL_FLEX_PATTERNS, getIconSize } from '../config/modal-layout';
import { getSelectStyles, getEncodingOptions } from '../config/modal-select';
// 🏢 ENTERPRISE: Centralized spacing tokens
import { PANEL_LAYOUT } from '../config/panel-tokens';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';

// 🏢 ENTERPRISE: File type detection
type ImportFileType = 'dxf' | 'pdf' | null;

interface DxfImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    /** Handler for DXF file import */
    onImport: (file: File, encoding: string) => Promise<void>;
    /** Handler for PDF file import (optional - if not provided, PDF option is hidden) */
    onPdfImport?: (file: File) => Promise<void>;
    /** Whether to show PDF option (default: true if onPdfImport is provided) */
    allowPdf?: boolean;
}

const DxfImportModal: React.FC<DxfImportModalProps> = ({
    isOpen,
    onClose,
    onImport,
    onPdfImport,
    allowPdf = true
}) => {
    // 🏢 ENTERPRISE: i18n hook
    const { t } = useTranslation('dxf-viewer');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [fileType, setFileType] = useState<ImportFileType>(null);
    const [encoding, setEncoding] = useState('windows-1253');
    const [isLoading, setIsLoading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // 🏢 ENTERPRISE: Detect file type from extension
    const detectFileType = (file: File): ImportFileType => {
        const extension = file.name.toLowerCase().split('.').pop();
        if (extension === 'dxf') return 'dxf';
        if (extension === 'pdf') return 'pdf';
        return null;
    };

    // 🏢 ENTERPRISE: Check if PDF is supported
    const isPdfSupported = allowPdf && !!onPdfImport;

    // 🏢 ENTERPRISE: Get accepted file types
    const getAcceptedTypes = (): string => {
        if (isPdfSupported) {
            return '.dxf,.pdf';
        }
        return '.dxf';
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files && event.target.files.length > 0) {
            const file = event.target.files[0];
            const type = detectFileType(file);
            setSelectedFile(file);
            setFileType(type);
            console.log('📁 [DxfImportModal] File selected:', { name: file.name, type });
        }
    };

    const handleFileButtonClick = () => {
        fileInputRef.current?.click();
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedFile || !fileType) return;

        setIsLoading(true);
        try {
            if (fileType === 'pdf' && onPdfImport) {
                // 🏢 ENTERPRISE: Handle PDF import
                console.log('📄 [DxfImportModal] Importing PDF:', selectedFile.name);
                await onPdfImport(selectedFile);
            } else if (fileType === 'dxf') {
                // 🏢 ENTERPRISE: Handle DXF import (existing logic)
                console.log('📐 [DxfImportModal] Importing DXF:', selectedFile.name, encoding);
                await onImport(selectedFile, encoding);
            }
            onClose();
            setSelectedFile(null);
            setFileType(null);
        } catch (error) {
            console.error(`❌ ${t('importModal.errors.importFailed')}`, error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleClose = () => {
        setSelectedFile(null);
        setFileType(null);
        setEncoding('windows-1253');
        setIsLoading(false);
        onClose();
    };

    // Get enterprise modal configuration for nested modals
    const modalConfig = getModalConfig('DXF_IMPORT');

    // 🏢 ENTERPRISE: Get title based on supported file types
    const getModalTitle = (): string => {
        if (isPdfSupported) {
            return t('importModal.titleDxfPdf');
        }
        return t('importModal.titleDxf');
    };

    // 🏢 ENTERPRISE: Get file label based on supported types
    const getFileLabel = (): string => {
        if (isPdfSupported) {
            return t('importModal.fileLabelDxfPdf');
        }
        return t('importModal.fileLabelDxf');
    };

    // 🏢 ENTERPRISE: Get icon based on file type
    const getFileIcon = () => {
        if (fileType === 'pdf') {
            return <FileText className={`${getIconSize('field')} ${PANEL_LAYOUT.MARGIN.RIGHT_SM} text-red-500`} />;
        }
        return <Upload className={`${getIconSize('field')} ${PANEL_LAYOUT.MARGIN.RIGHT_SM} ${getModalIconColor('upload')}`} />;
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
            <DialogContent
                className={modalConfig.className}
                style={{ zIndex: modalConfig.zIndex }}
            >
                <DialogHeader>
                    <DialogTitle className={MODAL_FLEX_PATTERNS.ROW.centerWithGap}>
                        <Upload className={`${getIconSize('title')} ${getModalIconColor('upload')}`} />
                        {getModalTitle()}
                    </DialogTitle>
                </DialogHeader>

                <form id="dxf-import-form" onSubmit={handleSubmit}>
                    <ModalFormSection>
                        <ModalField
                            label={getFileLabel()}
                            required
                            description={!selectedFile
                                ? (isPdfSupported
                                    ? t('importModal.selectDxfOrPdf')
                                    : t('importModal.noFileSelected'))
                                : undefined}
                        >
                            {/* Hidden file input */}
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept={getAcceptedTypes()}
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
                                {getFileIcon()}
                                {selectedFile ? selectedFile.name : t('importModal.selectFile')}
                            </Button>

                            {/* 🏢 ENTERPRISE: Show file type indicator */}
                            {selectedFile && fileType && (
                                <p className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${PANEL_LAYOUT.MARGIN.TOP_SM} ${fileType === 'pdf' ? 'text-red-400' : 'text-blue-400'}`}>
                                    {fileType === 'pdf'
                                        ? t('importModal.fileTypePdf')
                                        : t('importModal.fileTypeDxf')}
                                </p>
                            )}
                        </ModalField>

                        {/* 🏢 ENTERPRISE: Show encoding only for DXF files */}
                        {(fileType === 'dxf' || !selectedFile) && (
                            <ModalField
                                label={t('importModal.encoding.label')}
                                description={t('importModal.encoding.hint')}
                            >
                                {/* Centralized Select Component */}
                                <Select value={encoding} onValueChange={setEncoding} disabled={isLoading || fileType === 'pdf'}>
                                    <SelectTrigger className={getSelectStyles().trigger}>
                                        <SelectValue placeholder={t('importModal.encoding.placeholder')} />
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
                        )}
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
                            {t('importModal.buttons.cancel')}
                        </Button>
                        <Button
                            type="submit"
                            form="dxf-import-form"
                            disabled={!selectedFile || !fileType || isLoading}
                        >
                            {isLoading ? t('importModal.buttons.importing') : t('importModal.buttons.import')}
                        </Button>
                    </ModalActions>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default DxfImportModal;