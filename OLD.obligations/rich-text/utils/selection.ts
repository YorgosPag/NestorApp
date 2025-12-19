"use client";

export function getSelection(textarea: HTMLTextAreaElement) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const selectedText = textarea.value.substring(start, end);
  return { start, end, selectedText };
}

export function setSelection(
  textarea: HTMLTextAreaElement,
  start: number,
  end: number
) {
  textarea.setSelectionRange(start, end);
}

export function restoreCaret(
  textarea: HTMLTextAreaElement,
  position: number
) {
  // Use setTimeout to ensure the DOM has updated before setting the selection
  setTimeout(() => {
    textarea.focus();
    setSelection(textarea, position, position);
  }, 0);
}
