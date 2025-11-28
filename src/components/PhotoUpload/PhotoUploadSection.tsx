'use client';

interface PhotoUploadSectionProps {
  photoFile: File | null;
  photoPreview: string;
  onFileChange: (file: File | null) => void;
  onDrop: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  disabled?: boolean;
}

export function PhotoUploadSection({
  photoFile,
  photoPreview,
  onFileChange,
  onDrop,
  onDragOver,
  disabled = false
}: PhotoUploadSectionProps) {
  return (
    <>
      {/* Φωτογραφία Header */}
      <div className="col-span-2 border-t pt-4 mt-4">
        <h4 className="font-semibold mb-3 text-sm">📷 Φωτογραφία</h4>
      </div>

      <div className="col-span-2">
        <div
          className={`relative border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors min-h-[120px] flex flex-col items-center justify-center ${
            photoPreview
              ? 'border-green-300 bg-green-50'
              : 'border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          onDrop={disabled ? undefined : onDrop}
          onDragOver={disabled ? undefined : onDragOver}
          onClick={disabled ? undefined : () => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.onchange = (e) => {
              const file = (e.target as HTMLInputElement).files?.[0];
              onFileChange(file || null);
            };
            input.click();
          }}
        >
          {photoPreview ? (
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-lg overflow-hidden bg-white shadow-sm">
                <img
                  src={photoPreview}
                  alt="Προεπισκόπηση φωτογραφίας"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="text-left">
                <p className="text-sm font-medium text-green-700">✅ Φωτογραφία φορτώθηκε</p>
                <p className="text-xs text-green-600">{photoFile?.name}</p>
                <p className="text-xs text-gray-500 mt-1">Κάντε κλικ για αλλαγή</p>
              </div>
            </div>
          ) : (
            <div>
              <div className="text-4xl mb-2">📷</div>
              <p className="text-sm font-medium text-gray-700 mb-1">
                Κάντε κλικ ή σύρετε φωτογραφία εδώ
              </p>
              <p className="text-xs text-gray-500">
                Υποστηρίζονται JPG, PNG (μέγιστο 5MB)
              </p>
            </div>
          )}

          {photoPreview && !disabled && (
            <button
              type="button"
              className="absolute top-2 right-2 bg-red-100 text-red-600 rounded-full p-1 hover:bg-red-200 transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                onFileChange(null);
              }}
              title="Αφαίρεση φωτογραφίας"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </>
  );
}