import { PDFDocument } from 'pdf-lib';

export class PdfStamperService {
  /**
   * Menggabungkan beberapa buffer PDF menjadi 1 berkas PDF multi-halaman
   */
  static async mergePdfs(pdfBuffers: Buffer[]): Promise<Buffer> {
    if (!pdfBuffers || pdfBuffers.length === 0) {
      throw new Error('Daftar PDF buffer kosong');
    }
    if (pdfBuffers.length === 1) {
      return pdfBuffers[0];
    }

    const mergedDoc = await PDFDocument.create();

    for (const buf of pdfBuffers) {
      if (!buf || buf.length === 0) continue;
      try {
        const doc = await PDFDocument.load(buf, { ignoreEncryption: true });
        const copiedPages = await mergedDoc.copyPages(doc, doc.getPageIndices());
        copiedPages.forEach((page) => mergedDoc.addPage(page));
      } catch (err: any) {
        console.warn('[PdfStamperService] Gagal memuat salah satu PDF untuk merge:', err.message || err);
      }
    }

    const mergedBytes = await mergedDoc.save();
    return Buffer.from(mergedBytes);
  }
}
