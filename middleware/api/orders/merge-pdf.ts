import type { VercelRequest, VercelResponse } from '@vercel/node';
import { PdfStamperService } from '../../src/services/pdf-stamper.service.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-begood-secret');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      message: 'Method not allowed. Gunakan POST.',
    });
  }

  try {
    let payload = req.body;
    if (typeof payload === 'string') {
      try {
        payload = JSON.parse(payload);
      } catch (e) {}
    }

    const list: string[] = payload?.pdf_base64_list || [];
    if (!Array.isArray(list) || list.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Parameter pdf_base64_list wajib berupa array Base64 PDF non-kosong.',
      });
    }

    const buffers: Buffer[] = list
      .filter((b64) => typeof b64 === 'string' && b64.trim().length > 0)
      .map((b64) => Buffer.from(b64.trim(), 'base64'));

    if (buffers.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Tidak ada buffer PDF valid yang ditemukan di pdf_base64_list.',
      });
    }

    const mergedBuffer = await PdfStamperService.mergePdfs(buffers);

    const isDirectPdf = req.query?.format === 'pdf' ||
      (req.headers['accept'] && req.headers['accept'].includes('application/pdf'));

    if (isDirectPdf) {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'inline; filename="resi-thermal-massal.pdf"');
      return res.status(200).send(mergedBuffer);
    }

    return res.status(200).json({
      success: true,
      message: `Berhasil menggabungkan ${buffers.length} berkas PDF dokumen resi`,
      data: {
        pdf_base64: mergedBuffer.toString('base64'),
        merged_count: buffers.length,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('Error in merge-pdf handler:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Gagal menggabungkan dokumen PDF resi',
      error: err.message || String(err),
      timestamp: new Date().toISOString(),
    });
  }
}
