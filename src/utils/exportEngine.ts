import { jsPDF } from 'jspdf';
import { LogoLayer, PaintLayer, RawPageItem, TextLayer } from '../types/editor';
import { renderCompositeDocument } from './canvasEngine';

export function canvasToBlob(
  canvas: HTMLCanvasElement,
  mime = 'image/png',
  quality = 0.94
): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, mime, quality));
}

export function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

export interface ExportConfig {
  filename: string;
  format: 'png' | 'jpeg' | 'pdf';
  scalePct: number;
  quality: number; // 50..100
  sliceMode: 'none' | 'pages' | 'height';
  sliceHeight: number;
  dest: 'download' | 'folder';
  subfolder: string;
}

export async function buildExportOutputs(
  config: ExportConfig,
  docW: number,
  docH: number,
  baseCanvas: HTMLCanvasElement,
  paintLayers: PaintLayer[],
  texts: TextLayer[],
  logos: LogoLayer[],
  rawPages: RawPageItem[],
  customSplitYs: number[]
): Promise<{ files: { name: string; blob: Blob }[] }> {
  const safeBase = (config.filename.trim() || 'panelflow_export').replace(/[\\/:*?"<>|]/g, '_');

  const comp = document.createElement('canvas');
  comp.width = docW;
  comp.height = docH;
  const cCtx = comp.getContext('2d')!;
  cCtx.fillStyle = '#ffffff';
  cCtx.fillRect(0, 0, docW, docH);
  renderCompositeDocument(cCtx, docW, docH, baseCanvas, paintLayers, texts, logos, false);

  const scale = Math.max(0.25, Math.min(1, config.scalePct / 100));
  const outW = Math.max(1, Math.round(docW * scale));

  // Compute segment Y ranges
  const segments: { y: number; h: number }[] = [];
  if (config.sliceMode === 'pages' || (config.format === 'pdf' && config.sliceMode === 'none')) {
    const boundaries = new Set<number>([0, docH]);
    rawPages.forEach((p) => {
      if (p.yStart > 0 && p.yStart < docH) boundaries.add(p.yStart);
    });
    customSplitYs.forEach((y) => {
      if (y > 20 && y < docH - 20) boundaries.add(Math.round(y));
    });
    const sorted = Array.from(boundaries).sort((a, b) => a - b);
    // If no page markers exist and height is tall, split at standard 1400px for PDF
    if (sorted.length === 2 && config.format === 'pdf' && docH > 1600) {
      for (let y = 0; y < docH; y += 1400) {
        segments.push({ y, h: Math.min(1400, docH - y) });
      }
    } else {
      for (let i = 0; i < sorted.length - 1; i++) {
        const h = sorted[i + 1] - sorted[i];
        if (h > 4) segments.push({ y: sorted[i], h });
      }
    }
  } else if (config.sliceMode === 'height' && config.sliceHeight > 0 && docH > config.sliceHeight) {
    let y = 0;
    while (y < docH) {
      const h = Math.min(config.sliceHeight, docH - y);
      segments.push({ y, h });
      y += h;
    }
  } else {
    segments.push({ y: 0, h: docH });
  }

  if (config.format === 'pdf') {
    const firstH = Math.max(1, Math.round(segments[0].h * scale));
    const pdf = new jsPDF({
      orientation: outW >= firstH ? 'landscape' : 'portrait',
      unit: 'px',
      format: [outW, firstH],
      hotfixes: ['px_scaling'],
    });
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      const outH = Math.max(1, Math.round(seg.h * scale));
      const sliceCanvas = document.createElement('canvas');
      sliceCanvas.width = outW;
      sliceCanvas.height = outH;
      sliceCanvas.getContext('2d')!.drawImage(comp, 0, seg.y, docW, seg.h, 0, 0, outW, outH);
      const dataUrl = sliceCanvas.toDataURL('image/jpeg', Math.max(0.5, config.quality / 100));
      if (i > 0) {
        pdf.addPage([outW, outH], outW >= outH ? 'landscape' : 'portrait');
      }
      pdf.addImage(dataUrl, 'JPEG', 0, 0, outW, outH);
    }
    const pdfBlob = pdf.output('blob');
    return { files: [{ name: `${safeBase}.pdf`, blob: pdfBlob }] };
  }

  const mime = config.format === 'png' ? 'image/png' : 'image/jpeg';
  const ext = config.format === 'png' ? 'png' : 'jpg';
  const qual = config.quality / 100;
  const files: { name: string; blob: Blob }[] = [];

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const outH = Math.max(1, Math.round(seg.h * scale));
    const sliceCanvas = document.createElement('canvas');
    sliceCanvas.width = outW;
    sliceCanvas.height = outH;
    sliceCanvas.getContext('2d')!.drawImage(comp, 0, seg.y, docW, seg.h, 0, 0, outW, outH);
    const blob = await canvasToBlob(sliceCanvas, mime, qual);
    if (blob) {
      const suffix = segments.length > 1 ? `_${String(i + 1).padStart(2, '0')}` : '';
      files.push({ name: `${safeBase}${suffix}.${ext}`, blob });
    }
  }

  return { files };
}
