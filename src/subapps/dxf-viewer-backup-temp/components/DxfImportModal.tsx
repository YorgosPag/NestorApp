import React, { useState } from 'react';

interface DxfImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onImport: (file: File, encoding: string) => Promise<void>;
}

const DxfImportModal: React.FC<DxfImportModalProps> = ({ isOpen, onClose, onImport }) => {
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [encoding, setEncoding] = useState('windows-1253');
    const [isLoading, setIsLoading] = useState(false);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files && event.target.files.length > 0) {
            setSelectedFile(event.target.files[0]);
        }
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
        <div 
            className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center"
            style={{ zIndex: 999999 }}
            onClick={handleClose}
        >
            <div 
                className="bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-md mx-4"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-medium text-white">Εισαγωγή Αρχείου DXF</h3>
                    <button 
                        type="button" 
                        onClick={handleClose} 
                        className="text-gray-400 hover:text-white text-2xl"
                        disabled={isLoading}
                    >
                        ×
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="dxf-file-input" className="block text-sm font-medium text-gray-300 mb-1">
                            Αρχείο DXF
                        </label>
                        <input
                            id="dxf-file-input"
                            type="file"
                            accept=".dxf"
                            onChange={handleFileChange}
                            disabled={isLoading}
                            className="w-full text-sm text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-sky-600 file:text-white hover:file:bg-sky-500 disabled:opacity-50"
                        />
                    </div>

                    <div>
                        <label htmlFor="encoding-select" className="block text-sm font-medium text-gray-300 mb-1">
                            Κωδικοποίηση Χαρακτήρων
                        </label>
                        <select
                            id="encoding-select"
                            value={encoding}
                            onChange={(e) => setEncoding(e.target.value)}
                            disabled={isLoading}
                            className="w-full bg-gray-900 border border-gray-600 rounded-md focus:ring-sky-500 focus:border-sky-500 text-white p-2 disabled:opacity-50"
                        >
                            <option value="windows-1253">Windows-1253 (Greek)</option>
                            <option value="UTF-8">UTF-8 (Προεπιλογή)</option>
                            <option value="windows-1252">Windows-1252 (Western)</option>
                            <option value="ISO-8859-7">ISO-8859-7 (Greek)</option>
                        </select>
                        <p className="text-xs text-gray-400 mt-1">
                            Επιλέξτε Windows-1253 αν τα Ελληνικά δεν εμφανίζονται σωστά.
                        </p>
                    </div>

                    <div className="flex justify-end space-x-3 pt-4">
                        <button 
                            type="button" 
                            onClick={handleClose}
                            disabled={isLoading}
                            className="px-4 py-2 text-sm font-medium rounded-md bg-gray-600 hover:bg-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-gray-500 text-white disabled:opacity-50"
                        >
                            Ακύρωση
                        </button>
                        <button 
                            type="submit" 
                            disabled={!selectedFile || isLoading}
                            className="px-4 py-2 text-sm font-medium rounded-md bg-sky-600 hover:bg-sky-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-sky-500 disabled:bg-gray-500 disabled:cursor-not-allowed text-white"
                        >
                            {isLoading ? 'Εισαγωγή...' : 'Εισαγωγή'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default DxfImportModal;