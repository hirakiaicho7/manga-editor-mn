import React, { useEffect, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { hexToRgb, rgbToHex } from '../utils/canvasEngine';

function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === rn) h = ((gn - bn) / d) % 6;
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const s = max === 0 ? 0 : d / max;
  return [h, s, max];
}

function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let rp = 0,
    gp = 0,
    bp = 0;
  if (h < 60) [rp, gp, bp] = [c, x, 0];
  else if (h < 120) [rp, gp, bp] = [x, c, 0];
  else if (h < 180) [rp, gp, bp] = [0, c, x];
  else if (h < 240) [rp, gp, bp] = [0, x, c];
  else if (h < 300) [rp, gp, bp] = [x, 0, c];
  else [rp, gp, bp] = [c, 0, x];
  return [Math.round((rp + m) * 255), Math.round((gp + m) * 255), Math.round((bp + m) * 255)];
}

interface ColorStudioProps {
  color: string;
  onChange: (hex: string) => void;
  recentColors: string[];
  onCommitRecent?: (hex: string) => void;
  compact?: boolean;
}

export const ColorStudio: React.FC<ColorStudioProps> = ({
  color,
  onChange,
  recentColors,
  onCommitRecent,
  compact = false,
}) => {
  const [hsv, setHsv] = useState<[number, number, number]>(() => {
    const [r, g, b] = hexToRgb(color || '#111111');
    return rgbToHsv(r, g, b);
  });
  const [hexDraft, setHexDraft] = useState(color.toUpperCase());
  const svCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const hueCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    setHexDraft(color.toUpperCase());
    const [r, g, b] = hexToRgb(color);
    const [nh, ns, nv] = rgbToHsv(r, g, b);
    setHsv((prev) => [ns === 0 && nv === 0 ? prev[0] : nh, ns, nv]);
  }, [color]);

  // Render SV Square
  useEffect(() => {
    const c = svCanvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const w = c.width;
    const h = c.height;
    const [hr, hg, hb] = hsvToRgb(hsv[0], 1, 1);
    ctx.fillStyle = `rgb(${hr},${hg},${hb})`;
    ctx.fillRect(0, 0, w, h);

    const whiteGrad = ctx.createLinearGradient(0, 0, w, 0);
    whiteGrad.addColorStop(0, 'rgba(255,255,255,1)');
    whiteGrad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = whiteGrad;
    ctx.fillRect(0, 0, w, h);

    const blackGrad = ctx.createLinearGradient(0, 0, 0, h);
    blackGrad.addColorStop(0, 'rgba(0,0,0,0)');
    blackGrad.addColorStop(1, 'rgba(0,0,0,1)');
    ctx.fillStyle = blackGrad;
    ctx.fillRect(0, 0, w, h);
  }, [hsv[0]]);

  // Render Hue Bar
  useEffect(() => {
    const c = hueCanvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const g = ctx.createLinearGradient(0, 0, c.width, 0);
    g.addColorStop(0, '#ff0000');
    g.addColorStop(1 / 6, '#ffff00');
    g.addColorStop(2 / 6, '#00ff00');
    g.addColorStop(3 / 6, '#00ffff');
    g.addColorStop(4 / 6, '#0000ff');
    g.addColorStop(5 / 6, '#ff00ff');
    g.addColorStop(1, '#ff0000');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, c.width, c.height);
  }, []);

  const updateFromHsv = (next: [number, number, number], commit = false) => {
    setHsv(next);
    const [r, g, b] = hsvToRgb(next[0], next[1], next[2]);
    const hex = rgbToHex(r, g, b);
    onChange(hex);
    if (commit && onCommitRecent) onCommitRecent(hex);
  };

  const handleSvPointer = (e: React.PointerEvent<HTMLDivElement>, commit = false) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const s = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const v = Math.max(0, Math.min(1, 1 - (e.clientY - rect.top) / rect.height));
    updateFromHsv([hsv[0], s, v], commit);
  };

  const handleHuePointer = (e: React.PointerEvent<HTMLDivElement>, commit = false) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const h = Math.max(0, Math.min(359.9, ((e.clientX - rect.left) / rect.width) * 360));
    updateFromHsv([h, hsv[1], hsv[2]], commit);
  };

  const commitHexInput = (val: string) => {
    setHexDraft(val.toUpperCase());
    const cleaned = val.trim();
    if (/^#[0-9a-fA-F]{6}$/.test(cleaned)) {
      onChange(cleaned.toLowerCase());
      onCommitRecent?.(cleaned.toLowerCase());
    }
  };

  const presetPalette = ['#ffffff', '#000000', '#e5e7eb', '#64748b', '#ef4444', '#f59e0b', '#14b866', '#3b82f6'];

  return (
    <div className="flex flex-col gap-2.5">
      {/* SV Square */}
      <div
        className={`relative w-full ${compact ? 'h-32' : 'h-40'} rounded-lg overflow-hidden border border-neutral-300 dark:border-neutral-700 cursor-crosshair touch-none`}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          handleSvPointer(e, false);
        }}
        onPointerMove={(e) => {
          if (e.buttons === 1) handleSvPointer(e, false);
        }}
        onPointerUp={(e) => handleSvPointer(e, true)}
      >
        <canvas ref={svCanvasRef} width={240} height={160} className="w-full h-full block" />
        <div
          className="absolute w-3.5 h-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.6)] pointer-events-none"
          style={{
            left: `${hsv[1] * 100}%`,
            top: `${(1 - hsv[2]) * 100}%`,
            backgroundColor: color,
          }}
        />
      </div>

      {/* Hue Slider */}
      <div
        className="relative w-full h-4 rounded-md overflow-hidden border border-neutral-300 dark:border-neutral-700 cursor-ew-resize touch-none"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          handleHuePointer(e, false);
        }}
        onPointerMove={(e) => {
          if (e.buttons === 1) handleHuePointer(e, false);
        }}
        onPointerUp={(e) => handleHuePointer(e, true)}
      >
        <canvas ref={hueCanvasRef} width={240} height={16} className="w-full h-full block" />
        <div
          className="absolute top-0 bottom-0 w-2 -translate-x-1/2 border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.6)] pointer-events-none"
          style={{ left: `${(hsv[0] / 360) * 100}%` }}
        />
      </div>

      {/* Active Color + HEX Input */}
      <div className="flex items-center gap-2">
        <div
          className="w-8 h-8 rounded-md border border-neutral-300 dark:border-neutral-700 shrink-0"
          style={{ backgroundColor: color }}
        />
        <div className="flex-1 flex items-center gap-1.5 bg-neutral-100 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-md px-2 h-8">
          <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">HEX</span>
          <input
            type="text"
            value={hexDraft}
            maxLength={7}
            onChange={(e) => commitHexInput(e.target.value)}
            onBlur={() => setHexDraft(color.toUpperCase())}
            className="w-full bg-transparent text-xs font-mono-num text-neutral-900 dark:text-neutral-100 focus:outline-none uppercase"
          />
        </div>
        <button
          type="button"
          onClick={() => onCommitRecent?.(color)}
          title="Өнгийг палитрт хадгалах"
          className="h-8 px-2.5 rounded-md border border-neutral-300 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 hover:border-emerald-500 text-neutral-700 dark:text-neutral-200 flex items-center justify-center shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Quick Base Swatches */}
      <div className="flex flex-wrap gap-1.5">
        {presetPalette.map((sw) => (
          <button
            key={sw}
            type="button"
            onClick={() => {
              onChange(sw);
              onCommitRecent?.(sw);
            }}
            className={`w-6 h-6 rounded-md border transition-transform ${
              color.toLowerCase() === sw.toLowerCase()
                ? 'border-emerald-500 scale-110 ring-1 ring-emerald-500'
                : 'border-neutral-300 dark:border-neutral-700'
            }`}
            style={{ backgroundColor: sw }}
            title={sw}
          />
        ))}
      </div>

      {/* Recent / Saved Colors */}
      {recentColors.length > 0 && (
        <div className="flex flex-col gap-1 pt-1 border-t border-neutral-200 dark:border-neutral-800">
          <span className="text-[11px] text-neutral-500 dark:text-neutral-400">Өмнө ашигласан өнгөнүүд</span>
          <div className="flex flex-wrap gap-1.5">
            {recentColors.map((rc) => (
              <button
                key={rc}
                type="button"
                onClick={() => onChange(rc)}
                className={`w-5 h-5 rounded border ${
                  color.toLowerCase() === rc.toLowerCase()
                    ? 'border-emerald-500 ring-1 ring-emerald-500'
                    : 'border-neutral-300 dark:border-neutral-700'
                }`}
                style={{ backgroundColor: rc }}
                title={rc.toUpperCase()}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
