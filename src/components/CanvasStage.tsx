import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlignmentGuide,
  BrushSettings,
  LogoLayer,
  PaintLayer,
  RawPageItem,
  SelectionTarget,
  SmartCleanSettings,
  TextLayer,
  ToolId,
} from '../types/editor';
import {
  applyBrushSegment,
  cleanShapeOnLayer,
  cleanStrokeOnLayer,
  computeSmartSnap,
  computeTextBounds,
  detectSpeechBubble,
  floodFillOnLayer,
  renderCompositeDocument,
  rgbToHex,
  sampleCompositePixelAt,
} from '../utils/canvasEngine';

interface CanvasStageProps {
  docW: number;
  docH: number;
  zoom: number;
  onZoomChange: (nextZoom: number) => void;
  activeTool: ToolId;
  onSelectTool: (t: ToolId) => void;
  baseCanvasRef: React.MutableRefObject<HTMLCanvasElement | null>;
  paintLayers: PaintLayer[];
  activePaintLayerId: string | null;
  texts: TextLayer[];
  logos: LogoLayer[];
  rawPages: RawPageItem[];
  customSplitYs: number[];
  selection: SelectionTarget | null;
  onSelectObjects: (sel: SelectionTarget | null) => void;
  onUpdateTextsDirect: (updater: (prev: TextLayer[]) => TextLayer[], historyLabel?: string) => void;
  onUpdateLogosDirect: (updater: (prev: LogoLayer[]) => LogoLayer[], historyLabel?: string) => void;
  onCreateTextAt: (x: number, y: number, boxW?: number, autoFitH?: number) => void;
  onOpenQuickText: () => void;
  onCloseQuickText?: () => void;
  onOpenLogoUpload: () => void;
  onCanvasTapDismiss?: () => void;
  brush: BrushSettings;
  clean: SmartCleanSettings;
  onPickColor: (hex: string) => void;
  onCleanFeedback: (msg: { kind: 'ok' | 'empty'; text: string }) => void;
  onCommitPaintHistory: (
    layerId: string,
    bx: number,
    by: number,
    before: ImageData,
    after: ImageData,
    label: string
  ) => void;
  beforeAfterMode: 'off' | 'split' | 'peek';
  showPageMarkers: boolean;
  showGridSnap: boolean;
  autoBubbleDetect: boolean;
  workspaceRef: React.RefObject<HTMLDivElement | null>;
  stageRefExternal?: React.MutableRefObject<HTMLDivElement | null>;
  onPageScrollUpdate: () => void;
  renderVersion: number;
  onDropFiles: (files: File[]) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  clonePickMode?: boolean;
  onClonePicked?: () => void;
}

type DragState =
  | { kind: 'pan'; sx: number; sy: number; sl: number; st: number }
  | { kind: 'marquee'; sx: number; sy: number; cx: number; cy: number }
  | {
      kind: 'move';
      sx: number;
      sy: number;
      moved: boolean;
      tappedId?: string;
      initItems: { id: string; x: number; y: number }[];
      primaryKind: 'text' | 'logo';
    }
  | { kind: 'rotate'; cx: number; cy: number; id: string; primaryKind: 'text' | 'logo' }
  | {
      kind: 'scaleCorner';
      id: string;
      primaryKind: 'text' | 'logo';
      dist0: number;
      ux: number;
      uy: number;
      fontSize0: number;
      boxW0: number;
      w0: number;
      h0: number;
    }
  | { kind: 'stretchX'; id: string; scaleX0: number; scaleY0: number; lx0: number }
  | { kind: 'stretchY'; id: string; scaleX0: number; scaleY0: number; ly0: number }
  | { kind: 'boxWidth'; id: string }
  | { kind: 'newText'; sx: number; sy: number; cx: number; cy: number }
  | {
      kind: 'paint';
      layerId: string;
      snapshot: HTMLCanvasElement;
      minX: number;
      minY: number;
      maxX: number;
      maxY: number;
      lastX: number;
      lastY: number;
      smoothX: number;
      smoothY: number;
      prevMidX: number;
      prevMidY: number;
      lastTime: number;
      lastSize: number;
    }
  | { kind: 'cleanStroke'; layerId: string; snapshot: HTMLCanvasElement; pts: [number, number][] }
  | { kind: 'cleanShape'; layerId: string; snapshot: HTMLCanvasElement; sx: number; sy: number; cx: number; cy: number };

export const CanvasStage: React.FC<CanvasStageProps> = ({
  docW,
  docH,
  zoom,
  onZoomChange,
  activeTool,
  onSelectTool,
  baseCanvasRef,
  paintLayers,
  activePaintLayerId,
  texts,
  logos,
  rawPages,
  customSplitYs,
  selection,
  onSelectObjects,
  onUpdateTextsDirect,
  onUpdateLogosDirect,
  onCreateTextAt,
  onOpenQuickText,
  onCloseQuickText,
  onOpenLogoUpload,
  onCanvasTapDismiss,
  brush,
  clean,
  onPickColor,
  onCleanFeedback,
  onCommitPaintHistory,
  beforeAfterMode,
  showPageMarkers,
  showGridSnap,
  autoBubbleDetect,
  workspaceRef,
  stageRefExternal,
  onPageScrollUpdate,
  renderVersion,
  onDropFiles,
  onUndo,
  onRedo,
  clonePickMode = false,
  onClonePicked,
}) => {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const compCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const uiCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const [drag, setDrag] = useState<DragState | null>(null);
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [hoverDoc, setHoverDoc] = useState<{ x: number; y: number } | null>(null);
  const [guides, setGuides] = useState<AlignmentGuide[]>([]);
  const [cloneSrc, setCloneSrc] = useState<{ x: number; y: number } | null>(null);
  const [cloneOffset, setCloneOffset] = useState<{ dx: number; dy: number } | null>(null);
  const [splitPct, setSplitPct] = useState(50);
  const [dragOver, setDragOver] = useState(false);

  // Refs for live mutation during drag without spamming history
  const textsRef = useRef(texts);
  textsRef.current = texts;
  const logosRef = useRef(logos);
  logosRef.current = logos;
  const paintLayersRef = useRef(paintLayers);
  paintLayersRef.current = paintLayers;
  const dragRef = useRef<DragState | null>(null);
  dragRef.current = drag;
  const dragObjBeforeRef = useRef<{ texts: TextLayer[]; logos: LogoLayer[] } | null>(null);
  const lastTouchTapRef = useRef<{ time: number; x: number; y: number }>({ time: 0, x: 0, y: 0 });
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const onUndoRef = useRef(onUndo);
  onUndoRef.current = onUndo;
  const onRedoRef = useRef(onRedo);
  onRedoRef.current = onRedo;

  const isCoarsePointer =
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(pointer: coarse)').matches
      : false;
  const hitR = isCoarsePointer ? 22 : 14;

  // Keep external ref synced
  const setStageRef = useCallback(
    (el: HTMLDivElement | null) => {
      stageRef.current = el;
      if (stageRefExternal) stageRefExternal.current = el;
    },
    [stageRefExternal]
  );

  // Spacebar pan
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        setSpaceHeld(true);
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space') setSpaceHeld(false);
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  // Composite rendering
  const redrawComposite = useCallback(() => {
    const base = baseCanvasRef.current;
    const comp = compCanvasRef.current;
    if (!base || !comp) return;
    if (comp.width !== docW || comp.height !== docH) {
      comp.width = docW;
      comp.height = docH;
    }
    const ctx = comp.getContext('2d')!;
    if (beforeAfterMode === 'peek') {
      renderCompositeDocument(ctx, docW, docH, base, paintLayersRef.current, textsRef.current, logosRef.current, true);
      return;
    }
    if (beforeAfterMode === 'split') {
      renderCompositeDocument(ctx, docW, docH, base, paintLayersRef.current, textsRef.current, logosRef.current, false);
      const splitX = Math.round((docW * splitPct) / 100);
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, splitX, docH);
      ctx.clip();
      ctx.drawImage(base, 0, 0);
      ctx.restore();
      return;
    }
    renderCompositeDocument(ctx, docW, docH, base, paintLayersRef.current, textsRef.current, logosRef.current, false);
  }, [docW, docH, baseCanvasRef, beforeAfterMode, splitPct]);

  useEffect(() => {
    redrawComposite();
  }, [redrawComposite, paintLayers, texts, logos, renderVersion]);

  const toDocCoords = (clientX: number, clientY: number) => {
    const r = stageRef.current!.getBoundingClientRect();
    return {
      x: (clientX - r.left) / zoom,
      y: (clientY - r.top) / zoom,
    };
  };

  const toLocal = (obj: { x: number; y: number; rotation?: number }, x: number, y: number) => {
    const dx = x - obj.x;
    const dy = y - obj.y;
    const rad = (-(obj.rotation || 0) * Math.PI) / 180;
    return {
      lx: dx * Math.cos(rad) - dy * Math.sin(rad),
      ly: dx * Math.sin(rad) + dy * Math.cos(rad),
    };
  };

  const localToDoc = useCallback((obj: { x: number; y: number; rotation?: number }, lx: number, ly: number) => {
    const rad = ((obj.rotation || 0) * Math.PI) / 180;
    return {
      x: obj.x + lx * Math.cos(rad) - ly * Math.sin(rad),
      y: obj.y + lx * Math.sin(rad) + ly * Math.cos(rad),
    };
  }, []);

  // Smart handle placement: Box-width (↔) flips if near right edge; Move (✥) sits outside box so phone fingers never block text
  const getHandleLayout = useCallback(
    (obj: { x: number; y: number; rotation?: number; _halfW?: number; _halfH?: number }) => {
      const hw = obj._halfW || 60;
      const hh = obj._halfH || 25;
      const m = 14 / zoom;
      const vis = (lx: number, ly: number) => {
        const d = localToDoc(obj, lx, ly);
        return d.x >= m && d.x <= docW - m && d.y >= m && d.y <= docH - m;
      };
      const wOff = 40 / zoom;
      let widthSide = 1;
      if (!vis(hw + wOff, 0) && vis(-(hw + wOff), 0)) widthSide = -1;
      const mo = 32 / zoom;
      const cands: [number, number][] = [
        [-hw - mo, 0],
        [-hw - mo * 0.7, -hh - mo * 0.7],
        [-hw - mo * 0.7, hh + mo * 0.7],
        [0, hh + mo * 1.15],
        [hw + mo * 0.7, hh + mo * 0.9],
      ];
      const mv =
        cands.find((c) => vis(c[0], c[1]) && !(widthSide === -1 && c[0] === -hw - mo && c[1] === 0)) || cands[0];
      return { widthSide, widthX: widthSide * (hw + wOff), move: { lx: mv[0], ly: mv[1] } };
    },
    [docW, docH, zoom, localToDoc]
  );

  // UI Overlay rendering (Handles, Marquee, Guides, Page Dividers, Brush Cursor)
  const redrawUI = useCallback(() => {
    const ui = uiCanvasRef.current;
    if (!ui) return;
    if (ui.width !== docW || ui.height !== docH) {
      ui.width = docW;
      ui.height = docH;
    }
    const ctx = ui.getContext('2d')!;
    ctx.clearRect(0, 0, docW, docH);

    // 1. Page Markers on Stitch Strip
    if (showPageMarkers) {
      const markerYs = new Set<number>();
      rawPages.forEach((p, idx) => {
        if (idx > 0 && p.yStart > 0 && p.yStart < docH) markerYs.add(p.yStart);
      });
      customSplitYs.forEach((y) => {
        if (y > 10 && y < docH - 10) markerYs.add(Math.round(y));
      });
      const sorted = Array.from(markerYs).sort((a, b) => a - b);
      sorted.forEach((y, i) => {
        ctx.save();
        ctx.strokeStyle = 'rgba(20, 184, 102, 0.75)';
        ctx.lineWidth = Math.max(1.5, 2 / zoom);
        ctx.setLineDash([8 / zoom, 6 / zoom]);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(docW, y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = '#065f46';
        const lbl = `Хуудас ${i + 2}`;
        const fs = Math.max(10, 11 / zoom);
        ctx.font = `600 ${fs}px 'Plus Jakarta Sans', sans-serif`;
        const tw = ctx.measureText(lbl).width + 14 / zoom;
        const bh = 20 / zoom;
        ctx.fillRect(10 / zoom, y - bh / 2, tw, bh);
        ctx.fillStyle = '#ecfdf5';
        ctx.textBaseline = 'middle';
        ctx.fillText(lbl, 17 / zoom, y);
        ctx.restore();
      });
    }

    // 2. Smart Alignment Guides
    for (const g of guides) {
      ctx.save();
      ctx.strokeStyle = g.kind === 'center' ? '#14b866' : '#f59e0b';
      ctx.lineWidth = Math.max(1, 1.5 / zoom);
      ctx.setLineDash(g.kind === 'center' ? [] : [4 / zoom, 3 / zoom]);
      ctx.beginPath();
      if (g.axis === 'x') {
        ctx.moveTo(g.pos, g.from);
        ctx.lineTo(g.pos, g.to);
      } else {
        ctx.moveTo(g.from, g.pos);
        ctx.lineTo(g.to, g.pos);
      }
      ctx.stroke();
      ctx.restore();
    }

    // 3. Selection Frames (supports single full handles + multi-select boxes)
    if (selection && ['select', 'text', 'logo'].includes(activeTool)) {
      const selectedItems =
        selection.kind === 'text'
          ? textsRef.current.filter((t) => selection.ids.includes(t.id))
          : logosRef.current.filter((l) => selection.ids.includes(l.id));

      selectedItems.forEach((item, idx) => {
        if ('text' in item) computeTextBounds(item);
        const hw = item._halfW || 60;
        const hh = item._halfH || 25;
        const isPrimary = idx === 0 && selectedItems.length === 1;
        const isLogo = selection.kind === 'logo';
        const hs = (isCoarsePointer ? 7.5 : 5.5) / zoom;

        ctx.save();
        ctx.translate(item.x, item.y);
        ctx.rotate(((item.rotation || 0) * Math.PI) / 180);
        ctx.strokeStyle = isLogo ? '#fbbf24' : '#14b866';
        ctx.lineWidth = 1.8 / zoom;
        ctx.setLineDash([5 / zoom, 4 / zoom]);
        ctx.strokeRect(-hw, -hh, hw * 2, hh * 2);
        ctx.setLineDash([]);

        if (isPrimary) {
          const LAY = getHandleLayout(item);

          // 1. Top Rotate Handle (Teal #2dd4bf for text, Amber for logo)
          const rotOff = 26 / zoom;
          ctx.strokeStyle = isLogo ? '#fbbf24' : '#2dd4bf';
          ctx.beginPath();
          ctx.moveTo(0, -hh);
          ctx.lineTo(0, -hh - rotOff);
          ctx.stroke();
          ctx.fillStyle = isLogo ? '#fbbf24' : '#2dd4bf';
          ctx.beginPath();
          ctx.arc(0, -hh - rotOff, 6.5 / zoom, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.stroke();

          if (!isLogo) {
            // 2. Box-Width Wrap Pill (↔) on smart side
            ctx.strokeStyle = '#14b866';
            ctx.beginPath();
            ctx.moveTo(LAY.widthSide * hw, 0);
            ctx.lineTo(LAY.widthX - LAY.widthSide * hs * 2.1, 0);
            ctx.stroke();
            ctx.fillStyle = '#ecfdf5';
            ctx.strokeStyle = '#14b866';
            ctx.fillRect(LAY.widthX - hs * 2.1, -hs * 1.6, hs * 4.2, hs * 3.2);
            ctx.strokeRect(LAY.widthX - hs * 2.1, -hs * 1.6, hs * 4.2, hs * 3.2);
            ctx.fillStyle = '#064e3b';
            ctx.font = `bold ${hs * 2.5}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('↔', LAY.widthX, 0);

            // 3. Right Stretch-X Amber Pill + Bottom Stretch-Y Amber Pill
            ctx.fillStyle = '#fbbf24';
            ctx.strokeStyle = '#080d0b';
            ctx.lineWidth = 1.4 / zoom;
            ctx.fillRect(hw - hs, -hs * 1.4, hs * 2, hs * 2.8);
            ctx.strokeRect(hw - hs, -hs * 1.4, hs * 2, hs * 2.8);
            ctx.fillRect(-hs * 1.4, hh - hs, hs * 2.8, hs * 2);
            ctx.strokeRect(-hs * 1.4, hh - hs, hs * 2.8, hs * 2);

            // 4. All 4 Corner Proportional Size Handles (Font Size + Box Width 1:1)
            const cornerR = (isCoarsePointer ? 6.2 : 4.8) / zoom;
            [
              [-hw, -hh],
              [hw, -hh],
              [-hw, hh],
              [hw, hh],
            ].forEach(([cx, cy]) => {
              ctx.fillStyle = '#14b866';
              ctx.strokeStyle = '#ffffff';
              ctx.lineWidth = 1.6 / zoom;
              ctx.beginPath();
              ctx.arc(cx, cy, cornerR, 0, Math.PI * 2);
              ctx.fill();
              ctx.stroke();
            });
          } else {
            // Logo: 4 Proportional Corner Handles
            ctx.fillStyle = '#ffffff';
            ctx.strokeStyle = '#fbbf24';
            [
              [-hw, -hh],
              [hw, -hh],
              [-hw, hh],
              [hw, hh],
            ].forEach(([cx, cy]) => {
              ctx.fillRect(cx - hs, cy - hs, hs * 2, hs * 2);
              ctx.strokeRect(cx - hs, cy - hs, hs * 2, hs * 2);
            });
          }

          // 5. Edge 4-Way Move Handle (✥) — crucial on phones so fingers don't cover text!
          const mx = LAY.move.lx;
          const my = LAY.move.ly;
          const mr = hs * 2.25;
          ctx.strokeStyle = isLogo ? '#fbbf24' : '#2dd4bf';
          ctx.lineWidth = 1.4 / zoom;
          ctx.beginPath();
          const ax = Math.max(-hw, Math.min(hw, mx));
          const ay = Math.max(-hh, Math.min(hh, my));
          ctx.moveTo(ax, ay);
          ctx.lineTo(mx, my);
          ctx.stroke();

          ctx.fillStyle = 'rgba(8, 13, 11, 0.92)';
          ctx.lineWidth = 2 / zoom;
          ctx.beginPath();
          ctx.arc(mx, my, mr, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#ffffff';
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.7 / zoom;
          const a = mr * 0.62;
          const h = mr * 0.26;
          ctx.beginPath();
          ctx.moveTo(mx - a, my);
          ctx.lineTo(mx + a, my);
          ctx.moveTo(mx, my - a);
          ctx.lineTo(mx, my + a);
          ctx.stroke();
          [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
          ].forEach(([dx, dy]) => {
            ctx.beginPath();
            ctx.moveTo(mx + dx * a, my + dy * a);
            ctx.lineTo(mx + dx * (a - h * 1.4) - dy * h, my + dy * (a - h * 1.4) + dx * h);
            ctx.lineTo(mx + dx * (a - h * 1.4) + dy * h, my + dy * (a - h * 1.4) - dx * h);
            ctx.closePath();
            ctx.fill();
          });
        }
        ctx.restore();

        // Live Resize / Stretch / Rotate HUD Badge
        if (
          isPrimary &&
          drag &&
          ['scaleCorner', 'stretchX', 'stretchY', 'boxWidth', 'rotate'].includes(drag.kind) &&
          'id' in drag &&
          drag.id === item.id
        ) {
          let hudText = '';
          if (drag.kind === 'scaleCorner') {
            hudText =
              'fontSize' in item
                ? `${item.fontSize}px · Харьцаа 1:1`
                : `${Math.round((item as LogoLayer).width)} × ${Math.round((item as LogoLayer).height)}`;
          } else if ((drag.kind === 'stretchX' || drag.kind === 'stretchY') && 'scaleX' in item) {
            hudText = `${Math.round((item.scaleX || 1) * 100)}% × ${Math.round((item.scaleY || 1) * 100)}%`;
          } else if (drag.kind === 'boxWidth' && 'boxWidth' in item) {
            hudText = `Өргөн: ${Math.round(item.boxWidth)}px`;
          } else if (drag.kind === 'rotate') {
            hudText = `${Math.round(item.rotation || 0)}°`;
          }
          if (hudText) {
            ctx.save();
            const hudFs = Math.max(10, 11.5 / zoom);
            ctx.font = `600 ${hudFs}px 'Plus Jakarta Sans', sans-serif`;
            const padX = 8 / zoom;
            const bw = ctx.measureText(hudText).width + padX * 2;
            const bh = 22 / zoom;
            const hy = Math.max(bh / 2 + 4 / zoom, item.y - hh - 48 / zoom);
            const hx = Math.max(bw / 2 + 4 / zoom, Math.min(docW - bw / 2 - 4 / zoom, item.x));
            ctx.fillStyle = 'rgba(8, 13, 11, 0.92)';
            ctx.strokeStyle = '#14b866';
            ctx.lineWidth = 1.2 / zoom;
            ctx.beginPath();
            ctx.roundRect(hx - bw / 2, hy - bh / 2, bw, bh, 6 / zoom);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = '#ecfdf5';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(hudText, hx, hy);
            ctx.restore();
          }
        }
      });
    }

    // 4. Drag previews (marquee / newText / cleanShape / cleanStroke)
    if (drag?.kind === 'marquee' || drag?.kind === 'newText' || drag?.kind === 'cleanShape') {
      const rx = Math.min(drag.sx, drag.cx);
      const ry = Math.min(drag.sy, drag.cy);
      const rw = Math.abs(drag.cx - drag.sx);
      const rh = Math.abs(drag.cy - drag.sy);
      ctx.save();
      ctx.strokeStyle = drag.kind === 'marquee' ? '#3b82f6' : '#14b866';
      ctx.fillStyle = drag.kind === 'marquee' ? 'rgba(59,130,246,0.12)' : 'rgba(20,184,102,0.14)';
      ctx.lineWidth = 1.75 / zoom;
      ctx.setLineDash([5 / zoom, 4 / zoom]);
      if (drag.kind === 'cleanShape' && clean.shape === 'ellipse') {
        ctx.beginPath();
        ctx.ellipse(rx + rw / 2, ry + rh / 2, rw / 2, rh / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.fillRect(rx, ry, rw, rh);
        ctx.strokeRect(rx, ry, rw, rh);
      }
      ctx.restore();
    }

    if (drag?.kind === 'cleanStroke' && drag.pts.length) {
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = 'rgba(45, 212, 191, 0.42)';
      ctx.lineWidth = clean.brushSize;
      ctx.beginPath();
      drag.pts.forEach(([px, py], i) => (i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)));
      if (drag.pts.length === 1) ctx.lineTo(drag.pts[0][0] + 0.1, drag.pts[0][1]);
      ctx.stroke();
      ctx.restore();
    }

    // 5. Clone Source Crosshair
    if (activeTool === 'clone' && cloneSrc) {
      const r = 7 / zoom;
      ctx.save();
      ctx.strokeStyle = '#14b866';
      ctx.lineWidth = 2 / zoom;
      ctx.beginPath();
      ctx.arc(cloneSrc.x, cloneSrc.y, r, 0, Math.PI * 2);
      ctx.moveTo(cloneSrc.x - r * 1.4, cloneSrc.y);
      ctx.lineTo(cloneSrc.x + r * 1.4, cloneSrc.y);
      ctx.moveTo(cloneSrc.x, cloneSrc.y - r * 1.4);
      ctx.lineTo(cloneSrc.x, cloneSrc.y + r * 1.4);
      ctx.stroke();
      ctx.restore();
    }

    // 6. Brush / Cleaner Cursor Preview Ring
    if (
      hoverDoc &&
      (['brush', 'eraser', 'clone'].includes(activeTool) ||
        (activeTool === 'bubble' && clean.shape === 'brush'))
    ) {
      const sz = activeTool === 'bubble' ? clean.brushSize : brush.size;
      ctx.save();
      ctx.strokeStyle =
        activeTool === 'eraser' ? '#f43f5e' : activeTool === 'bubble' ? '#2dd4bf' : '#14b866';
      ctx.lineWidth = 1.5 / zoom;
      ctx.beginPath();
      ctx.arc(hoverDoc.x, hoverDoc.y, sz / 2, 0, Math.PI * 2);
      ctx.stroke();

      if (activeTool === 'brush' && brush.hardness < 95) {
        ctx.setLineDash([3 / zoom, 3 / zoom]);
        ctx.strokeStyle = 'rgba(20, 184, 102, 0.55)';
        ctx.beginPath();
        ctx.arc(hoverDoc.x, hoverDoc.y, (sz / 2) * (brush.hardness / 100), 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }
  }, [
    docW,
    docH,
    zoom,
    showPageMarkers,
    rawPages,
    customSplitYs,
    guides,
    selection,
    activeTool,
    drag,
    clean,
    cloneSrc,
    hoverDoc,
    brush,
    isCoarsePointer,
    getHandleLayout,
  ]);

  useEffect(() => {
    redrawUI();
  }, [redrawUI, texts, logos, renderVersion]);

  const hitTestItem = (obj: TextLayer | LogoLayer, x: number, y: number) => {
    if (!obj.visible || obj.locked) return false;
    if ('text' in obj) computeTextBounds(obj);
    const { lx, ly } = toLocal(obj, x, y);
    const hw = obj._halfW || 60;
    const hh = obj._halfH || 25;
    const pad = isCoarsePointer ? 14 / zoom : 10 / zoom;
    return Math.abs(lx) <= hw + pad && Math.abs(ly) <= hh + pad;
  };

  const hitTestAny = (x: number, y: number): { kind: 'text' | 'logo'; item: TextLayer | LogoLayer } | null => {
    for (let i = logosRef.current.length - 1; i >= 0; i--) {
      if (logosRef.current[i].aboveText && hitTestItem(logosRef.current[i], x, y)) {
        return { kind: 'logo', item: logosRef.current[i] };
      }
    }
    for (let i = textsRef.current.length - 1; i >= 0; i--) {
      if (hitTestItem(textsRef.current[i], x, y)) {
        return { kind: 'text', item: textsRef.current[i] };
      }
    }
    for (let i = logosRef.current.length - 1; i >= 0; i--) {
      if (!logosRef.current[i].aboveText && hitTestItem(logosRef.current[i], x, y)) {
        return { kind: 'logo', item: logosRef.current[i] };
      }
    }
    return null;
  };

  const getActivePaintLayer = (): PaintLayer | null => {
    return (
      paintLayers.find((l) => l.id === activePaintLayerId && !l.locked) ||
      paintLayers.find((l) => !l.locked) ||
      null
    );
  };

  const snapshotCanvas = (src: HTMLCanvasElement): HTMLCanvasElement => {
    const c = document.createElement('canvas');
    c.width = src.width;
    c.height = src.height;
    c.getContext('2d')!.drawImage(src, 0, 0);
    return c;
  };

  // Ctrl+Wheel zoom centered at cursor
  useEffect(() => {
    const ws = workspaceRef.current;
    if (!ws) return;
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const st = stageRef.current;
        const factor = Math.exp(-e.deltaY * (Math.abs(e.deltaY) < 30 ? 0.01 : 0.0015));
        const nextZ = Math.min(6, Math.max(0.15, zoomRef.current * factor));
        if (st) {
          const r0 = st.getBoundingClientRect();
          const docX = (e.clientX - r0.left) / zoomRef.current;
          const docY = (e.clientY - r0.top) / zoomRef.current;
          onZoomChange(nextZ);
          requestAnimationFrame(() => {
            const r1 = st.getBoundingClientRect();
            ws.scrollLeft += r1.left + docX * nextZ - e.clientX;
            ws.scrollTop += r1.top + docY * nextZ - e.clientY;
          });
        } else {
          onZoomChange(nextZ);
        }
      }
    };
    ws.addEventListener('wheel', onWheel, { passive: false });
    return () => ws.removeEventListener('wheel', onWheel);
  }, [workspaceRef, onZoomChange]);

  // Mobile Two-Finger Pinch-Zoom + Two-Finger Pan + 2-Finger Undo / 3-Finger Redo + Outside-Stage 1-Finger Pan
  useEffect(() => {
    const ws = workspaceRef.current;
    if (!ws) return;
    const ptrs = new Map<number, { x: number; y: number; sx: number; sy: number }>();
    let gesturing = false;
    let last: { cx: number; cy: number; d: number } | null = null;
    let raf = 0;
    let pend: { cx: number; cy: number; d: number } | null = null;
    let maxFingers = 0;
    let gestureStartTime = 0;
    let maxFingerMove = 0;

    const getInfo = () => {
      const a = Array.from(ptrs.values());
      if (a.length >= 2) {
        return {
          cx: (a[0].x + a[1].x) / 2,
          cy: (a[0].y + a[1].y) / 2,
          d: Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y) || 1,
        };
      }
      return { cx: a[0].x, cy: a[0].y, d: 0 };
    };

    const abortActiveSingleFingerDrag = () => {
      const d = dragRef.current;
      if (!d) return;
      if (d.kind === 'paint') {
        const layer = paintLayersRef.current.find((l) => l.id === d.layerId);
        if (layer) {
          const ctx = layer.canvas.getContext('2d')!;
          ctx.clearRect(0, 0, docW, docH);
          ctx.drawImage(d.snapshot, 0, 0);
          redrawComposite();
        }
      } else if (
        ['move', 'rotate', 'scaleCorner', 'stretchX', 'stretchY', 'boxWidth'].includes(d.kind) &&
        dragObjBeforeRef.current
      ) {
        onUpdateTextsDirect(() => dragObjBeforeRef.current!.texts);
        onUpdateLogosDirect(() => dragObjBeforeRef.current!.logos);
        dragObjBeforeRef.current = null;
      }
      setGuides([]);
      setDrag(null);
    };

    const applyGesture = () => {
      raf = 0;
      if (!pend) return;
      const n = pend;
      pend = null;
      if (last) {
        ws.scrollLeft -= n.cx - last.cx;
        ws.scrollTop -= n.cy - last.cy;
      }
      if (last && n.d && last.d) {
        const st = stageRef.current;
        const nextZ = Math.min(6, Math.max(0.15, zoomRef.current * (n.d / last.d)));
        if (st) {
          const r0 = st.getBoundingClientRect();
          const docX = (n.cx - r0.left) / zoomRef.current;
          const docY = (n.cy - r0.top) / zoomRef.current;
          onZoomChange(nextZ);
          zoomRef.current = nextZ;
          requestAnimationFrame(() => {
            const r1 = st.getBoundingClientRect();
            ws.scrollLeft += r1.left + docX * nextZ - n.cx;
            ws.scrollTop += r1.top + docY * nextZ - n.cy;
          });
        } else {
          onZoomChange(nextZ);
        }
      }
      last = n;
    };

    const inStage = (e: PointerEvent) => {
      const st = stageRef.current;
      return !!st && (e.target === st || st.contains(e.target as Node));
    };

    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== 'touch') return;
      if (ptrs.size === 0) {
        maxFingers = 1;
        gestureStartTime = Date.now();
        maxFingerMove = 0;
      }
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY });
      maxFingers = Math.max(maxFingers, ptrs.size);
      if (ptrs.size >= 2) {
        if (!gesturing) abortActiveSingleFingerDrag();
        gesturing = true;
        last = getInfo();
        e.stopPropagation();
        e.preventDefault();
      } else if (!inStage(e)) {
        gesturing = true;
        last = getInfo();
        e.stopPropagation();
      }
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'touch' || !ptrs.has(e.pointerId)) return;
      const prev = ptrs.get(e.pointerId)!;
      maxFingerMove = Math.max(maxFingerMove, Math.hypot(e.clientX - prev.sx, e.clientY - prev.sy));
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: prev.sx, sy: prev.sy });
      if (!gesturing) return;
      e.stopPropagation();
      e.preventDefault();
      pend = getInfo();
      if (!raf) raf = requestAnimationFrame(applyGesture);
    };

    const onEnd = (e: PointerEvent) => {
      if (e.pointerType !== 'touch' || !ptrs.has(e.pointerId)) return;
      ptrs.delete(e.pointerId);
      if (gesturing) {
        e.stopPropagation();
        if (ptrs.size === 0) {
          const elapsed = Date.now() - gestureStartTime;
          if (elapsed < 280 && maxFingerMove < 14) {
            if (maxFingers === 2) onUndoRef.current?.();
            else if (maxFingers >= 3) onRedoRef.current?.();
          }
          gesturing = false;
          last = null;
          pend = null;
          maxFingers = 0;
        } else {
          last = getInfo();
        }
      }
    };

    ws.addEventListener('pointerdown', onDown, true);
    ws.addEventListener('pointermove', onMove, true);
    ws.addEventListener('pointerup', onEnd, true);
    ws.addEventListener('pointercancel', onEnd, true);
    return () => {
      ws.removeEventListener('pointerdown', onDown, true);
      ws.removeEventListener('pointermove', onMove, true);
      ws.removeEventListener('pointerup', onEnd, true);
      ws.removeEventListener('pointercancel', onEnd, true);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [workspaceRef, docW, docH, onZoomChange, redrawComposite, onUpdateTextsDirect, onUpdateLogosDirect]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (document.activeElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
      (document.activeElement as HTMLElement).blur();
    }
    onCanvasTapDismiss?.();

    const ws = workspaceRef.current;
    if (activeTool === 'hand' || spaceHeld || e.button === 1) {
      if (!ws) return;
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      setDrag({ kind: 'pan', sx: e.clientX, sy: e.clientY, sl: ws.scrollLeft, st: ws.scrollTop });
      return;
    }

    e.currentTarget.setPointerCapture(e.pointerId);
    const { x, y } = toDocCoords(e.clientX, e.clientY);
    setHoverDoc({ x, y });

    if (activeTool === 'eyedrop') {
      const base = baseCanvasRef.current;
      if (base) {
        const [r, g, b] = sampleCompositePixelAt(x, y, docW, docH, base, paintLayers);
        onPickColor(rgbToHex(r, g, b));
        onSelectTool('brush');
      }
      return;
    }

    if (activeTool === 'clone' && (e.altKey || clonePickMode)) {
      setCloneSrc({ x: Math.round(x), y: Math.round(y) });
      onClonePicked?.();
      return;
    }

    if (['select', 'text', 'logo'].includes(activeTool)) {
      // 1. Check primary single-selection handles first
      if (selection && selection.ids.length === 1) {
        const active =
          selection.kind === 'text'
            ? textsRef.current.find((t) => t.id === selection.ids[0])
            : logosRef.current.find((l) => l.id === selection.ids[0]);

        if (active && !active.locked) {
          if ('text' in active) computeTextBounds(active);
          const { lx, ly } = toLocal(active, x, y);
          const hw = active._halfW || 60;
          const hh = active._halfH || 25;
          const hr = hitR / zoom;
          const LAY = getHandleLayout(active);

          const snapshotBefore = () => {
            dragObjBeforeRef.current = {
              texts: JSON.parse(JSON.stringify(textsRef.current)),
              logos: logosRef.current.map((l) => ({ ...l })),
            };
          };

          // A. Edge 4-Way Move Handle (✥) — phone thumb friendly!
          if (Math.hypot(lx - LAY.move.lx, ly - LAY.move.ly) <= (hitR + 6) / zoom) {
            snapshotBefore();
            setDrag({
              kind: 'move',
              sx: x,
              sy: y,
              moved: false,
              primaryKind: selection.kind,
              initItems: [{ id: active.id, x: active.x, y: active.y }],
            });
            return;
          }

          // B. Top Rotate handle
          if (Math.hypot(lx, ly + hh + 26 / zoom) <= (hitR + 2) / zoom) {
            snapshotBefore();
            setDrag({ kind: 'rotate', cx: active.x, cy: active.y, id: active.id, primaryKind: selection.kind });
            return;
          }

          // C. Text Box Width handle (↔)
          if (
            selection.kind === 'text' &&
            Math.abs(ly) <= (hitR + 6) / zoom &&
            Math.abs(lx - LAY.widthX) <= hr + 4 / zoom
          ) {
            snapshotBefore();
            setDrag({ kind: 'boxWidth', id: active.id });
            return;
          }

          // D. Closest-match among 4 Corner Scale Handles, Stretch-X (right), and Stretch-Y (bottom)
          const cornerPoints: [number, number][] = [
            [-hw, -hh],
            [hw, -hh],
            [-hw, hh],
            [hw, hh],
          ];
          let bestKind: 'corner' | 'stretchX' | 'stretchY' | null = null;
          let bestDist = (hitR + 2) / zoom;

          for (const [cx, cy] of cornerPoints) {
            const d = Math.hypot(lx - cx, ly - cy);
            if (d <= bestDist) {
              bestDist = d;
              bestKind = 'corner';
            }
          }

          if (selection.kind === 'text') {
            const dSX = Math.hypot(lx - hw, ly);
            if (dSX < bestDist) {
              bestDist = dSX;
              bestKind = 'stretchX';
            }
            const dSY = Math.hypot(lx, ly - hh);
            if (dSY < bestDist) {
              bestDist = dSY;
              bestKind = 'stretchY';
            }
          }

          if (bestKind === 'stretchX') {
            snapshotBefore();
            setDrag({
              kind: 'stretchX',
              id: active.id,
              scaleX0: (active as TextLayer).scaleX || 1,
              scaleY0: (active as TextLayer).scaleY || 1,
              lx0: Math.max(12, Math.abs(lx)),
            });
            return;
          }

          if (bestKind === 'stretchY') {
            snapshotBefore();
            setDrag({
              kind: 'stretchY',
              id: active.id,
              scaleX0: (active as TextLayer).scaleX || 1,
              scaleY0: (active as TextLayer).scaleY || 1,
              ly0: Math.max(12, Math.abs(ly)),
            });
            return;
          }

          if (bestKind === 'corner') {
            snapshotBefore();
            const d0 = Math.max(12, Math.hypot(x - active.x, y - active.y));
            setDrag({
              kind: 'scaleCorner',
              id: active.id,
              primaryKind: selection.kind,
              dist0: d0,
              ux: (x - active.x) / d0,
              uy: (y - active.y) / d0,
              fontSize0: 'fontSize' in active ? active.fontSize : 24,
              boxW0: 'boxWidth' in active ? active.boxWidth : 200,
              w0: 'width' in active ? active.width : 100,
              h0: 'height' in active ? active.height : 100,
            });
            return;
          }
        }
      }

      // 2. Hit test text/logo body
      const hit = hitTestAny(x, y);
      if (hit) {
        const isMultiKey = e.ctrlKey || e.metaKey || e.shiftKey;
        let nextSel: SelectionTarget;
        if (isMultiKey && selection && selection.kind === hit.kind) {
          const exists = selection.ids.includes(hit.item.id);
          const nextIds = exists
            ? selection.ids.filter((id) => id !== hit.item.id)
            : [...selection.ids, hit.item.id];
          nextSel = nextIds.length ? { kind: hit.kind, ids: nextIds } : { kind: hit.kind, ids: [hit.item.id] };
        } else if (selection && selection.kind === hit.kind && selection.ids.includes(hit.item.id)) {
          nextSel = selection;
        } else {
          nextSel = { kind: hit.kind, ids: [hit.item.id] };
        }
        onSelectObjects(nextSel);

        if (hit.kind === 'text' && !isMultiKey) {
          onOpenQuickText();
        }

        const groupItems =
          nextSel.kind === 'text'
            ? textsRef.current.filter((t) => nextSel.ids.includes(t.id))
            : logosRef.current.filter((l) => nextSel.ids.includes(l.id));

        dragObjBeforeRef.current = {
          texts: JSON.parse(JSON.stringify(textsRef.current)),
          logos: logosRef.current.map((l) => ({ ...l })),
        };

        setDrag({
          kind: 'move',
          sx: x,
          sy: y,
          moved: false,
          tappedId: hit.kind === 'text' ? hit.item.id : undefined,
          primaryKind: nextSel.kind,
          initItems: groupItems.map((it) => ({ id: it.id, x: it.x, y: it.y })),
        });
        return;
      }

      if (activeTool === 'text') {
        setDrag({ kind: 'newText', sx: x, sy: y, cx: x, cy: y });
        return;
      }

      if (activeTool === 'logo') {
        onOpenLogoUpload();
        return;
      }

      // Empty canvas click/tap
      onSelectObjects(null);
      onCloseQuickText?.();

      // Touch double-tap on empty canvas creates text bubble cleanly!
      if (e.pointerType === 'touch' && activeTool === 'select') {
        const now = Date.now();
        const prevTap = lastTouchTapRef.current;
        if (now - prevTap.time < 340 && Math.hypot(x - prevTap.x, y - prevTap.y) < 40 / zoom) {
          lastTouchTapRef.current = { time: 0, x: 0, y: 0 };
          const base = baseCanvasRef.current;
          if (autoBubbleDetect && base) {
            const bub = detectSpeechBubble(x, y, docW, docH, base, paintLayers);
            if (bub) {
              onCreateTextAt(bub.cx, bub.cy, bub.safeW, bub.safeH);
              onOpenQuickText();
              return;
            }
          }
          onCreateTextAt(Math.round(x), Math.round(y), 210);
          onOpenQuickText();
          return;
        }
        lastTouchTapRef.current = { time: now, x, y };

        if (ws) {
          setDrag({ kind: 'pan', sx: e.clientX, sy: e.clientY, sl: ws.scrollLeft, st: ws.scrollTop });
          return;
        }
      }

      setDrag({ kind: 'marquee', sx: x, sy: y, cx: x, cy: y });
      return;
    }

    // Paint / Eraser / Clone / Smart Clean
    const targetLayer = getActivePaintLayer();
    const base = baseCanvasRef.current;
    if (!targetLayer || !base) return;

    if (['brush', 'eraser', 'clone'].includes(activeTool)) {
      if (activeTool === 'clone' && !cloneSrc) {
        setCloneSrc({ x: Math.round(x), y: Math.round(y) });
        return;
      }
      const cOff = activeTool === 'clone' && cloneSrc ? { dx: cloneSrc.x - x, dy: cloneSrc.y - y } : null;
      if (cOff) setCloneOffset(cOff);

      const snap = snapshotCanvas(targetLayer.canvas);
      const pCtx = targetLayer.canvas.getContext('2d', { willReadFrequently: true })!;
      const taperOn = brush.taper ?? true;
      const startPressure =
        e.pointerType === 'pen' && e.pressure > 0 ? Math.max(0.25, Math.min(1.25, e.pressure * 1.4)) : taperOn ? 0.65 : 1;
      const initSize = Math.max(1, brush.size * startPressure);
      applyBrushSegment(
        pCtx,
        x,
        y,
        x + 0.01,
        y + 0.01,
        brush,
        activeTool as 'brush' | 'eraser' | 'clone',
        docW,
        docH,
        base,
        paintLayers,
        cOff,
        initSize
      );
      redrawComposite();
      setDrag({
        kind: 'paint',
        layerId: targetLayer.id,
        snapshot: snap,
        minX: x,
        minY: y,
        maxX: x,
        maxY: y,
        lastX: x,
        lastY: y,
        smoothX: x,
        smoothY: y,
        prevMidX: x,
        prevMidY: y,
        lastTime: performance.now(),
        lastSize: initSize,
      });
      return;
    }

    if (activeTool === 'bubble') {
      if (clean.shape === 'flood') {
        const snap = snapshotCanvas(targetLayer.canvas);
        const bounds = floodFillOnLayer(x, y, clean.tolerance, brush.color, docW, docH, base, paintLayers, targetLayer);
        if (bounds) {
          const [bx, by, bx2, by2] = bounds;
          const beforeImg = snap.getContext('2d')!.getImageData(bx, by, bx2 - bx, by2 - by);
          const afterImg = targetLayer.canvas.getContext('2d')!.getImageData(bx, by, bx2 - bx, by2 - by);
          onCommitPaintHistory(targetLayer.id, bx, by, beforeImg, afterImg, 'Дүүргэж цэвэрлэх');
          redrawComposite();
        }
        return;
      }

      const snap = snapshotCanvas(targetLayer.canvas);
      if (clean.shape === 'brush') {
        setDrag({ kind: 'cleanStroke', layerId: targetLayer.id, snapshot: snap, pts: [[x, y]] });
      } else {
        setDrag({ kind: 'cleanShape', layerId: targetLayer.id, snapshot: snap, sx: x, sy: y, cx: x, cy: y });
      }
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (drag?.kind === 'pan' && workspaceRef.current) {
      workspaceRef.current.scrollLeft = drag.sl - (e.clientX - drag.sx);
      workspaceRef.current.scrollTop = drag.st - (e.clientY - drag.sy);
      return;
    }

    const { x, y } = toDocCoords(e.clientX, e.clientY);
    setHoverDoc({ x, y });
    if (!drag) return;

    if (drag.kind === 'marquee' || drag.kind === 'newText' || drag.kind === 'cleanShape') {
      setDrag({ ...drag, cx: x, cy: y });
      return;
    }

    if (drag.kind === 'cleanStroke') {
      const lastPt = drag.pts[drag.pts.length - 1];
      if (!lastPt || Math.hypot(x - lastPt[0], y - lastPt[1]) >= 2.5) {
        setDrag({ ...drag, pts: [...drag.pts, [x, y]] });
      }
      return;
    }

    if (drag.kind === 'move') {
      const dx = x - drag.sx;
      const dy = y - drag.sy;
      if (!drag.moved && Math.hypot(dx, dy) > 4 / zoom) {
        setDrag({ ...drag, moved: true });
      }
      const first = drag.initItems[0];
      const movingSet = new Set(drag.initItems.map((i) => i.id));
      const refObj =
        drag.primaryKind === 'text'
          ? textsRef.current.find((t) => t.id === first.id)
          : logosRef.current.find((l) => l.id === first.id);

      let snapDx = dx;
      let snapDy = dy;
      if (refObj && drag.initItems.length === 1) {
        const snap = computeSmartSnap(
          first.x + dx,
          first.y + dy,
          refObj._halfW || 60,
          refObj._halfH || 25,
          movingSet,
          docW,
          docH,
          textsRef.current,
          logosRef.current,
          showGridSnap
        );
        snapDx = snap.x - first.x;
        snapDy = snap.y - first.y;
        setGuides(snap.guides);
      } else {
        setGuides([]);
      }

      const deltaMap = new Map(
        drag.initItems.map((it) => [it.id, { x: Math.round(it.x + snapDx), y: Math.round(it.y + snapDy) }])
      );
      if (drag.primaryKind === 'text') {
        onUpdateTextsDirect((prev) =>
          prev.map((t) => {
            const p = deltaMap.get(t.id);
            return p ? { ...t, x: p.x, y: p.y } : t;
          })
        );
      } else {
        onUpdateLogosDirect((prev) =>
          prev.map((l) => {
            const p = deltaMap.get(l.id);
            return p ? { ...l, x: p.x, y: p.y } : l;
          })
        );
      }
      return;
    }

    if (drag.kind === 'rotate') {
      const deg = Math.round((Math.atan2(y - drag.cy, x - drag.cx) * 180) / Math.PI + 90);
      if (drag.primaryKind === 'text') {
        onUpdateTextsDirect((prev) => prev.map((t) => (t.id === drag.id ? { ...t, rotation: deg } : t)));
      } else {
        onUpdateLogosDirect((prev) => prev.map((l) => (l.id === drag.id ? { ...l, rotation: deg } : l)));
      }
      return;
    }

    if (drag.kind === 'boxWidth') {
      const target = textsRef.current.find((t) => t.id === drag.id);
      if (!target) return;
      const { lx } = toLocal(target, x, y);
      const nextW = Math.max(50, Math.min(docW, Math.round(Math.abs(lx) * 2)));
      onUpdateTextsDirect((prev) => prev.map((t) => (t.id === drag.id ? { ...t, boxWidth: nextW } : t)));
      return;
    }

    if (drag.kind === 'stretchX') {
      const target = textsRef.current.find((t) => t.id === drag.id);
      if (!target) return;
      const { lx } = toLocal(target, x, y);
      const nextSX = Math.round(Math.max(0.35, Math.min(3.0, drag.scaleX0 * (Math.abs(lx) / drag.lx0))) * 100) / 100;
      const nextSY = e.shiftKey
        ? Math.round(Math.max(0.35, Math.min(3.0, drag.scaleY0 * (nextSX / Math.max(0.01, drag.scaleX0)))) * 100) / 100
        : target.scaleY;
      onUpdateTextsDirect((prev) =>
        prev.map((t) => (t.id === drag.id ? { ...t, scaleX: nextSX, scaleY: nextSY } : t))
      );
      return;
    }

    if (drag.kind === 'stretchY') {
      const target = textsRef.current.find((t) => t.id === drag.id);
      if (!target) return;
      const { ly } = toLocal(target, x, y);
      const nextSY = Math.round(Math.max(0.35, Math.min(3.0, drag.scaleY0 * (Math.abs(ly) / drag.ly0))) * 100) / 100;
      const nextSX = e.shiftKey
        ? Math.round(Math.max(0.35, Math.min(3.0, drag.scaleX0 * (nextSY / Math.max(0.01, drag.scaleY0)))) * 100) / 100
        : target.scaleX;
      onUpdateTextsDirect((prev) =>
        prev.map((t) => (t.id === drag.id ? { ...t, scaleX: nextSX, scaleY: nextSY } : t))
      );
      return;
    }

    if (drag.kind === 'scaleCorner') {
      const target =
        drag.primaryKind === 'text'
          ? textsRef.current.find((t) => t.id === drag.id)
          : logosRef.current.find((l) => l.id === drag.id);
      if (!target) return;

      // Project drag position along initial corner radial vector so dragging past center clamps cleanly
      const proj = (x - target.x) * drag.ux + (y - target.y) * drag.uy;
      const rawRatio = proj / drag.dist0;

      if (drag.primaryKind === 'text') {
        // Preserve aspect ratio: clamp ratio jointly by fontSize & boxWidth limits and derive boxWidth from exact integer fontSize ratio
        const minRatio = 8 / Math.max(1, drag.fontSize0);
        const maxRatio = Math.min(220 / Math.max(1, drag.fontSize0), docW / Math.max(36, drag.boxW0));
        const clampedRatio = Math.max(minRatio, Math.min(maxRatio, rawRatio));
        const nextFs = Math.max(8, Math.min(220, Math.round(drag.fontSize0 * clampedRatio)));
        const exactRatio = nextFs / Math.max(1, drag.fontSize0);
        const nextW = Math.max(36, Math.min(docW, Math.round(drag.boxW0 * exactRatio)));
        onUpdateTextsDirect((prev) =>
          prev.map((t) => (t.id === drag.id ? { ...t, fontSize: nextFs, boxWidth: nextW } : t))
        );
      } else {
        const minRatio = Math.max(20 / Math.max(1, drag.w0), 20 / Math.max(1, drag.h0));
        const maxRatio = Math.min(docW / Math.max(1, drag.w0), docH / Math.max(1, drag.h0));
        const ratio = Math.max(minRatio, Math.min(maxRatio, rawRatio));
        const nextW = Math.max(20, Math.min(docW, Math.round(drag.w0 * ratio)));
        const nextH = Math.max(20, Math.min(docH, Math.round(drag.h0 * ratio)));
        onUpdateLogosDirect((prev) =>
          prev.map((l) => (l.id === drag.id ? { ...l, width: nextW, height: nextH } : l))
        );
      }
      return;
    }

    if (drag.kind === 'paint') {
      const targetLayer = paintLayers.find((l) => l.id === drag.layerId);
      const base = baseCanvasRef.current;
      if (!targetLayer || !base) return;

      const stab = Math.max(0, Math.min(10, brush.stabilizer ?? 4));
      const lerp = 1 / (1 + stab * 0.45);
      const sx = drag.smoothX + (x - drag.smoothX) * lerp;
      const sy = drag.smoothY + (y - drag.smoothY) * lerp;
      const midX = (drag.smoothX + sx) / 2;
      const midY = (drag.smoothY + sy) / 2;

      const now = performance.now();
      const dt = Math.max(4, now - drag.lastTime);
      const dist = Math.hypot(sx - drag.smoothX, sy - drag.smoothY);
      const vel = dist / dt; // doc px per ms

      const taperOn = brush.taper ?? true;
      let targetFactor = 1;
      if (e.pointerType === 'pen' && e.pressure > 0) {
        targetFactor = Math.max(0.2, Math.min(1.25, e.pressure * 1.4));
      } else if (taperOn) {
        targetFactor = Math.max(0.45, Math.min(1.08, 1.05 - vel * 0.16));
      }
      const nextSize = drag.lastSize + (brush.size * targetFactor - drag.lastSize) * 0.35;

      const pCtx = targetLayer.canvas.getContext('2d', { willReadFrequently: true })!;
      // Quadratic Bezier smoothing along prevMid -> drag.smooth -> mid
      const segLen = Math.hypot(midX - drag.prevMidX, midY - drag.prevMidY);
      const subSteps = Math.max(1, Math.min(6, Math.ceil(segLen / 10)));
      let cx0 = drag.prevMidX;
      let cy0 = drag.prevMidY;
      for (let s = 1; s <= subSteps; s++) {
        const t = s / subSteps;
        const omt = 1 - t;
        const qx = omt * omt * drag.prevMidX + 2 * omt * t * drag.smoothX + t * t * midX;
        const qy = omt * omt * drag.prevMidY + 2 * omt * t * drag.smoothY + t * t * midY;
        const interpSize = drag.lastSize + (nextSize - drag.lastSize) * t;
        applyBrushSegment(
          pCtx,
          cx0,
          cy0,
          qx,
          qy,
          brush,
          activeTool as 'brush' | 'eraser' | 'clone',
          docW,
          docH,
          base,
          paintLayers,
          cloneOffset,
          interpSize
        );
        cx0 = qx;
        cy0 = qy;
      }

      redrawComposite();
      setDrag({
        ...drag,
        minX: Math.min(drag.minX, sx, midX),
        minY: Math.min(drag.minY, sy, midY),
        maxX: Math.max(drag.maxX, sx, midX),
        maxY: Math.max(drag.maxY, sy, midY),
        lastX: midX,
        lastY: midY,
        smoothX: sx,
        smoothY: sy,
        prevMidX: midX,
        prevMidY: midY,
        lastTime: now,
        lastSize: nextSize,
      });
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag) return;
    const { x, y } = toDocCoords(e.clientX, e.clientY);
    setGuides([]);

    if (drag.kind === 'marquee') {
      const x1 = Math.min(drag.sx, x);
      const y1 = Math.min(drag.sy, y);
      const x2 = Math.max(drag.sx, x);
      const y2 = Math.max(drag.sy, y);
      if (x2 - x1 > 12 || y2 - y1 > 12) {
        const matchedTexts = textsRef.current.filter(
          (t) => t.visible && !t.locked && t.x >= x1 && t.x <= x2 && t.y >= y1 && t.y <= y2
        );
        if (matchedTexts.length) {
          onSelectObjects({ kind: 'text', ids: matchedTexts.map((t) => t.id) });
        }
      }
      setDrag(null);
      return;
    }

    if (
      ['move', 'rotate', 'scaleCorner', 'stretchX', 'stretchY', 'boxWidth'].includes(drag.kind) &&
      dragObjBeforeRef.current
    ) {
      if (drag.kind === 'move' && !drag.moved) {
        // Pure tap on text without dragging -> ensure QuickTextWindow opens
        if (drag.tappedId) onOpenQuickText();
        dragObjBeforeRef.current = null;
        setDrag(null);
        return;
      }

      const label =
        drag.kind === 'move'
          ? 'Байрлал зөөх'
          : drag.kind === 'rotate'
          ? 'Эргүүлэх'
          : drag.kind === 'scaleCorner'
          ? 'Хэмжээ өөрчлөх'
          : drag.kind === 'stretchX'
          ? 'Өргөсгөх'
          : drag.kind === 'stretchY'
          ? 'Сунгах'
          : 'Хайрцгийн өргөн';

      if (drag.kind === 'move' || drag.kind === 'rotate' || drag.kind === 'scaleCorner') {
        if ((drag as { primaryKind: string }).primaryKind === 'text') {
          onUpdateTextsDirect((p) => p, label);
        } else {
          onUpdateLogosDirect((p) => p, label);
        }
      } else {
        onUpdateTextsDirect((p) => p, label);
      }
      dragObjBeforeRef.current = null;
      setDrag(null);
      return;
    }

    if (drag.kind === 'newText') {
      const bw = Math.abs(x - drag.sx);
      const bh = Math.abs(y - drag.sy);
      const base = baseCanvasRef.current;
      if (bw > 24) {
        onCreateTextAt(
          Math.round((drag.sx + x) / 2),
          Math.round((drag.sy + y) / 2),
          Math.max(70, Math.round(bw)),
          Math.max(40, Math.round(bh))
        );
      } else if (autoBubbleDetect && base) {
        const bub = detectSpeechBubble(drag.sx, drag.sy, docW, docH, base, paintLayers);
        if (bub) onCreateTextAt(bub.cx, bub.cy, bub.safeW, bub.safeH);
        else onCreateTextAt(Math.round(drag.sx), Math.round(drag.sy), 210);
      } else {
        onCreateTextAt(Math.round(drag.sx), Math.round(drag.sy), 210);
      }
      onOpenQuickText();
      setDrag(null);
      return;
    }

    if (drag.kind === 'paint') {
      const targetLayer = paintLayers.find((l) => l.id === drag.layerId);
      if (targetLayer) {
        const pad = Math.ceil(brush.size / 2) + 8;
        const bx = Math.max(0, Math.floor(drag.minX - pad));
        const by = Math.max(0, Math.floor(drag.minY - pad));
        const bx2 = Math.min(docW, Math.ceil(drag.maxX + pad));
        const by2 = Math.min(docH, Math.ceil(drag.maxY + pad));
        if (bx2 > bx && by2 > by) {
          const beforeImg = drag.snapshot.getContext('2d')!.getImageData(bx, by, bx2 - bx, by2 - by);
          const afterImg = targetLayer.canvas.getContext('2d')!.getImageData(bx, by, bx2 - bx, by2 - by);
          const lbl = activeTool === 'eraser' ? 'Баллуур' : activeTool === 'clone' ? 'Хуулах' : 'Бийрээр зурах';
          onCommitPaintHistory(targetLayer.id, bx, by, beforeImg, afterImg, lbl);
        }
      }
      setDrag(null);
      return;
    }

    if (drag.kind === 'cleanStroke') {
      const targetLayer = paintLayers.find((l) => l.id === drag.layerId);
      const base = baseCanvasRef.current;
      if (targetLayer && base) {
        const res = cleanStrokeOnLayer(drag.pts, clean, docW, docH, base, paintLayers, targetLayer);
        if (res) {
          const [bx, by, bx2, by2] = res.bounds;
          if (res.status === 'ok' && bx2 > bx && by2 > by) {
            const beforeImg = drag.snapshot.getContext('2d')!.getImageData(bx, by, bx2 - bx, by2 - by);
            const afterImg = targetLayer.canvas.getContext('2d')!.getImageData(bx, by, bx2 - bx, by2 - by);
            onCommitPaintHistory(targetLayer.id, bx, by, beforeImg, afterImg, 'Ухаалаг цэвэрлэгээ');
          }
          onCleanFeedback({ kind: res.status, text: res.message });
          redrawComposite();
        }
      }
      setDrag(null);
      return;
    }

    if (drag.kind === 'cleanShape') {
      const targetLayer = paintLayers.find((l) => l.id === drag.layerId);
      const base = baseCanvasRef.current;
      if (targetLayer && base) {
        let sx1 = drag.sx;
        let sy1 = drag.sy;
        let sx2 = x;
        let sy2 = y;
        if (Math.hypot(x - drag.sx, y - drag.sy) <= 10) {
          const bub = detectSpeechBubble(drag.sx, drag.sy, docW, docH, base, paintLayers);
          if (bub) {
            sx1 = bub.cx - bub.safeW / 2 - 10;
            sy1 = bub.cy - bub.safeH / 2 - 10;
            sx2 = bub.cx + bub.safeW / 2 + 10;
            sy2 = bub.cy + bub.safeH / 2 + 10;
          } else {
            sx1 = drag.sx - 68;
            sy1 = drag.sy - 44;
            sx2 = drag.sx + 68;
            sy2 = drag.sy + 44;
          }
        }
        const res = cleanShapeOnLayer(sx1, sy1, sx2, sy2, clean, docW, docH, base, paintLayers, targetLayer);
        if (res) {
          const [bx, by, bx2, by2] = res.bounds;
          if (res.status === 'ok' && bx2 > bx && by2 > by) {
            const beforeImg = drag.snapshot.getContext('2d')!.getImageData(bx, by, bx2 - bx, by2 - by);
            const afterImg = targetLayer.canvas.getContext('2d')!.getImageData(bx, by, bx2 - bx, by2 - by);
            onCommitPaintHistory(targetLayer.id, bx, by, beforeImg, afterImg, 'Хүрээлж цэвэрлэх');
          }
          onCleanFeedback({ kind: res.status, text: res.message });
          redrawComposite();
        }
      }
      setDrag(null);
      return;
    }

    setDrag(null);
  };

  const handleDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const { x, y } = toDocCoords(e.clientX, e.clientY);
    const hit = hitTestAny(x, y);
    if (hit) {
      onSelectObjects({ kind: hit.kind, ids: [hit.item.id] });
      if (hit.kind === 'text') onOpenQuickText();
      return;
    }
    if (['select', 'text'].includes(activeTool)) {
      const base = baseCanvasRef.current;
      if (autoBubbleDetect && base) {
        const bub = detectSpeechBubble(x, y, docW, docH, base, paintLayers);
        if (bub) {
          onCreateTextAt(bub.cx, bub.cy, bub.safeW, bub.safeH);
          onOpenQuickText();
          return;
        }
      }
      onCreateTextAt(Math.round(x), Math.round(y), 210);
      onOpenQuickText();
    }
  };

  const cursorClass =
    activeTool === 'hand' || spaceHeld
      ? 'cursor-grab active:cursor-grabbing'
      : ['select', 'text', 'logo'].includes(activeTool)
      ? 'cursor-default'
      : 'cursor-crosshair';

  return (
    <div
      ref={workspaceRef}
      onScroll={onPageScrollUpdate}
      onDragEnter={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const files = Array.from(e.dataTransfer.files || []);
        if (files.length) onDropFiles(files);
      }}
      className="flex-1 h-full overflow-auto studio-grid-bg relative flex justify-center items-start p-3 sm:p-6 md:p-10 pb-28 touch-none"
    >
      {dragOver && (
        <div className="fixed inset-4 z-50 rounded-2xl border-2 border-dashed border-emerald-500 bg-emerald-500/10 backdrop-blur-xs flex items-center justify-center pointer-events-none">
          <div className="px-5 py-3 rounded-xl bg-white dark:bg-neutral-900 border border-emerald-500 text-sm font-semibold text-neutral-900 dark:text-neutral-100 shadow-lg">
            Зураг эсвэл .ttf / .otf фонтоо энд чирж хаяна уу
          </div>
        </div>
      )}

      <div
        ref={setStageRef}
        style={{ width: Math.round(docW * zoom), height: Math.round(docH * zoom) }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={() => setHoverDoc(null)}
        onDoubleClick={handleDoubleClick}
        className={`relative bg-white shadow-2xl shrink-0 touch-none ${cursorClass}`}
      >
        <canvas ref={compCanvasRef} className="absolute inset-0 w-full h-full block" />
        <canvas ref={uiCanvasRef} className="absolute inset-0 w-full h-full block pointer-events-none" />

        {/* Interactive Before/After Split Curtain Handle */}
        {beforeAfterMode === 'split' && (
          <div
            style={{ left: `${splitPct}%` }}
            className="absolute top-0 bottom-0 w-0.5 bg-emerald-500 z-20 cursor-ew-resize"
            onPointerDown={(e) => {
              e.stopPropagation();
              const target = e.currentTarget;
              target.setPointerCapture(e.pointerId);
            }}
            onPointerMove={(e) => {
              if (e.buttons !== 1 || !stageRef.current) return;
              e.stopPropagation();
              const r = stageRef.current.getBoundingClientRect();
              const pct = Math.max(5, Math.min(95, ((e.clientX - r.left) / r.width) * 100));
              setSplitPct(pct);
            }}
          >
            <div className="sticky top-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-emerald-600 text-white border-2 border-white shadow-lg flex items-center justify-center text-xs font-bold">
              ⇆
            </div>
            <div className="sticky top-4 -translate-x-[calc(100%+8px)] px-2 py-0.5 rounded bg-neutral-900/85 text-white text-[10px] font-semibold whitespace-nowrap">
              Эх (Before)
            </div>
            <div className="sticky top-4 translate-x-2 px-2 py-0.5 rounded bg-emerald-700/90 text-white text-[10px] font-semibold whitespace-nowrap">
              Зассан (After)
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
