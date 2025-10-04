import type { IPDFDoc } from '../contracts';

export class JSPDFAdapter implements IPDFDoc {
  constructor(private doc: any) {}

  get pageSize() {
    return this.doc.internal.pageSize;
  }

  getNumberOfPages(): number {
    return this.doc.internal.pages.length - 1;
  }
  
  setPage(n: number): void {
    this.doc.setPage(n);
  }

  addPage(): void {
    this.doc.addPage();
  }

  setFillColor(r: number, g: number, b: number): void {
    this.doc.setFillColor(r, g, b);
  }

  setDrawColor(r: number, g: number, b: number): void {
    this.doc.setDrawColor(r, g, b);
  }

  setLineWidth(w: number): void {
    this.doc.setLineWidth(w);
  }

  rect(x: number, y: number, w: number, h: number, style?: 'F' | 'S' | 'DF'): void {
    this.doc.rect(x, y, w, h, style);
  }
  
  line(x1: number, y1: number, x2: number, y2: number): void {
    this.doc.line(x1, y1, x2, y2);
  }

  setTextColor(r: number, g: number, b: number): void {
    this.doc.setTextColor(r, g, b);
  }
  
  setFont(font: string, style: 'normal' | 'bold'): void {
    this.doc.setFont(font, style);
  }
  
  setFontSize(size: number): void {
    this.doc.setFontSize(size);
  }

  text(text: string, x: number, y: number, opts?: { align?: 'left'|'center'|'right' }): void {
    this.doc.text(text, x, y, opts);
  }

  splitTextToSize(text: string, width: number): string[] {
    return this.doc.splitTextToSize(text, width);
  }

  getTextWidth(text: string): number {
    return this.doc.getTextWidth(text);
  }

  output(type: 'arraybuffer'): ArrayBuffer {
    return this.doc.output(type);
  }
}
