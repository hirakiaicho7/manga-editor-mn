import React, { useEffect, useRef, useState } from 'react';
import {
  AlignCenter,
  AlignHorizontalJustifyCenter,
  AlignLeft,
  AlignRight,
  AlignVerticalJustifyCenter,
  ArrowDown,
  ArrowUp,
  Bold,
  BookmarkPlus,
  Check,
  ChevronDown,
  Copy,
  Crosshair,
  Eye,
  EyeOff,
  FolderOpen,
  Image as ImageIcon,
  Italic,
  Layers,
  Loader2,
  Lock,
  Plus,
  RotateCcw,
  Sliders,
  Sparkles,
  Trash2,
  Underline,
  Unlock,
  X,
} from 'lucide-react';
import {
  AiCleanFilter,
  BrushSettings,
  BrushType,
  GradientPreset,
  InspectorTab,
  LogoLayer,
  PaintLayer,
  ProjectRecord,
  ProjectSnapshot,
  RawPageItem,
  SavedFont,
  SavedLogoAsset,
  SelectionTarget,
  SmartCleanSettings,
  TextLayer,
  TextPreset,
  ToolId,
} from '../types/editor';
import { renderBrushPreviewCurve } from '../utils/canvasEngine';
import { BUILTIN_FONTS } from '../utils/indexedDb';
import { ColorStudio } from './ColorStudio';

const BlobImage: React.FC<{ blob: Blob; alt: string; className?: string }> = ({ blob, alt, className }) => {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  if (!url) return null;
  return <img src={url} alt={alt} className={className} />;
};

interface RightInspectorProps {
  tab: InspectorTab;
  onChangeTab: (tab: InspectorTab) => void;
  activeTool: ToolId;
  docW: number;
  docH: number;
  isDark: boolean;

  // Selection
  selection: SelectionTarget | null;
  onSelectObjects: (sel: SelectionTarget | null) => void;

  // Texts
  texts: TextLayer[];
  onBatchUpdateTexts: (patch: Partial<TextLayer>, historyLabel?: string) => void;
  onAlignTexts: (mode: 'left' | 'centerX' | 'right' | 'top' | 'centerY' | 'bottom' | 'distributeY' | 'canvasCenter') => void;
  onDuplicateSelectedText: () => void;
  onDeleteSelectedText: () => void;
  onBubbleFitSelected: () => void;
  onAddNewTextCenter: () => void;
  onMoveTextLayer: (id: string, dir: -1 | 1) => void;
  onToggleTextLayerProp: (id: string, prop: 'visible' | 'locked') => void;
  savedFonts: SavedFont[];
  onUploadFonts: (files: File[]) => void;
  onDeleteFont: (id: string) => void;
  presets: TextPreset[];
  onSaveCustomPreset: (name: string) => void;
  onDeleteCustomPreset: (id: string) => void;
  gradients: GradientPreset[];
  onSaveCustomGradient: (c1: string, c2: string, ang: number) => void;
  scriptInput: string;
  onChangeScriptInput: (v: string) => void;
  scriptLines: string[];
  scriptUsed: Set<number>;
  scriptNext: number;
  onStartScriptLine: (idx: number, reset?: boolean) => void;

  // Logos
  logos: LogoLayer[];
  onUpdateSelectedLogos: (patch: Partial<LogoLayer>, historyLabel?: string) => void;
  onPlaceLogoPreset: (pos: 'center' | 'top' | 'bottom' | 'left' | 'right') => void;
  onSendLogoToBack: () => void;
  onBringLogoToFront: () => void;
  onTileLogo: () => void;
  onDeleteSelectedLogo: () => void;
  onToggleLogoProp: (id: string, prop: 'visible' | 'locked') => void;
  onSaveLogoToLibrary: (logo: LogoLayer) => void;
  savedLogos: SavedLogoAsset[];
  onInsertSavedLogo: (asset: SavedLogoAsset) => void;
  onDeleteSavedLogo: (id: string) => void;
  onTriggerLogoUpload: () => void;

  // Paint Layers
  paintLayers: PaintLayer[];
  activePaintLayerId: string | null;
  onSelectPaintLayer: (id: string) => void;
  onAddPaintLayer: () => void;
  onUpdatePaintLayer: (id: string, patch: Partial<Pick<PaintLayer, 'visible' | 'locked' | 'opacity' | 'name'>>) => void;
  onMovePaintLayer: (id: string, dir: -1 | 1) => void;
  onDeletePaintLayer: (id: string) => void;

  // Brush & Color & Clean
  brush: BrushSettings;
  onUpdateBrush: (patch: Partial<BrushSettings>) => void;
  recentColors: string[];
  onCommitRecentColor: (hex: string) => void;
  clean: SmartCleanSettings;
  onUpdateClean: (patch: Partial<SmartCleanSettings>) => void;
  onAutoCleanAll: () => void;
  onAiClean?: (scope: 'view' | 'all', filter: AiCleanFilter) => void;
  aiCleanBusy?: boolean;
  aiCleanFilter?: AiCleanFilter;
  onChangeAiCleanFilter?: (f: AiCleanFilter) => void;
  clonePickMode?: boolean;
  onToggleClonePickMode?: () => void;

  // Script queue helpers
  onPasteScript?: () => void;
  onClearScript?: () => void;

  // Mobile sheet close
  onCloseMobileSheet?: () => void;

  // Pages & Projects
  rawPages: RawPageItem[];
  stitchWidthMode: string;
  onChangeStitchWidthMode: (mode: string) => void;
  onMoveRawPage: (idx: number, dir: -1 | 1) => void;
  onRemoveRawPage: (idx: number) => void;
  onJumpToPageY: (y: number) => void;
  onAddCustomSplitAtCurrent: () => void;
  onTriggerImageUpload: () => void;

  projects: ProjectRecord[];
  currentProjectId: string | null;
  snapshots: ProjectSnapshot[];
  onOpenProject: (id: string) => void;
  onDuplicateProject: (id: string) => void;
  onRenameProjectById: (id: string, name: string) => void;
  onDeleteProject: (id: string) => void;
  onCreateSnapshot: () => void;
  onRevertSnapshot: (snap: ProjectSnapshot) => void;
  onDeleteSnapshot: (id: string) => void;
}

export const RightInspector: React.FC<RightInspectorProps> = (props) => {
  const {
    tab,
    onChangeTab,
    activeTool,
    docW,
    docH,
    isDark,
    selection,
    onSelectObjects,
    texts,
    onBatchUpdateTexts,
    onAlignTexts,
    onDuplicateSelectedText,
    onDeleteSelectedText,
    onBubbleFitSelected,
    onAddNewTextCenter,
    onMoveTextLayer,
    onToggleTextLayerProp,
    savedFonts,
    onUploadFonts,
    onDeleteFont,
    presets,
    onSaveCustomPreset,
    onDeleteCustomPreset,
    gradients,
    onSaveCustomGradient,
    scriptInput,
    onChangeScriptInput,
    scriptLines,
    scriptUsed,
    scriptNext,
    onStartScriptLine,
    logos,
    onUpdateSelectedLogos,
    onPlaceLogoPreset,
    onSendLogoToBack,
    onBringLogoToFront,
    onTileLogo,
    onDeleteSelectedLogo,
    onToggleLogoProp,
    onSaveLogoToLibrary,
    savedLogos,
    onInsertSavedLogo,
    onDeleteSavedLogo,
    onTriggerLogoUpload,
    paintLayers,
    activePaintLayerId,
    onSelectPaintLayer,
    onAddPaintLayer,
    onUpdatePaintLayer,
    onMovePaintLayer,
    onDeletePaintLayer,
    brush,
    onUpdateBrush,
    recentColors,
    onCommitRecentColor,
    clean,
    onUpdateClean,
    onAutoCleanAll,
    onAiClean,
    aiCleanBusy = false,
    aiCleanFilter = 'all',
    onChangeAiCleanFilter,
    clonePickMode = false,
    onToggleClonePickMode,
    onPasteScript,
    onClearScript,
    onCloseMobileSheet,
    rawPages,
    stitchWidthMode,
    onChangeStitchWidthMode,
    onMoveRawPage,
    onRemoveRawPage,
    onJumpToPageY,
    onAddCustomSplitAtCurrent,
    onTriggerImageUpload,
    projects,
    currentProjectId,
    snapshots,
    onOpenProject,
    onDuplicateProject,
    onRenameProjectById,
    onDeleteProject,
    onCreateSnapshot,
    onRevertSnapshot,
    onDeleteSnapshot,
  } = props;

  const brushPreviewRef = useRef<HTMLCanvasElement | null>(null);
  const fontInputRef = useRef<HTMLInputElement | null>(null);
  const [keepLogoRatio, setKeepLogoRatio] = useState(true);
  const [showAdvancedText, setShowAdvancedText] = useState(false);
  const [showEffectsSection, setShowEffectsSection] = useState(false);
  const [showPresetsSection, setShowPresetsSection] = useState(false);
  const [showScriptSection, setShowScriptSection] = useState(false);
  const [aiScope, setAiScope] = useState<'view' | 'all'>('view');
  const [savingPresetName, setSavingPresetName] = useState<string | null>(null);
  const [renamingProjectId, setRenamingProjectId] = useState<string | null>(null);
  const [renamingDraft, setRenamingDraft] = useState('');

  const selectedTexts =
    selection?.kind === 'text' ? texts.filter((t) => selection.ids.includes(t.id)) : [];
  const primaryText = selectedTexts[0] || null;
  const selectedLogo =
    selection?.kind === 'logo' ? logos.find((l) => l.id === selection.ids[0]) || null : null;

  useEffect(() => {
    if (brushPreviewRef.current) {
      renderBrushPreviewCurve(brushPreviewRef.current, brush, isDark);
    }
  }, [brush, isDark, tab, activeTool]);

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(
      d.getHours()
    ).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  // Tool context takes priority over stale selection so switching to Cleaner or Brush opens its own settings!
  const propContext: 'text' | 'logo' | 'brush' | 'clean' =
    activeTool === 'bubble'
      ? 'clean'
      : ['brush', 'eraser', 'clone', 'eyedrop'].includes(activeTool)
      ? 'brush'
      : activeTool === 'logo' || selection?.kind === 'logo'
      ? 'logo'
      : 'text';

  return (
    <aside className="w-full md:w-80 lg:w-[340px] shrink-0 border-t-2 border-t-emerald-500 md:border-t-0 md:border-l border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#111715] flex flex-col max-h-[56dvh] md:max-h-none md:h-full rounded-t-2xl md:rounded-none z-20">
      {/* Mobile Bottom Sheet Handle */}
      {onCloseMobileSheet && (
        <button
          type="button"
          onClick={onCloseMobileSheet}
          className="md:hidden w-full py-1.5 flex items-center justify-center gap-1 text-[11px] font-medium text-neutral-500 dark:text-neutral-400 border-b border-neutral-200 dark:border-neutral-800"
        >
          <ChevronDown className="w-3.5 h-3.5" />
          Самбар хаах
        </button>
      )}

      {/* Unified 3-Tab Bar */}
      <div className="grid grid-cols-3 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-[#0e1412] shrink-0">
        {(
          [
            ['properties', 'Тохиргоо', Sliders],
            ['layers', 'Давхарга', Layers],
            ['projects', 'Төсөл', FolderOpen],
          ] as const
        ).map(([id, label, Icon]) => {
          const active = tab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChangeTab(id)}
              className={`py-2.5 px-1 flex items-center justify-center gap-1.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
                active
                  ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400 bg-white dark:bg-[#111715] font-semibold'
                  : 'border-transparent text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200'
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span>{label}</span>
            </button>
          );
        })}
      </div>

      {/* Scrollable Inspector Body */}
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-4">
        {/* ================= PROPERTIES TAB ================= */}
        {tab === 'properties' && (
          <>
            {/* ---------- CONTEXT: TEXT ---------- */}
            {propContext === 'text' && (
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                    {selectedTexts.length > 1
                      ? `${selectedTexts.length} текст зэрэг засах`
                      : primaryText
                      ? 'Текстийн тохиргоо'
                      : 'Текст систем'}
                  </div>
                  <button
                    type="button"
                    onClick={onAddNewTextCenter}
                    className="h-7 px-2.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Шинэ текст
                  </button>
                </div>

                {!primaryText ? (
                  <div className="py-4 px-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/50 text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                    Зураг дээрх текстийг дарж сонгох эсвэл <span className="font-semibold text-neutral-800 dark:text-neutral-200">Ctrl / Shift</span> дарж олон текстийг зэрэг сонгоно уу.
                  </div>
                ) : (
                  <>
                    {/* Text content (when single) */}
                    {selectedTexts.length === 1 && (
                      <div className="flex flex-col gap-1.5">
                        <textarea
                          value={primaryText.text}
                          rows={2}
                          onChange={(e) => onBatchUpdateTexts({ text: e.target.value })}
                          placeholder="Текстээ бичнэ үү..."
                          className="w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 px-2.5 py-2 text-sm text-neutral-900 dark:text-neutral-100 focus:outline-none focus:border-emerald-500"
                        />
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={onBubbleFitSelected}
                            className="flex-1 h-7 rounded-md border border-neutral-300 dark:border-neutral-700 text-xs font-medium text-neutral-700 dark:text-neutral-200 hover:border-emerald-500 flex items-center justify-center gap-1"
                          >
                            <Sparkles className="w-3 h-3" />
                            Бөмбөлөгт багтаах
                          </button>
                          <button
                            type="button"
                            onClick={onDuplicateSelectedText}
                            className="h-7 px-2.5 rounded-md border border-neutral-300 dark:border-neutral-700 text-xs text-neutral-700 dark:text-neutral-200 hover:border-emerald-500"
                            title="Хувилах (Ctrl+D)"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={onDeleteSelectedText}
                            className="h-7 px-2.5 rounded-md border border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10"
                            title="Устгах (Delete)"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Smart Alignment Tools */}
                    <div className="flex flex-col gap-1.5 pt-2 border-t border-neutral-200 dark:border-neutral-800">
                      <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
                        Ухаалаг тэгшлэлт (Smart Align)
                      </span>
                      <div className="grid grid-cols-4 gap-1">
                        <button
                          type="button"
                          onClick={() => onAlignTexts('canvasCenter')}
                          className="h-7 rounded border border-neutral-200 dark:border-neutral-800 text-[11px] text-neutral-700 dark:text-neutral-200 hover:border-emerald-500"
                          title="Хуудасны төвд"
                        >
                          Хуудас төв
                        </button>
                        <button
                          type="button"
                          onClick={() => onAlignTexts('left')}
                          className="h-7 rounded border border-neutral-200 dark:border-neutral-800 text-[11px] text-neutral-700 dark:text-neutral-200 hover:border-emerald-500 flex items-center justify-center"
                          title="Зүүн ирмэгээр"
                        >
                          <AlignLeft className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onAlignTexts('centerX')}
                          className="h-7 rounded border border-neutral-200 dark:border-neutral-800 text-[11px] text-neutral-700 dark:text-neutral-200 hover:border-emerald-500 flex items-center justify-center"
                          title="Хэвтээ голоор"
                        >
                          <AlignHorizontalJustifyCenter className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onAlignTexts('right')}
                          className="h-7 rounded border border-neutral-200 dark:border-neutral-800 text-[11px] text-neutral-700 dark:text-neutral-200 hover:border-emerald-500 flex items-center justify-center"
                          title="Баруун ирмэгээр"
                        >
                          <AlignRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      {selectedTexts.length > 1 && (
                        <div className="grid grid-cols-2 gap-1">
                          <button
                            type="button"
                            onClick={() => onAlignTexts('centerY')}
                            className="h-7 rounded border border-neutral-200 dark:border-neutral-800 text-[11px] text-neutral-700 dark:text-neutral-200 hover:border-emerald-500 flex items-center justify-center gap-1"
                          >
                            <AlignVerticalJustifyCenter className="w-3.5 h-3.5" />
                            Босоо голлуулах
                          </button>
                          <button
                            type="button"
                            onClick={() => onAlignTexts('distributeY')}
                            className="h-7 rounded border border-neutral-200 dark:border-neutral-800 text-[11px] text-neutral-700 dark:text-neutral-200 hover:border-emerald-500"
                          >
                            Ижил зайтай болгох
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Font & Typography (Batch applies to all selected texts!) */}
                    <div className="flex flex-col gap-2 pt-2 border-t border-neutral-200 dark:border-neutral-800">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
                          Фонт ба хэмжээ
                        </span>
                        <input
                          ref={fontInputRef}
                          type="file"
                          accept=".ttf,.otf,.woff,.woff2"
                          multiple
                          hidden
                          onChange={(e) => {
                            const files = Array.from(e.target.files || []);
                            if (files.length) onUploadFonts(files);
                            e.target.value = '';
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => fontInputRef.current?.click()}
                          className="text-[11px] text-emerald-600 dark:text-emerald-400 hover:underline font-medium"
                        >
                          + Фонт (.ttf)
                        </button>
                      </div>

                      <select
                        value={primaryText.fontFamily}
                        onChange={(e) => onBatchUpdateTexts({ fontFamily: e.target.value }, 'Фонт солих')}
                        className="h-8 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 px-2 text-xs text-neutral-900 dark:text-neutral-100"
                      >
                        {BUILTIN_FONTS.map((f) => (
                          <option key={f.value} value={f.value} style={{ fontFamily: f.value }}>
                            {f.label}
                          </option>
                        ))}
                        {savedFonts.map((sf) => (
                          <option key={sf.id} value={`'PFFont_${sf.id}', sans-serif`}>
                            {sf.name}
                          </option>
                        ))}
                      </select>

                      <div
                        className="py-2 px-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/70 text-center text-base text-neutral-900 dark:text-neutral-100 truncate"
                        style={{ fontFamily: primaryText.fontFamily }}
                      >
                        Аа Бб Өө Үү — Манга Орчуулга 123
                      </div>

                      {savedFonts.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {savedFonts.map((sf) => (
                            <span
                              key={sf.id}
                              className="inline-flex items-center gap-1 text-[11px] text-neutral-600 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-800 rounded px-1.5 py-0.5"
                            >
                              {sf.name}
                              <button
                                type="button"
                                onClick={() => onDeleteFont(sf.id)}
                                className="text-rose-500 hover:text-rose-400 ml-0.5"
                              >
                                ×
                              </button>
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-2">
                        <label className="flex flex-col gap-1 text-[11px] text-neutral-500 dark:text-neutral-400">
                          <span className="flex justify-between">
                            <span>Хэмжээ</span>
                            <span className="font-mono-num text-neutral-800 dark:text-neutral-200">
                              {primaryText.fontSize}px
                            </span>
                          </span>
                          <input
                            type="range"
                            min={10}
                            max={150}
                            value={primaryText.fontSize}
                            onChange={(e) =>
                              onBatchUpdateTexts({ fontSize: Number(e.target.value) }, 'Үсгийн хэмжээ')
                            }
                            className="accent-emerald-600"
                          />
                        </label>
                        <label className="flex flex-col gap-1 text-[11px] text-neutral-500 dark:text-neutral-400">
                          <span className="flex justify-between">
                            <span>Хайрцаг өргөн</span>
                            <span className="font-mono-num text-neutral-800 dark:text-neutral-200">
                              {primaryText.boxWidth}px
                            </span>
                          </span>
                          <input
                            type="range"
                            min={50}
                            max={Math.max(400, docW)}
                            value={primaryText.boxWidth}
                            onChange={(e) =>
                              onBatchUpdateTexts({ boxWidth: Number(e.target.value) }, 'Хайрцагны өргөн')
                            }
                            className="accent-emerald-600"
                          />
                        </label>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => onBatchUpdateTexts({ bold: !primaryText.bold }, 'Тод')}
                          className={`h-7 w-8 rounded border flex items-center justify-center ${
                            primaryText.bold
                              ? 'bg-emerald-600 border-emerald-600 text-white'
                              : 'border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-200'
                          }`}
                        >
                          <Bold className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onBatchUpdateTexts({ italic: !primaryText.italic }, 'Налуу')}
                          className={`h-7 w-8 rounded border flex items-center justify-center ${
                            primaryText.italic
                              ? 'bg-emerald-600 border-emerald-600 text-white'
                              : 'border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-200'
                          }`}
                        >
                          <Italic className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onBatchUpdateTexts({ underline: !primaryText.underline }, 'Доогуур зураас')}
                          className={`h-7 w-8 rounded border flex items-center justify-center ${
                            primaryText.underline
                              ? 'bg-emerald-600 border-emerald-600 text-white'
                              : 'border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-200'
                          }`}
                        >
                          <Underline className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onBatchUpdateTexts({ uppercase: !primaryText.uppercase }, 'Том үсэг')}
                          className={`h-7 px-2 rounded border text-[11px] font-semibold ${
                            primaryText.uppercase
                              ? 'bg-emerald-600 border-emerald-600 text-white'
                              : 'border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-200'
                          }`}
                        >
                          AA
                        </button>
                        <div className="flex-1 flex items-center justify-end gap-0.5">
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
                              className={`h-7 w-7 rounded border flex items-center justify-center ${
                                primaryText.align === al
                                  ? 'bg-emerald-600 border-emerald-600 text-white'
                                  : 'border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-200'
                              }`}
                            >
                              <Icon className="w-3.5 h-3.5" />
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Color, Stroke, Gradient */}
                    <div className="flex flex-col gap-2.5 pt-2 border-t border-neutral-200 dark:border-neutral-800">
                      <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
                        Өнгө, Хүрээ ба Градиент
                      </span>
                      <div className="grid grid-cols-3 gap-2 items-end">
                        <label className="flex flex-col gap-1 text-[11px] text-neutral-500 dark:text-neutral-400">
                          <span>Үсэг</span>
                          <input
                            type="color"
                            value={primaryText.color}
                            onChange={(e) => onBatchUpdateTexts({ color: e.target.value, gradEnabled: false }, 'Үсгийн өнгө')}
                            className="w-full h-7 rounded border border-neutral-300 dark:border-neutral-700 bg-transparent cursor-pointer"
                          />
                        </label>
                        <label className="flex flex-col gap-1 text-[11px] text-neutral-500 dark:text-neutral-400">
                          <span>Хүрээ</span>
                          <input
                            type="color"
                            value={primaryText.strokeColor}
                            onChange={(e) => onBatchUpdateTexts({ strokeColor: e.target.value }, 'Хүрээний өнгө')}
                            className="w-full h-7 rounded border border-neutral-300 dark:border-neutral-700 bg-transparent cursor-pointer"
                          />
                        </label>
                        <label className="flex flex-col gap-1 text-[11px] text-neutral-500 dark:text-neutral-400">
                          <span>Зузаан ({primaryText.strokeWidth})</span>
                          <input
                            type="range"
                            min={0}
                            max={24}
                            value={primaryText.strokeWidth}
                            onChange={(e) =>
                              onBatchUpdateTexts({ strokeWidth: Number(e.target.value) }, 'Хүрээний зузаан')
                            }
                            className="accent-emerald-600"
                          />
                        </label>
                      </div>

                      {/* Collapsible Gradient, Glow, Shadow & Background */}
                      <button
                        type="button"
                        onClick={() => setShowEffectsSection((v) => !v)}
                        className="w-full flex items-center justify-between py-1 text-xs font-medium text-neutral-600 dark:text-neutral-300 hover:text-emerald-600"
                      >
                        <span>Градиент, Гэрэлтэлт, Сүүдэр ба Хайрцаг</span>
                        <span>{showEffectsSection ? '▴' : '▾'}</span>
                      </button>

                      {showEffectsSection && (
                        <div className="flex flex-col gap-2.5 pt-1">
                          <div className="flex items-center justify-between">
                        <label className="flex items-center gap-2 text-xs text-neutral-700 dark:text-neutral-300 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={primaryText.gradEnabled}
                            onChange={(e) =>
                              onBatchUpdateTexts({ gradEnabled: e.target.checked }, 'Градиент')
                            }
                            className="accent-emerald-600"
                          />
                          <span>Градиент өнгө</span>
                        </label>
                        <button
                          type="button"
                          onClick={() =>
                            onSaveCustomGradient(primaryText.grad1, primaryText.grad2, primaryText.gradAng)
                          }
                          className="text-[11px] text-emerald-600 dark:text-emerald-400 hover:underline"
                        >
                          + Хадгалах
                        </button>
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                        {gradients.map((g) => (
                          <button
                            key={g.id}
                            type="button"
                            onClick={() =>
                              onBatchUpdateTexts(
                                { gradEnabled: true, grad1: g.c1, grad2: g.c2, gradAng: g.ang },
                                'Градиент'
                              )
                            }
                            className="w-6 h-6 rounded-full border border-neutral-300 dark:border-neutral-700"
                            style={{ background: `linear-gradient(${g.ang}deg, ${g.c1}, ${g.c2})` }}
                          />
                        ))}
                      </div>

                      {primaryText.gradEnabled && (
                        <div className="grid grid-cols-3 gap-2">
                          <input
                            type="color"
                            value={primaryText.grad1}
                            onChange={(e) => onBatchUpdateTexts({ grad1: e.target.value })}
                            className="w-full h-7 rounded border border-neutral-300 dark:border-neutral-700 cursor-pointer"
                          />
                          <input
                            type="color"
                            value={primaryText.grad2}
                            onChange={(e) => onBatchUpdateTexts({ grad2: e.target.value })}
                            className="w-full h-7 rounded border border-neutral-300 dark:border-neutral-700 cursor-pointer"
                          />
                          <input
                            type="range"
                            min={0}
                            max={360}
                            value={primaryText.gradAng}
                            onChange={(e) => onBatchUpdateTexts({ gradAng: Number(e.target.value) })}
                            className="accent-emerald-600"
                            title={`Өнцөг: ${primaryText.gradAng}°`}
                          />
                        </div>
                      )}

                    {/* Glow & Full Shadow Controls (Angle, Distance, Blur, Opacity) */}
                    <div className="flex flex-col gap-2 pt-2 border-t border-neutral-200 dark:border-neutral-800">
                      <label className="flex items-center gap-2 text-xs text-neutral-700 dark:text-neutral-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={primaryText.glowEnabled}
                          onChange={(e) => onBatchUpdateTexts({ glowEnabled: e.target.checked }, 'Glow')}
                          className="accent-emerald-600"
                        />
                        <span>Гэрэлтэлт (Glow)</span>
                      </label>
                      {primaryText.glowEnabled && (
                        <div className="grid grid-cols-2 gap-2 pl-5">
                          <input
                            type="color"
                            value={primaryText.glowColor}
                            onChange={(e) => onBatchUpdateTexts({ glowColor: e.target.value })}
                            className="w-full h-7 rounded border border-neutral-300 dark:border-neutral-700 cursor-pointer"
                          />
                          <label className="flex flex-col gap-0.5 text-[11px] text-neutral-500">
                            <span>Тархалт ({primaryText.glowRadius}px)</span>
                            <input
                              type="range"
                              min={2}
                              max={40}
                              value={primaryText.glowRadius}
                              onChange={(e) => onBatchUpdateTexts({ glowRadius: Number(e.target.value) })}
                              className="accent-emerald-600"
                            />
                          </label>
                        </div>
                      )}

                      <label className="flex items-center gap-2 text-xs text-neutral-700 dark:text-neutral-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={primaryText.shadowEnabled}
                          onChange={(e) => onBatchUpdateTexts({ shadowEnabled: e.target.checked }, 'Сүүдэр')}
                          className="accent-emerald-600"
                        />
                        <span>Сүүдэр (Текстийн ард)</span>
                      </label>

                      {primaryText.shadowEnabled && (
                        <div className="grid grid-cols-2 gap-2 pl-5">
                          <label className="flex flex-col gap-1 text-[11px] text-neutral-500">
                            <span>Өнгө</span>
                            <input
                              type="color"
                              value={primaryText.shadowColor}
                              onChange={(e) => onBatchUpdateTexts({ shadowColor: e.target.value })}
                              className="w-full h-7 rounded border border-neutral-300 dark:border-neutral-700 cursor-pointer"
                            />
                          </label>
                          <label className="flex flex-col gap-1 text-[11px] text-neutral-500">
                            <span>Тунгалаг ({primaryText.shadowOpacity}%)</span>
                            <input
                              type="range"
                              min={5}
                              max={100}
                              value={primaryText.shadowOpacity}
                              onChange={(e) => onBatchUpdateTexts({ shadowOpacity: Number(e.target.value) })}
                              className="accent-emerald-600"
                            />
                          </label>
                          <label className="flex flex-col gap-1 text-[11px] text-neutral-500">
                            <span>Өнцөг ({primaryText.shadowAngle}°)</span>
                            <input
                              type="range"
                              min={0}
                              max={360}
                              value={primaryText.shadowAngle}
                              onChange={(e) => onBatchUpdateTexts({ shadowAngle: Number(e.target.value) })}
                              className="accent-emerald-600"
                            />
                          </label>
                          <label className="flex flex-col gap-1 text-[11px] text-neutral-500">
                            <span>Зай ({primaryText.shadowDistance}px)</span>
                            <input
                              type="range"
                              min={0}
                              max={40}
                              value={primaryText.shadowDistance}
                              onChange={(e) => onBatchUpdateTexts({ shadowDistance: Number(e.target.value) })}
                              className="accent-emerald-600"
                            />
                          </label>
                          <label className="col-span-2 flex flex-col gap-1 text-[11px] text-neutral-500">
                            <span>Бүдгэрэл ({primaryText.shadowBlur}px)</span>
                            <input
                              type="range"
                              min={0}
                              max={40}
                              value={primaryText.shadowBlur}
                              onChange={(e) => onBatchUpdateTexts({ shadowBlur: Number(e.target.value) })}
                              className="accent-emerald-600"
                            />
                          </label>
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-1">
                        <label className="flex items-center gap-2 text-xs text-neutral-700 dark:text-neutral-300 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={primaryText.bgEnabled}
                            onChange={(e) => onBatchUpdateTexts({ bgEnabled: e.target.checked }, 'Арын хайрцаг')}
                            className="accent-emerald-600"
                          />
                          <span>Арын хайрцаг</span>
                        </label>
                        {primaryText.bgEnabled && (
                          <input
                            type="color"
                            value={primaryText.bgColor}
                            onChange={(e) => onBatchUpdateTexts({ bgColor: e.target.value })}
                            className="w-12 h-6 rounded border border-neutral-300 dark:border-neutral-700 cursor-pointer"
                          />
                        )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                    {/* Advanced Transform (Collapsed by default) */}
                    <div className="pt-2 border-t border-neutral-200 dark:border-neutral-800">
                      <button
                        type="button"
                        onClick={() => setShowAdvancedText((v) => !v)}
                        className="w-full flex items-center justify-between text-xs font-medium text-neutral-600 dark:text-neutral-300 hover:text-emerald-600"
                      >
                        <span>Нарийн тохиргоо (Зай, Эргүүлэлт, Нуман)</span>
                        <span>{showAdvancedText ? '▴' : '▾'}</span>
                      </button>

                      {showAdvancedText && (
                        <div className="mt-2.5 flex flex-col gap-2">
                          <div className="grid grid-cols-2 gap-2">
                            <label className="text-[11px] text-neutral-500 flex flex-col gap-1">
                              <span>Үсгийн зай ({primaryText.letterSpacing}px)</span>
                              <input
                                type="range"
                                min={-3}
                                max={20}
                                step={0.5}
                                value={primaryText.letterSpacing}
                                onChange={(e) => onBatchUpdateTexts({ letterSpacing: Number(e.target.value) })}
                                className="accent-emerald-600"
                              />
                            </label>
                            <label className="text-[11px] text-neutral-500 flex flex-col gap-1">
                              <span>Мөрийн зай ({primaryText.lineHeight.toFixed(2)})</span>
                              <input
                                type="range"
                                min={0.8}
                                max={2.4}
                                step={0.05}
                                value={primaryText.lineHeight}
                                onChange={(e) => onBatchUpdateTexts({ lineHeight: Number(e.target.value) })}
                                className="accent-emerald-600"
                              />
                            </label>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <label className="text-[11px] text-neutral-500 flex flex-col gap-1">
                              <span>Эргүүлэлт ({primaryText.rotation}°)</span>
                              <input
                                type="range"
                                min={-180}
                                max={180}
                                value={primaryText.rotation}
                                onChange={(e) => onBatchUpdateTexts({ rotation: Number(e.target.value) })}
                                className="accent-emerald-600"
                              />
                            </label>
                            <label className="text-[11px] text-neutral-500 flex flex-col gap-1">
                              <span>Тунгалаг ({Math.round((primaryText.opacity ?? 1) * 100)}%)</span>
                              <input
                                type="range"
                                min={10}
                                max={100}
                                value={Math.round((primaryText.opacity ?? 1) * 100)}
                                onChange={(e) => onBatchUpdateTexts({ opacity: Number(e.target.value) / 100 })}
                                className="accent-emerald-600"
                              />
                            </label>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <label className="text-[11px] text-neutral-500 flex flex-col gap-1">
                              <span>Нуман ({primaryText.bend})</span>
                              <input
                                type="range"
                                min={-100}
                                max={100}
                                value={primaryText.bend}
                                onChange={(e) => onBatchUpdateTexts({ bend: Number(e.target.value) })}
                                className="accent-emerald-600"
                              />
                            </label>
                            <label className="text-[11px] text-neutral-500 flex flex-col gap-1">
                              <span>Налалт X ({primaryText.perspX})</span>
                              <input
                                type="range"
                                min={-60}
                                max={60}
                                value={primaryText.perspX}
                                onChange={(e) => onBatchUpdateTexts({ perspX: Number(e.target.value) })}
                                className="accent-emerald-600"
                              />
                            </label>
                            <label className="text-[11px] text-neutral-500 flex flex-col gap-1">
                              <span>Налалт Y ({primaryText.perspY})</span>
                              <input
                                type="range"
                                min={-60}
                                max={60}
                                value={primaryText.perspY}
                                onChange={(e) => onBatchUpdateTexts({ perspY: Number(e.target.value) })}
                                className="accent-emerald-600"
                              />
                            </label>
                          </div>
                          <div className="grid grid-cols-3 gap-2 items-end">
                            <label className="text-[11px] text-neutral-500 flex flex-col gap-1">
                              <span>Scale X ({primaryText.scaleX.toFixed(2)}x)</span>
                              <input
                                type="range"
                                min={0.4}
                                max={2.5}
                                step={0.05}
                                value={primaryText.scaleX}
                                onChange={(e) => onBatchUpdateTexts({ scaleX: Number(e.target.value) })}
                                className="accent-emerald-600"
                              />
                            </label>
                            <label className="text-[11px] text-neutral-500 flex flex-col gap-1">
                              <span>Scale Y ({primaryText.scaleY.toFixed(2)}x)</span>
                              <input
                                type="range"
                                min={0.4}
                                max={2.5}
                                step={0.05}
                                value={primaryText.scaleY}
                                onChange={(e) => onBatchUpdateTexts({ scaleY: Number(e.target.value) })}
                                className="accent-emerald-600"
                              />
                            </label>
                            <button
                              type="button"
                              onClick={() =>
                                onBatchUpdateTexts(
                                  { scaleX: 1, scaleY: 1, rotation: 0, bend: 0, perspX: 0, perspY: 0, opacity: 1 },
                                  '1:1 сэргээх'
                                )
                              }
                              className="h-7 w-full rounded border border-neutral-300 dark:border-neutral-700 text-[11px] text-neutral-700 dark:text-neutral-200 flex items-center justify-center gap-1"
                            >
                              <RotateCcw className="w-3 h-3" />
                              1:1
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Presets (Collapsible) */}
                    <div className="flex flex-col gap-1.5 pt-2 border-t border-neutral-200 dark:border-neutral-800">
                      <div className="flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() => setShowPresetsSection((v) => !v)}
                          className="flex items-center gap-1.5 text-xs font-medium text-neutral-600 dark:text-neutral-300 hover:text-emerald-600"
                        >
                          <span>Хадгалсан загварууд ({presets.length})</span>
                          <span>{showPresetsSection ? '▴' : '▾'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowPresetsSection(true);
                            setSavingPresetName(`Загвар ${presets.length + 1}`);
                          }}
                          className="text-[11px] text-emerald-600 dark:text-emerald-400 hover:underline"
                        >
                          + Хадгалах
                        </button>
                      </div>
                      {savingPresetName !== null && (
                        <div className="flex items-center gap-1.5 pt-1">
                          <input
                            type="text"
                            value={savingPresetName}
                            onChange={(e) => setSavingPresetName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && savingPresetName.trim()) {
                                onSaveCustomPreset(savingPresetName.trim());
                                setSavingPresetName(null);
                              } else if (e.key === 'Escape') {
                                setSavingPresetName(null);
                              }
                            }}
                            placeholder="Загварын нэр..."
                            className="flex-1 h-7 px-2 rounded border border-emerald-500 bg-neutral-50 dark:bg-neutral-900 text-xs text-neutral-900 dark:text-neutral-100 focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              if (savingPresetName.trim()) {
                                onSaveCustomPreset(savingPresetName.trim());
                                setSavingPresetName(null);
                              }
                            }}
                            className="h-7 w-7 rounded bg-emerald-600 text-white flex items-center justify-center"
                            title="Хадгалах"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setSavingPresetName(null)}
                            className="h-7 w-7 rounded border border-neutral-300 dark:border-neutral-700 text-neutral-500 flex items-center justify-center"
                            title="Болих"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                      {showPresetsSection && (
                        <div className="grid grid-cols-2 gap-1.5 pt-1">
                          {presets.map((p) => (
                            <div key={p.id} className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => onBatchUpdateTexts(p.style, `Загвар: ${p.name}`)}
                                className="flex-1 h-7 px-2 rounded border border-neutral-200 dark:border-neutral-800 hover:border-emerald-500 text-[11px] text-neutral-700 dark:text-neutral-200 truncate text-left"
                              >
                                {p.name}
                              </button>
                              {!p.builtIn && (
                                <button
                                  type="button"
                                  onClick={() => onDeleteCustomPreset(p.id)}
                                  className="h-7 px-1.5 rounded border border-rose-500/30 text-rose-500 text-xs"
                                >
                                  ×
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* Translation Script Queue (Collapsible) */}
                <div className="flex flex-col gap-1.5 pt-2 border-t border-neutral-200 dark:border-neutral-800">
                  <button
                    type="button"
                    onClick={() => setShowScriptSection((v) => !v)}
                    className="w-full flex items-center justify-between text-xs font-medium text-neutral-600 dark:text-neutral-300 hover:text-emerald-600"
                  >
                    <span>
                      Орчуулга буулгах дараалал {scriptLines.length > 0 ? `(${scriptLines.length})` : ''}
                    </span>
                    <span>{showScriptSection ? '▴' : '▾'}</span>
                  </button>

                  {showScriptSection && (
                    <div className="flex flex-col gap-1.5 pt-1">
                      <div className="flex items-center justify-between gap-1">
                        {onPasteScript && (
                          <button
                            type="button"
                            onClick={onPasteScript}
                            className="h-7 px-2 rounded border border-neutral-300 dark:border-neutral-700 text-[11px] text-neutral-700 dark:text-neutral-200 hover:border-emerald-500"
                          >
                            Наах
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => onStartScriptLine(0, true)}
                          className="flex-1 h-7 px-2 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-medium"
                        >
                          Эхнээс нь тавих
                        </button>
                        {onClearScript && scriptLines.length > 0 && (
                          <button
                            type="button"
                            onClick={onClearScript}
                            className="h-7 px-2 rounded border border-neutral-300 dark:border-neutral-700 text-[11px] text-neutral-500 hover:text-rose-500"
                          >
                            Цэвэрлэх
                          </button>
                        )}
                      </div>
                      <textarea
                        value={scriptInput}
                        onChange={(e) => onChangeScriptInput(e.target.value)}
                        rows={3}
                        placeholder="Мөр бүр = 1 бөмбөлөг. Шинэ мөрийг «//» гэж бичнэ."
                        className="w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 px-2.5 py-1.5 text-xs text-neutral-900 dark:text-neutral-100 focus:outline-none focus:border-emerald-500"
                      />
                      {scriptLines.length > 0 && (
                        <div className="max-h-36 overflow-y-auto flex flex-col gap-1">
                          {scriptLines.map((ln, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => onStartScriptLine(idx)}
                              className={`text-left px-2 py-1 rounded border text-[11px] transition-colors ${
                                idx === scriptNext
                                  ? 'border-emerald-500 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-medium'
                                  : scriptUsed.has(idx)
                                  ? 'border-neutral-200 dark:border-neutral-800 opacity-45 line-through text-neutral-500'
                                  : 'border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-200 hover:border-emerald-500'
                              }`}
                            >
                              <span className="font-mono-num text-neutral-400 mr-1.5">{idx + 1}.</span>
                              {ln.replace(/\n/g, ' ⏎ ')}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ---------- CONTEXT: LOGO ---------- */}
            {propContext === 'logo' && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                    Лого ба Watermark
                  </span>
                  <button
                    type="button"
                    onClick={onTriggerLogoUpload}
                    className="h-7 px-2.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Лого нэмэх
                  </button>
                </div>

                {selectedLogo ? (
                  <>
                    {/* Quick Placement Grid */}
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
                        Хуудсан дээрх байрлал
                      </span>
                      <div className="grid grid-cols-5 gap-1">
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
                            className="h-7 rounded border border-neutral-300 dark:border-neutral-700 hover:border-emerald-500 text-[11px] text-neutral-700 dark:text-neutral-200"
                          >
                            {lbl}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Z-order: Send to back vs Front */}
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={onSendLogoToBack}
                        className={`h-8 rounded-md border text-xs font-medium ${
                          !selectedLogo.aboveText
                            ? 'border-emerald-500 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                            : 'border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-200'
                        }`}
                      >
                        Эхлэл рүү (Back)
                      </button>
                      <button
                        type="button"
                        onClick={onBringLogoToFront}
                        className={`h-8 rounded-md border text-xs font-medium ${
                          selectedLogo.aboveText
                            ? 'border-emerald-500 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                            : 'border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-200'
                        }`}
                      >
                        Дээд талд (Front)
                      </button>
                    </div>

                    {/* Opacity & Dimensions */}
                    <label className="flex flex-col gap-1 text-[11px] text-neutral-500 dark:text-neutral-400">
                      <span className="flex justify-between">
                        <span>Тунгалаг байдал</span>
                        <span className="font-mono-num text-neutral-800 dark:text-neutral-200">
                          {Math.round(selectedLogo.opacity * 100)}%
                        </span>
                      </span>
                      <input
                        type="range"
                        min={5}
                        max={100}
                        value={Math.round(selectedLogo.opacity * 100)}
                        onChange={(e) =>
                          onUpdateSelectedLogos({ opacity: Number(e.target.value) / 100 }, 'Лого тунгалагшил')
                        }
                        className="accent-emerald-600"
                      />
                    </label>

                    <div className="grid grid-cols-2 gap-2">
                      <label className="flex flex-col gap-1 text-[11px] text-neutral-500 dark:text-neutral-400">
                        <span>Өргөн ({selectedLogo.width}px)</span>
                        <input
                          type="range"
                          min={20}
                          max={docW}
                          value={selectedLogo.width}
                          onChange={(e) => {
                            const w = Number(e.target.value);
                            const ratio = selectedLogo.img.height / selectedLogo.img.width;
                            onUpdateSelectedLogos(
                              keepLogoRatio ? { width: w, height: Math.max(10, Math.round(w * ratio)) } : { width: w },
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
                    </div>

                    {!keepLogoRatio && (
                      <label className="flex flex-col gap-1 text-[11px] text-neutral-500 dark:text-neutral-400">
                        <span>Өндөр ({selectedLogo.height}px)</span>
                        <input
                          type="range"
                          min={10}
                          max={Math.max(400, docH)}
                          value={selectedLogo.height}
                          onChange={(e) =>
                            onUpdateSelectedLogos({ height: Number(e.target.value) }, 'Лого өндөр')
                          }
                          className="accent-emerald-600"
                        />
                      </label>
                    )}

                    <label className="flex items-center gap-2 text-xs text-neutral-700 dark:text-neutral-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={keepLogoRatio}
                        onChange={(e) => setKeepLogoRatio(e.target.checked)}
                        className="accent-emerald-600"
                      />
                      <span>Харьцааг хадгалах</span>
                    </label>

                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => onUpdateSelectedLogos({ flipX: !selectedLogo.flipX }, 'Хэвтээ толь')}
                        className={`h-7 rounded border text-xs ${
                          selectedLogo.flipX
                            ? 'border-emerald-500 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-medium'
                            : 'border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-200'
                        }`}
                      >
                        ⇄ Хэвтээ толь
                      </button>
                      <button
                        type="button"
                        onClick={() => onUpdateSelectedLogos({ flipY: !selectedLogo.flipY }, 'Босоо толь')}
                        className={`h-7 rounded border text-xs ${
                          selectedLogo.flipY
                            ? 'border-emerald-500 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-medium'
                            : 'border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-200'
                        }`}
                      >
                        ⇅ Босоо толь
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={onTileLogo}
                        className="flex-1 h-7 rounded border border-neutral-300 dark:border-neutral-700 text-xs text-neutral-700 dark:text-neutral-200 hover:border-emerald-500"
                      >
                        1500px тутамд давтах
                      </button>
                      <button
                        type="button"
                        onClick={() => onSaveLogoToLibrary(selectedLogo)}
                        className="h-7 px-2.5 rounded border border-emerald-500/40 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-1"
                        title="Миний лого санд хадгалах"
                      >
                        <BookmarkPlus className="w-3.5 h-3.5" />
                        Хадгалах
                      </button>
                      <button
                        type="button"
                        onClick={onDeleteSelectedLogo}
                        className="h-7 px-2 rounded border border-rose-500/30 text-rose-500"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="py-3 px-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/50 text-xs text-neutral-500 dark:text-neutral-400">
                    Лого эсвэл watermark зураг оруулж байрлал, тунгалагшил, дарааллаа удирдана уу.
                  </div>
                )}

                {/* Reusable Logo & Watermark Library */}
                <div className="flex flex-col gap-2 pt-2 border-t border-neutral-200 dark:border-neutral-800">
                  <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
                    Хадгалсан лого ба Watermark ({savedLogos.length})
                  </span>
                  {savedLogos.length === 0 ? (
                    <span className="text-[11px] text-neutral-400">
                      Лого сонгоод «Хадгалах» дарвал дараагийн бүлэгт шууд ашиглана.
                    </span>
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      {savedLogos.map((sl) => (
                        <div
                          key={sl.id}
                          className="group relative rounded-lg border border-neutral-200 dark:border-neutral-800 p-1.5 bg-neutral-50 dark:bg-neutral-900 flex flex-col items-center gap-1"
                        >
                          <button
                            type="button"
                            onClick={() => onInsertSavedLogo(sl)}
                            className="w-full h-12 flex items-center justify-center checker-bg rounded overflow-hidden"
                            title={`${sl.name} оруулах`}
                          >
                            <BlobImage
                              blob={sl.blob}
                              alt={sl.name}
                              className="max-h-11 max-w-full object-contain"
                            />
                          </button>
                          <span className="text-[10px] text-neutral-600 dark:text-neutral-300 truncate w-full text-center">
                            {sl.name}
                          </span>
                          <button
                            type="button"
                            onClick={() => onDeleteSavedLogo(sl.id)}
                            className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-neutral-900/70 text-white text-[10px] opacity-0 group-hover:opacity-100 flex items-center justify-center"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ---------- CONTEXT: BRUSH & COLOR (ibisPaint X Style) ---------- */}
            {propContext === 'brush' && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                    {activeTool === 'eraser'
                      ? 'Баллуурын тохиргоо'
                      : activeTool === 'clone'
                      ? 'Хуулах (Clone Stamp)'
                      : 'Бийр ба Өнгөний Студи'}
                  </span>
                </div>

                {/* Live Stroke Preview */}
                <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 overflow-hidden">
                  <canvas ref={brushPreviewRef} width={296} height={58} className="w-full h-14 block" />
                </div>

                {activeTool === 'clone' && (
                  <div className="flex flex-col gap-1.5">
                    {onToggleClonePickMode && (
                      <button
                        type="button"
                        onClick={onToggleClonePickMode}
                        className={`h-8 px-2.5 rounded-lg border text-xs font-medium flex items-center justify-center gap-1.5 ${
                          clonePickMode
                            ? 'border-emerald-500 bg-emerald-600 text-white'
                            : 'border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-200 hover:border-emerald-500'
                        }`}
                      >
                        <Crosshair className="w-3.5 h-3.5" />
                        {clonePickMode ? 'Зураг дээр дарж эх цэг авна уу…' : 'Эх цэг авах'}
                      </button>
                    )}
                    <div className="text-[11px] px-2.5 py-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                      Зураг дээр <b>Alt + Click</b> эсвэл дээрх товчоор хуулах эх цэгийг сонгоно уу.
                    </div>
                  </div>
                )}

                {activeTool !== 'eraser' && activeTool !== 'clone' && (
                  <div className="grid grid-cols-3 gap-1">
                    {(
                      [
                        ['gpen', 'G-Pen Ink'],
                        ['airbrush', 'Airbrush'],
                        ['marker', 'Marker'],
                        ['screentone', 'Screentone'],
                        ['blur', 'Blur / Smudge'],
                      ] as [BrushType, string][]
                    ).map(([id, lbl]) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => onUpdateBrush({ type: id })}
                        className={`py-1.5 px-1.5 rounded-md border text-[11px] font-medium whitespace-nowrap ${
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

                <div className="grid grid-cols-2 gap-2.5">
                  <label className="flex flex-col gap-1 text-[11px] text-neutral-500 dark:text-neutral-400">
                    <span className="flex justify-between">
                      <span>Хэмжээ</span>
                      <span className="font-mono-num text-neutral-800 dark:text-neutral-200">{brush.size}px</span>
                    </span>
                    <input
                      type="range"
                      min={1}
                      max={150}
                      value={brush.size}
                      onChange={(e) => onUpdateBrush({ size: Number(e.target.value) })}
                      className="accent-emerald-600"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-[11px] text-neutral-500 dark:text-neutral-400">
                    <span className="flex justify-between">
                      <span>Тунгалаг байдал</span>
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
                      <span>Мөрийн зай</span>
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
                  <label className="flex items-center gap-2 text-xs text-neutral-700 dark:text-neutral-300 cursor-pointer pt-3">
                    <input
                      type="checkbox"
                      checked={brush.taper ?? true}
                      onChange={(e) => onUpdateBrush({ taper: e.target.checked })}
                      className="accent-emerald-600"
                    />
                    <span>Үзүүр нарийсах</span>
                  </label>
                </div>

                {activeTool !== 'eraser' && (
                  <div className="pt-2 border-t border-neutral-200 dark:border-neutral-800">
                    <ColorStudio
                      color={brush.color}
                      onChange={(hex) => onUpdateBrush({ color: hex })}
                      recentColors={recentColors}
                      onCommitRecent={onCommitRecentColor}
                    />
                  </div>
                )}
              </div>
            )}

            {/* ---------- CONTEXT: SMART CLEANER ---------- */}
            {propContext === 'clean' && (
              <div className="flex flex-col gap-3">
                <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                  Ухаалаг цэвэрлэгчийн тохиргоо
                </span>
                <label className="flex flex-col gap-1 text-[11px] text-neutral-500 dark:text-neutral-400">
                  <span>Арга</span>
                  <select
                    value={clean.mode}
                    onChange={(e) => onUpdateClean({ mode: e.target.value as SmartCleanSettings['mode'] })}
                    className="h-8 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 px-2 text-xs text-neutral-900 dark:text-neutral-100"
                  >
                    <option value="erase">Шууд арилгах (Magic Eraser)</option>
                    <option value="inpaint">Зөвхөн текстийг арилгах (Auto Inpaint)</option>
                    <option value="fill">Арын өнгөөр дүүргэх (Fill)</option>
                  </select>
                </label>

                <div className="grid grid-cols-2 gap-2">
                  <label className="flex flex-col gap-1 text-[11px] text-neutral-500 dark:text-neutral-400">
                    <span>Хэлбэр</span>
                    <select
                      value={clean.shape}
                      onChange={(e) => onUpdateClean({ shape: e.target.value as SmartCleanSettings['shape'] })}
                      className="h-8 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 px-2 text-xs text-neutral-900 dark:text-neutral-100"
                    >
                      <option value="brush">Тодруулах бийр</option>
                      <option value="box">Дөрвөлжин</option>
                      <option value="ellipse">Зууван</option>
                      <option value="flood">Товших (Flood)</option>
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-[11px] text-neutral-500 dark:text-neutral-400">
                    <span>Текстийн өнгө</span>
                    <select
                      value={clean.polarity}
                      onChange={(e) => onUpdateClean({ polarity: e.target.value as SmartCleanSettings['polarity'] })}
                      className="h-8 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 px-2 text-xs text-neutral-900 dark:text-neutral-100"
                    >
                      <option value="auto">Автомат</option>
                      <option value="dark">Зөвхөн хар</option>
                      <option value="light">Зөвхөн цагаан</option>
                    </select>
                  </label>
                </div>

                <label className="flex flex-col gap-1 text-[11px] text-neutral-500 dark:text-neutral-400">
                  <span className="flex justify-between">
                    <span>Тодруулагч хэмжээ</span>
                    <span className="font-mono-num text-neutral-800 dark:text-neutral-200">{clean.brushSize}px</span>
                  </span>
                  <input
                    type="range"
                    min={10}
                    max={120}
                    value={clean.brushSize}
                    onChange={(e) => onUpdateClean({ brushSize: Number(e.target.value) })}
                    className="accent-emerald-600"
                  />
                </label>

                {clean.shape === 'flood' && (
                  <div className="flex items-center justify-between gap-2 pt-0.5">
                    <span className="text-[11px] text-neutral-500 dark:text-neutral-400">Дүүргэх өнгө</span>
                    <div className="flex items-center gap-1.5">
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
                        className="w-7 h-6 rounded border border-neutral-300 dark:border-neutral-700 cursor-pointer"
                      />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
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

                {onAiClean && (
                  <div className="flex flex-col gap-1.5 pt-1 border-t border-neutral-200 dark:border-neutral-800">
                    <div className="grid grid-cols-2 gap-1.5">
                      <select
                        value={aiScope}
                        onChange={(e) => setAiScope(e.target.value as 'view' | 'all')}
                        className="h-7 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 px-2 text-[11px] text-neutral-900 dark:text-neutral-100"
                      >
                        <option value="view">Харагдаж буй хэсэг</option>
                        <option value="all">Бүх хуудас</option>
                      </select>
                      {onChangeAiCleanFilter && (
                        <select
                          value={aiCleanFilter}
                          onChange={(e) => onChangeAiCleanFilter(e.target.value as AiCleanFilter)}
                          className="h-7 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 px-2 text-[11px] text-neutral-900 dark:text-neutral-100"
                        >
                          <option value="all">Бөмбөлөг + SFX</option>
                          <option value="bubble">Зөвхөн бөмбөлөг</option>
                          <option value="sfx">Зөвхөн SFX</option>
                        </select>
                      )}
                    </div>
                    <button
                      type="button"
                      disabled={aiCleanBusy}
                      onClick={() => onAiClean(aiScope, aiCleanFilter)}
                      className="h-8 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white text-xs font-semibold flex items-center justify-center gap-1.5"
                    >
                      {aiCleanBusy ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="w-3.5 h-3.5" />
                      )}
                      {aiCleanBusy ? 'AI таньж цэвэрлэж байна…' : 'AI Бөмбөлөг + SFX цэвэрлэх'}
                    </button>
                  </div>
                )}

                <button
                  type="button"
                  onClick={onAutoCleanAll}
                  className="h-8 rounded-lg border border-neutral-300 dark:border-neutral-700 hover:border-emerald-500 text-neutral-700 dark:text-neutral-200 text-xs font-semibold flex items-center justify-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  Бүх бөмбөлгийг цэвэрлэх (Auto)
                </button>
              </div>
            )}
          </>
        )}

        {/* ================= LAYERS TAB (Non-destructive Stack) ================= */}
        {tab === 'layers' && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                Давхаргууд (Non-Destructive)
              </span>
              <button
                type="button"
                onClick={onAddPaintLayer}
                className="h-7 px-2 rounded-md border border-neutral-300 dark:border-neutral-700 hover:border-emerald-500 text-[11px] font-medium text-neutral-700 dark:text-neutral-200 flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                Засварын давхарга
              </button>
            </div>

            {/* Front Logos */}
            {logos.filter((l) => l.aboveText).length > 0 && (
              <div className="flex flex-col gap-1">
                <span className="text-[10.5px] font-medium text-neutral-500">Дээд логонууд</span>
                {[...logos]
                  .reverse()
                  .filter((l) => l.aboveText)
                  .map((lo) => {
                    const isSel = selection?.kind === 'logo' && selection.ids.includes(lo.id);
                    return (
                      <div
                        key={lo.id}
                        onClick={() => onSelectObjects({ kind: 'logo', ids: [lo.id] })}
                        className={`flex items-center gap-2 px-2 py-1.5 rounded-lg border text-xs cursor-pointer ${
                          isSel
                            ? 'border-emerald-500 bg-emerald-500/10'
                            : 'border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/60'
                        }`}
                      >
                        <ImageIcon className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        <span className="flex-1 truncate text-neutral-800 dark:text-neutral-200">{lo.name}</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleLogoProp(lo.id, 'visible');
                          }}
                          className="text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
                        >
                          {lo.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5 opacity-40" />}
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleLogoProp(lo.id, 'locked');
                          }}
                          className="text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
                        >
                          {lo.locked ? <Lock className="w-3.5 h-3.5 text-amber-500" /> : <Unlock className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    );
                  })}
              </div>
            )}

            {/* Text Layers */}
            <div className="flex flex-col gap-1">
              <span className="text-[10.5px] font-medium text-neutral-500">Текст давхаргууд ({texts.length})</span>
              {texts.length === 0 ? (
                <div className="text-[11px] text-neutral-400 py-1">Текст алга.</div>
              ) : (
                [...texts].reverse().map((t) => {
                  const isSel = selection?.kind === 'text' && selection.ids.includes(t.id);
                  return (
                    <div
                      key={t.id}
                      onClick={(e) => {
                        if ((e.ctrlKey || e.metaKey || e.shiftKey) && selection?.kind === 'text') {
                          const exists = selection.ids.includes(t.id);
                          const nextIds = exists
                            ? selection.ids.filter((id) => id !== t.id)
                            : [...selection.ids, t.id];
                          onSelectObjects(nextIds.length ? { kind: 'text', ids: nextIds } : null);
                        } else {
                          onSelectObjects({ kind: 'text', ids: [t.id] });
                        }
                      }}
                      className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border text-xs cursor-pointer ${
                        isSel
                          ? 'border-emerald-500 bg-emerald-500/10'
                          : 'border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/60'
                      }`}
                    >
                      <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 w-3 text-center shrink-0">
                        T
                      </span>
                      <span className="flex-1 truncate text-neutral-800 dark:text-neutral-200">
                        {t.text.replace(/\n/g, ' ') || '(Хоосон)'}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onMoveTextLayer(t.id, 1);
                        }}
                        className="text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
                        title="Дээш"
                      >
                        <ArrowUp className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onMoveTextLayer(t.id, -1);
                        }}
                        className="text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
                        title="Доош"
                      >
                        <ArrowDown className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleTextLayerProp(t.id, 'visible');
                        }}
                        className="text-neutral-500"
                      >
                        {t.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5 opacity-40" />}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleTextLayerProp(t.id, 'locked');
                        }}
                        className="text-neutral-500"
                      >
                        {t.locked ? <Lock className="w-3.5 h-3.5 text-amber-500" /> : <Unlock className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {/* Paint / Cleaning Layers (Non-destructive) */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[10.5px] font-medium text-neutral-500">
                Цэвэрлэх ба Бийрний давхаргууд ({paintLayers.length})
              </span>
              {[...paintLayers].reverse().map((pl) => {
                const isAct = pl.id === activePaintLayerId;
                return (
                  <div
                    key={pl.id}
                    onClick={() => onSelectPaintLayer(pl.id)}
                    className={`flex flex-col gap-1.5 px-2.5 py-2 rounded-lg border cursor-pointer ${
                      isAct
                        ? 'border-emerald-500 bg-emerald-500/10'
                        : 'border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/60'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-xs">
                      <span className="flex-1 font-medium text-neutral-800 dark:text-neutral-200 truncate">
                        {pl.name}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onMovePaintLayer(pl.id, 1);
                        }}
                        className="text-neutral-400 hover:text-neutral-700"
                      >
                        <ArrowUp className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onMovePaintLayer(pl.id, -1);
                        }}
                        className="text-neutral-400 hover:text-neutral-700"
                      >
                        <ArrowDown className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onUpdatePaintLayer(pl.id, { visible: !pl.visible });
                        }}
                        className="text-neutral-500"
                      >
                        {pl.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5 opacity-40" />}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onUpdatePaintLayer(pl.id, { locked: !pl.locked });
                        }}
                        className="text-neutral-500"
                      >
                        {pl.locked ? <Lock className="w-3.5 h-3.5 text-amber-500" /> : <Unlock className="w-3.5 h-3.5" />}
                      </button>
                      {paintLayers.length > 1 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeletePaintLayer(pl.id);
                          }}
                          className="text-rose-500"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-neutral-500">Тунгалаг</span>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={Math.round(pl.opacity * 100)}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => onUpdatePaintLayer(pl.id, { opacity: Number(e.target.value) / 100 })}
                        className="flex-1 accent-emerald-600 h-1.5"
                      />
                      <span className="text-[10px] font-mono-num text-neutral-700 dark:text-neutral-300 w-7 text-right">
                        {Math.round(pl.opacity * 100)}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Back Logos */}
            {logos.filter((l) => !l.aboveText).length > 0 && (
              <div className="flex flex-col gap-1">
                <span className="text-[10.5px] font-medium text-neutral-500">Текстийн ард байгаа логонууд</span>
                {[...logos]
                  .reverse()
                  .filter((l) => !l.aboveText)
                  .map((lo) => {
                    const isSel = selection?.kind === 'logo' && selection.ids.includes(lo.id);
                    return (
                      <div
                        key={lo.id}
                        onClick={() => onSelectObjects({ kind: 'logo', ids: [lo.id] })}
                        className={`flex items-center gap-2 px-2 py-1.5 rounded-lg border text-xs cursor-pointer ${
                          isSel
                            ? 'border-emerald-500 bg-emerald-500/10'
                            : 'border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/60'
                        }`}
                      >
                        <ImageIcon className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        <span className="flex-1 truncate text-neutral-800 dark:text-neutral-200">{lo.name}</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleLogoProp(lo.id, 'visible');
                          }}
                          className="text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
                        >
                          {lo.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5 opacity-40" />}
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleLogoProp(lo.id, 'locked');
                          }}
                          className="text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
                        >
                          {lo.locked ? <Lock className="w-3.5 h-3.5 text-amber-500" /> : <Unlock className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    );
                  })}
              </div>
            )}

            {/* Locked Base Raw Image Layer */}
            <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-100/70 dark:bg-neutral-900/90 text-xs">
              <Lock className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
              <span className="flex-1 font-medium text-neutral-700 dark:text-neutral-300">
                Эх зураг (Хамгаалагдсан)
              </span>
              <span className="text-[10px] text-neutral-500">Non-destructive</span>
            </div>
          </div>
        )}

        {/* ================= PROJECTS & PAGES TAB ================= */}
        {tab === 'projects' && (
          <div className="flex flex-col gap-4">
            {/* Multi-Page Stitch Section */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                  Бүлгийн хуудсууд ({rawPages.length})
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={onAddCustomSplitAtCurrent}
                    className="h-7 px-2 rounded border border-neutral-300 dark:border-neutral-700 text-[11px] text-neutral-700 dark:text-neutral-200 hover:border-emerald-500"
                    title="Одоогийн харагдац дээр хуудас хуваах зааг нэмэх"
                  >
                    + Зааг
                  </button>
                  <button
                    type="button"
                    onClick={onTriggerImageUpload}
                    className="h-7 px-2 rounded bg-emerald-600 text-white text-[11px] font-medium"
                  >
                    + Хуудас
                  </button>
                </div>
              </div>

              <label className="flex items-center justify-between gap-2 text-[11px] text-neutral-500 dark:text-neutral-400">
                <span>Нийлүүлэх өргөн</span>
                <select
                  value={stitchWidthMode}
                  onChange={(e) => onChangeStitchWidthMode(e.target.value)}
                  className="h-7 rounded border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 px-2 text-xs text-neutral-900 dark:text-neutral-100"
                >
                  <option value="800">800px (Webtoon)</option>
                  <option value="1000">1000px (Өндөр)</option>
                  <option value="1200">1200px (HD)</option>
                  <option value="first">Эхний зургаар</option>
                </select>
              </label>

              {rawPages.length === 0 ? (
                <div className="text-[11px] text-neutral-400">Зураг нэмээгүй байна.</div>
              ) : (
                <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto">
                  {rawPages.map((pg, idx) => (
                    <div
                      key={pg.id}
                      onClick={() => onJumpToPageY(pg.yStart)}
                      className="flex items-center gap-2 p-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/60 hover:border-emerald-500 cursor-pointer text-xs"
                    >
                      <img src={pg.url} alt={pg.name} className="w-8 h-10 object-cover rounded bg-white shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-neutral-800 dark:text-neutral-200 truncate">
                          {idx + 1}. {pg.name}
                        </div>
                        <div className="text-[10px] font-mono-num text-neutral-400">
                          Y: {pg.yStart}px · H: {pg.height}px
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={(e) => {
                          e.stopPropagation();
                          onMoveRawPage(idx, -1);
                        }}
                        className="p-1 text-neutral-400 hover:text-neutral-700 disabled:opacity-25"
                      >
                        <ArrowUp className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === rawPages.length - 1}
                        onClick={(e) => {
                          e.stopPropagation();
                          onMoveRawPage(idx, 1);
                        }}
                        className="p-1 text-neutral-400 hover:text-neutral-700 disabled:opacity-25"
                      >
                        <ArrowDown className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveRawPage(idx);
                        }}
                        className="p-1 text-rose-500"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Version History Snapshots */}
            <div className="flex flex-col gap-2 pt-3 border-t border-neutral-200 dark:border-neutral-800">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                  Өмнөх хувилбарууд ({snapshots.length})
                </span>
                <button
                  type="button"
                  onClick={onCreateSnapshot}
                  className="h-7 px-2 rounded border border-emerald-500/40 text-emerald-700 dark:text-emerald-300 text-[11px] font-medium hover:bg-emerald-500/10"
                >
                  + Хувилбар хадгалах
                </button>
              </div>
              {snapshots.length === 0 ? (
                <div className="text-[11px] text-neutral-400">
                  Хадгалах үед өмнөх хувилбарууд энд хадгалагдана.
                </div>
              ) : (
                <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto">
                  {snapshots.map((sn) => (
                    <div
                      key={sn.id}
                      className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="font-medium text-neutral-800 dark:text-neutral-200 truncate">{sn.label}</div>
                        <div className="text-[10px] font-mono-num text-neutral-400">{formatTime(sn.createdAt)}</div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => onRevertSnapshot(sn)}
                          className="h-6 px-2 rounded border border-neutral-300 dark:border-neutral-700 hover:border-emerald-500 text-[11px] text-neutral-700 dark:text-neutral-200"
                        >
                          Сэргээх
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteSnapshot(sn.id)}
                          className="h-6 px-1.5 rounded text-rose-500"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Saved Projects List */}
            <div className="flex flex-col gap-2 pt-3 border-t border-neutral-200 dark:border-neutral-800">
              <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                Хадгалсан төслүүд ({projects.length})
              </span>
              {projects.length === 0 ? (
                <div className="text-[11px] text-neutral-400">Одоогоор хадгалсан төсөл алга.</div>
              ) : (
                <div className="flex flex-col gap-2">
                  {projects.map((p) => {
                    const isCur = p.id === currentProjectId;
                    const isRenaming = renamingProjectId === p.id;
                    return (
                      <div
                        key={p.id}
                        className={`flex items-center gap-2 p-2 rounded-lg border ${
                          isCur
                            ? 'border-emerald-500 bg-emerald-500/10'
                            : 'border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/50'
                        }`}
                      >
                        {p.thumbBlob ? (
                          <BlobImage
                            blob={p.thumbBlob}
                            alt={p.name}
                            className="w-10 h-12 object-cover rounded border border-neutral-200 dark:border-neutral-700 bg-white shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-12 rounded bg-neutral-200 dark:bg-neutral-800 shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          {isRenaming ? (
                            <div className="flex items-center gap-1">
                              <input
                                type="text"
                                value={renamingDraft}
                                onChange={(e) => setRenamingDraft(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && renamingDraft.trim()) {
                                    onRenameProjectById(p.id, renamingDraft.trim());
                                    setRenamingProjectId(null);
                                  } else if (e.key === 'Escape') {
                                    setRenamingProjectId(null);
                                  }
                                }}
                                className="flex-1 min-w-0 h-6 px-1.5 rounded border border-emerald-500 bg-white dark:bg-neutral-900 text-xs text-neutral-900 dark:text-neutral-100 focus:outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  if (renamingDraft.trim()) onRenameProjectById(p.id, renamingDraft.trim());
                                  setRenamingProjectId(null);
                                }}
                                className="h-6 w-6 rounded bg-emerald-600 text-white flex items-center justify-center shrink-0"
                              >
                                <Check className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setRenamingProjectId(null)}
                                className="h-6 w-6 rounded border border-neutral-300 dark:border-neutral-700 text-neutral-500 flex items-center justify-center shrink-0"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <div className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 truncate">
                              {p.name}
                            </div>
                          )}
                          <div className="text-[10.5px] font-mono-num text-neutral-500">
                            {p.docW}×{p.docH} · {formatTime(p.updatedAt)}
                          </div>
                          <div className="flex items-center gap-1.5 mt-1">
                            <button
                              type="button"
                              onClick={() => onOpenProject(p.id)}
                              className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 hover:underline"
                            >
                              Нээх
                            </button>
                            <span className="text-neutral-300 dark:text-neutral-700">·</span>
                            <button
                              type="button"
                              onClick={() => {
                                setRenamingProjectId(p.id);
                                setRenamingDraft(p.name);
                              }}
                              className="text-[11px] text-neutral-600 dark:text-neutral-400 hover:underline"
                            >
                              Нэр
                            </button>
                            <span className="text-neutral-300 dark:text-neutral-700">·</span>
                            <button
                              type="button"
                              onClick={() => onDuplicateProject(p.id)}
                              className="text-[11px] text-neutral-600 dark:text-neutral-400 hover:underline"
                            >
                              Хувилах
                            </button>
                            <span className="text-neutral-300 dark:text-neutral-700">·</span>
                            <button
                              type="button"
                              onClick={() => onDeleteProject(p.id)}
                              className="text-[11px] text-rose-500 hover:underline"
                            >
                              Устгах
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
