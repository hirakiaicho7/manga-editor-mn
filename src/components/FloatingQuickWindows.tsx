import React, { useEffect, useRef, useState } from 'react';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ClipboardPaste,
  Copy,
  Eraser,
  GripHorizontal,
  Italic,
  Maximize2,
  Minimize2,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
  Type,
  Underline,
  Undo2,
  X,
} from 'lucide-react';
import {
  FloatingWindowState,
  SavedFont,
  SmartCleanSettings,
  TextLayer,
  TextPreset,
} from '../types/editor';
import { BUILTIN_FONTS } from '../utils/indexedDb';

type QuickTab = 'text' | 'style' | 'size';

interface QuickTextWindowProps {
  win: FloatingWindowState;
  onUpdateWin: (patch: Partial<FloatingWindowState>) => void;
  selectedTexts: TextLayer[];
  savedFonts: SavedFont[];
  presets: TextPreset[];
  docW: number;
  onBatchUpdateTexts: (patch: Partial<TextLayer>, commitLabel?: string) => void;
  onPasteText: () => void;
  onInsertNextText: () => void;
  onBubbleFit: () => void;
  onAutoFitText: () => void;
  onDuplicateSelected: () => void;
  onDeleteSelected: () => void;
  onEnsureVisible?: (panelEl: HTMLDivElement | null) => void;
  boundsRef: React.RefObject<HTMLDivElement | null>;
}

interface ScrubFieldConfig {
  key: 'fontSize' | 'scaleX' | 'scaleY' | 'boxWidth' | 'lineHeight' | 'rotation';
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  mult: number;
  dec: number;
  def: number | null;
}

const ScrubStepperField: React.FC<{
  cfg: ScrubFieldConfig;
  value: number;
  onChange: (nextShown: number, commit?: boolean) => void;
}> = ({ cfg, value, onChange }) => {
  const holdTimerRef = useRef<number | null>(null);
  const holdIntRef = useRef<number | null>(null);
  const scrubRef = useRef<{ sx: number; sv: number } | null>(null);
  const valRef = useRef(value);
  valRef.current = value;

  const round = (v: number) => {
    const k = Math.pow(10, cfg.dec);
    return Math.round(Math.max(cfg.min, Math.min(cfg.max, v)) * k) / k;
  };

  const stopHold = () => {
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    if (holdIntRef.current) clearInterval(holdIntRef.current);
    holdTimerRef.current = null;
    holdIntRef.current = null;
  };

  useEffect(() => () => stopHold(), []);

  const startHold = (dir: -1 | 1, shift: boolean) => {
    const stepAmt = cfg.step * (shift ? 10 : 1);
    onChange(round(valRef.current + dir * stepAmt), true);
    stopHold();
    holdTimerRef.current = window.setTimeout(() => {
      holdIntRef.current = window.setInterval(() => {
        onChange(round(valRef.current + dir * cfg.step), false);
      }, 70);
    }, 360);
  };

  const shown = round(value);

  return (
    <div className="flex flex-col gap-1 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/90 dark:bg-[#0d1411] p-1.5">
      <span
        onPointerDown={(e) => {
          e.preventDefault();
          e.currentTarget.setPointerCapture(e.pointerId);
          scrubRef.current = { sx: e.clientX, sv: valRef.current };
        }}
        onPointerMove={(e) => {
          if (!scrubRef.current) return;
          const range = cfg.max - cfg.min;
          onChange(round(scrubRef.current.sv + (e.clientX - scrubRef.current.sx) * (range / 280)), false);
        }}
        onPointerUp={(e) => {
          if (scrubRef.current) {
            const range = cfg.max - cfg.min;
            onChange(round(scrubRef.current.sv + (e.clientX - scrubRef.current.sx) * (range / 280)), true);
            scrubRef.current = null;
          }
        }}
        onPointerCancel={() => {
          scrubRef.current = null;
        }}
        onDoubleClick={() => {
          if (cfg.def !== null) onChange(cfg.def, true);
        }}
        title="Чирж өөрчил · давхар товшиж стандарт болгоно"
        className="text-[10.5px] text-neutral-500 dark:text-neutral-400 cursor-ew-resize touch-none select-none truncate px-0.5"
      >
        ⇆ {cfg.label} <em className="not-italic font-semibold text-emerald-600 dark:text-emerald-400">{cfg.unit}</em>
      </span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            e.currentTarget.setPointerCapture(e.pointerId);
            startHold(-1, e.shiftKey);
          }}
          onPointerUp={stopHold}
          onPointerCancel={stopHold}
          onLostPointerCapture={stopHold}
          className="w-8 h-8 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-base font-semibold text-neutral-700 dark:text-neutral-200 active:bg-emerald-600 active:text-white touch-none shrink-0"
        >
          −
        </button>
        <input
          type="number"
          inputMode="decimal"
          min={cfg.min}
          max={cfg.max}
          step={cfg.step}
          value={shown}
          onFocus={(e) => e.currentTarget.select()}
          onChange={(e) => {
            const v = parseFloat(e.target.value);
            if (!Number.isFinite(v)) return;
            onChange(round(v), false);
          }}
          onBlur={(e) => {
            const v = parseFloat(e.target.value);
            if (Number.isFinite(v)) onChange(round(v), true);
          }}
          className="w-full min-w-0 h-8 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-center text-xs font-mono-num font-bold text-neutral-900 dark:text-neutral-100 focus:outline-none focus:border-emerald-500"
        />
        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            e.currentTarget.setPointerCapture(e.pointerId);
            startHold(1, e.shiftKey);
          }}
          onPointerUp={stopHold}
          onPointerCancel={stopHold}
          onLostPointerCapture={stopHold}
          className="w-8 h-8 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-base font-semibold text-neutral-700 dark:text-neutral-200 active:bg-emerald-600 active:text-white touch-none shrink-0"
        >
          +
        </button>
      </div>
    </div>
  );
};

export const QuickTextWindow: React.FC<QuickTextWindowProps> = ({
  win,
  onUpdateWin,
  selectedTexts,
  savedFonts,
  presets,
  docW,
  onBatchUpdateTexts,
  onPasteText,
  onInsertNextText,
  onBubbleFit,
  onAutoFitText,
  onDuplicateSelected,
  onDeleteSelected,
  onEnsureVisible,
  boundsRef,
}) => {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const dragRef = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);
  const [tab, setTab] = useState<QuickTab>('text');
  const [hasDragged, setHasDragged] = useState(false);

  const primary = selectedTexts[0] || null;

  useEffect(() => {
    if (win.open && !win.minimized && primary) {
      onEnsureVisible?.(panelRef.current);
    }
  }, [win.open, win.minimized, tab, primary?.id]);

  if (!win.open) return null;

  const onPointerDownHeader = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button')) return;
    if (window.innerWidth < 768) return; // Bottom-docked on mobile phones
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const parent = boundsRef.current;
    const panel = panelRef.current;
    let ox = win.x;
    let oy = win.y;
    if (!hasDragged && parent && panel) {
      const pr = parent.getBoundingClientRect();
      const qr = panel.getBoundingClientRect();
      ox = Math.max(8, qr.left - pr.left);
      oy = Math.max(8, qr.top - pr.top);
      onUpdateWin({ x: ox, y: oy });
      setHasDragged(true);
    }
    dragRef.current = { sx: e.clientX, sy: e.clientY, ox, oy };
  };

  const onPointerMoveHeader = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    const parent = boundsRef.current;
    const maxW = parent ? Math.max(40, parent.clientWidth - 280) : 600;
    const maxH = parent ? Math.max(40, parent.clientHeight - 70) : 500;
    const nx = Math.max(8, Math.min(maxW, dragRef.current.ox + (e.clientX - dragRef.current.sx)));
    const ny = Math.max(8, Math.min(maxH, dragRef.current.oy + (e.clientY - dragRef.current.sy)));
    onUpdateWin({ x: nx, y: ny });
  };

  const onPointerUpHeader = () => {
    dragRef.current = null;
  };

  const fields: ScrubFieldConfig[] = [
    { key: 'fontSize', label: 'Үсгийн хэмжээ', unit: 'px', min: 8, max: 180, step: 1, mult: 1, dec: 0, def: 24 },
    { key: 'scaleX', label: 'Өргөсгөх ↔', unit: '%', min: 30, max: 300, step: 2, mult: 100, dec: 0, def: 100 },
    { key: 'scaleY', label: 'Сунгах ↕', unit: '%', min: 30, max: 300, step: 2, mult: 100, dec: 0, def: 100 },
    { key: 'boxWidth', label: 'Хайрцгийн өргөн', unit: 'px', min: 50, max: Math.max(400, docW), step: 4, mult: 1, dec: 0, def: null },
    { key: 'lineHeight', label: 'Мөрийн зай', unit: '×', min: 0.8, max: 2.5, step: 0.05, mult: 1, dec: 2, def: 1.2 },
    { key: 'rotation', label: 'Эргүүлэлт', unit: '°', min: -180, max: 180, step: 1, mult: 1, dec: 0, def: 0 },
  ];

  const getShownVal = (cfg: ScrubFieldConfig) => {
    if (!primary) return cfg.def ?? 0;
    const raw =
      primary[cfg.key] ??
      (cfg.key === 'lineHeight' ? 1.2 : cfg.key === 'rotation' ? 0 : cfg.key === 'scaleX' || cfg.key === 'scaleY' ? 1 : 24);
    return raw * cfg.mult;
  };

  const applyField = (cfg: ScrubFieldConfig, shown: number, commit = false) => {
    const k = Math.pow(10, 4);
    const val = cfg.mult === 1 ? shown : Math.round((shown / cfg.mult) * k) / k;
    onBatchUpdateTexts({ [cfg.key]: val }, commit ? cfg.label : undefined);
  };

  const quickColors = ['#111111', '#ffffff', '#ef4444', '#3b82f6', '#14b866', '#facc15'];

  // Desktop positioned at bottom-center by default unless dragged; mobile always bottom-docked cleanly
  const positionStyle: React.CSSProperties =
    hasDragged && typeof window !== 'undefined' && window.innerWidth >= 768
      ? { top: 0, left: 0, transform: `translate3d(${win.x}px, ${win.y}px, 0)` }
      : {};

  const positionClass =
    hasDragged && typeof window !== 'undefined' && window.innerWidth >= 768
      ? 'absolute z-30'
      : 'absolute bottom-2.5 left-1/2 -translate-x-1/2 z-30';

  return (
    <div
      ref={panelRef}
      style={positionStyle}
      className={`${positionClass} rounded-2xl border border-emerald-500/40 dark:border-emerald-500/35 bg-white/95 dark:bg-[#111916]/95 backdrop-blur-md shadow-2xl ${
        win.minimized
          ? 'w-64'
          : 'w-[min(560px,calc(100%-16px))] max-h-[54dvh] flex flex-col overflow-hidden'
      }`}
    >
      {/* Top Tabs + Drag + Done Bar */}
      <div
        onPointerDown={onPointerDownHeader}
        onPointerMove={onPointerMoveHeader}
        onPointerUp={onPointerUpHeader}
        onPointerCancel={onPointerUpHeader}
        className="px-2.5 py-2 flex items-center gap-1.5 border-b border-neutral-200 dark:border-neutral-800 md:cursor-grab md:active:cursor-grabbing touch-none shrink-0"
      >
        <GripHorizontal className="w-3.5 h-3.5 text-neutral-400 hidden md:block shrink-0" />

        {!win.minimized ? (
          <div className="flex-1 grid grid-cols-3 gap-1 p-0.5 rounded-xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 min-w-0">
            {(
              [
                ['text', 'Бичвэр'],
                ['style', 'Загвар'],
                ['size', 'Хэмжээ'],
              ] as [QuickTab, string][]
            ).map(([tId, lbl]) => (
              <button
                key={tId}
                type="button"
                onClick={() => setTab(tId)}
                className={`h-8 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                  tab === tId
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                }`}
              >
                {lbl}
              </button>
            ))}
          </div>
        ) : (
          <span className="flex-1 text-xs font-semibold text-neutral-800 dark:text-neutral-200 truncate">
            Текст {selectedTexts.length > 1 ? `(${selectedTexts.length})` : ''}
          </span>
        )}

        <button
          type="button"
          onClick={() => onUpdateWin({ minimized: !win.minimized })}
          title={win.minimized ? 'Дэлгэх' : 'Жижигрүүлэх'}
          className="h-8 w-8 rounded-lg border border-neutral-200 dark:border-neutral-800 hover:border-emerald-500 flex items-center justify-center text-neutral-600 dark:text-neutral-300 shrink-0"
        >
          {win.minimized ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        <button
          type="button"
          onClick={() => {
            textareaRef.current?.blur();
            onUpdateWin({ open: false });
          }}
          className="h-8 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1 shrink-0"
        >
          <Check className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Болсон</span>
        </button>
      </div>

      {!win.minimized && (
        <div className="p-2.5 overflow-y-auto flex flex-col gap-2">
          {!primary ? (
            <div className="text-xs text-neutral-500 dark:text-neutral-400 py-3 text-center">
              Текст сонгох эсвэл зураг дээр давхар товшиж шинэ текст нэмнэ үү.
            </div>
          ) : (
            <>
              {/* TAB 1: Бичвэр */}
              {tab === 'text' && (
                <>
                  <textarea
                    ref={textareaRef}
                    value={selectedTexts.length > 1 ? '' : primary.text}
                    placeholder={
                      selectedTexts.length > 1
                        ? `${selectedTexts.length} текст сонгогдсон — Загвар/Хэмжээ табаар бөөнөөр засна уу`
                        : 'Текстээ бичнэ үү...'
                    }
                    disabled={selectedTexts.length > 1}
                    rows={3}
                    onChange={(e) => onBatchUpdateTexts({ text: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape' || (e.key === 'Enter' && (e.ctrlKey || e.metaKey))) {
                        e.preventDefault();
                        textareaRef.current?.blur();
                        onUpdateWin({ open: false });
                      }
                    }}
                    className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 px-3 py-2 text-base sm:text-sm leading-snug text-neutral-900 dark:text-neutral-100 focus:outline-none focus:border-emerald-500 resize-y disabled:opacity-60"
                  />

                  <div className="grid grid-cols-4 gap-1.5">
                    <button
                      type="button"
                      onClick={onPasteText}
                      className="h-9 rounded-lg border border-neutral-300 dark:border-neutral-700 text-xs font-medium text-neutral-700 dark:text-neutral-200 hover:border-emerald-500 flex items-center justify-center gap-1"
                    >
                      <ClipboardPaste className="w-3.5 h-3.5 shrink-0" />
                      <span>Наах</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onBatchUpdateTexts({ text: '' }, 'Текст цэвэрлэх');
                        textareaRef.current?.focus();
                      }}
                      className="h-9 rounded-lg border border-neutral-300 dark:border-neutral-700 text-xs font-medium text-neutral-700 dark:text-neutral-200 hover:border-emerald-500 flex items-center justify-center gap-1"
                    >
                      <X className="w-3.5 h-3.5 shrink-0" />
                      <span>Арилгах</span>
                    </button>
                    <button
                      type="button"
                      onClick={onInsertNextText}
                      className="h-9 rounded-lg border border-neutral-300 dark:border-neutral-700 text-xs font-medium text-neutral-700 dark:text-neutral-200 hover:border-emerald-500 flex items-center justify-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5 shrink-0" />
                      <span>Дараагийн</span>
                    </button>
                    <button
                      type="button"
                      onClick={onBubbleFit}
                      className="h-9 rounded-lg border border-emerald-500/40 bg-emerald-500/10 text-xs font-semibold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 flex items-center justify-center gap-1"
                    >
                      <Sparkles className="w-3.5 h-3.5 shrink-0" />
                      <span>Бөмбөлөгт</span>
                    </button>
                  </div>

                  {/* 1-Tap Quick Presets Strip (saves tons of time on phones!) */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
                    {presets.slice(0, 6).map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => onBatchUpdateTexts(p.style, `Загвар: ${p.name}`)}
                        className="h-7 px-2.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 hover:border-emerald-500 text-[11px] font-medium text-neutral-700 dark:text-neutral-200 whitespace-nowrap shrink-0"
                      >
                        {p.name}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {/* TAB 2: Загвар */}
              {tab === 'style' && (
                <div className="flex flex-col gap-2">
                  <div className="grid grid-cols-8 gap-1">
                    <button
                      type="button"
                      onClick={() => onBatchUpdateTexts({ bold: !primary.bold }, 'Тод')}
                      className={`h-9 rounded-lg border flex items-center justify-center ${
                        primary.bold
                          ? 'bg-emerald-600 border-emerald-600 text-white'
                          : 'border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-200'
                      }`}
                    >
                      <Bold className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onBatchUpdateTexts({ italic: !primary.italic }, 'Налуу')}
                      className={`h-9 rounded-lg border flex items-center justify-center ${
                        primary.italic
                          ? 'bg-emerald-600 border-emerald-600 text-white'
                          : 'border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-200'
                      }`}
                    >
                      <Italic className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onBatchUpdateTexts({ underline: !primary.underline }, 'Доогуур зураас')}
                      className={`h-9 rounded-lg border flex items-center justify-center ${
                        primary.underline
                          ? 'bg-emerald-600 border-emerald-600 text-white'
                          : 'border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-200'
                      }`}
                    >
                      <Underline className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onBatchUpdateTexts({ uppercase: !primary.uppercase }, 'Том үсэг')}
                      className={`h-9 rounded-lg border text-xs font-bold ${
                        primary.uppercase
                          ? 'bg-emerald-600 border-emerald-600 text-white'
                          : 'border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-200'
                      }`}
                    >
                      AA
                    </button>
                    <button
                      type="button"
                      onClick={() => onBatchUpdateTexts({ glowEnabled: !primary.glowEnabled }, 'Гэрэлтэлт')}
                      className={`h-9 rounded-lg border flex items-center justify-center ${
                        primary.glowEnabled
                          ? 'bg-emerald-600 border-emerald-600 text-white'
                          : 'border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-200'
                      }`}
                      title="Гэрэлтэлт (Glow)"
                    >
                      <Sparkles className="w-4 h-4" />
                    </button>
                    {(
                      [
                        ['left', AlignLeft],
                        ['center', AlignCenter],
                        ['right', AlignRight],
                      ] as const
                    ).map(([al, Icon]) => (
                      <button
                        key={al}
                        type="button"
                        onClick={() => onBatchUpdateTexts({ align: al }, 'Зэрэгцүүлэх')}
                        className={`h-9 rounded-lg border flex items-center justify-center ${
                          primary.align === al
                            ? 'bg-emerald-600 border-emerald-600 text-white'
                            : 'border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-200'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-12 gap-1.5">
                    <select
                      value={primary.fontFamily}
                      onChange={(e) => onBatchUpdateTexts({ fontFamily: e.target.value }, 'Фонт солих')}
                      className="col-span-7 h-9 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 px-2 text-xs text-neutral-900 dark:text-neutral-100"
                    >
                      {BUILTIN_FONTS.map((f) => (
                        <option key={f.value} value={f.value}>
                          {f.label.split(' (')[0]}
                        </option>
                      ))}
                      {savedFonts.map((sf) => (
                        <option key={sf.id} value={`'PFFont_${sf.id}', sans-serif`}>
                          {sf.name}
                        </option>
                      ))}
                    </select>
                    <select
                      value=""
                      onChange={(e) => {
                        const p = presets.find((x) => x.id === e.target.value);
                        if (p) onBatchUpdateTexts(p.style, `Загвар: ${p.name}`);
                      }}
                      className="col-span-5 h-9 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 px-2 text-xs text-neutral-800 dark:text-neutral-200"
                    >
                      <option value="">Загвар…</option>
                      {presets.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Quick Color & Stroke Bar */}
                  <div className="flex items-center justify-between gap-2 pt-0.5">
                    <div className="flex items-center gap-1.5">
                      {quickColors.map((hex) => (
                        <button
                          key={hex}
                          type="button"
                          onClick={() => onBatchUpdateTexts({ color: hex, gradEnabled: false }, 'Үсгийн өнгө')}
                          className={`w-6 h-6 rounded-full border ${
                            primary.color.toLowerCase() === hex
                              ? 'border-emerald-500 ring-2 ring-emerald-500/40'
                              : 'border-neutral-300 dark:border-neutral-700'
                          }`}
                          style={{ backgroundColor: hex }}
                        />
                      ))}
                      <input
                        type="color"
                        value={primary.color}
                        onChange={(e) => onBatchUpdateTexts({ color: e.target.value, gradEnabled: false }, 'Үсгийн өнгө')}
                        className="w-7 h-6 rounded border border-neutral-300 dark:border-neutral-700 cursor-pointer"
                        title="Өнгө сонгох"
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onBatchUpdateTexts({ strokeColor: '#ffffff', strokeWidth: 5 }, 'Цагаан хүрээ')}
                        className="h-7 px-2 rounded-md border border-neutral-300 dark:border-neutral-700 text-[11px] text-neutral-700 dark:text-neutral-200"
                      >
                        Цагаан хүрээ
                      </button>
                      <button
                        type="button"
                        onClick={() => onBatchUpdateTexts({ strokeColor: '#111111', strokeWidth: 5 }, 'Хар хүрээ')}
                        className="h-7 px-2 rounded-md border border-neutral-300 dark:border-neutral-700 text-[11px] text-neutral-700 dark:text-neutral-200"
                      >
                        Хар хүрээ
                      </button>
                      <button
                        type="button"
                        onClick={() => onBatchUpdateTexts({ strokeWidth: 0 }, 'Хүрээгүй')}
                        className="h-7 px-2 rounded-md border border-neutral-300 dark:border-neutral-700 text-[11px] text-neutral-500 dark:text-neutral-400"
                      >
                        0
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: Хэмжээ (Size, Scale X/Y Stretch, BoxWidth, LineHeight, Rotation) */}
              {tab === 'size' && (
                <div className="flex flex-col gap-2">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                    {fields.map((cfg) => (
                      <ScrubStepperField
                        key={cfg.key}
                        cfg={cfg}
                        value={getShownVal(cfg)}
                        onChange={(next, commit) => applyField(cfg, next, commit)}
                      />
                    ))}
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    <button
                      type="button"
                      onClick={() => onBatchUpdateTexts({ scaleX: 1, scaleY: 1 }, '1:1 Стандарт')}
                      className="h-9 rounded-lg border border-neutral-300 dark:border-neutral-700 text-xs font-medium text-neutral-700 dark:text-neutral-200 hover:border-emerald-500 flex items-center justify-center gap-1"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>1:1</span>
                    </button>
                    <button
                      type="button"
                      onClick={onAutoFitText}
                      className="h-9 rounded-lg border border-neutral-300 dark:border-neutral-700 text-xs font-medium text-neutral-700 dark:text-neutral-200 hover:border-emerald-500 flex items-center justify-center gap-1"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Багтаах</span>
                    </button>
                    <button
                      type="button"
                      onClick={onDuplicateSelected}
                      className="h-9 rounded-lg border border-neutral-300 dark:border-neutral-700 text-xs font-medium text-neutral-700 dark:text-neutral-200 hover:border-emerald-500 flex items-center justify-center gap-1"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>Хувилах</span>
                    </button>
                    <button
                      type="button"
                      onClick={onDeleteSelected}
                      className="h-9 rounded-lg border border-rose-500/40 bg-rose-500/10 text-xs font-medium text-rose-600 dark:text-rose-400 flex items-center justify-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Устгах</span>
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

interface QuickCleanWindowProps {
  win: FloatingWindowState;
  onUpdateWin: (patch: Partial<FloatingWindowState>) => void;
  clean: SmartCleanSettings;
  onUpdateClean: (patch: Partial<SmartCleanSettings>) => void;
  onAutoCleanAll: () => void;
  onSwitchToText: () => void;
  statusMsg: { kind: 'ok' | 'empty'; text: string } | null;
  onUndo: () => void;
  boundsRef: React.RefObject<HTMLDivElement | null>;
}

export const QuickCleanWindow: React.FC<QuickCleanWindowProps> = ({
  win,
  onUpdateWin,
  clean,
  onUpdateClean,
  onAutoCleanAll,
  onSwitchToText,
  statusMsg,
  onUndo,
  boundsRef,
}) => {
  const dragRef = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);

  if (!win.open) return null;

  const onPointerDownHeader = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button')) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { sx: e.clientX, sy: e.clientY, ox: win.x, oy: win.y };
  };

  const onPointerMoveHeader = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    const parent = boundsRef.current;
    const maxW = parent ? Math.max(40, parent.clientWidth - 260) : 600;
    const maxH = parent ? Math.max(40, parent.clientHeight - 60) : 500;
    const nx = Math.max(8, Math.min(maxW, dragRef.current.ox + (e.clientX - dragRef.current.sx)));
    const ny = Math.max(8, Math.min(maxH, dragRef.current.oy + (e.clientY - dragRef.current.sy)));
    onUpdateWin({ x: nx, y: ny });
  };

  const onPointerUpHeader = () => {
    dragRef.current = null;
  };

  return (
    <div
      style={{ transform: `translate3d(${win.x}px, ${win.y}px, 0)` }}
      className={`absolute top-0 left-0 z-30 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white/95 dark:bg-[#131b18]/95 backdrop-blur-md shadow-2xl ${
        win.minimized
          ? 'w-56'
          : win.expanded
          ? 'w-[380px] max-w-[calc(100%-16px)]'
          : 'w-[310px] max-w-[calc(100%-16px)]'
      }`}
    >
      <div
        onPointerDown={onPointerDownHeader}
        onPointerMove={onPointerMoveHeader}
        onPointerUp={onPointerUpHeader}
        onPointerCancel={onPointerUpHeader}
        className="px-3 py-2 flex items-center justify-between gap-2 border-b border-neutral-200 dark:border-neutral-800 cursor-grab active:cursor-grabbing touch-none"
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <Eraser className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 truncate">
            Ухаалаг Цэвэрлэгч
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={onSwitchToText}
            title="Текст бичих горим руу шилжих (T)"
            className="h-6 px-1.5 rounded border border-neutral-300 dark:border-neutral-700 hover:border-emerald-500 text-[10.5px] font-medium text-neutral-700 dark:text-neutral-200 flex items-center gap-0.5"
          >
            <Type className="w-3 h-3" />
            Текст
          </button>
          <button
            type="button"
            onClick={() => onUpdateWin({ minimized: !win.minimized })}
            title={win.minimized ? 'Дэлгэх' : 'Жижигрүүлэх'}
            className="w-6 h-6 rounded hover:bg-neutral-200 dark:hover:bg-neutral-800 flex items-center justify-center text-neutral-600 dark:text-neutral-300"
          >
            {win.minimized ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          </button>
          <button
            type="button"
            onClick={() => onUpdateWin({ expanded: !win.expanded, minimized: false })}
            title={win.expanded ? 'Авсаархан болгох' : 'Томруулах'}
            className="w-6 h-6 rounded hover:bg-neutral-200 dark:hover:bg-neutral-800 flex items-center justify-center text-neutral-600 dark:text-neutral-300"
          >
            {win.expanded ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
          </button>
          <button
            type="button"
            onClick={() => onUpdateWin({ open: false })}
            title="Нуух"
            className="w-6 h-6 rounded hover:bg-rose-500/20 hover:text-rose-500 flex items-center justify-center text-neutral-600 dark:text-neutral-300"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {!win.minimized && (
        <div className="p-2.5 flex flex-col gap-2">
          <div className="grid grid-cols-3 gap-1 p-0.5 rounded-lg bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
            {(
              [
                ['erase', 'Шууд арилгах'],
                ['inpaint', 'Текст (Auto)'],
                ['fill', 'Дүүргэх'],
              ] as const
            ).map(([val, lbl]) => (
              <button
                key={val}
                type="button"
                onClick={() => onUpdateClean({ mode: val })}
                className={`py-1 px-1.5 rounded-md text-[11px] font-medium whitespace-nowrap transition-colors ${
                  clean.mode === val
                    ? 'bg-emerald-600 text-white'
                    : 'text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white'
                }`}
              >
                {lbl}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-4 gap-1">
            {(
              [
                ['brush', 'Тодруулах'],
                ['box', 'Хайрцаг'],
                ['ellipse', 'Зууван'],
                ['flood', 'Товших'],
              ] as const
            ).map(([val, lbl]) => (
              <button
                key={val}
                type="button"
                onClick={() => onUpdateClean({ shape: val })}
                className={`py-1 px-1.5 rounded-md border text-[11px] font-medium whitespace-nowrap ${
                  clean.shape === val
                    ? 'border-emerald-500 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                    : 'border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-300'
                }`}
              >
                {lbl}
              </button>
            ))}
          </div>

          {clean.shape === 'brush' && (
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-neutral-500 dark:text-neutral-400 shrink-0">Бийр</span>
              <input
                type="range"
                min={10}
                max={120}
                value={clean.brushSize}
                onChange={(e) => onUpdateClean({ brushSize: Number(e.target.value) })}
                className="flex-1 accent-emerald-600"
              />
              <span className="text-xs font-mono-num font-semibold w-9 text-right text-neutral-800 dark:text-neutral-200">
                {clean.brushSize}px
              </span>
            </div>
          )}

          {win.expanded && (
            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-neutral-200 dark:border-neutral-800">
              <label className="text-[11px] text-neutral-500 dark:text-neutral-400 flex flex-col gap-1">
                <span>Мэдрэмж ({clean.tolerance})</span>
                <input
                  type="range"
                  min={5}
                  max={110}
                  value={clean.tolerance}
                  onChange={(e) => onUpdateClean({ tolerance: Number(e.target.value) })}
                  className="accent-emerald-600"
                />
              </label>
              <label className="text-[11px] text-neutral-500 dark:text-neutral-400 flex flex-col gap-1">
                <span>Уусгалт ({clean.feather}px)</span>
                <input
                  type="range"
                  min={0}
                  max={30}
                  value={clean.feather}
                  onChange={(e) => onUpdateClean({ feather: Number(e.target.value) })}
                  className="accent-emerald-600"
                />
              </label>
            </div>
          )}

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onAutoCleanAll}
              className="flex-1 h-8 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center justify-center gap-1"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Бүх бөмбөлөг цэвэрлэх
            </button>
            <button
              type="button"
              onClick={onUndo}
              title="Сүүлийн цэвэрлэгээг буцаах"
              className="h-8 px-2.5 rounded-md border border-neutral-300 dark:border-neutral-700 text-xs text-neutral-700 dark:text-neutral-200 flex items-center gap-1"
            >
              <Undo2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {statusMsg && (
            <div
              className={`text-[11px] px-2 py-1 rounded-md border ${
                statusMsg.kind === 'ok'
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                  : 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300'
              }`}
            >
              {statusMsg.text}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

interface ScriptQueueBarProps {
  lines: string[];
  used: Set<number>;
  nextIdx: number;
  onStep: (dir: -1 | 1) => void;
  onDropAtCenter: () => void;
  onClose: () => void;
}

export const ScriptQueueBar: React.FC<ScriptQueueBarProps> = ({
  lines,
  used,
  nextIdx,
  onStep,
  onDropAtCenter,
  onClose,
}) => {
  if (nextIdx < 0 || nextIdx >= lines.length) return null;
  const remaining = Math.max(0, lines.length - used.size);
  const preview = lines[nextIdx].replace(/\n/g, ' ');

  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 w-[min(520px,calc(100%-20px))] rounded-xl border border-emerald-500 bg-emerald-950/95 text-emerald-50 px-2.5 py-1.5 shadow-xl backdrop-blur-md flex items-center gap-1.5">
      <div className="flex-1 min-w-0 text-xs truncate">
        <span className="font-mono-num text-emerald-300 font-semibold mr-1.5">
          {nextIdx + 1}/{lines.length}
        </span>
        <span className="font-medium">«{preview}»</span>
        <span className="text-[10.5px] text-emerald-300/80 ml-1.5">({remaining} үлдсэн)</span>
      </div>
      <button
        type="button"
        onClick={onDropAtCenter}
        className="h-7 px-2 rounded-md bg-emerald-500 hover:bg-emerald-400 text-neutral-950 text-[11px] font-bold shrink-0"
        title="Дэлгэцийн голд текст тавих"
      >
        Буулгах
      </button>
      <button
        type="button"
        onClick={() => onStep(-1)}
        className="w-7 h-7 rounded-md border border-emerald-700 hover:border-emerald-400 flex items-center justify-center shrink-0"
      >
        <ChevronLeft className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onClick={() => onStep(1)}
        className="w-7 h-7 rounded-md border border-emerald-700 hover:border-emerald-400 flex items-center justify-center shrink-0"
      >
        <ChevronRight className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onClick={onClose}
        className="w-7 h-7 rounded-md hover:bg-rose-500/30 flex items-center justify-center shrink-0"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
