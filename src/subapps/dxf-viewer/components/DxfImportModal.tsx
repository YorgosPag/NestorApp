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
// ADR-716 Φ5 — Ο ίδιος επιλογέας μονάδων με το wizard — ΈΝΑ component, ΈΝΑ σύνολο κλειδιών
// (`floorplanImport.drawingUnits.*` στο namespace `files-media`), ΈΝΑ μονοπάτι απόφασης.
// Η μονάδα είναι απόφαση με απόδειξη («587 m × 488 m») και ΕΔΩ, όχι μόνο στο wizard.
import { DxfUnitsSelector } from '@/features/floorplan-import/components/DxfUnitsSelector';
import { useDxfUnitSuggestion } from '../hooks/common/useDxfUnitSuggestion';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import type { SceneUnits } from '../utils/scene-units';
// ADR-736 Φ3ε — τα συνοδευτικά υπόβαθρα. Ό,τι δώσει ο χρήστης εδώ (αρχεία / φάκελος / .zip)
// περιμένει στον κατάλογο υποψηφίων και επιλύεται ΜΟΝΟ ΤΟΥ μόλις γεννηθεί η σκηνή.
import { collectExternalReferenceCandidates } from '../io/dxf-external-reference-intake';
import { offerExternalReferenceCandidates } from '../stores/ExternalReferenceCandidatesStore';

// 🏢 ENTERPRISE: File type detection
type ImportFileType = 'dxf' | 'pdf' | null;

interface DxfImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    /**
     * Handler for DXF file import.
     * @param userDrawingUnits ADR-716 Φ5 — ρητή επιλογή μονάδων (απόν όταν «Αυτόματα»).
     */
    onImport: (file: File, encoding: string, userDrawingUnits?: SceneUnits) => Promise<void>;
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
    // `files-media` προστέθηκε για τα ήδη υπάρχοντα κλειδιά `floorplanImport.drawingUnits.*`
    // (el + en) — κανένα νέο κλειδί, καμία αντιγραφή κειμένου (N.11).
    const { t } = useTranslation(['dxf-viewer', 'dxf-viewer-settings', 'dxf-viewer-wizard', 'dxf-viewer-guides', 'dxf-viewer-panels', 'dxf-viewer-shell', 'files-media']);
    const colors = useSemanticColors();
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [fileType, setFileType] = useState<ImportFileType>(null);
    const [encoding, setEncoding] = useState('windows-1253');
    // ADR-368/716 — οι μονάδες του σχεδίου: 'auto' = αποφασίζει η σκάλα τεκμηρίων.
    const [selectedUnits, setSelectedUnits] = useState<SceneUnits | 'auto'>('auto');
    const [isLoading, setIsLoading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    // ADR-736 Φ3ε — τα συνοδευτικά υπόβαθρα (προαιρετικά, ΠΟΤΕ δεν μπλοκάρουν την εισαγωγή).
    const [companionFiles, setCompanionFiles] = useState<File[]>([]);
    const companionInputRef = useRef<HTMLInputElement>(null);
    const companionFolderInputRef = useRef<HTMLInputElement>(null);

    const explicitUnits = selectedUnits !== 'auto' ? selectedUnits : undefined;
    // Διαβάζει ΜΟΝΟ την κεφαλίδα του DXF και καθρεφτίζει την ΙΔΙΑ απόφαση που θα
    // εκτελέσει ο importer — όχι δεύτερη, παράλληλη ευρετική.
    const unitDecision = useDxfUnitSuggestion(fileType === 'dxf' ? selectedFile : null, explicitUnits);

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

    /**
     * ADR-736 Φ3ε — τα συνοδευτικά. Τα `.zip` ανοίγουν εδώ (`collect…`), ώστε ο χρήστης να
     * μπορεί να ρίξει το πακέτο *eTransmit* του τοπογράφου αυτούσιο. Ο επιλογέας μηδενίζεται
     * πάντα, αλλιώς η δεύτερη επιλογή του ΙΔΙΟΥ αρχείου δεν εκπέμπει `change`.
     */
    const handleCompanionChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const picked = Array.from(event.target.files ?? []);
        event.target.value = '';
        if (picked.length === 0) return;
        setCompanionFiles(await collectExternalReferenceCandidates(picked));
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
                console.log('📐 [DxfImportModal] Importing DXF:', selectedFile.name, encoding, selectedUnits);
                // ADR-736 Φ3ε — ΠΡΙΝ την εισαγωγή: η σκηνή γεννιέται ασύγχρονα και η αυτόματη
                // επίλυση τρέχει μόλις εμφανιστεί. Καταχώρηση μετά το `onImport` θα έχανε την
                // κούρσα σε γρήγορο parse — τα αρχεία θα έφταναν αφού είχε ήδη κοιτάξει κανείς.
                offerExternalReferenceCandidates(companionFiles);
                await onImport(selectedFile, encoding, explicitUnits);
            }
            onClose();
            setSelectedFile(null);
            setFileType(null);
            setCompanionFiles([]);
        } catch (error) {
            console.error(`❌ ${t('importModal.errors.importFailed')}`, error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleClose = () => {
        setSelectedFile(null);
        setFileType(null);
        setCompanionFiles([]);
        setEncoding('windows-1253');
        setSelectedUnits('auto');
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
            return <FileText className={`${getIconSize('field')} ${PANEL_LAYOUT.MARGIN.RIGHT_SM} text-destructive`} />;
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

                {/* 🔴 `min-w-0`: το `DialogContent` είναι **grid**, άρα το `<form>` είναι grid item με
                    `min-width: auto` — η στήλη πλαταίνει όσο το min-content του **φαρδύτερου**
                    παιδιού και ΟΛΑ τα αδέρφια (header, τίτλος) τεντώνονται μαζί της. Χωρίς αυτό,
                    το `truncate` στο όνομα αρχείου είναι **ανενεργό**: το `white-space: nowrap`
                    κρατά το min-content στο πλήρες πλάτος του κειμένου και το `overflow:hidden`
                    δεν το μειώνει. Εδώ κόβεται η αλυσίδα — μετρημένο 2026-07-31: 539px → 500px. */}
                <form id="dxf-import-form" onSubmit={handleSubmit} className="min-w-0">
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

                            {/* Centralized Button for file selection.
                                🔴 Το ΟΝΟΜΑ ΑΡΧΕΙΟΥ ΔΕΝ ΕΠΙΤΡΕΠΕΤΑΙ ΝΑ ΟΡΙΖΕΙ ΤΟ ΠΛΑΤΟΣ ΤΟΥ DIALOG.
                                Το `Button` φέρει `whitespace-nowrap` (shadcn base): το min-content του
                                κειμένου νικά το `w-full`, οπότε ένα μακρύ όνομα φούσκωνε το κουμπί και
                                **παρέσυρε ΟΛΟ το δέντρο** — header, τίτλο, form, labels. Μετρημένο
                                2026-07-31 με `2026-07-22 - Τοπογραφικό διάγραμμα - Ο.Τ. 47 (…).dxf`:
                                dialog 500px, περιεχόμενο **539px** ⇒ 64px έξω από το παράθυρο.
                                `min-w-0` (αναιρεί το `min-width:auto` του flex item) + `truncate`
                                στο κείμενο ⇒ το κουμπί δεν ζητά ΠΟΤΕ πάνω από το διαθέσιμο πλάτος.
                                Ο τύπος αρχείου δεν χάνεται με το κόψιμο: τον λέει η γραμμή από κάτω. */}
                            <Button
                                type="button"
                                onClick={handleFileButtonClick}
                                disabled={isLoading}
                                variant="outline"
                                className={`${getSelectStyles().trigger} min-w-0`}
                            >
                                {getFileIcon()}
                                <span className="min-w-0 truncate">
                                    {selectedFile ? selectedFile.name : t('importModal.selectFile')}
                                </span>
                            </Button>

                            {/* 🏢 ENTERPRISE: Show file type indicator.
                                🔴 ΟΧΙ `text-primary`: το `--primary` είναι χρώμα **γεμίσματος** (φόντο
                                κουμπιού), όχι χρώμα κειμένου — πάνω στο σκούρο φόντο του modal έβγαινε
                                σκούρο μπλε σε σκούρο μπλε και το «DXF αρχείο — θα φορτωθεί ως κάτοψη»
                                ήταν πρακτικά αόρατο (αναφορά Giorgio 2026-07-31). Το `--text-success`
                                είναι το **theme-aware SSoT** του ADR-365: green-700 στο φωτεινό,
                                αυτόματα green-400 στο σκοτεινό — αναγνώσιμο και στα δύο θέματα.
                                ⚠️ Το `colors.text.info` έχει ΤΟ ΙΔΙΟ ελάττωμα — σταθερή σκούρα μπλε
                                απόχρωση, δεν αντιστρέφεται στο σκοτεινό θέμα.
                                (Η ωμή utility δεν γράφεται εδώ ούτε ως παράδειγμα: CHECK 3.7 και 3.26
                                σαρώνουν κείμενο, όχι AST — δεν αφαιρούν σχόλια, οπότε την έβλεπαν ως
                                πραγματική χρήση και μπλόκαραν το commit.) */}
                            {selectedFile && fileType && (
                                <p className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${PANEL_LAYOUT.MARGIN.TOP_SM} ${fileType === 'pdf' ? 'text-destructive' : colors.text.success}`}>
                                    {fileType === 'pdf'
                                        ? t('importModal.fileTypePdf')
                                        : t('importModal.fileTypeDxf')}
                                </p>
                            )}
                        </ModalField>

                        {/* ADR-736 Φ3ε — Συνοδευτικά υπόβαθρα. ΠΡΟΑΙΡΕΤΙΚΑ και μη δεσμευτικά:
                            το DXF κρατά διαδρομές, όχι bytes, οπότε ένα σχέδιο με 10 ανεπίλυτους
                            συνδέσμους είναι απολύτως υγιές. Δίνοντάς τα εδώ, ο resolver τα
                            ταυτίζει (όνομα → διαστάσεις σε pixels) ΧΩΡΙΣ καμία άλλη ενέργεια·
                            ό,τι μείνει διορθώνεται αργότερα από την παλέτα «Εξωτερικές Αναφορές». */}
                        {(fileType === 'dxf' || !selectedFile) && (
                            <ModalField
                                label={t('importModal.externalReferences.label')}
                                description={t('importModal.externalReferences.hint')}
                            >
                                <input
                                    ref={companionInputRef}
                                    type="file"
                                    multiple
                                    accept=".png,.jpg,.jpeg,.webp,.zip"
                                    onChange={(e) => void handleCompanionChange(e)}
                                    disabled={isLoading}
                                    className="hidden"
                                />
                                <input
                                    ref={companionFolderInputRef}
                                    type="file"
                                    multiple
                                    /* @ts-expect-error — μη τυποποιημένο, αλλά υλοποιημένο σε όλους τους σύγχρονους browsers. */
                                    webkitdirectory=""
                                    onChange={(e) => void handleCompanionChange(e)}
                                    disabled={isLoading}
                                    className="hidden"
                                />
                                <div className={MODAL_FLEX_PATTERNS.ROW.centerWithGap}>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        disabled={isLoading}
                                        onClick={() => companionInputRef.current?.click()}
                                    >
                                        {t('importModal.externalReferences.selectFiles')}
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        disabled={isLoading}
                                        onClick={() => companionFolderInputRef.current?.click()}
                                    >
                                        {t('importModal.externalReferences.selectFolder')}
                                    </Button>
                                </div>
                                {companionFiles.length > 0 && (
                                    <p className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${PANEL_LAYOUT.MARGIN.TOP_SM} text-primary`}>
                                        {t('importModal.externalReferences.selected', { count: companionFiles.length })}
                                    </p>
                                )}
                            </ModalField>
                        )}

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
                                                <span>{t(option.label)}</span>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </ModalField>
                        )}

                        {/* ADR-716 Φ5 — Μονάδες σχεδίου: η επιλογή φτάνει στο parse (κλιμακώνει
                            τη γεωμετρία) και γράφεται στο FileRecord (επιβιώνει σε κάθε re-parse). */}
                        {(fileType === 'dxf' || !selectedFile) && (
                            <DxfUnitsSelector
                                value={selectedUnits}
                                onChange={setSelectedUnits}
                                colors={colors}
                                t={t}
                                decision={unitDecision}
                            />
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