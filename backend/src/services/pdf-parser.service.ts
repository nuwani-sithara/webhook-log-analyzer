import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

export class PdfParserService {
  /**
   * Parses an uploaded PDF page-by-page to keep memory usage low.
   * Runs the onPageParsed callback for each page.
   * Returns the total page count.
   */
  static async parsePdfPageByPage(
    pdfBuffer: Buffer,
    onPageParsed: (pageNumber: number, text: string) => void
  ): Promise<number> {
    // Node.js doesn't have a window object, so we use Uint8Array representation
    const uint8Array = new Uint8Array(pdfBuffer);
    
    const loadingTask = pdfjsLib.getDocument({
      data: uint8Array,
      useSystemFonts: true,
      disableFontFace: true,
      verbosity: 0 // Suppress warnings
    });

    const pdfDoc = await loadingTask.promise;
    const numPages = pdfDoc.numPages;

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await pdfDoc.getPage(pageNum);
      const textContent = await page.getTextContent();
      
      let lastY: number | null = null;
      let text = '';
      
      for (const item of textContent.items as any[]) {
        // Construct line by line based on coordinate positions
        if (lastY === item.transform[5] || lastY === null) {
          text += item.str;
        } else {
          text += '\n' + item.str;
        }
        lastY = item.transform[5];
      }
      
      onPageParsed(pageNum, text);
      
      // Release page resources to prevent memory leaks
      page.cleanup();
    }

    // Release document resources and destroy the loading task to terminate the worker
    await pdfDoc.cleanup();
    await loadingTask.destroy();
    return numPages;
  }
}
