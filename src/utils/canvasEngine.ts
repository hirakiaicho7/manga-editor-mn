import {
  AiDetectedRegion,
  AlignmentGuide,
  BrushSettings,
  LogoLayer,
  PaintLayer,
  SmartCleanSettings,
  TextLayer,
} from '../types/editor';

export function hexToRgb(h: string): [number, number, number] {
  const clean = h.replace('#', '');
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean.padEnd(6, '0');
  return [
    parseInt(full.slice(0, 2), 16) || 0,
    parseInt(full.slice(2, 4), 16) || 0,
    parseInt(full.slice(4, 6), 16) || 0,
  ];
}

export function rgbToHex(r: number, g: number, b: number): string {
  return (
    '#' +
    [r, g, b]
      .map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0'))
      .join('')
  );
}

export function rgbaFromHex(hex: string, alpha01: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha01))})`;
}

export function measureSpacedText(ctx: CanvasRenderingContext2D, str: string, ls: number): number {
  if (!str.length) return 0;
  if (!ls) return ctx.measureText(str).width;
  let w = 0;
  for (let i = 0; i < str.length; i++) {
    w += ctx.measureText(str[i]).width + (i < str.length - 1 ? ls : 0);
  }
  return w;
}

export function wrapTextLines(
  ctx: CanvasRenderingContext2D,
  rawText: string,
  maxW: number,
  ls: number
): string[] {
  const paragraphs = (rawText || ' ').split('\n');
  const result: string[] = [];
  for (const para of paragraphs) {
    if (!para.length) {
      result.push('');
      continue;
    }
    const words = para.split(' ');
    let line = '';
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (measureSpacedText(ctx, test, ls) <= maxW) {
        line = test;
      } else {
        if (line) result.push(line);
        if (measureSpacedText(ctx, word, ls) > maxW) {
          let chunk = '';
          for (const ch of word) {
            if (measureSpacedText(ctx, chunk + ch, ls) > maxW && chunk) {
              result.push(chunk);
              chunk = ch;
            } else {
              chunk += ch;
            }
          }
          line = chunk;
        } else {
          line = word;
        }
      }
    }
    if (line || !words.length) result.push(line);
  }
  return result;
}

function drawSpacedLine(
  ctx: CanvasRenderingContext2D,
  str: string,
  startX: number,
  y: number,
  ls: number,
  isStroke: boolean
) {
  if (!ls) {
    if (isStroke) ctx.strokeText(str, startX, y);
    else ctx.fillText(str, startX, y);
    return;
  }
  ctx.save();
  ctx.textAlign = 'left';
  let cx = startX;
  for (let i = 0; i < str.length; i++) {
    if (isStroke) ctx.strokeText(str[i], cx, y);
    else ctx.fillText(str[i], cx, y);
    cx += ctx.measureText(str[i]).width + ls;
  }
  ctx.restore();
}

export function computeTextBounds(item: TextLayer): { halfW: number; halfH: number; lines: string[]; linePx: number; textH: number } {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  const raw = item.uppercase ? (item.text || ' ').toUpperCase() : item.text || ' ';
  const boxW = Math.max(36, item.boxWidth || 200);
  const sx = item.scaleX || 1;
  const sy = item.scaleY || 1;
  const ls = item.letterSpacing || 0;
  ctx.font = `${item.italic ? 'italic ' : ''}${item.bold ? 'bold ' : ''}${item.fontSize}px ${item.fontFamily}`;
  const lines = wrapTextLines(ctx, raw, boxW / sx, ls);
  const linePx = item.fontSize * (item.lineHeight || 1.2);
  const textH = lines.length * linePx;
  const halfW = boxW / 2 + 8;
  const halfH = (textH * sy) / 2 + 8;
  item._halfW = halfW;
  item._halfH = halfH;
  return { halfW, halfH, lines, linePx, textH };
}

/**
 * Two-pass text renderer:
 * Pass 'shadow' draws only drop shadows behind all text glyphs (so no shadow covers another text).
 * Pass 'body' draws background box, stroke, fill/gradient, glow, and underline.
 */
export function drawTextItemPass(
  ctx: CanvasRenderingContext2D,
  item: TextLayer,
  pass: 'shadow' | 'body' | 'both'
) {
  if (!item.visible) return;
  if (pass === 'shadow' && !item.shadowEnabled) return;

  const { lines, linePx, textH } = computeTextBounds(item);
  const boxW = Math.max(36, item.boxWidth || 200);
  const sx = item.scaleX || 1;
  const sy = item.scaleY || 1;
  const ls = item.letterSpacing || 0;
  const sw = item.strokeWidth || 0;
  const layerAlpha = item.opacity ?? 1;
  const hasWarp = (item.bend || 0) !== 0 || (item.perspX || 0) !== 0 || (item.perspY || 0) !== 0;

  const shadowRad = ((item.shadowAngle ?? 135) * Math.PI) / 180;
  const shadowDist = item.shadowDistance ?? 4;
  const offX = Math.cos(shadowRad) * shadowDist;
  const offY = Math.sin(shadowRad) * shadowDist;
  const shadowCol = rgbaFromHex(item.shadowColor || '#000000', (item.shadowOpacity ?? 70) / 100);

  const renderCore = (c: CanvasRenderingContext2D, cx: number, cy: number, corePass: 'shadow' | 'body') => {
    c.save();
    c.translate(cx, cy);
    c.scale(sx, sy);
    c.font = `${item.italic ? 'italic ' : ''}${item.bold ? 'bold ' : ''}${item.fontSize}px ${item.fontFamily}`;
    c.textBaseline = 'middle';
    const unscaledW = boxW / sx;

    const pos = lines.map((line, i) => {
      const lw = measureSpacedText(c, line, ls);
      const ly = -textH / 2 + (i + 0.5) * linePx;
      let drawX = 0;
      if (!ls) {
        c.textAlign = item.align || 'center';
        if (item.align === 'left') drawX = -unscaledW / 2;
        else if (item.align === 'right') drawX = unscaledW / 2;
      } else {
        if (item.align === 'left') drawX = -unscaledW / 2;
        else if (item.align === 'right') drawX = unscaledW / 2 - lw;
        else drawX = -lw / 2;
      }
      return { line, lw, ly, drawX };
    });

    if (corePass === 'shadow') {
      // Draw shadow silhouette offset out of clip or via shadowOffset so text body doesn't get tinted
      const bigOffset = 12000;
      c.save();
      c.translate(-bigOffset, 0);
      c.shadowColor = shadowCol;
      c.shadowBlur = item.shadowBlur ?? 6;
      c.shadowOffsetX = bigOffset + offX;
      c.shadowOffsetY = offY;
      c.fillStyle = '#000000';
      if (sw > 0) {
        c.lineJoin = 'round';
        c.miterLimit = 2;
        c.lineWidth = sw;
        c.strokeStyle = '#000000';
        pos.forEach((p) => drawSpacedLine(c, p.line, p.drawX, p.ly, ls, true));
      }
      pos.forEach((p) => drawSpacedLine(c, p.line, p.drawX, p.ly, ls, false));
      c.restore();
      c.restore();
      return;
    }

    // Body pass
    if (item.bgEnabled) {
      c.fillStyle = item.bgColor || '#ffffff';
      c.fillRect(-unscaledW / 2 - 10, -textH / 2 - 8, unscaledW + 20, textH + 16);
    }

    let fillStyle: string | CanvasGradient = item.color;
    if (item.gradEnabled) {
      const rad = (((item.gradAng ?? 90) - 90) * Math.PI) / 180;
      const r = Math.max(unscaledW, textH) / 2;
      const grad = c.createLinearGradient(
        -Math.cos(rad) * r,
        -Math.sin(rad) * r,
        Math.cos(rad) * r,
        Math.sin(rad) * r
      );
      grad.addColorStop(0, item.grad1 || '#14b866');
      grad.addColorStop(1, item.grad2 || '#2dd4bf');
      fillStyle = grad;
    }

    if (item.glowEnabled) {
      c.shadowColor = item.glowColor || '#14b866';
      c.shadowBlur = item.glowRadius ?? 14;
      c.shadowOffsetX = 0;
      c.shadowOffsetY = 0;
    }

    if (sw > 0) {
      c.lineJoin = 'round';
      c.miterLimit = 2;
      c.lineWidth = sw;
      c.strokeStyle = item.strokeColor;
      pos.forEach((p) => drawSpacedLine(c, p.line, p.drawX, p.ly, ls, true));
    }

    c.fillStyle = fillStyle;
    pos.forEach((p) => {
      drawSpacedLine(c, p.line, p.drawX, p.ly, ls, false);
      if (item.underline && p.lw > 0) {
        let ux = -p.lw / 2;
        if (item.align === 'left') ux = -unscaledW / 2;
        else if (item.align === 'right') ux = unscaledW / 2 - p.lw;
        c.fillRect(ux, p.ly + item.fontSize * 0.42, p.lw, Math.max(1.5, item.fontSize * 0.07));
      }
    });
    c.restore();
  };

  const runPass = (pKind: 'shadow' | 'body') => {
    ctx.save();
    ctx.globalAlpha = layerAlpha;
    ctx.translate(item.x, item.y);
    ctx.rotate(((item.rotation || 0) * Math.PI) / 180);
    if (!hasWarp) {
      renderCore(ctx, 0, 0, pKind);
    } else {
      const pad = sw * Math.max(sx, sy) + 36;
      const bw = Math.ceil(boxW + pad * 2);
      const bh = Math.ceil(textH * sy + pad * 2);
      const buf1 = document.createElement('canvas');
      buf1.width = bw;
      buf1.height = bh;
      renderCore(buf1.getContext('2d')!, bw / 2, bh / 2, pKind);
      const pxFactor = (item.perspX || 0) / 100;
      const buf2 = document.createElement('canvas');
      buf2.width = Math.ceil(bw * 1.6);
      buf2.height = bh;
      const c2 = buf2.getContext('2d')!;
      for (let y = 0; y < bh; y += 2) {
        const dw = bw * Math.max(0.15, 1 + pxFactor * ((y / bh) * 2 - 1));
        c2.drawImage(buf1, 0, y, bw, 2, (buf2.width - dw) / 2, y, dw, 2);
      }
      const bendVal = item.bend || 0;
      const pyFactor = (item.perspY || 0) / 100;
      for (let x = 0; x < buf2.width; x += 2) {
        const nx = (x / buf2.width) * 2 - 1;
        const dh = bh * Math.max(0.15, 1 + pyFactor * nx);
        ctx.drawImage(
          buf2,
          x,
          0,
          2,
          bh,
          x - buf2.width / 2,
          -dh / 2 - bendVal * (1 - nx * nx),
          2,
          dh
        );
      }
    }
    ctx.restore();
  };

  if (pass === 'both') {
    if (item.shadowEnabled) runPass('shadow');
    runPass('body');
  } else {
    runPass(pass);
  }
}

export function drawLogoItem(ctx: CanvasRenderingContext2D, ov: LogoLayer) {
  if (!ov.visible) return;
  ov._halfW = ov.width / 2;
  ov._halfH = ov.height / 2;
  ctx.save();
  ctx.globalAlpha = ov.opacity ?? 1;
  ctx.translate(ov.x, ov.y);
  ctx.rotate(((ov.rotation || 0) * Math.PI) / 180);
  ctx.scale(ov.flipX ? -1 : 1, ov.flipY ? -1 : 1);
  ctx.drawImage(ov.img, -ov.width / 2, -ov.height / 2, ov.width, ov.height);
  ctx.restore();
}

export function renderCompositeDocument(
  targetCtx: CanvasRenderingContext2D,
  docW: number,
  docH: number,
  baseCanvas: HTMLCanvasElement,
  paintLayers: PaintLayer[],
  texts: TextLayer[],
  logos: LogoLayer[],
  beforeOnly = false
) {
  targetCtx.clearRect(0, 0, docW, docH);
  targetCtx.drawImage(baseCanvas, 0, 0);
  if (beforeOnly) return;

  // Non-destructive Paint / Clean layers (bottom to top)
  for (const pl of paintLayers) {
    if (!pl.visible) continue;
    targetCtx.save();
    targetCtx.globalAlpha = pl.opacity;
    targetCtx.drawImage(pl.canvas, 0, 0);
    targetCtx.restore();
  }

  // Logos sent to back (behind text)
  for (const lo of logos) {
    if (!lo.aboveText) drawLogoItem(targetCtx, lo);
  }

  // Two-pass text rendering: all shadows strictly behind all text bodies!
  for (const t of texts) {
    drawTextItemPass(targetCtx, t, 'shadow');
  }
  for (const t of texts) {
    drawTextItemPass(targetCtx, t, 'body');
  }

  // Logos above text
  for (const lo of logos) {
    if (lo.aboveText) drawLogoItem(targetCtx, lo);
  }
}

export function sampleCompositeRegion(
  rx: number,
  ry: number,
  rw: number,
  rh: number,
  baseCanvas: HTMLCanvasElement,
  paintLayers: PaintLayer[]
): Uint8ClampedArray {
  const tmp = document.createElement('canvas');
  tmp.width = rw;
  tmp.height = rh;
  const ctx = tmp.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(baseCanvas, rx, ry, rw, rh, 0, 0, rw, rh);
  for (const pl of paintLayers) {
    if (!pl.visible) continue;
    ctx.save();
    ctx.globalAlpha = pl.opacity;
    ctx.drawImage(pl.canvas, rx, ry, rw, rh, 0, 0, rw, rh);
    ctx.restore();
  }
  return ctx.getImageData(0, 0, rw, rh).data;
}

export function sampleCompositePixelAt(
  x: number,
  y: number,
  docW: number,
  docH: number,
  baseCanvas: HTMLCanvasElement,
  paintLayers: PaintLayer[]
): [number, number, number] {
  const cx = Math.max(0, Math.min(docW - 1, Math.round(x)));
  const cy = Math.max(0, Math.min(docH - 1, Math.round(y)));
  const d = sampleCompositeRegion(cx, cy, 1, 1, baseCanvas, paintLayers);
  return [d[0], d[1], d[2]];
}

export interface DetectedBubble {
  cx: number;
  cy: number;
  safeW: number;
  safeH: number;
}

export function detectSpeechBubble(
  sx: number,
  sy: number,
  docW: number,
  docH: number,
  baseCanvas: HTMLCanvasElement,
  paintLayers: PaintLayer[]
): DetectedBubble | null {
  const px = Math.round(sx);
  const py = Math.round(sy);
  if (px < 0 || py < 0 || px >= docW || py >= docH) return null;

  const rad = 350;
  const rx = Math.max(0, px - rad);
  const ry = Math.max(0, py - rad);
  const rx2 = Math.min(docW, px + rad);
  const ry2 = Math.min(docH, py + rad);
  const rw = rx2 - rx;
  const rh = ry2 - ry;
  if (rw < 10 || rh < 10) return null;

  const data = sampleCompositeRegion(rx, ry, rw, rh, baseCanvas, paintLayers);
  const startIdx = ((py - ry) * rw + (px - rx)) * 4;
  const sr = data[startIdx];
  const sg = data[startIdx + 1];
  const sb = data[startIdx + 2];

  const tol = 95;
  const visited = new Uint8Array(rw * rh);
  const queue: number[] = [px - rx, py - ry];
  visited[(py - ry) * rw + (px - rx)] = 1;

  let head = 0;
  let count = 0;
  let touchedEdge = false;
  const rowBounds = new Map<number, [number, number]>();

  while (head < queue.length && count < 180000) {
    const cx = queue[head++];
    const cy = queue[head++];
    const pos = cy * rw + cx;
    const idx = pos * 4;
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];
    if (Math.abs(r - sr) + Math.abs(g - sg) + Math.abs(b - sb) > tol) continue;

    count++;
    if (cx === 0 || cx === rw - 1 || cy === 0 || cy === rh - 1) touchedEdge = true;
    const gx = rx + cx;
    const gy = ry + cy;
    const rb = rowBounds.get(gy);
    if (!rb) rowBounds.set(gy, [gx, gx]);
    else {
      if (gx < rb[0]) rb[0] = gx;
      if (gx > rb[1]) rb[1] = gx;
    }
    if (cx > 0 && !visited[pos - 1]) {
      visited[pos - 1] = 1;
      queue.push(cx - 1, cy);
    }
    if (cx < rw - 1 && !visited[pos + 1]) {
      visited[pos + 1] = 1;
      queue.push(cx + 1, cy);
    }
    if (cy > 0 && !visited[pos - rw]) {
      visited[pos - rw] = 1;
      queue.push(cx, cy - 1);
    }
    if (cy < rh - 1 && !visited[pos + rw]) {
      visited[pos + rw] = 1;
      queue.push(cx, cy + 1);
    }
  }

  if (count < 400 || count >= 175000 || (touchedEdge && count > 120000)) return null;
  const rows = Array.from(rowBounds.entries()).sort((a, b) => a[0] - b[0]);
  let maxRowW = 0;
  rows.forEach(([, [x1, x2]]) => {
    maxRowW = Math.max(maxRowW, x2 - x1);
  });
  const bodyRows = rows.filter(([, [x1, x2]]) => x2 - x1 >= maxRowW * 0.45);
  if (bodyRows.length < 15) return null;

  let sumCX = 0;
  let sumCY = 0;
  let sumW = 0;
  bodyRows.forEach(([y, [x1, x2]]) => {
    sumCX += (x1 + x2) / 2;
    sumCY += y;
    sumW += x2 - x1;
  });

  return {
    cx: Math.round(sumCX / bodyRows.length),
    cy: Math.round(sumCY / bodyRows.length),
    safeW: Math.max(70, Math.round((sumW / bodyRows.length) * 0.8)),
    safeH: Math.max(40, Math.round((bodyRows[bodyRows.length - 1][0] - bodyRows[0][0]) * 0.82)),
  };
}

export function fitFontSizeToHeight(t: TextLayer, maxH: number): number {
  const tmp = document.createElement('canvas').getContext('2d')!;
  let best = 12;
  for (let fs = 54; fs >= 12; fs--) {
    tmp.font = `${t.italic ? 'italic ' : ''}${t.bold ? 'bold ' : ''}${fs}px ${t.fontFamily}`;
    const raw = t.uppercase ? (t.text || ' ').toUpperCase() : t.text || ' ';
    const lines = wrapTextLines(tmp, raw, t.boxWidth / (t.scaleX || 1), t.letterSpacing || 0);
    if (lines.length * fs * (t.lineHeight || 1.2) * (t.scaleY || 1) <= maxH) {
      best = fs;
      break;
    }
  }
  return best;
}

/**
 * ibisPaint X style Brush Stroke Engine (Hardness, Opacity, Spacing, Type)
 */
export function applyBrushSegment(
  paintCtx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  brush: BrushSettings,
  mode: 'brush' | 'eraser' | 'clone',
  docW: number,
  docH: number,
  baseCanvas: HTMLCanvasElement,
  paintLayers: PaintLayer[],
  cloneOffset: { dx: number; dy: number } | null,
  sizeOverride?: number
) {
  const size = Math.max(1, sizeOverride ?? brush.size);
  const alpha = Math.max(0.01, Math.min(1, brush.opacity / 100));
  const hardness = Math.max(0, Math.min(100, brush.hardness)) / 100;
  const spacingPx = Math.max(1.5, size * (Math.max(5, brush.spacing) / 100));
  const dist = Math.hypot(x2 - x1, y2 - y1);
  const steps = Math.max(1, Math.ceil(dist / spacingPx));
  const r = size / 2;
  const [cr, cg, cb] = hexToRgb(brush.color);

  if (mode === 'eraser') {
    paintCtx.save();
    paintCtx.globalCompositeOperation = 'destination-out';
    for (let i = 0; i <= steps; i++) {
      const t = steps === 0 ? 0 : i / steps;
      const px = x1 + (x2 - x1) * t;
      const py = y1 + (y2 - y1) * t;
      if (hardness >= 0.95) {
        paintCtx.globalAlpha = alpha;
        paintCtx.fillStyle = '#000';
        paintCtx.beginPath();
        paintCtx.arc(px, py, r, 0, Math.PI * 2);
        paintCtx.fill();
      } else {
        const g = paintCtx.createRadialGradient(px, py, r * hardness * 0.85, px, py, r);
        g.addColorStop(0, `rgba(0,0,0,${alpha})`);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        paintCtx.fillStyle = g;
        paintCtx.beginPath();
        paintCtx.arc(px, py, r, 0, Math.PI * 2);
        paintCtx.fill();
      }
    }
    paintCtx.restore();
    return;
  }

  if (mode === 'clone' && cloneOffset) {
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const px = x1 + (x2 - x1) * t;
      const py = y1 + (y2 - y1) * t;
      paintCtx.save();
      paintCtx.globalAlpha = alpha;
      paintCtx.beginPath();
      paintCtx.arc(px, py, r, 0, Math.PI * 2);
      paintCtx.clip();
      paintCtx.drawImage(
        baseCanvas,
        px + cloneOffset.dx - r,
        py + cloneOffset.dy - r,
        size,
        size,
        px - r,
        py - r,
        size,
        size
      );
      paintCtx.restore();
    }
    return;
  }

  if (brush.type === 'blur') {
    const bx = Math.max(0, Math.floor(x2 - r));
    const by = Math.max(0, Math.floor(y2 - r));
    const bw = Math.min(docW - bx, Math.ceil(size));
    const bh = Math.min(docH - by, Math.ceil(size));
    if (bw > 2 && bh > 2) {
      const tmp = document.createElement('canvas');
      tmp.width = bw;
      tmp.height = bh;
      const tc = tmp.getContext('2d')!;
      tc.filter = `blur(${Math.max(2, Math.round(size * 0.14))}px)`;
      tc.drawImage(baseCanvas, bx, by, bw, bh, 0, 0, bw, bh);
      for (const pl of paintLayers) {
        if (pl.visible) tc.drawImage(pl.canvas, bx, by, bw, bh, 0, 0, bw, bh);
      }
      paintCtx.save();
      paintCtx.globalAlpha = alpha * 0.6;
      paintCtx.beginPath();
      paintCtx.arc(x2, y2, r, 0, Math.PI * 2);
      paintCtx.clip();
      paintCtx.drawImage(tmp, bx, by);
      paintCtx.restore();
    }
    return;
  }

  if (brush.type === 'marker') {
    paintCtx.save();
    paintCtx.fillStyle = brush.color;
    paintCtx.globalAlpha = alpha * 0.85;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const px = x1 + (x2 - x1) * t;
      const py = y1 + (y2 - y1) * t;
      paintCtx.save();
      paintCtx.translate(px, py);
      paintCtx.rotate(-Math.PI / 6);
      paintCtx.fillRect(-r, -r * 0.36, size, size * 0.36);
      paintCtx.restore();
    }
    paintCtx.restore();
    return;
  }

  if (brush.type === 'screentone') {
    paintCtx.save();
    paintCtx.fillStyle = brush.color;
    paintCtx.globalAlpha = alpha * 0.65;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const px = x1 + (x2 - x1) * t;
      const py = y1 + (y2 - y1) * t;
      const density = Math.max(8, Math.round(size * 0.6));
      for (let d = 0; d < density; d++) {
        const ang = Math.random() * Math.PI * 2;
        const rad = Math.random() * r;
        paintCtx.fillRect(px + Math.cos(ang) * rad, py + Math.sin(ang) * rad, 2, 2);
      }
    }
    paintCtx.restore();
    return;
  }

  // gpen & airbrush respect hardness & spacing smoothly
  const effHardness = brush.type === 'airbrush' ? Math.min(hardness, 0.35) : hardness;
  paintCtx.save();
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const px = x1 + (x2 - x1) * t;
    const py = y1 + (y2 - y1) * t;
    if (effHardness >= 0.92 && brush.type === 'gpen') {
      paintCtx.globalAlpha = alpha;
      paintCtx.fillStyle = brush.color;
      paintCtx.beginPath();
      paintCtx.arc(px, py, r, 0, Math.PI * 2);
      paintCtx.fill();
    } else {
      const innerR = r * effHardness * 0.85;
      const g = paintCtx.createRadialGradient(px, py, innerR, px, py, r);
      const stampAlpha = brush.type === 'airbrush' ? alpha * 0.42 : alpha;
      g.addColorStop(0, `rgba(${cr},${cg},${cb},${stampAlpha})`);
      g.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
      paintCtx.fillStyle = g;
      paintCtx.beginPath();
      paintCtx.arc(px, py, r, 0, Math.PI * 2);
      paintCtx.fill();
    }
  }
  paintCtx.restore();
}

export function renderBrushPreviewCurve(canvas: HTMLCanvasElement, brush: BrushSettings, isDark: boolean) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  // Subtle backdrop
  ctx.fillStyle = isDark ? '#121917' : '#f4f6f5';
  ctx.fillRect(0, 0, w, h);

  const previewBrush: BrushSettings = {
    ...brush,
    size: Math.min(28, Math.max(4, brush.size * 0.55)),
  };

  const dummyBase = document.createElement('canvas');
  dummyBase.width = w;
  dummyBase.height = h;

  const pts: [number, number][] = [];
  const n = 28;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = 18 + t * (w - 36);
    const y = h / 2 + Math.sin(t * Math.PI * 2) * (h * 0.24);
    pts.push([x, y]);
  }
  for (let i = 1; i < pts.length; i++) {
    applyBrushSegment(
      ctx,
      pts[i - 1][0],
      pts[i - 1][1],
      pts[i][0],
      pts[i][1],
      previewBrush,
      'brush',
      w,
      h,
      dummyBase,
      [],
      null
    );
  }
}

/**
 * Fast Non-Destructive Inpainting Engine
 */
function runFastInpaintRegion(
  compRGB: Uint8ClampedArray,
  mask: Uint8Array,
  rw: number,
  rh: number,
  domBg: [number, number, number]
): { outRGB: Float32Array; dist: Int32Array } {
  const total = rw * rh;
  const known = new Uint8Array(total);
  const outRGB = new Float32Array(compRGB);
  const dist = new Int32Array(total);
  const frontier = new Int32Array(total);
  const inFrontier = new Uint8Array(total);
  let qh = 0;
  let qt = 0;

  for (let i = 0; i < total; i++) {
    if (!mask[i]) {
      known[i] = 1;
      dist[i] = 0;
    } else {
      dist[i] = 1e9;
    }
  }
  for (let py = 0; py < rh; py++) {
    for (let px = 0; px < rw; px++) {
      const idx = py * rw + px;
      if (
        !known[idx] &&
        ((px > 0 && known[idx - 1]) ||
          (px < rw - 1 && known[idx + 1]) ||
          (py > 0 && known[idx - rw]) ||
          (py < rh - 1 && known[idx + rw]))
      ) {
        dist[idx] = 1;
        inFrontier[idx] = 1;
        frontier[qt++] = idx;
      }
    }
  }

  while (qh < qt) {
    const idx = frontier[qh++];
    const px = idx % rw;
    const py = (idx / rw) | 0;
    let sr = 0;
    let sg = 0;
    let sb = 0;
    let wSum = 0;
    for (let dy = -2; dy <= 2; dy++) {
      const ny = py + dy;
      if (ny < 0 || ny >= rh) continue;
      for (let dx = -2; dx <= 2; dx++) {
        if (!dx && !dy) continue;
        const nx = px + dx;
        if (nx < 0 || nx >= rw) continue;
        const nIdx = ny * rw + nx;
        if (!known[nIdx]) continue;
        const d2 = dx * dx + dy * dy;
        let w = 1 / (d2 * Math.sqrt(d2));
        if (
          nx > 0 &&
          nx < rw - 1 &&
          ny > 0 &&
          ny < rh - 1 &&
          known[nIdx - 1] &&
          known[nIdx + 1] &&
          known[nIdx - rw] &&
          known[nIdx + rw]
        ) {
          const lumL = 0.299 * outRGB[(nIdx - 1) * 3] + 0.587 * outRGB[(nIdx - 1) * 3 + 1] + 0.114 * outRGB[(nIdx - 1) * 3 + 2];
          const lumR = 0.299 * outRGB[(nIdx + 1) * 3] + 0.587 * outRGB[(nIdx + 1) * 3 + 1] + 0.114 * outRGB[(nIdx + 1) * 3 + 2];
          const lumU = 0.299 * outRGB[(nIdx - rw) * 3] + 0.587 * outRGB[(nIdx - rw) * 3 + 1] + 0.114 * outRGB[(nIdx - rw) * 3 + 2];
          const lumD = 0.299 * outRGB[(nIdx + rw) * 3] + 0.587 * outRGB[(nIdx + rw) * 3 + 1] + 0.114 * outRGB[(nIdx + rw) * 3 + 2];
          const gx = lumR - lumL;
          const gy = lumD - lumU;
          const gm = Math.hypot(gx, gy);
          if (gm > 6) {
            w *= 0.3 + (0.9 * Math.abs(-dy * gx + dx * gy)) / (Math.sqrt(d2) * gm + 0.001);
          }
        }
        sr += outRGB[nIdx * 3] * w;
        sg += outRGB[nIdx * 3 + 1] * w;
        sb += outRGB[nIdx * 3 + 2] * w;
        wSum += w;
      }
    }
    if (wSum > 0) {
      outRGB[idx * 3] = sr / wSum;
      outRGB[idx * 3 + 1] = sg / wSum;
      outRGB[idx * 3 + 2] = sb / wSum;
      known[idx] = 1;
    }
    const nd = dist[idx] + 1;
    if (px > 0 && !known[idx - 1] && !inFrontier[idx - 1]) {
      dist[idx - 1] = nd;
      inFrontier[idx - 1] = 1;
      frontier[qt++] = idx - 1;
    }
    if (px < rw - 1 && !known[idx + 1] && !inFrontier[idx + 1]) {
      dist[idx + 1] = nd;
      inFrontier[idx + 1] = 1;
      frontier[qt++] = idx + 1;
    }
    if (py > 0 && !known[idx - rw] && !inFrontier[idx - rw]) {
      dist[idx - rw] = nd;
      inFrontier[idx - rw] = 1;
      frontier[qt++] = idx - rw;
    }
    if (py < rh - 1 && !known[idx + rw] && !inFrontier[idx + rw]) {
      dist[idx + rw] = nd;
      inFrontier[idx + rw] = 1;
      frontier[qt++] = idx + rw;
    }
  }

  for (let i = 0; i < total; i++) {
    if (!known[i]) {
      outRGB[i * 3] = domBg[0];
      outRGB[i * 3 + 1] = domBg[1];
      outRGB[i * 3 + 2] = domBg[2];
    }
  }

  for (let s = 0; s < 3; s++) {
    const cp = new Float32Array(outRGB);
    for (let py = 1; py < rh - 1; py++) {
      for (let px = 1; px < rw - 1; px++) {
        const idx = py * rw + px;
        if (!mask[idx]) continue;
        outRGB[idx * 3] =
          (cp[idx * 3] * 2 + cp[(idx - 1) * 3] + cp[(idx + 1) * 3] + cp[(idx - rw) * 3] + cp[(idx + rw) * 3]) / 6;
        outRGB[idx * 3 + 1] =
          (cp[idx * 3 + 1] * 2 +
            cp[(idx - 1) * 3 + 1] +
            cp[(idx + 1) * 3 + 1] +
            cp[(idx - rw) * 3 + 1] +
            cp[(idx + rw) * 3 + 1]) /
          6;
        outRGB[idx * 3 + 2] =
          (cp[idx * 3 + 2] * 2 +
            cp[(idx - 1) * 3 + 2] +
            cp[(idx + 1) * 3 + 2] +
            cp[(idx - rw) * 3 + 2] +
            cp[(idx + rw) * 3 + 2]) /
          6;
      }
    }
  }
  return { outRGB, dist };
}

export function cleanStrokeOnLayer(
  points: [number, number][],
  clean: SmartCleanSettings,
  docW: number,
  docH: number,
  baseCanvas: HTMLCanvasElement,
  paintLayers: PaintLayer[],
  targetLayer: PaintLayer
): { bounds: [number, number, number, number]; status: 'ok' | 'empty'; message: string } | null {
  if (!points.length) return null;
  const radius = Math.max(4, clean.brushSize / 2);
  let minX = docW;
  let minY = docH;
  let maxX = 0;
  let maxY = 0;
  for (const [px, py] of points) {
    minX = Math.min(minX, px);
    minY = Math.min(minY, py);
    maxX = Math.max(maxX, px);
    maxY = Math.max(maxY, py);
  }
  const ringPad = Math.max(16, Math.round(radius * 0.45));
  const rx = Math.max(0, Math.floor(minX - radius - ringPad));
  const ry = Math.max(0, Math.floor(minY - radius - ringPad));
  const rx2 = Math.min(docW, Math.ceil(maxX + radius + ringPad));
  const ry2 = Math.min(docH, Math.ceil(maxY + radius + ringPad));
  const rw = rx2 - rx;
  const rh = ry2 - ry;
  if (rw < 4 || rh < 4) return null;

  const n = rw * rh;
  const strokeMask = new Uint8Array(n);
  const radSq = radius * radius;
  const segCount = Math.max(1, points.length - 1);

  for (let py = 0; py < rh; py++) {
    const wy = ry + py;
    for (let px = 0; px < rw; px++) {
      const wx = rx + px;
      let hit = false;
      if (points.length === 1) {
        const dx = wx - points[0][0];
        const dy = wy - points[0][1];
        hit = dx * dx + dy * dy <= radSq;
      } else {
        for (let s = 0; s < segCount; s++) {
          const [ax, ay] = points[s];
          const [bx, by] = points[s + 1];
          const vx = bx - ax;
          const vy = by - ay;
          const l2 = vx * vx + vy * vy;
          const t = l2 < 0.0001 ? 0 : Math.max(0, Math.min(1, ((wx - ax) * vx + (wy - ay) * vy) / l2));
          const dx = wx - (ax + vx * t);
          const dy = wy - (ay + vy * t);
          if (dx * dx + dy * dy <= radSq) {
            hit = true;
            break;
          }
        }
      }
      if (hit) strokeMask[py * rw + px] = 1;
    }
  }

  const compRGBA = sampleCompositeRegion(rx, ry, rw, rh, baseCanvas, paintLayers);
  const compRGB = new Uint8ClampedArray(n * 3);
  for (let i = 0; i < n; i++) {
    compRGB[i * 3] = compRGBA[i * 4];
    compRGB[i * 3 + 1] = compRGBA[i * 4 + 1];
    compRGB[i * 3 + 2] = compRGBA[i * 4 + 2];
  }

  const buckets = new Map<number, { c: number; sr: number; sg: number; sb: number }>();
  let best: { c: number; sr: number; sg: number; sb: number } | null = null;
  for (let py = 1; py < rh - 1; py++) {
    for (let px = 1; px < rw - 1; px++) {
      const idx = py * rw + px;
      if (
        !strokeMask[idx] &&
        (strokeMask[idx - 1] ||
          strokeMask[idx + 1] ||
          strokeMask[idx - rw] ||
          strokeMask[idx + rw] ||
          (px >= 4 && strokeMask[idx - 4]) ||
          (px + 4 < rw && strokeMask[idx + 4]))
      ) {
        const r = compRGB[idx * 3];
        const g = compRGB[idx * 3 + 1];
        const b = compRGB[idx * 3 + 2];
        const q = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
        let e = buckets.get(q);
        if (!e) {
          e = { c: 0, sr: 0, sg: 0, sb: 0 };
          buckets.set(q, e);
        }
        e.c++;
        e.sr += r;
        e.sg += g;
        e.sb += b;
        if (!best || e.c > best.c) best = e;
      }
    }
  }
  const domBg: [number, number, number] = best
    ? [Math.round(best.sr / best.c), Math.round(best.sg / best.c), Math.round(best.sb / best.c)]
    : [255, 255, 255];

  const tCtx = targetLayer.canvas.getContext('2d', { willReadFrequently: true })!;
  const pImg = tCtx.getImageData(rx, ry, rw, rh);
  const paintD = pImg.data;

  if (clean.mode === 'fill') {
    for (let i = 0; i < n; i++) {
      if (strokeMask[i]) {
        paintD[i * 4] = domBg[0];
        paintD[i * 4 + 1] = domBg[1];
        paintD[i * 4 + 2] = domBg[2];
        paintD[i * 4 + 3] = 255;
      }
    }
    tCtx.putImageData(pImg, rx, ry);
    return { bounds: [rx, ry, rx2, ry2], status: 'ok', message: 'Тодруулсан хэсгийг дүүргэлээ.' };
  }

  let mask = new Uint8Array(strokeMask);
  if (clean.mode === 'inpaint') {
    const bgA = new Float32Array(compRGB);
    const bgKnown = new Uint8Array(n);
    const q: number[] = [];
    const inQ = new Uint8Array(n);
    for (let i = 0; i < n; i++) if (!strokeMask[i]) bgKnown[i] = 1;
    for (let py = 1; py < rh - 1; py++) {
      for (let px = 1; px < rw - 1; px++) {
        const idx = py * rw + px;
        if (!bgKnown[idx] && (bgKnown[idx - 1] || bgKnown[idx + 1] || bgKnown[idx - rw] || bgKnown[idx + rw])) {
          q.push(idx);
          inQ[idx] = 1;
        }
      }
    }
    for (let h = 0; h < q.length; h++) {
      const idx = q[h];
      const px = idx % rw;
      const py = (idx / rw) | 0;
      let sr = 0;
      let sg = 0;
      let sb = 0;
      let wt = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const nx = px + dx;
          const ny = py + dy;
          if (nx >= 0 && nx < rw && ny >= 0 && ny < rh) {
            const ni = ny * rw + nx;
            if (bgKnown[ni]) {
              const w = !dx || !dy ? 1 : 0.707;
              sr += bgA[ni * 3] * w;
              sg += bgA[ni * 3 + 1] * w;
              sb += bgA[ni * 3 + 2] * w;
              wt += w;
            } else if (!inQ[ni]) {
              inQ[ni] = 1;
              q.push(ni);
            }
          }
        }
      }
      if (wt > 0) {
        bgA[idx * 3] = sr / wt;
        bgA[idx * 3 + 1] = sg / wt;
        bgA[idx * 3 + 2] = sb / wt;
        bgKnown[idx] = 1;
      }
    }
    mask.fill(0);
    for (let i = 0; i < n; i++) {
      if (!strokeMask[i]) continue;
      const r = compRGB[i * 3];
      const g = compRGB[i * 3 + 1];
      const b = compRGB[i * 3 + 2];
      const rr = bgA[i * 3];
      const rg = bgA[i * 3 + 1];
      const rb = bgA[i * 3 + 2];
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      const rLum = 0.299 * rr + 0.587 * rg + 0.114 * rb;
      const dist = Math.hypot(r - rr, g - rg, b - rb);
      const sat = Math.max(r, g, b) - Math.min(r, g, b);
      const rSat = Math.max(rr, rg, rb) - Math.min(rr, rg, rb);
      const isTxt =
        clean.polarity === 'dark'
          ? rLum - lum > clean.tolerance * 0.75 || (dist > clean.tolerance * 1.05 && lum < rLum)
          : clean.polarity === 'light'
          ? lum - rLum > clean.tolerance * 0.75 || (dist > clean.tolerance * 1.05 && lum > rLum)
          : dist > clean.tolerance * 0.82 ||
            Math.abs(lum - rLum) > clean.tolerance * 0.7 ||
            (Math.abs(sat - rSat) > 25 && dist > 15);
      if (isTxt) mask[i] = 1;
    }
  }

  for (let p = 0; p < 2; p++) {
    const nx = new Uint8Array(mask);
    for (let py = 1; py < rh - 1; py++) {
      for (let px = 1; px < rw - 1; px++) {
        const idx = py * rw + px;
        if (
          (clean.mode === 'erase' || strokeMask[idx]) &&
          !mask[idx] &&
          (mask[idx - 1] || mask[idx + 1] || mask[idx - rw] || mask[idx + rw])
        ) {
          nx[idx] = 1;
        }
      }
    }
    mask = nx;
  }

  if (!mask.some(Boolean)) {
    return { bounds: [rx, ry, rx2, ry2], status: 'empty', message: 'Тодруулсан хэсэгт арилгах текст олдсонгүй.' };
  }

  const { outRGB, dist } = runFastInpaintRegion(compRGB, mask, rw, rh, domBg);
  for (let i = 0; i < n; i++) {
    if (mask[i]) {
      const bl = clean.feather > 0 && dist[i] === 1 ? 0.72 : 1;
      paintD[i * 4] = Math.round(compRGB[i * 3] * (1 - bl) + outRGB[i * 3] * bl);
      paintD[i * 4 + 1] = Math.round(compRGB[i * 3 + 1] * (1 - bl) + outRGB[i * 3 + 1] * bl);
      paintD[i * 4 + 2] = Math.round(compRGB[i * 3 + 2] * (1 - bl) + outRGB[i * 3 + 2] * bl);
      paintD[i * 4 + 3] = 255;
    }
  }
  tCtx.putImageData(pImg, rx, ry);
  return { bounds: [rx, ry, rx2, ry2], status: 'ok', message: 'Тодруулсан хэсгийг цэвэрлэлээ.' };
}

export function cleanShapeOnLayer(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  clean: SmartCleanSettings,
  docW: number,
  docH: number,
  baseCanvas: HTMLCanvasElement,
  paintLayers: PaintLayer[],
  targetLayer: PaintLayer
): { bounds: [number, number, number, number]; status: 'ok' | 'empty'; message: string } | null {
  const bx = Math.max(0, Math.floor(Math.min(x1, x2)));
  const by = Math.max(0, Math.floor(Math.min(y1, y2)));
  const bx2 = Math.min(docW, Math.ceil(Math.max(x1, x2)));
  const by2 = Math.min(docH, Math.ceil(Math.max(y1, y2)));
  const bw = bx2 - bx;
  const bh = by2 - by;
  if (bw < 4 || bh < 4) return null;

  const isInsideShape = (lx: number, ly: number) =>
    clean.shape === 'box' || ((lx - bw / 2) / (bw / 2)) ** 2 + ((ly - bh / 2) / (bh / 2)) ** 2 <= 1.0;

  const tCtx = targetLayer.canvas.getContext('2d', { willReadFrequently: true })!;
  if (clean.mode === 'fill') {
    const rs: number[] = [];
    const gs: number[] = [];
    const bs: number[] = [];
    const step = Math.max(1, Math.floor((bw + bh) / 50));
    for (let px = bx; px < bx2; px += step) {
      const t = sampleCompositePixelAt(px, by, docW, docH, baseCanvas, paintLayers);
      const bo = sampleCompositePixelAt(px, by2 - 1, docW, docH, baseCanvas, paintLayers);
      rs.push(t[0], bo[0]);
      gs.push(t[1], bo[1]);
      bs.push(t[2], bo[2]);
    }
    for (let py = by; py < by2; py += step) {
      const l = sampleCompositePixelAt(bx, py, docW, docH, baseCanvas, paintLayers);
      const r = sampleCompositePixelAt(bx2 - 1, py, docW, docH, baseCanvas, paintLayers);
      rs.push(l[0], r[0]);
      gs.push(l[1], r[1]);
      bs.push(l[2], r[2]);
    }
    const med = (a: number[]) => {
      a.sort((m, n) => m - n);
      return a[Math.floor(a.length / 2)];
    };
    const fillCol = `rgb(${med(rs)}, ${med(gs)}, ${med(bs)})`;
    const pad = clean.feather > 0 ? clean.feather * 2 + 4 : 0;
    tCtx.save();
    tCtx.fillStyle = fillCol;
    if (clean.feather > 0) {
      tCtx.shadowColor = fillCol;
      tCtx.shadowBlur = clean.feather;
    }
    for (let i = 0; i < (clean.feather > 0 ? 2 : 1); i++) {
      if (clean.shape === 'ellipse') {
        tCtx.beginPath();
        tCtx.ellipse(bx + bw / 2, by + bh / 2, bw / 2, bh / 2, 0, 0, Math.PI * 2);
        tCtx.fill();
      } else {
        tCtx.fillRect(bx, by, bw, bh);
      }
    }
    tCtx.restore();
    return {
      bounds: [Math.max(0, bx - pad), Math.max(0, by - pad), Math.min(docW, bx2 + pad), Math.min(docH, by2 + pad)],
      status: 'ok',
      message: 'Хэсгийг арын өнгөөр дүүргэлээ.',
    };
  }

  const pad = clean.mode === 'erase' ? 14 : 4;
  const rx = Math.max(0, bx - pad);
  const ry = Math.max(0, by - pad);
  const rx2 = Math.min(docW, bx2 + pad);
  const ry2 = Math.min(docH, by2 + pad);
  const rw = rx2 - rx;
  const rh = ry2 - ry;

  const compRGBA = sampleCompositeRegion(rx, ry, rw, rh, baseCanvas, paintLayers);
  const compRGB = new Uint8ClampedArray(rw * rh * 3);
  for (let i = 0; i < rw * rh; i++) {
    compRGB[i * 3] = compRGBA[i * 4];
    compRGB[i * 3 + 1] = compRGBA[i * 4 + 1];
    compRGB[i * 3 + 2] = compRGBA[i * 4 + 2];
  }

  const dominantColor = (coords: [number, number][]): [number, number, number] => {
    if (!coords.length) return [255, 255, 255];
    const buckets = new Map<number, { c: number; sr: number; sg: number; sb: number }>();
    for (const [px, py] of coords) {
      const k = (py * rw + px) * 3;
      const r = compRGB[k];
      const g = compRGB[k + 1];
      const b = compRGB[k + 2];
      const q = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
      let entry = buckets.get(q);
      if (!entry) {
        entry = { c: 0, sr: 0, sg: 0, sb: 0 };
        buckets.set(q, entry);
      }
      entry.c++;
      entry.sr += r;
      entry.sg += g;
      entry.sb += b;
    }
    let best: { c: number; sr: number; sg: number; sb: number } | null = null;
    for (const e of buckets.values()) if (!best || e.c > best.c) best = e;
    return best ? [best.sr / best.c, best.sg / best.c, best.sb / best.c] : [255, 255, 255];
  };

  const ringT = Math.min(3, Math.floor(rh / 4));
  const ringW = Math.min(3, Math.floor(rw / 4));
  const topC: [number, number][] = [];
  const botC: [number, number][] = [];
  const leftC: [number, number][] = [];
  const rightC: [number, number][] = [];
  for (let d = 0; d <= ringT; d++) {
    for (let px = 0; px < rw; px++) {
      topC.push([px, d]);
      botC.push([px, Math.max(0, rh - 1 - d)]);
    }
  }
  for (let d = 0; d <= ringW; d++) {
    for (let py = 0; py < rh; py++) {
      leftC.push([d, py]);
      rightC.push([Math.max(0, rw - 1 - d), py]);
    }
  }
  const cTop = dominantColor(topC);
  const cBot = dominantColor(botC);
  const cLeft = dominantColor(leftC);
  const cRight = dominantColor(rightC);
  const domBg = dominantColor([...topC, ...botC, ...leftC, ...rightC]);

  let mask = new Uint8Array(rw * rh);
  if (clean.mode === 'erase') {
    for (let py = 0; py < rh; py++) {
      for (let px = 0; px < rw; px++) {
        const lx = rx + px - bx;
        const ly = ry + py - by;
        if (lx >= 0 && ly >= 0 && lx < bw && ly < bh && isInsideShape(lx, ly)) mask[py * rw + px] = 1;
      }
    }
  } else {
    for (let py = 0; py < rh; py++) {
      const ty = py / Math.max(1, rh - 1);
      for (let px = 0; px < rw; px++) {
        const lx = rx + px - bx;
        const ly = ry + py - by;
        if (lx < 0 || ly < 0 || lx >= bw || ly >= bh || !isInsideShape(lx, ly)) continue;
        const tx = px / Math.max(1, rw - 1);
        const refR = (cTop[0] * (1 - ty) + cBot[0] * ty + cLeft[0] * (1 - tx) + cRight[0] * tx) / 2;
        const refG = (cTop[1] * (1 - ty) + cBot[1] * ty + cLeft[1] * (1 - tx) + cRight[1] * tx) / 2;
        const refB = (cTop[2] * (1 - ty) + cBot[2] * ty + cLeft[2] * (1 - tx) + cRight[2] * tx) / 2;
        const refLum = 0.299 * refR + 0.587 * refG + 0.114 * refB;
        const k = (py * rw + px) * 3;
        const r = compRGB[k];
        const g = compRGB[k + 1];
        const b = compRGB[k + 2];
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        const dist = Math.sqrt((r - refR) ** 2 + (g - refG) ** 2 + (b - refB) ** 2);
        const lumDiff = Math.abs(lum - refLum);
        const sat = Math.max(r, g, b) - Math.min(r, g, b);
        const refSat = Math.max(refR, refG, refB) - Math.min(refR, refG, refB);
        const isText =
          clean.polarity === 'dark'
            ? refLum - lum > clean.tolerance * 0.78
            : clean.polarity === 'light'
            ? lum - refLum > clean.tolerance * 0.78
            : dist > clean.tolerance * 0.85 || lumDiff > clean.tolerance * 0.72 || (Math.abs(sat - refSat) > 26 && dist > 16);
        if (isText) mask[py * rw + px] = 1;
      }
    }
  }

  for (let dilPass = 0; dilPass < (clean.mode === 'erase' ? 1 : 2); dilPass++) {
    const nextMask = new Uint8Array(mask);
    for (let py = 1; py < rh - 1; py++) {
      for (let px = 1; px < rw - 1; px++) {
        const idx = py * rw + px;
        if (
          !mask[idx] &&
          (mask[idx - 1] ||
            mask[idx + 1] ||
            mask[idx - rw] ||
            mask[idx + rw] ||
            mask[idx - rw - 1] ||
            mask[idx - rw + 1] ||
            mask[idx + rw - 1] ||
            mask[idx + rw + 1])
        ) {
          const lx = rx + px - bx;
          const ly = ry + py - by;
          if (lx >= 0 && ly >= 0 && lx < bw && ly < bh && isInsideShape(lx, ly)) nextMask[idx] = 1;
        }
      }
    }
    mask = nextMask;
  }

  if (!mask.some(Boolean)) {
    return { bounds: [rx, ry, rx2, ry2], status: 'empty', message: 'Арилгах текст олдсонгүй.' };
  }

  const { outRGB, dist } = runFastInpaintRegion(compRGB, mask, rw, rh, domBg);
  const pImg = tCtx.getImageData(rx, ry, rw, rh);
  for (let i = 0; i < rw * rh; i++) {
    if (mask[i]) {
      const bl = clean.feather > 0 && dist[i] === 1 ? 0.72 : 1;
      pImg.data[i * 4] = Math.round(compRGB[i * 3] * (1 - bl) + outRGB[i * 3] * bl);
      pImg.data[i * 4 + 1] = Math.round(compRGB[i * 3 + 1] * (1 - bl) + outRGB[i * 3 + 1] * bl);
      pImg.data[i * 4 + 2] = Math.round(compRGB[i * 3 + 2] * (1 - bl) + outRGB[i * 3 + 2] * bl);
      pImg.data[i * 4 + 3] = 255;
    }
  }
  tCtx.putImageData(pImg, rx, ry);
  return { bounds: [rx, ry, rx2, ry2], status: 'ok', message: 'Сонгосон хэсгийг цэвэрлэлээ.' };
}

export function floodFillOnLayer(
  sx: number,
  sy: number,
  tolValue: number,
  fillHex: string,
  docW: number,
  docH: number,
  baseCanvas: HTMLCanvasElement,
  paintLayers: PaintLayer[],
  targetLayer: PaintLayer
): [number, number, number, number] | null {
  const px0 = Math.round(sx);
  const py0 = Math.round(sy);
  if (px0 < 0 || py0 < 0 || px0 >= docW || py0 >= docH) return null;

  const tol = tolValue * 3;
  const [fr, fg, fb] = hexToRgb(fillHex);
  const rad = 550;
  const rx = Math.max(0, px0 - rad);
  const ry = Math.max(0, py0 - rad);
  const rx2 = Math.min(docW, px0 + rad);
  const ry2 = Math.min(docH, py0 + rad);
  const rw = rx2 - rx;
  const rh = ry2 - ry;

  const comp = sampleCompositeRegion(rx, ry, rw, rh, baseCanvas, paintLayers);
  const tCtx = targetLayer.canvas.getContext('2d', { willReadFrequently: true })!;
  const paintImg = tCtx.getImageData(rx, ry, rw, rh);
  const pData = paintImg.data;

  const startIdx = ((py0 - ry) * rw + (px0 - rx)) * 4;
  const sr = comp[startIdx];
  const sg = comp[startIdx + 1];
  const sb = comp[startIdx + 2];

  const visited = new Uint8Array(rw * rh);
  const queue: number[] = [px0 - rx, py0 - ry];
  visited[(py0 - ry) * rw + (px0 - rx)] = 1;

  let head = 0;
  let count = 0;
  let minX = px0;
  let minY = py0;
  let maxX = px0;
  let maxY = py0;

  while (head < queue.length && count < 280000) {
    const cx = queue[head++];
    const cy = queue[head++];
    const pos = cy * rw + cx;
    const idx = pos * 4;
    const r = comp[idx];
    const g = comp[idx + 1];
    const b = comp[idx + 2];
    if (Math.abs(r - sr) + Math.abs(g - sg) + Math.abs(b - sb) > tol) continue;

    pData[idx] = fr;
    pData[idx + 1] = fg;
    pData[idx + 2] = fb;
    pData[idx + 3] = 255;
    count++;

    const gx = rx + cx;
    const gy = ry + cy;
    if (gx < minX) minX = gx;
    if (gx > maxX) maxX = gx;
    if (gy < minY) minY = gy;
    if (gy > maxY) maxY = gy;

    if (cx > 0 && !visited[pos - 1]) {
      visited[pos - 1] = 1;
      queue.push(cx - 1, cy);
    }
    if (cx < rw - 1 && !visited[pos + 1]) {
      visited[pos + 1] = 1;
      queue.push(cx + 1, cy);
    }
    if (cy > 0 && !visited[pos - rw]) {
      visited[pos - rw] = 1;
      queue.push(cx, cy - 1);
    }
    if (cy < rh - 1 && !visited[pos + rw]) {
      visited[pos + rw] = 1;
      queue.push(cx, cy + 1);
    }
  }

  if (count > 0) {
    tCtx.putImageData(paintImg, rx, ry);
    return [minX, minY, maxX + 1, maxY + 1];
  }
  return null;
}

/**
 * Smart Alignment calculation when dragging objects
 */
export function computeSmartSnap(
  movingX: number,
  movingY: number,
  movingHalfW: number,
  movingHalfH: number,
  movingIds: Set<string>,
  docW: number,
  docH: number,
  texts: TextLayer[],
  logos: LogoLayer[],
  enabled: boolean
): { x: number; y: number; guides: AlignmentGuide[] } {
  if (!enabled) return { x: movingX, y: movingY, guides: [] };
  const threshold = 7;
  let bestDx = threshold + 1;
  let bestDy = threshold + 1;
  let snapX = movingX;
  let snapY = movingY;
  const guides: AlignmentGuide[] = [];

  const xTargets: { pos: number; from: number; to: number; kind: 'center' | 'edge' }[] = [
    { pos: docW / 2, from: 0, to: docH, kind: 'center' },
  ];
  const yTargets: { pos: number; from: number; to: number; kind: 'center' | 'edge' }[] = [];

  const allObjs: { id: string; x: number; y: number; hw: number; hh: number }[] = [
    ...texts.map((t) => ({ id: t.id, x: t.x, y: t.y, hw: t._halfW || 60, hh: t._halfH || 25 })),
    ...logos.map((l) => ({ id: l.id, x: l.x, y: l.y, hw: l._halfW || l.width / 2, hh: l._halfH || l.height / 2 })),
  ];

  for (const o of allObjs) {
    if (movingIds.has(o.id)) continue;
    xTargets.push({ pos: o.x, from: Math.min(o.y - o.hh, movingY - movingHalfH), to: Math.max(o.y + o.hh, movingY + movingHalfH), kind: 'center' });
    xTargets.push({ pos: o.x - o.hw, from: Math.min(o.y - o.hh, movingY - movingHalfH), to: Math.max(o.y + o.hh, movingY + movingHalfH), kind: 'edge' });
    xTargets.push({ pos: o.x + o.hw, from: Math.min(o.y - o.hh, movingY - movingHalfH), to: Math.max(o.y + o.hh, movingY + movingHalfH), kind: 'edge' });

    yTargets.push({ pos: o.y, from: Math.min(o.x - o.hw, movingX - movingHalfW), to: Math.max(o.x + o.hw, movingX + movingHalfW), kind: 'center' });
    yTargets.push({ pos: o.y - o.hh, from: Math.min(o.x - o.hw, movingX - movingHalfW), to: Math.max(o.x + o.hw, movingX + movingHalfW), kind: 'edge' });
    yTargets.push({ pos: o.y + o.hh, from: Math.min(o.x - o.hw, movingX - movingHalfW), to: Math.max(o.x + o.hw, movingX + movingHalfW), kind: 'edge' });
  }

  let matchedXGuide: AlignmentGuide | null = null;
  for (const xt of xTargets) {
    const offsets = [
      { d: xt.pos - movingX, anchor: movingX },
      { d: xt.pos - (movingX - movingHalfW), anchor: movingX - movingHalfW },
      { d: xt.pos - (movingX + movingHalfW), anchor: movingX + movingHalfW },
    ];
    for (const off of offsets) {
      if (Math.abs(off.d) < Math.abs(bestDx) && Math.abs(off.d) <= threshold) {
        bestDx = off.d;
        snapX = movingX + off.d;
        matchedXGuide = { axis: 'x', pos: xt.pos, from: xt.from, to: xt.to, kind: xt.kind };
      }
    }
  }

  let matchedYGuide: AlignmentGuide | null = null;
  for (const yt of yTargets) {
    const offsets = [
      { d: yt.pos - movingY, anchor: movingY },
      { d: yt.pos - (movingY - movingHalfH), anchor: movingY - movingHalfH },
      { d: yt.pos - (movingY + movingHalfH), anchor: movingY + movingHalfH },
    ];
    for (const off of offsets) {
      if (Math.abs(off.d) < Math.abs(bestDy) && Math.abs(off.d) <= threshold) {
        bestDy = off.d;
        snapY = movingY + off.d;
        matchedYGuide = { axis: 'y', pos: yt.pos, from: yt.from, to: yt.to, kind: yt.kind };
      }
    }
  }

  if (matchedXGuide) guides.push(matchedXGuide);
  if (matchedYGuide) guides.push(matchedYGuide);
  return { x: Math.round(snapX), y: Math.round(snapY), guides };
}

/**
 * Clean AI-detected speech bubble text and SFX/action text regions strictly inside their tight bounding boxes
 * without altering surrounding manga artwork or characters.
 */
export function cleanAiDetectedRegions(
  regions: AiDetectedRegion[],
  cropX: number,
  cropY: number,
  cropW: number,
  cropH: number,
  docW: number,
  docH: number,
  baseCanvas: HTMLCanvasElement,
  paintLayers: PaintLayer[],
  targetLayer: PaintLayer
): { cleanedCount: number; bounds: [number, number, number, number] | null } {
  let cleanedCount = 0;
  let minX = docW;
  let minY = docH;
  let maxX = 0;
  let maxY = 0;

  for (const region of regions) {
    const [yn, xn, yx, xx] = region.box_2d;
    const pad = region.hasOutline ? 4 : 3;
    const bx = Math.max(0, Math.floor(cropX + (xn / 1000) * cropW) - pad);
    const by = Math.max(0, Math.floor(cropY + (yn / 1000) * cropH) - pad);
    const bx2 = Math.min(docW, Math.ceil(cropX + (xx / 1000) * cropW) + pad);
    const by2 = Math.min(docH, Math.ceil(cropY + (yx / 1000) * cropH) + pad);
    if (bx2 - bx < 5 || by2 - by < 5) continue;

    const settings: SmartCleanSettings = {
      mode: 'inpaint',
      shape: 'box',
      polarity: region.hasOutline ? 'auto' : region.polarity,
      brushSize: 28,
      tolerance: region.hasOutline ? 24 : region.kind === 'sfx_text' ? 28 : 34,
      feather: 4,
    };

    const res = cleanShapeOnLayer(
      bx,
      by,
      bx2,
      by2,
      settings,
      docW,
      docH,
      baseCanvas,
      paintLayers,
      targetLayer
    );

    if (res && res.status === 'ok') {
      cleanedCount++;
      minX = Math.min(minX, res.bounds[0]);
      minY = Math.min(minY, res.bounds[1]);
      maxX = Math.max(maxX, res.bounds[2]);
      maxY = Math.max(maxY, res.bounds[3]);
    }
  }

  return {
    cleanedCount,
    bounds: cleanedCount > 0 && maxX > minX && maxY > minY ? [minX, minY, maxX, maxY] : null,
  };
}

