"use client";

/**
 * Triggers a browser download for the given PDF data.
 * @param pdfData The PDF content as a Uint8Array.
 * @param filename The desired filename for the downloaded file.
 */
export const downloadPDF = (pdfData: Uint8Array, filename: string) => {
  if (typeof window === 'undefined') {
    console.error("Download function called on the server.");
    return;
  }

  const blob = new Blob([pdfData], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  
  // Append to body, click, and remove for cross-browser compatibility
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  // Clean up the object URL
  URL.revokeObjectURL(url);
};
