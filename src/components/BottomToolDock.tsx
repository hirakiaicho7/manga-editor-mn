import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Crosshair,
  Eraser,
  Image as ImageIcon,
  Layers,
  Loader2,
  Paintbrush,
  Pipette,
  Redo2,
  Sparkles,
  Stamp,
  Trash2,
  Undo2,
  Zap,
} from 'lucide-react';
import {
  AiCleanFilter,
  BrushSettings,
  BrushType,
  LogoLayer,
  SmartCleanSettings,
  ToolId,
} from '../types/editor';

interface BottomToolDockProps {
  activeTool: ToolId;
  onSelectTool: (t: ToolId) => void;
  visible: boolean;
  brush: BrushSettings;
  onUpdateBrush: (patch: Partial<BrushSettings>) => void;
  recentColors: string[];
  onCommitRecentColor: (hex: string) => void;
  clean: SmartCleanSettings;
  onUpdateClean: (patch: Partial<SmartCleanSettings>) => void;
  onAutoCleanAll: () => void;
  onAiClean: (scope: 'view' | 'all', filter: AiCleanFilter) => void;
  aiCleanBusy: boolean;
  aiCleanFilter: AiCleanFilter;
  onChangeAiCleanFilter: (f: AiCleanFilter) => void;
  cleanStatus: { kind: 'ok' | 'empty'; text: string } | null;
  clonePickMode: boolean;
  onToggleClonePickMode: () => void;
  selectedLogo: LogoLayer | null;
  onTriggerLogoUpload: () => void;
  onPlaceLogoPreset: (pos: 'center' | 'top' | 'bottom' | 'left' | 'right') => void;
  onSendLogoToBack: () => void;
  onBringLogoToFront: () => void;
  onUpdateSelectedLogos: (patch: Partial<LogoLayer>, label?: string) => void;
  onDeleteSelectedLogo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  docW: number;
}

const SIZE_CHIPS = [6, 16, 32, 64, 100];
const QUICK_COLORS = ['#ffffff', '#111111', '#ef4444', '#3b82f6', '#14b866', '#facc15'];

export const BottomToolDock: React.FC<BottomToolDockProps> = ({
  activeTool,
  onSelectTool,
  visible,
  brush,
  onUpdateBrush,
  recentColors,
  onCommitRecentColor,
  clean,
  onUpdateClean,
  onAutoCleanAll,
  onAiClean,
  aiCleanBusy,
  aiCleanFilter,
  onChangeAiCleanFilter,
  cleanStatus,
  clonePickMode,
  onToggleClonePickMode,
  selectedLogo,
  onTriggerLogoUpload,
  onPlaceLogoPreset,
  onSendLogoToBack,
  onBringLogoToFront,
  onUpdateSelectedLogos,
  onDeleteSelectedLogo,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  docW,
}) => {
  const [minimized, setMinimized] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [aiScope, setAiScope] = useState<'view' | 'all'>('view');

  if (!visible) return null;
  if (!['brush', 'eraser', 'clone', 'bubble', 'logo'].includes(activeTool)) return null;

  const isPaintTool = activeTool === 'brush' || activeTool === 'eraser' || activeTool === 'clone';
  const currentBrushSize = activeTool === 'bubble' ? clean.brushSize : brush.size;
  const dotPreviewPx = Math.max(4, Math.min(24, Math.round(currentBrushSize * 0.24)));

  const toolTitle =
    activeTool === 'brush'
      ? 'Бийр (ibisPaint)'
      : activeTool === 'eraser'
      ? 'Баллуур'
      : activeTool === 'clone'
      ? 'Хуулах (Clone)'
      : activeTool === 'bubble'
      ? 'AI Цэвэрлэгч'
      : 'Лого ба Watermark';

  const ToolIcon =
    activeTool === 'brush'
      ? Paintbrush
      : activeTool === 'eraser'
      ? Eraser
      : activeTool === 'clone'
      ? Stamp
      : activeTool === 'bubble'
      ? Sparkles
      : ImageIcon;

  return (
    <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 z-30 w-[min(620px,calc(100%-16px))] rounded-2xl border border-neutral-300/90 dark:border-neutral-700/90 bg-white/95 dark:bg-[#111916]/95 backdrop-blur-md shadow-2xl overflow-hidden">
      {/* Compact Header */}
      <div className="px-3 py-1.5 flex items-center justify-between gap-2 border-b border-neutral-200 dark:border-neutral-800">
        <div className="flex items-center gap-2 min-w-0">
          <ToolIcon className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
          <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 truncate">
            {toolTitle}
          </span>
          {isPaintTool && (
            <span className="text-[11px] font-mono-num text-emerald-600 dark:text-emerald-400 font-semibold">
              {brush.size}px · {brush.opacity}%
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={onUndo}
            disabled={!canUndo}
            title="Буцаах (2 хуруугаар товших)"
            className="h-7 w-7 rounded-lg border border-neutral-200 dark:border-neutral-800 hover:border-emerald-500 disabled:opacity-30 flex items-center justify-center text-neutral-700 dark:text-neutral-200"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onRedo}
            disabled={!canRedo}
            title="Дахих (3 хуруугаар товших)"
            className="h-7 w-7 rounded-lg border border-neutral-200 dark:border-neutral-800 hover:border-emerald-500 disabled:opacity-30 flex items-center justify-center text-neutral-700 dark:text-neutral-200"
          >
            <Redo2 className="w-3.5 h-3.5" />
          </button>

          {!minimized && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className={`h-7 px-2 rounded-lg border text-[11px] font-medium transition-colors ${
                expanded
                  ? 'border-emerald-500 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                  : 'border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-300 hover:border-emerald-500'
              }`}
            >
              {expanded ? 'Хураах' : 'Дэлгэрэнгүй'}
            </button>
          )}

          <button
            type="button"
            onClick={() => setMinimized((v) => !v)}
            title={minimized ? 'Дэлгэх' : 'Жижигрүүлэх'}
            className="h-7 w-7 rounded-lg border border-neutral-200 dark:border-neutral-800 hover:border-emerald-500 flex items-center justify-center text-neutral-600 dark:text-neutral-300"
          >
            {minimized ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Body */}
      {!minimized && (
        <div className="p-2.5 flex flex-col gap-2 max-h-[42dvh] overflow-y-auto">
          {/* ============== BRUSH / ERASER / CLONE ============== */}
          {isPaintTool && (
            <>
              {/* Size Preview + Slider + Stepper + Quick Chips */}
              <div className="flex items-center gap-2">
                <div
                  className="w-8 h-8 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-100 dark:bg-neutral-900 flex items-center justify-center shrink-0"
                  title={`Хэмжээ: ${brush.size}px`}
                >
                  <span
                    className="rounded-full border border-neutral-400/60"
                    style={{
                      width: dotPreviewPx,
                      height: dotPreviewPx,
                      backgroundColor: activeTool === 'eraser' ? '#f43f5e' : brush.color,
                    }}
                  />
                </div>

                <button
                  type="button"
                  onClick={() => onUpdateBrush({ size: Math.max(1, brush.size - 4) })}
                  className="w-8 h-8 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 text-sm font-bold text-neutral-700 dark:text-neutral-200 active:bg-emerald-600 active:text-white shrink-0"
                >
                  −
                </button>

                <input
                  type="range"
                  min={1}
                  max={150}
                  value={brush.size}
                  onChange={(e) => onUpdateBrush({ size: Number(e.target.value) })}
                  className="flex-1 accent-emerald-600 h-2 cursor-pointer"
                />

                <button
                  type="button"
                  onClick={() => onUpdateBrush({ size: Math.min(150, brush.size + 4) })}
                  className="w-8 h-8 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 text-sm font-bold text-neutral-700 dark:text-neutral-200 active:bg-emerald-600 active:text-white shrink-0"
                >
                  +
                </button>

                <div className="hidden sm:flex items-center gap-1 shrink-0">
                  {SIZE_CHIPS.map((sz) => (
                    <button
                      key={sz}
                      type="button"
                      onClick={() => onUpdateBrush({ size: sz })}
                      className={`h-7 px-2 rounded-md border text-[11px] font-mono-num font-semibold ${
                        brush.size === sz
                          ? 'border-emerald-500 bg-emerald-600 text-white'
                          : 'border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-300'
                      }`}
                    >
                      {sz}
                    </button>
                  ))}
                </div>
              </div>

              {/* Mobile Quick Size Chips + Opacity + Color/Clone */}
              <div className="flex sm:hidden items-center gap-1 overflow-x-auto pb-0.5">
                {SIZE_CHIPS.map((sz) => (
                  <button
                    key={sz}
                    type="button"
                    onClick={() => onUpdateBrush({ size: sz })}
                    className={`h-7 px-2.5 rounded-md border text-[11px] font-mono-num font-semibold shrink-0 ${
                      brush.size === sz
                        ? 'border-emerald-500 bg-emerald-600 text-white'
                        : 'border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-300'
                    }`}
                  >
                    {sz}px
                  </button>
                ))}
              </div>

              {/* Quick Row: Brush Types + Color Swatches / Clone Source Pick */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                {activeTool === 'brush' && (
                  <div className="flex items-center gap-1 overflow-x-auto">
                    {(
                      [
                        ['gpen', 'G-Pen'],
                        ['airbrush', 'Air'],
                        ['marker', 'Marker'],
                        ['screentone', 'Tone'],
                        ['blur', 'Blur'],
                      ] as [BrushType, string][]
                    ).map(([id, lbl]) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => onUpdateBrush({ type: id })}
                        className={`h-7 px-2 rounded-md border text-[11px] font-medium whitespace-nowrap ${
                          brush.type === id
                            ? 'border-emerald-500 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                            : 'border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-300'
                        }`}
                      >
                        {lbl}
                      </button>
                    ))}
                  </div>
                )}

                {activeTool === 'clone' && (
                  <button
                    type="button"
                    onClick={onToggleClonePickMode}
                    className={`h-7 px-2.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 ${
                      clonePickMode
                        ? 'border-emerald-500 bg-emerald-600 text-white'
                        : 'border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-200 hover:border-emerald-500'
                    }`}
                  >
                    <Crosshair className="w-3.5 h-3.5" />
                    {clonePickMode ? 'Зураг дээр дарж эх цэг авна уу…' : 'Эх цэг авах'}
                  </button>
                )}

                {activeTool !== 'eraser' && activeTool !== 'clone' && (
                  <div className="flex items-center gap-1.5 ml-auto">
                    {Array.from(new Set([...QUICK_COLORS, ...recentColors.slice(0, 3)]))
                      .slice(0, 6)
                      .map((hex) => (
                        <button
                          key={hex}
                          type="button"
                          onClick={() => {
                            onUpdateBrush({ color: hex });
                            onCommitRecentColor(hex);
                          }}
                          className={`w-6 h-6 rounded-full border shrink-0 ${
                            brush.color.toLowerCase() === hex.toLowerCase()
                              ? 'border-emerald-500 ring-2 ring-emerald-500/40'
                              : 'border-neutral-300 dark:border-neutral-700'
                          }`}
                          style={{ backgroundColor: hex }}
                        />
                      ))}
                    <input
                      type="color"
                      value={brush.color}
                      onChange={(e) => {
                        onUpdateBrush({ color: e.target.value });
                        onCommitRecentColor(e.target.value);
                      }}
                      title="Өнгө сонгох"
                      className="w-7 h-6 rounded border border-neutral-300 dark:border-neutral-700 cursor-pointer shrink-0"
                    />
                    <button
                      type="button"
                      onClick={() => onSelectTool('eyedrop')}
                      title="Зургаас өнгө сорох (I)"
                      className="h-7 w-7 rounded-lg border border-neutral-300 dark:border-neutral-700 hover:border-emerald-500 flex items-center justify-center text-neutral-700 dark:text-neutral-200 shrink-0"
                    >
                      <Pipette className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {/* Expanded ibisPaint X Controls: Opacity, Hardness, Spacing, Stabilizer, Taper */}
              {expanded && (
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1.5 border-t border-neutral-200 dark:border-neutral-800">
                  <label className="flex flex-col gap-1 text-[11px] text-neutral-500 dark:text-neutral-400">
                    <span className="flex justify-between">
                      <span>Тунгалаг</span>
                      <span className="font-mono-num text-neutral-800 dark:text-neutral-200">{brush.opacity}%</span>
                    </span>
                    <input
                      type="range"
                      min={5}
                      max={100}
                      value={brush.opacity}
                      onChange={(e) => onUpdateBrush({ opacity: Number(e.target.value) })}
                      className="accent-emerald-600"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-[11px] text-neutral-500 dark:text-neutral-400">
                    <span className="flex justify-between">
                      <span>Хатуулаг</span>
                      <span className="font-mono-num text-neutral-800 dark:text-neutral-200">{brush.hardness}%</span>
                    </span>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={brush.hardness}
                      onChange={(e) => onUpdateBrush({ hardness: Number(e.target.value) })}
                      className="accent-emerald-600"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-[11px] text-neutral-500 dark:text-neutral-400">
                    <span className="flex justify-between">
                      <span>Зай</span>
                      <span className="font-mono-num text-neutral-800 dark:text-neutral-200">{brush.spacing}%</span>
                    </span>
                    <input
                      type="range"
                      min={5}
                      max={80}
                      value={brush.spacing}
                      onChange={(e) => onUpdateBrush({ spacing: Number(e.target.value) })}
                      className="accent-emerald-600"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-[11px] text-neutral-500 dark:text-neutral-400">
                    <span className="flex justify-between">
                      <span>Тогтворжуулагч</span>
                      <span className="font-mono-num text-neutral-800 dark:text-neutral-200">
                        {brush.stabilizer ?? 4}
                      </span>
                    </span>
                    <input
                      type="range"
                      min={0}
                      max={10}
                      value={brush.stabilizer ?? 4}
                      onChange={(e) => onUpdateBrush({ stabilizer: Number(e.target.value) })}
                      className="accent-emerald-600"
                    />
                  </label>
                  <div className="col-span-2 sm:col-span-1 flex items-end">
                    <button
                      type="button"
                      onClick={() => onUpdateBrush({ taper: !(brush.taper ?? true) })}
                      className={`w-full h-7 rounded-lg border text-[11px] font-medium ${
                        brush.taper ?? true
                          ? 'border-emerald-500 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                          : 'border-neutral-300 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300'
                      }`}
                    >
                      Үзүүр: {(brush.taper ?? true) ? 'Нарийн' : 'Тэгш'}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ============== AI & SMART CLEANER ============== */}
          {activeTool === 'bubble' && (
            <>
              {/* AI Scope + Filter + Primary AI Action */}
              <div className="flex flex-wrap items-center gap-1.5">
                <div className="flex items-center p-0.5 rounded-lg bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
                  {(
                    [
                      ['view', 'Харагдаж буй'],
                      ['all', 'Бүх хуудас'],
                    ] as const
                  ).map(([id, lbl]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setAiScope(id)}
                      className={`h-7 px-2 rounded-md text-[11px] font-medium whitespace-nowrap ${
                        aiScope === id
                          ? 'bg-emerald-600 text-white'
                          : 'text-neutral-600 dark:text-neutral-300'
                      }`}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>

                <select
                  value={aiCleanFilter}
                  onChange={(e) => onChangeAiCleanFilter(e.target.value as AiCleanFilter)}
                  className="h-8 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 px-2 text-[11px] font-medium text-neutral-800 dark:text-neutral-100"
                >
                  <option value="all">Бүгд (Бөмбөлөг + SFX)</option>
                  <option value="bubble">Зөвхөн ярианы бөмбөлөг</option>
                  <option value="sfx">Зөвхөн SFX / Үйл хөдлөл</option>
                </select>

                <button
                  type="button"
                  disabled={aiCleanBusy}
                  onClick={() => onAiClean(aiScope, aiCleanFilter)}
                  className="flex-1 min-w-[155px] h-8 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white text-xs font-semibold flex items-center justify-center gap-1.5"
                >
                  {aiCleanBusy ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5" />
                  )}
                  <span>{aiCleanBusy ? 'AI таньж байна…' : 'AI Бөмбөлөг + SFX'}</span>
                </button>

                <button
                  type="button"
                  onClick={onAutoCleanAll}
                  title="Энгийн цагаан бөмбөлөг цэвэрлэх (Офлайн)"
                  className="h-8 px-2.5 rounded-lg border border-neutral-300 dark:border-neutral-700 hover:border-emerald-500 text-xs font-medium text-neutral-700 dark:text-neutral-200 flex items-center gap-1"
                >
                  <Zap className="w-3.5 h-3.5 text-amber-500" />
                  <span className="hidden sm:inline">Энгийн Auto</span>
                </button>
              </div>

              {/* Manual Clean Shape & Brush Size */}
              <div className="flex flex-wrap items-center gap-1.5">
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
                      className={`h-7 px-2 rounded-md border text-[11px] font-medium whitespace-nowrap ${
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
                  <div className="flex-1 min-w-[160px] flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => onUpdateClean({ brushSize: Math.max(10, clean.brushSize - 4) })}
                      className="w-7 h-7 rounded-md border border-neutral-300 dark:border-neutral-700 text-xs font-bold"
                    >
                      −
                    </button>
                    <input
                      type="range"
                      min={10}
                      max={120}
                      value={clean.brushSize}
                      onChange={(e) => onUpdateClean({ brushSize: Number(e.target.value) })}
                      className="flex-1 accent-emerald-600"
                    />
                    <button
                      type="button"
                      onClick={() => onUpdateClean({ brushSize: Math.min(120, clean.brushSize + 4) })}
                      className="w-7 h-7 rounded-md border border-neutral-300 dark:border-neutral-700 text-xs font-bold"
                    >
                      +
                    </button>
                    <span className="text-[11px] font-mono-num w-9 text-right text-neutral-700 dark:text-neutral-200">
                      {clean.brushSize}px
                    </span>
                  </div>
                )}
                {clean.shape === 'flood' && (
                  <div className="flex items-center gap-1.5 ml-auto">
                    <span className="text-[11px] text-neutral-500 dark:text-neutral-400">Дүүргэх өнгө:</span>
                    {['#ffffff', '#111111', '#f3f4f6'].map((hex) => (
                      <button
                        key={hex}
                        type="button"
                        onClick={() => onUpdateClean({ floodColor: hex })}
                        className={`w-6 h-6 rounded-full border shrink-0 ${
                          (clean.floodColor || '#ffffff').toLowerCase() === hex
                            ? 'border-emerald-500 ring-2 ring-emerald-500/40'
                            : 'border-neutral-300 dark:border-neutral-700'
                        }`}
                        style={{ backgroundColor: hex }}
                      />
                    ))}
                    <input
                      type="color"
                      value={clean.floodColor || '#ffffff'}
                      onChange={(e) => onUpdateClean({ floodColor: e.target.value })}
                      title="Дүүргэх өнгө сонгох"
                      className="w-7 h-6 rounded border border-neutral-300 dark:border-neutral-700 cursor-pointer shrink-0"
                    />
                  </div>
                )}
              </div>

              {expanded && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1.5 border-t border-neutral-200 dark:border-neutral-800">
                  <label className="flex flex-col gap-1 text-[11px] text-neutral-500 dark:text-neutral-400">
                    <span>Арга</span>
                    <select
                      value={clean.mode}
                      onChange={(e) =>
                        onUpdateClean({ mode: e.target.value as SmartCleanSettings['mode'] })
                      }
                      className="h-7 rounded border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 px-1.5 text-[11px] text-neutral-800 dark:text-neutral-100"
                    >
                      <option value="erase">Шууд арилгах</option>
                      <option value="inpaint">Auto Текст</option>
                      <option value="fill">Дүүргэх</option>
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-[11px] text-neutral-500 dark:text-neutral-400">
                    <span>Текстийн өнгө</span>
                    <select
                      value={clean.polarity}
                      onChange={(e) =>
                        onUpdateClean({ polarity: e.target.value as SmartCleanSettings['polarity'] })
                      }
                      className="h-7 rounded border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 px-1.5 text-[11px] text-neutral-800 dark:text-neutral-100"
                    >
                      <option value="auto">Автомат</option>
                      <option value="dark">Зөвхөн хар</option>
                      <option value="light">Зөвхөн цагаан</option>
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-[11px] text-neutral-500 dark:text-neutral-400">
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
                  <label className="flex flex-col gap-1 text-[11px] text-neutral-500 dark:text-neutral-400">
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

              {cleanStatus && (
                <div
                  className={`text-[11px] px-2.5 py-1 rounded-lg border ${
                    cleanStatus.kind === 'ok'
                      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                      : 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300'
                  }`}
                >
                  {cleanStatus.text}
                </div>
              )}
            </>
          )}

          {/* ============== LOGO QUICK DOCK ============== */}
          {activeTool === 'logo' && (
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={onTriggerLogoUpload}
                  className="h-8 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1"
                >
                  <ImageIcon className="w-3.5 h-3.5" />
                  + Лого оруулах
                </button>

                {selectedLogo && (
                  <>
                    {(
                      [
                        ['left', 'Зүүн'],
                        ['top', 'Дээд'],
                        ['center', 'Голд'],
                        ['bottom', 'Доод'],
                        ['right', 'Баруун'],
                      ] as const
                    ).map(([pos, lbl]) => (
                      <button
                        key={pos}
                        type="button"
                        onClick={() => onPlaceLogoPreset(pos)}
                        className="h-8 px-2 rounded-lg border border-neutral-300 dark:border-neutral-700 hover:border-emerald-500 text-[11px] font-medium text-neutral-700 dark:text-neutral-200"
                      >
                        {lbl}
                      </button>
                    ))}

                    <button
                      type="button"
                      onClick={selectedLogo.aboveText ? onSendLogoToBack : onBringLogoToFront}
                      className="h-8 px-2 rounded-lg border border-neutral-300 dark:border-neutral-700 hover:border-emerald-500 text-[11px] font-medium flex items-center gap-1 text-neutral-700 dark:text-neutral-200"
                    >
                      <Layers className="w-3.5 h-3.5" />
                      {selectedLogo.aboveText ? 'Ард илгээх' : 'Урд гаргах'}
                    </button>

                    <label className="flex items-center gap-1.5 text-[11px] text-neutral-600 dark:text-neutral-300 px-1">
                      <span>Тунгалаг</span>
                      <input
                        type="range"
                        min={10}
                        max={100}
                        value={Math.round(selectedLogo.opacity * 100)}
                        onChange={(e) =>
                          onUpdateSelectedLogos(
                            { opacity: Number(e.target.value) / 100 },
                            'Лого тунгалагшил'
                          )
                        }
                        className="w-20 accent-emerald-600"
                      />
                    </label>

                    <button
                      type="button"
                      onClick={onDeleteSelectedLogo}
                      className="h-8 w-8 rounded-lg border border-rose-500/40 text-rose-500 flex items-center justify-center ml-auto"
                      title="Лого устгах"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>

              {expanded && selectedLogo && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1.5 border-t border-neutral-200 dark:border-neutral-800 items-end">
                  <label className="flex flex-col gap-1 text-[11px] text-neutral-500 dark:text-neutral-400">
                    <span>Өргөн ({selectedLogo.width}px)</span>
                    <input
                      type="range"
                      min={20}
                      max={Math.max(200, docW)}
                      value={selectedLogo.width}
                      onChange={(e) => {
                        const w = Number(e.target.value);
                        const ratio = selectedLogo.img.height / Math.max(1, selectedLogo.img.width);
                        onUpdateSelectedLogos(
                          { width: w, height: Math.max(10, Math.round(w * ratio)) },
                          'Лого хэмжээ'
                        );
                      }}
                      className="accent-emerald-600"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-[11px] text-neutral-500 dark:text-neutral-400">
                    <span>Эргүүлэлт ({selectedLogo.rotation}°)</span>
                    <input
                      type="range"
                      min={-180}
                      max={180}
                      value={selectedLogo.rotation}
                      onChange={(e) =>
                        onUpdateSelectedLogos({ rotation: Number(e.target.value) }, 'Лого эргүүлэх')
                      }
                      className="accent-emerald-600"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => onUpdateSelectedLogos({ flipX: !selectedLogo.flipX }, 'Хэвтээ толь')}
                    className={`h-7 rounded-lg border text-[11px] font-medium ${
                      selectedLogo.flipX
                        ? 'border-emerald-500 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                        : 'border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-200'
                    }`}
                  >
                    ⇄ Хэвтээ толь
                  </button>
                  <button
                    type="button"
                    onClick={() => onUpdateSelectedLogos({ flipY: !selectedLogo.flipY }, 'Босоо толь')}
                    className={`h-7 rounded-lg border text-[11px] font-medium ${
                      selectedLogo.flipY
                        ? 'border-emerald-500 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                        : 'border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-200'
                    }`}
                  >
                    ⇅ Босоо толь
                  </button>
                </div>
              )}

              {expanded && !selectedLogo && (
                <div className="text-[11px] text-neutral-500 dark:text-neutral-400 pt-1 border-t border-neutral-200 dark:border-neutral-800">
                  Эхлээд лого оруулах эсвэл зураг дээрх логог сонгоно уу.
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
