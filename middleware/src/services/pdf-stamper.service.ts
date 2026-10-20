import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { ShippingOrderItemParam } from './shipping.service.js';

export class PdfStamperService {
  /**
   * Memotong teks agar tidak melebihi panjang maksimum
   */
  private static sanitizeText(str: string | undefined, maxLen = 42): string {
    if (!str) return '-';
    const clean = String(str).replace(/[\r\n\t]+/g, ' ').trim();
    if (clean.length <= maxLen) return clean;
    return clean.slice(0, maxLen - 3) + '...';
  }

  /**
   * Menyematkan kotak footer "VERIFIKASI QC BEGOOD - PENJAHIT & KELENGKAPAN"
   * pada setiap halaman dokumen resi thermal A6 resmi Shopee
   */
  static async stampQcToShippingDocument(
    pdfBuffer: Buffer,
    orderList?: ShippingOrderItemParam[]
  ): Promise<Buffer> {
    try {
      if (!pdfBuffer || pdfBuffer.length === 0) return pdfBuffer;

      const pdfDoc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
      const pages = pdfDoc.getPages();
      if (!pages || pages.length === 0) return pdfBuffer;

      const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

      for (let i = 0; i < pages.length; i++) {
        const page = pages[i];
        const { width } = page.getSize();

        // Cocokkan data pesanan untuk halaman ke-i
        const orderInfo: ShippingOrderItemParam | undefined =
          (orderList && orderList[i]) ? orderList[i] : (orderList && orderList[0]) ? orderList[0] : undefined;

        const penjahit = this.sanitizeText(orderInfo?.penjahit, 40);
        const packing = this.sanitizeText(orderInfo?.petugas_packing, 40);
        const kelengkapan = this.sanitizeText(orderInfo?.kelengkapan, 42);
        const summary = this.sanitizeText(
          orderInfo?.items_summary || (orderInfo?.order_sn ? `No. Pesanan: ${orderInfo.order_sn}` : '-'),
          45
        );

        // Dimensi Kotak Footer QC di bagian bawah label (Bottom 0 - 75 pt)
        const margin = 8;
        const boxX = margin;
        const boxY = margin;
        const boxW = Math.max(width - (margin * 2), 260);
        const boxH = 68;

        // 1. Background kotak putih bersih dengan garis tepi hitam solid (menutupi area bawah)
        page.drawRectangle({
          x: boxX,
          y: boxY,
          width: boxW,
          height: boxH,
          borderColor: rgb(0, 0, 0),
          borderWidth: 1,
          color: rgb(1, 1, 1),
        });

        // 2. Banner Header Gelap
        const headerH = 13;
        page.drawRectangle({
          x: boxX,
          y: boxY + boxH - headerH,
          width: boxW,
          height: headerH,
          color: rgb(0.12, 0.12, 0.12),
        });

        page.drawText('VERIFIKASI QC BEGOOD - PENJAHIT & KELENGKAPAN', {
          x: boxX + 6,
          y: boxY + boxH - 9.5,
          size: 7,
          font: fontBold,
          color: rgb(1, 1, 1),
        });

        // 3. Garis pemisah kolom Paraf QC (sebelah kanan)
        const dividerX = boxX + boxW - 62;
        page.drawLine({
          start: { x: dividerX, y: boxY },
          end: { x: dividerX, y: boxY + boxH - headerH },
          thickness: 1,
          color: rgb(0, 0, 0),
        });

        // Judul kolom Paraf QC
        page.drawText('PARAF QC', {
          x: dividerX + 13,
          y: boxY + boxH - 23,
          size: 6.5,
          font: fontBold,
          color: rgb(0, 0, 0),
        });

        // Kotak paraf / cap stempel QC
        page.drawRectangle({
          x: dividerX + 7,
          y: boxY + 5,
          width: 48,
          height: 25,
          borderColor: rgb(0.4, 0.4, 0.4),
          borderWidth: 0.8,
          color: rgb(0.98, 0.98, 0.98),
        });

        page.drawText('[ Lolos QC ]', {
          x: dividerX + 13,
          y: boxY + 7,
          size: 5,
          font: fontRegular,
          color: rgb(0.5, 0.5, 0.5),
        });

        // 4. Kolom Kiri: Rincian Penjahit, Packing, Kelengkapan & Item
        const leftX = boxX + 5;
        const lineH = 11;
        let curY = boxY + boxH - 24;

        // Baris 1: Penjahit
        page.drawText('Penjahit   :', {
          x: leftX,
          y: curY,
          size: 6.5,
          font: fontBold,
          color: rgb(0.2, 0.2, 0.2),
        });
        page.drawText(penjahit, {
          x: leftX + 44,
          y: curY,
          size: 6.5,
          font: fontBold,
          color: rgb(0, 0, 0),
        });
        curY -= lineH;

        // Baris 2: Petugas Packing
        page.drawText('Packing    :', {
          x: leftX,
          y: curY,
          size: 6.5,
          font: fontRegular,
          color: rgb(0.2, 0.2, 0.2),
        });
        page.drawText(packing, {
          x: leftX + 44,
          y: curY,
          size: 6.5,
          font: fontRegular,
          color: rgb(0, 0, 0),
        });
        curY -= lineH;

        // Baris 3: Kelengkapan
        page.drawText('Kelengkapan:', {
          x: leftX,
          y: curY,
          size: 6.5,
          font: fontRegular,
          color: rgb(0.2, 0.2, 0.2),
        });
        page.drawText(kelengkapan, {
          x: leftX + 44,
          y: curY,
          size: 6.5,
          font: fontRegular,
          color: rgb(0, 0, 0),
        });
        curY -= lineH;

        // Baris 4: Ringkasan Item & Qty
        page.drawText('Item / Qty :', {
          x: leftX,
          y: curY,
          size: 6.5,
          font: fontRegular,
          color: rgb(0.2, 0.2, 0.2),
        });
        page.drawText(summary, {
          x: leftX + 44,
          y: curY,
          size: 6.5,
          font: fontRegular,
          color: rgb(0, 0, 0),
        });
      }

      const stampedBytes = await pdfDoc.save();
      return Buffer.from(stampedBytes);
    } catch (err: any) {
      console.warn('[PdfStamperService] Gagal menyematkan stempel QC pada PDF:', err.message || err);
      // Fallback: kembalikan buffer asli jika gagal stempel agar download tidak terputus
      return pdfBuffer;
    }
  }

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
