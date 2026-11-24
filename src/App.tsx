import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Hand,
  Maximize2,
  Minimize2,
  Redo2,
  SlidersHorizontal,
  Undo2,
} from 'lucide-react';
import { BottomToolDock } from './components/BottomToolDock';
import { CanvasStage } from './components/CanvasStage';
import { QuickTextWindow, ScriptQueueBar } from './components/FloatingQuickWindows';
import { ExportModal, NewProjectModal, ShortcutsModal } from './components/Modals';
import { OfflineIndicator } from './components/PWAInstall';
import { RightInspector } from './components/RightInspector';
import { Toolbar } from './components/Toolbar';
import { TopBar } from './components/TopBar';
import {
  AiCleanFilter,
  AiDetectedRegion,
  BrushSettings,
  FloatingWindowState,
  GradientPreset,
  HistoryEntry,
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
  WorkspaceSettings,
} from './types/editor';
import {
  cleanAiDetectedRegions,
  cleanShapeOnLayer,
  detectSpeechBubble,
  fitFontSizeToHeight,
  renderCompositeDocument,
  sampleCompositePixelAt,
} from './utils/canvasEngine';
import { buildExportOutputs, canvasToBlob, ExportConfig, loadImage } from './utils/exportEngine';
import {
  DEFAULT_GRADIENTS,
  DEFAULT_PRESETS,
  safeLocalGet,
  safeLocalSet,
  StudioDB,
} from './utils/indexedDb';
import { createDefaultTextLayer, renderSampleComicBase } from './utils/sampleProject';

function cloneTexts(list: TextLayer[]): TextLayer[] {
  return JSON.parse(JSON.stringify(list));
}

function cloneLogosMeta(list: LogoLayer[]): LogoLayer[] {
  return list.map((l) => ({ ...l }));
}

function createPaintCanvas(w: number, h: number, fill?: HTMLCanvasElement): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  if (fill) {
    c.getContext('2d')!.drawImage(fill, 0, 0);
  }
  return c;
}

export default function App() {
  // Workspace settings
  const [workspaceSettings, setWorkspaceSettings] = useState<WorkspaceSettings>(() =>
    safeLocalGet<WorkspaceSettings>('pf_workspace_settings_v2', {
      theme: 'dark',
      toolbarSide: 'left',
      showPageMarkers: true,
      showGridSnap: true,
      autoBubbleDetect: true,
      autoSaveIntervalSec: 3,
    })
  );

  // Sync Tailwind dark class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (workspaceSettings.theme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
    safeLocalSet('pf_workspace_settings_v2', workspaceSettings);
  }, [workspaceSettings]);

  // Document & Canvas state
  const [docW, setDocW] = useState(800);
  const [docH, setDocH] = useState(1100);
  const [bgColor, setBgColor] = useState('#ffffff');
  const [zoom, setZoom] = useState(0.72);
  const [renderVersion, setRenderVersion] = useState(0);

  const baseCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const workspaceRef = useRef<HTMLDivElement | null>(null);
  const workAreaWrapRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const prevToolRef = useRef<ToolId>('select');
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const logoInputRef = useRef<HTMLInputElement | null>(null);

  // Project state
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState('Жишээ бүлэг');
  const [isSample, setIsSample] = useState(true);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [stitchWidthMode, setStitchWidthMode] = useState('800');
  const [customSplitYs, setCustomSplitYs] = useState<number[]>([]);
  const [rawPages, setRawPages] = useState<RawPageItem[]>([]);

  // Non-destructive Layers
  const [paintLayers, setPaintLayers] = useState<PaintLayer[]>(() => [
    {
      id: 'pl_main',
      name: 'Цэвэрлэх давхарга 1',
      visible: true,
      locked: false,
      opacity: 1,
      canvas: createPaintCanvas(800, 1100),
    },
  ]);
  const [activePaintLayerId, setActivePaintLayerId] = useState<string | null>('pl_main');
  const [texts, setTexts] = useState<TextLayer[]>([]);
  const [logos, setLogos] = useState<LogoLayer[]>([]);

  // Selection & UI state
  const [activeTool, setActiveTool] = useState<ToolId>('select');
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>('properties');
  const [mobileInspectorOpen, setMobileInspectorOpen] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [selection, setSelection] = useState<SelectionTarget | null>(null);
  const [beforeAfterMode, setBeforeAfterMode] = useState<'off' | 'split' | 'peek'>('off');
  const [currentPageNum, setCurrentPageNum] = useState(1);
  const [lastTextStyle, setLastTextStyle] = useState<Partial<TextLayer>>(() =>
    safeLocalGet<Partial<TextLayer>>('pf_last_text_style_v2', {
      fontFamily: "'Montserrat', sans-serif",
      fontSize: 22,
      color: '#111111',
      strokeColor: '#ffffff',
      strokeWidth: 5,
    })
  );

  // Floating Quick Text Window
  const [quickTextWin, setQuickTextWin] = useState<FloatingWindowState>({
    open: false,
    minimized: false,
    expanded: false,
    x: 20,
    y: 16,
  });
  const [cleanStatus, setCleanStatus] = useState<{ kind: 'ok' | 'empty'; text: string } | null>(null);
  const [aiCleanBusy, setAiCleanBusy] = useState(false);
  const [aiCleanFilter, setAiCleanFilter] = useState<AiCleanFilter>('all');
  const [clonePickMode, setClonePickMode] = useState(false);

  // Brush & Clean settings
  const [brush, setBrush] = useState<BrushSettings>({
    type: 'gpen',
    size: 26,
    opacity: 100,
    hardness: 90,
    spacing: 15,
    color: '#ffffff',
    stabilizer: 4,
    taper: true,
  });
  const [recentColors, setRecentColors] = useState<string[]>(() =>
    safeLocalGet<string[]>('pf_recent_colors_v2', ['#ffffff', '#111111', '#14b866', '#ef4444'])
  );
  const [clean, setClean] = useState<SmartCleanSettings>({
    mode: 'erase',
    shape: 'brush',
    polarity: 'auto',
    brushSize: 34,
    tolerance: 35,
    feather: 4,
  });

  // Libraries & Presets
  const [savedFonts, setSavedFonts] = useState<SavedFont[]>([]);
  const [savedLogos, setSavedLogos] = useState<SavedLogoAsset[]>([]);
  const [customPresets, setCustomPresets] = useState<TextPreset[]>(() =>
    safeLocalGet<TextPreset[]>('pf_custom_presets_v2', [])
  );
  const [customGradients, setCustomGradients] = useState<GradientPreset[]>(() =>
    safeLocalGet<GradientPreset[]>('pf_custom_gradients_v2', [])
  );

  // Script Queue
  const [scriptInput, setScriptInput] = useState('');
  const [scriptUsed, setScriptUsed] = useState<Set<number>>(new Set());
  const [scriptNext, setScriptNext] = useState(-1);

  const scriptLines = useMemo(
    () =>
      scriptInput
        .split(/\n/)
        .map((l) => l.trim())
        .filter(Boolean)
        .map((l) => l.replace(/\s*\/\/\s*/g, '\n')),
    [scriptInput]
  );

  // Projects & Version History
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [snapshots, setSnapshots] = useState<ProjectSnapshot[]>([]);
  const [pendingProjectName, setPendingProjectName] = useState<string | null>(null);

  // Modals & Toast
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const [exportDirHandle, setExportDirHandle] = useState<FileSystemDirectoryHandle | null>(null);

  // History Timeline (Undo/Redo + Click-to-Jump)
  const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const historyRef = useRef<{ entries: HistoryEntry[]; index: number }>({ entries: [], index: -1 });
  historyRef.current = { entries: historyEntries, index: historyIndex };

  // Refs for latest state in callbacks
  const textsRef = useRef(texts);
  textsRef.current = texts;
  const logosRef = useRef(logos);
  logosRef.current = logos;
  const paintLayersRef = useRef(paintLayers);
  paintLayersRef.current = paintLayers;

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 2600);
  }, []);

  const fitWidth = useCallback(
    (targetW = docW) => {
      const ws = workspaceRef.current;
      const avail = ws ? ws.clientWidth - 64 : window.innerWidth - 420;
      const nextZ = Math.min(1.25, Math.max(0.2, avail / Math.max(100, targetW)));
      setZoom(Number(nextZ.toFixed(2)));
    },
    [docW]
  );

  // Initialize base sample comic & load IndexedDB libraries
  useEffect(() => {
    const base = document.createElement('canvas');
    base.width = 800;
    base.height = 1100;
    renderSampleComicBase(base);
    baseCanvasRef.current = base;

    const demoText = createDefaultTextLayer({
      id: 't_demo_1',
      text: 'Сайн уу! Хоёр товшиж засаарай.',
      x: 545,
      y: 350,
      boxWidth: 230,
      fontSize: 22,
      fontFamily: "'Montserrat', sans-serif",
    });
    setTexts([demoText]);
    setSelection({ kind: 'text', ids: [demoText.id] });
    setRenderVersion((v) => v + 1);
    setTimeout(() => fitWidth(800), 60);

    // Load DB assets
    (async () => {
      try {
        const fonts = await StudioDB.listFonts();
        for (const f of fonts) {
          try {
            const face = new FontFace(`PFFont_${f.id}`, f.data);
            await face.load();
            document.fonts.add(face);
          } catch {
            // ignore corrupted font
          }
        }
        setSavedFonts(fonts);
        setSavedLogos(await StudioDB.listLogos());
        setProjects(await StudioDB.listProjects());
        const dirH = await StudioDB.getSetting<FileSystemDirectoryHandle>('exportDirHandle');
        if (dirH) setExportDirHandle(dirH);
      } catch {
        // ignore IndexedDB errors
      }
    })();
  }, []);

  // History Helpers
  const pushHistory = useCallback((entry: Omit<HistoryEntry, 'id' | 'timestamp'>) => {
    const { entries, index } = historyRef.current;
    const sliced = entries.slice(0, index + 1);
    const full: HistoryEntry = {
      ...entry,
      id: 'h_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5),
      timestamp: Date.now(),
    };
    const nextEntries = [...sliced, full].slice(-40);
    setHistoryEntries(nextEntries);
    setHistoryIndex(nextEntries.length - 1);
  }, []);

  const applyHistoryAction = useCallback((entry: HistoryEntry, direction: 'undo' | 'redo') => {
    if (entry.kind === 'paint') {
      const p = entry.payload as {
        layerId: string;
        bx: number;
        by: number;
        before: ImageData;
        after: ImageData;
      };
      const layer = paintLayersRef.current.find((l) => l.id === p.layerId);
      if (layer) {
        const ctx = layer.canvas.getContext('2d', { willReadFrequently: true })!;
        ctx.putImageData(direction === 'undo' ? p.before : p.after, p.bx, p.by);
        setRenderVersion((v) => v + 1);
      }
    } else if (entry.kind === 'objects') {
      const p = entry.payload as {
        before: { texts: TextLayer[]; logos: LogoLayer[] };
        after: { texts: TextLayer[]; logos: LogoLayer[] };
      };
      const target = direction === 'undo' ? p.before : p.after;
      setTexts(cloneTexts(target.texts));
      setLogos(cloneLogosMeta(target.logos));
      setRenderVersion((v) => v + 1);
    }
  }, []);

  const handleUndo = useCallback(() => {
    const { entries, index } = historyRef.current;
    if (index < 0) return;
    applyHistoryAction(entries[index], 'undo');
    setHistoryIndex(index - 1);
  }, [applyHistoryAction]);

  const handleRedo = useCallback(() => {
    const { entries, index } = historyRef.current;
    if (index >= entries.length - 1) return;
    const nextIdx = index + 1;
    applyHistoryAction(entries[nextIdx], 'redo');
    setHistoryIndex(nextIdx);
  }, [applyHistoryAction]);

  // Resize document cleanly while preserving paint layers
  const resizeCanvasDocument = useCallback((w: number, h: number, preservePaint: boolean) => {
    const nextW = Math.max(100, Math.round(w));
    const nextH = Math.max(100, Math.round(h));
    const oldBase = baseCanvasRef.current;
    const newBase = document.createElement('canvas');
    newBase.width = nextW;
    newBase.height = nextH;
    if (preservePaint && oldBase) {
      newBase.getContext('2d')!.drawImage(oldBase, 0, 0);
    }
    baseCanvasRef.current = newBase;

    setPaintLayers((prev) =>
      prev.map((pl) => {
        const nextC = document.createElement('canvas');
        nextC.width = nextW;
        nextC.height = nextH;
        if (preservePaint && pl.canvas.width > 0) {
          const scale = nextW / pl.canvas.width;
          nextC
            .getContext('2d')!
            .drawImage(pl.canvas, 0, 0, pl.canvas.width, pl.canvas.height, 0, 0, nextW, Math.round(pl.canvas.height * scale));
        }
        return { ...pl, canvas: nextC };
      })
    );
    setDocW(nextW);
    setDocH(nextH);
    setRenderVersion((v) => v + 1);
  }, []);

  // Build Stitch base canvas from rawPages
  const rebuildStitchCanvas = useCallback(
    (pages: RawPageItem[], widthMode: string) => {
      if (!pages.length) return;
      const targetW = widthMode === 'first' ? pages[0].img.width : parseInt(widthMode, 10) || 800;
      let totalH = 0;
      const updatedPages = pages.map((p) => {
        const h = Math.round(p.img.height * (targetW / p.img.width));
        const yStart = totalH;
        totalH += h;
        return { ...p, yStart, height: h };
      });
      resizeCanvasDocument(targetW, Math.max(100, totalH), true);
      const base = baseCanvasRef.current!;
      const ctx = base.getContext('2d')!;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, targetW, totalH);
      updatedPages.forEach((p) => {
        ctx.drawImage(p.img, 0, p.yStart, targetW, p.height);
      });
      setRawPages(updatedPages);
      setRenderVersion((v) => v + 1);
    },
    [resizeCanvasDocument]
  );

  // Tool switching automatically closes conflicting windows without piling
  const handleSelectTool = useCallback((tool: ToolId) => {
    setActiveTool((cur) => {
      if (cur !== 'hand') prevToolRef.current = cur;
      return tool;
    });
    if (tool !== 'clone') setClonePickMode(false);
    if (['bubble', 'brush', 'eraser', 'clone', 'logo'].includes(tool)) {
      setQuickTextWin((w) => ({ ...w, open: false }));
    }
    setInspectorTab('properties');
  }, []);

  // Object mutations with Undo history
  const updateTextsWithOptionalHistory = useCallback(
    (updater: (prev: TextLayer[]) => TextLayer[], historyLabel?: string) => {
      const before = { texts: cloneTexts(textsRef.current), logos: cloneLogosMeta(logosRef.current) };
      const next = updater(textsRef.current);
      setTexts(next);
      setRenderVersion((v) => v + 1);
      if (historyLabel) {
        pushHistory({
          kind: 'objects',
          label: historyLabel,
          payload: { before, after: { texts: cloneTexts(next), logos: cloneLogosMeta(logosRef.current) } },
        });
      }
    },
    [pushHistory]
  );

  const updateLogosWithOptionalHistory = useCallback(
    (updater: (prev: LogoLayer[]) => LogoLayer[], historyLabel?: string) => {
      const before = { texts: cloneTexts(textsRef.current), logos: cloneLogosMeta(logosRef.current) };
      const next = updater(logosRef.current);
      setLogos(next);
      setRenderVersion((v) => v + 1);
      if (historyLabel) {
        pushHistory({
          kind: 'objects',
          label: historyLabel,
          payload: { before, after: { texts: cloneTexts(textsRef.current), logos: cloneLogosMeta(next) } },
        });
      }
    },
    [pushHistory]
  );

  // Batch edit selected texts & remember latest style preferences
  const handleBatchUpdateTexts = useCallback(
    (patch: Partial<TextLayer>, historyLabel?: string) => {
      if (!selection || selection.kind !== 'text' || !selection.ids.length) return;
      const idSet = new Set(selection.ids);
      updateTextsWithOptionalHistory(
        (prev) => prev.map((t) => (idSet.has(t.id) ? { ...t, ...patch } : t)),
        historyLabel
      );
      const styleKeys: (keyof TextLayer)[] = [
        'fontFamily',
        'fontSize',
        'color',
        'strokeColor',
        'strokeWidth',
        'bold',
        'italic',
        'underline',
        'uppercase',
        'align',
        'lineHeight',
        'letterSpacing',
        'scaleX',
        'scaleY',
        'glowEnabled',
        'glowColor',
        'glowRadius',
        'shadowEnabled',
        'shadowColor',
        'shadowBlur',
        'shadowDistance',
        'shadowAngle',
        'shadowOpacity',
        'gradEnabled',
        'grad1',
        'grad2',
        'gradAng',
      ];
      const stylePatch: Partial<TextLayer> = {};
      let hasStyle = false;
      for (const k of styleKeys) {
        if (k in patch) {
          (stylePatch as Record<string, unknown>)[k] = patch[k];
          hasStyle = true;
        }
      }
      if (hasStyle) {
        setLastTextStyle((prev) => {
          const next = { ...prev, ...stylePatch };
          safeLocalSet('pf_last_text_style_v2', next);
          return next;
        });
      }
    },
    [selection, updateTextsWithOptionalHistory]
  );

  // Script queue helper
  const takeNextScriptLine = useCallback((): string | null => {
    if (scriptNext < 0 || scriptNext >= scriptLines.length) return null;
    const line = scriptLines[scriptNext];
    const nextUsed = new Set(scriptUsed);
    nextUsed.add(scriptNext);
    setScriptUsed(nextUsed);
    let found = -1;
    for (let k = 1; k <= scriptLines.length; k++) {
      const idx = (scriptNext + k) % scriptLines.length;
      if (!nextUsed.has(idx)) {
        found = idx;
        break;
      }
    }
    setScriptNext(found);
    return line;
  }, [scriptNext, scriptLines, scriptUsed]);

  const handleCreateTextAt = useCallback(
    (x: number, y: number, boxW = 210, autoFitH?: number) => {
      const queued = takeNextScriptLine();
      const primaryRef =
        selection?.kind === 'text' ? textsRef.current.find((t) => t.id === selection.ids[0]) : null;
      const baseStyle = primaryRef ?? lastTextStyle;
      const newText = createDefaultTextLayer({
        ...baseStyle,
        text: queued ?? 'Шинэ текст',
        x,
        y,
        boxWidth: boxW,
        fontFamily: baseStyle.fontFamily ?? "'Montserrat', sans-serif",
        fontSize: baseStyle.fontSize ?? 24,
        color: baseStyle.color ?? '#111111',
        strokeColor: baseStyle.strokeColor ?? '#ffffff',
        strokeWidth: baseStyle.strokeWidth ?? 5,
      });
      if (autoFitH) {
        newText.fontSize = fitFontSizeToHeight(newText, autoFitH);
      }
      updateTextsWithOptionalHistory((prev) => [...prev, newText], 'Шинэ текст нэмэх');
      setSelection({ kind: 'text', ids: [newText.id] });
      setQuickTextWin((w) => ({ ...w, open: true, minimized: false }));
    },
    [selection, lastTextStyle, takeNextScriptLine, updateTextsWithOptionalHistory]
  );

  const ensureSelectedTextVisible = useCallback(
    (panelEl: HTMLDivElement | null) => {
      const ws = workspaceRef.current;
      const stage = stageRef.current;
      if (!ws || !stage || !panelEl) return;
      if (!selection || selection.kind !== 'text' || !selection.ids.length) return;
      const t = textsRef.current.find((x) => x.id === selection.ids[0]);
      if (!t) return;

      window.requestAnimationFrame(() => {
        const wsRect = ws.getBoundingClientRect();
        const stageRect = stage.getBoundingClientRect();
        const panelRect = panelEl.getBoundingClientRect();
        if (!panelRect.height) return;

        const halfH = (t._halfH || Math.max(24, t.fontSize * 1.4)) * (t.scaleY ?? 1) * zoom;
        const textTopY = stageRect.top + t.y * zoom - halfH;
        const textBotY = stageRect.top + t.y * zoom + halfH;
        const safeBottom = Math.min(wsRect.bottom, panelRect.top) - 24;
        const safeTop = wsRect.top + 20;

        if (textBotY > safeBottom) {
          ws.scrollBy({ top: textBotY - safeBottom + 16, behavior: 'smooth' });
        } else if (textTopY < safeTop) {
          ws.scrollBy({ top: textTopY - safeTop - 16, behavior: 'smooth' });
        }
      });
    },
    [selection, zoom]
  );

  const handleDuplicateSelectedText = useCallback(() => {
    if (!selection || selection.kind !== 'text' || !selection.ids.length) return;
    const idSet = new Set(selection.ids);
    const copies = textsRef.current
      .filter((t) => idSet.has(t.id))
      .map((t) => ({
        ...JSON.parse(JSON.stringify(t)),
        id: 't_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5),
        x: t.x + 24,
        y: t.y + 24,
      }));
    if (!copies.length) return;
    updateTextsWithOptionalHistory((prev) => [...prev, ...copies], 'Текст хувилах');
    setSelection({ kind: 'text', ids: copies.map((c) => c.id) });
  }, [selection, updateTextsWithOptionalHistory]);

  const handleBubbleFitSelected = useCallback(() => {
    if (!selection || selection.kind !== 'text' || !selection.ids.length) return;
    const t = textsRef.current.find((x) => x.id === selection.ids[0]);
    const base = baseCanvasRef.current;
    if (!t || !base) return;
    const bub = detectSpeechBubble(t.x, t.y, docW, docH, base, paintLayers);
    if (!bub) return showToast('Битүү хүрээтэй бөмбөлөг олдсонгүй');
    const fittedFs = fitFontSizeToHeight({ ...t, boxWidth: bub.safeW }, bub.safeH);
    handleBatchUpdateTexts(
      { x: bub.cx, y: bub.cy, boxWidth: bub.safeW, fontSize: fittedFs },
      'Бөмбөлөгт багтаах'
    );
  }, [selection, docW, docH, paintLayers, handleBatchUpdateTexts, showToast]);

  const handleAlignTexts = useCallback(
    (mode: 'left' | 'centerX' | 'right' | 'top' | 'centerY' | 'bottom' | 'distributeY' | 'canvasCenter') => {
      if (!selection || selection.kind !== 'text' || !selection.ids.length) return;
      const idSet = new Set(selection.ids);
      const group = textsRef.current.filter((t) => idSet.has(t.id));
      if (!group.length) return;

      updateTextsWithOptionalHistory((prev) => {
        if (mode === 'canvasCenter') {
          return prev.map((t) => (idSet.has(t.id) ? { ...t, x: Math.round(docW / 2) } : t));
        }
        const minX = Math.min(...group.map((t) => t.x));
        const maxX = Math.max(...group.map((t) => t.x));
        const avgX = Math.round(group.reduce((s, t) => s + t.x, 0) / group.length);
        const minY = Math.min(...group.map((t) => t.y));
        const maxY = Math.max(...group.map((t) => t.y));
        const avgY = Math.round(group.reduce((s, t) => s + t.y, 0) / group.length);

        if (mode === 'distributeY' && group.length >= 3) {
          const sorted = [...group].sort((a, b) => a.y - b.y);
          const step = (sorted[sorted.length - 1].y - sorted[0].y) / (sorted.length - 1);
          const yMap = new Map(sorted.map((t, i) => [t.id, Math.round(sorted[0].y + step * i)]));
          return prev.map((t) => (yMap.has(t.id) ? { ...t, y: yMap.get(t.id)! } : t));
        }

        return prev.map((t) => {
          if (!idSet.has(t.id)) return t;
          if (mode === 'left') return { ...t, x: minX };
          if (mode === 'right') return { ...t, x: maxX };
          if (mode === 'centerX') return { ...t, x: avgX };
          if (mode === 'top') return { ...t, y: minY };
          if (mode === 'bottom') return { ...t, y: maxY };
          if (mode === 'centerY') return { ...t, y: avgY };
          return t;
        });
      }, 'Текст тэгшлэх');
    },
    [selection, docW, updateTextsWithOptionalHistory]
  );

  // Add raw image files to Stitch
  const handleAddImageFiles = useCallback(
    async (files: File[], overrideName?: string) => {
      if (!files.length) return;
      const loaded: RawPageItem[] = [];
      for (const f of files) {
        const url = URL.createObjectURL(f);
        const img = await loadImage(url);
        loaded.push({
          id: 'pg_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5),
          name: f.name,
          img,
          url,
          blob: f,
          yStart: 0,
          height: img.height,
        });
      }

      if (overrideName || isSample) {
        if (overrideName) setProjectName(overrideName);
        else if (isSample) setProjectName(files[0].name.replace(/\.[^/.]+$/, '') || 'Шинэ бүлэг');
        setIsSample(false);
        setProjectId(null);
        setTexts([]);
        setLogos([]);
        setSelection(null);
        setHistoryEntries([]);
        setHistoryIndex(-1);
        setPaintLayers([
          {
            id: 'pl_main',
            name: 'Цэвэрлэх давхарга 1',
            visible: true,
            locked: false,
            opacity: 1,
            canvas: createPaintCanvas(docW, docH),
          },
        ]);
        setActivePaintLayerId('pl_main');
        rebuildStitchCanvas(loaded, stitchWidthMode);
      } else {
        const combined = [...rawPages, ...loaded];
        rebuildStitchCanvas(combined, stitchWidthMode);
      }
      setTimeout(() => fitWidth(), 50);
      showToast(`${files.length} зураг нэмэгдлээ`);
    },
    [isSample, docW, docH, rawPages, stitchWidthMode, rebuildStitchCanvas, fitWidth, showToast]
  );

  // Upload custom fonts (.ttf/.otf)
  const handleUploadFonts = useCallback(
    async (files: File[]) => {
      const added: SavedFont[] = [];
      for (const f of files) {
        try {
          const data = await f.arrayBuffer();
          const rec: SavedFont = {
            id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
            name: f.name.replace(/\.[^/.]+$/, ''),
            data,
            added: Date.now(),
          };
          const face = new FontFace(`PFFont_${rec.id}`, data);
          await face.load();
          document.fonts.add(face);
          await StudioDB.putFont(rec);
          added.push(rec);
        } catch {
          showToast(`Фонт уншихад алдаа: ${f.name}`);
        }
      }
      if (added.length) {
        setSavedFonts((prev) => [...prev, ...added]);
        if (selection?.kind === 'text') {
          handleBatchUpdateTexts({ fontFamily: `'PFFont_${added[0].id}', sans-serif` }, 'Фонт солих');
        }
        showToast(`${added.length} фонт хадгалагдлаа`);
      }
    },
    [selection, handleBatchUpdateTexts, showToast]
  );

  // Add Logo files
  const handleAddLogoFiles = useCallback(
    async (files: File[]) => {
      if (!files.length) return;
      const ws = workspaceRef.current;
      const viewY = ws
        ? Math.max(80, Math.min(docH - 80, (ws.scrollTop + ws.clientHeight / 2) / zoom))
        : Math.round(docH / 2);

      const newLogos: LogoLayer[] = [];
      for (const f of files) {
        const url = URL.createObjectURL(f);
        const img = await loadImage(url);
        const w = Math.min(220, Math.round(docW * 0.35), img.width);
        const h = Math.round(w * (img.height / img.width));
        newLogos.push({
          id: 'ov_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5),
          name: f.name,
          img,
          url,
          blob: f,
          x: Math.round(docW / 2),
          y: Math.round(viewY),
          width: w,
          height: h,
          rotation: 0,
          opacity: 1,
          flipX: false,
          flipY: false,
          aboveText: true,
          visible: true,
          locked: false,
        });
      }
      updateLogosWithOptionalHistory((prev) => [...prev, ...newLogos], 'Лого нэмэх');
      setSelection({ kind: 'logo', ids: [newLogos[newLogos.length - 1].id] });
      setActiveTool('logo');
    },
    [docW, docH, zoom, updateLogosWithOptionalHistory]
  );

  // Auto Clean All Bubbles
  const handleAutoCleanAllBubbles = useCallback(() => {
    const base = baseCanvasRef.current;
    const targetLayer = paintLayers.find((l) => l.id === activePaintLayerId && !l.locked) || paintLayers[0];
    if (!base || !targetLayer) return;

    const snap = createPaintCanvas(docW, docH, targetLayer.canvas);
    const stepX = Math.max(24, Math.floor(docW / 26));
    const stepY = Math.max(24, Math.floor(docH / 32));
    const handled: { x1: number; y1: number; x2: number; y2: number }[] = [];
    let count = 0;

    for (let y = stepY; y < docH - stepY; y += stepY) {
      for (let x = stepX; x < docW - stepX; x += stepX) {
        if (handled.some((r) => x >= r.x1 && x <= r.x2 && y >= r.y1 && y <= r.y2)) continue;
        const [r, g, b] = sampleCompositePixelAt(x, y, docW, docH, base, paintLayers);
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        if (lum >= 225) {
          const bub = detectSpeechBubble(x, y, docW, docH, base, paintLayers);
          if (bub && bub.safeW >= 55 && bub.safeW <= docW * 0.72 && bub.safeH >= 36 && bub.safeH <= docH * 0.45) {
            const bx = Math.max(0, Math.round(bub.cx - bub.safeW / 2));
            const by = Math.max(0, Math.round(bub.cy - bub.safeH / 2));
            const bx2 = Math.min(docW, Math.round(bub.cx + bub.safeW / 2));
            const by2 = Math.min(docH, Math.round(bub.cy + bub.safeH / 2));
            const overlaps = handled.some((o) => !(bx2 < o.x1 || bx > o.x2 || by2 < o.y1 || by > o.y2));
            if (!overlaps) {
              cleanShapeOnLayer(
                bx,
                by,
                bx2,
                by2,
                { ...clean, mode: 'inpaint', shape: 'ellipse', polarity: 'dark', tolerance: 40, feather: 4 },
                docW,
                docH,
                base,
                paintLayers,
                targetLayer
              );
              handled.push({ x1: bx, y1: by, x2: bx2, y2: by2 });
              count++;
            }
          }
        }
      }
    }

    if (count > 0) {
      const beforeImg = snap.getContext('2d')!.getImageData(0, 0, docW, docH);
      const afterImg = targetLayer.canvas.getContext('2d')!.getImageData(0, 0, docW, docH);
      pushHistory({
        kind: 'paint',
        label: `Бүх бөмбөлөг цэвэрлэх (${count})`,
        payload: { layerId: targetLayer.id, bx: 0, by: 0, before: beforeImg, after: afterImg },
      });
      setRenderVersion((v) => v + 1);
      setCleanStatus({ kind: 'ok', text: `${count} бөмбөлгийг автоматаар цэвэрлэлээ.` });
    } else {
      setCleanStatus({ kind: 'empty', text: 'Автоматаар танигдах цагаан бөмбөлөг олдсонгүй.' });
    }
  }, [docW, docH, paintLayers, activePaintLayerId, clean, pushHistory]);

  // AI Bubble & SFX Text Cleaner (gemini-4-hydrogen via /api/ai/detect-text-regions)
  const handleAiCleanRegions = useCallback(
    async (scope: 'view' | 'all', filter: AiCleanFilter) => {
      if (aiCleanBusy) return;
      const base = baseCanvasRef.current;
      const targetLayer =
        paintLayers.find((l) => l.id === activePaintLayerId && !l.locked) ||
        paintLayers.find((l) => !l.locked);
      if (!base || !targetLayer) {
        showToast('Түгжээгүй засварын давхарга олдсонгүй');
        return;
      }

      setAiCleanBusy(true);
      setCleanStatus(null);
      const snap = createPaintCanvas(docW, docH, targetLayer.canvas);

      try {
        // Render composite (art + existing paint layers, excluding user's own translated text layers)
        const fullComp = document.createElement('canvas');
        fullComp.width = docW;
        fullComp.height = docH;
        renderCompositeDocument(
          fullComp.getContext('2d')!,
          docW,
          docH,
          base,
          paintLayers,
          [],
          [],
          false
        );

        const bands: { y: number; h: number }[] = [];
        if (scope === 'view' && workspaceRef.current) {
          const ws = workspaceRef.current;
          const vy1 = Math.max(0, Math.floor(ws.scrollTop / zoom) - 40);
          const vh = Math.min(docH - vy1, Math.max(400, Math.ceil(ws.clientHeight / zoom) + 80));
          bands.push({ y: vy1, h: Math.max(100, vh) });
        } else {
          const step = 1080;
          const bandH = 1200;
          for (let y = 0; y < docH; y += step) {
            const h = Math.min(bandH, docH - y);
            if (h > 40) bands.push({ y, h });
            if (y + h >= docH) break;
          }
        }

        let totalCleaned = 0;
        let totalDetected = 0;

        for (const band of bands) {
          const crop = document.createElement('canvas');
          crop.width = docW;
          crop.height = band.h;
          crop.getContext('2d')!.drawImage(fullComp, 0, band.y, docW, band.h, 0, 0, docW, band.h);

          const dataUrl = crop.toDataURL('image/jpeg', 0.92);
          const base64 = dataUrl.split(',')[1] || '';

          const res = await fetch('/api/ai/detect-text-regions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              imageBase64: base64,
              mimeType: 'image/jpeg',
              targetFilter: filter,
            }),
          });

          const payload = (await res.json().catch(() => ({}))) as {
            regions?: AiDetectedRegion[];
            error?: string;
          };

          if (!res.ok) {
            throw new Error(payload.error || 'AI шинжилгээ амжилтгүй боллоо.');
          }

          const regions = Array.isArray(payload.regions) ? payload.regions : [];
          totalDetected += regions.length;

          if (regions.length > 0) {
            const cleaned = cleanAiDetectedRegions(
              regions,
              0,
              band.y,
              docW,
              band.h,
              docW,
              docH,
              base,
              paintLayers,
              targetLayer
            );
            totalCleaned += cleaned.cleanedCount;
          }
        }

        if (totalCleaned > 0) {
          const beforeImg = snap.getContext('2d')!.getImageData(0, 0, docW, docH);
          const afterImg = targetLayer.canvas.getContext('2d')!.getImageData(0, 0, docW, docH);
          pushHistory({
            kind: 'paint',
            label: `AI Цэвэрлэгээ (${totalCleaned})`,
            payload: { layerId: targetLayer.id, bx: 0, by: 0, before: beforeImg, after: afterImg },
          });
          setRenderVersion((v) => v + 1);
          setCleanStatus({
            kind: 'ok',
            text: `AI ${totalCleaned} текст/SFX хэсгийг цэвэрлэлээ (Зураг хэвээр).`,
          });
          showToast(`AI ${totalCleaned} хэсгийг цэвэрлэлээ`);
        } else if (totalDetected === 0) {
          setCleanStatus({
            kind: 'empty',
            text: 'Энэ хэсэгт цэвэрлэх бөмбөлөг эсвэл SFX текст олдсонгүй.',
          });
        } else {
          setCleanStatus({
            kind: 'empty',
            text: 'Илэрсэн текстэд арын өнгөнөөс ялгарах пиксел олдсонгүй.',
          });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'AI цэвэрлэгээний үед алдаа гарлаа.';
        setCleanStatus({ kind: 'empty', text: msg });
        showToast(msg);
      } finally {
        setAiCleanBusy(false);
      }
    },
    [aiCleanBusy, paintLayers, activePaintLayerId, docW, docH, zoom, pushHistory, showToast]
  );

  // Serialize current project for IndexedDB & Snapshots
  const serializeCurrentProjectData = useCallback(async () => {
    const base = baseCanvasRef.current;
    const baseBlob = base ? await canvasToBlob(base, 'image/png') : null;

    const serPaint = [];
    for (const pl of paintLayersRef.current) {
      const blob = await canvasToBlob(pl.canvas, 'image/png');
      if (blob) {
        serPaint.push({
          id: pl.id,
          name: pl.name,
          visible: pl.visible,
          locked: pl.locked,
          opacity: pl.opacity,
          blob,
        });
      }
    }

    const serLogos = [];
    for (const lo of logosRef.current) {
      let blob = lo.blob;
      if (!blob) {
        const c = document.createElement('canvas');
        c.width = lo.img.naturalWidth || lo.width;
        c.height = lo.img.naturalHeight || lo.height;
        c.getContext('2d')!.drawImage(lo.img, 0, 0);
        blob = (await canvasToBlob(c, 'image/png')) || undefined;
      }
      if (blob) {
        serLogos.push({
          id: lo.id,
          name: lo.name,
          x: lo.x,
          y: lo.y,
          width: lo.width,
          height: lo.height,
          rotation: lo.rotation,
          opacity: lo.opacity,
          flipX: lo.flipX,
          flipY: lo.flipY,
          aboveText: lo.aboveText,
          visible: lo.visible,
          locked: lo.locked,
          blob,
          assetId: lo.assetId,
        });
      }
    }

    const serRaw = rawPages
      .filter((r) => r.blob)
      .map((r) => ({ id: r.id, name: r.name, blob: r.blob! }));

    // Thumbnail
    const thumbW = 140;
    const thumbH = Math.max(48, Math.min(220, Math.round(docH * (thumbW / docW))));
    const tc = document.createElement('canvas');
    tc.width = thumbW;
    tc.height = thumbH;
    const tCtx = tc.getContext('2d')!;
    tCtx.fillStyle = '#ffffff';
    tCtx.fillRect(0, 0, thumbW, thumbH);
    if (base) {
      const srcH = Math.min(docH, Math.round(docW * (thumbH / thumbW)));
      tCtx.drawImage(base, 0, 0, docW, srcH, 0, 0, thumbW, thumbH);
    }
    const thumbBlob = await canvasToBlob(tc, 'image/jpeg', 0.8);

    return {
      docW,
      docH,
      bgColor,
      stitchWidthMode,
      customSplitYs,
      scriptText: scriptInput,
      baseBlob,
      thumbBlob,
      rawPages: serRaw,
      paintLayers: serPaint,
      texts: cloneTexts(textsRef.current),
      logos: serLogos,
    };
  }, [docW, docH, bgColor, stitchWidthMode, customSplitYs, scriptInput, rawPages]);

  const saveProjectToDB = useCallback(
    async (withSnapshot = false, snapshotLabel?: string, silent = false) => {
      if (isSaving) return;
      setIsSaving(true);
      try {
        const id = projectId || 'proj_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
        const data = await serializeCurrentProjectData();
        const rec: ProjectRecord = {
          id,
          name: projectName,
          docW: data.docW,
          docH: data.docH,
          bgColor: data.bgColor,
          updatedAt: Date.now(),
          stitchWidthMode: data.stitchWidthMode,
          customSplitYs: data.customSplitYs,
          scriptText: data.scriptText,
          baseBlob: data.baseBlob,
          thumbBlob: data.thumbBlob,
          rawPages: data.rawPages,
          paintLayers: data.paintLayers,
          texts: data.texts,
          logos: data.logos,
        };
        await StudioDB.putProject(rec);
        setProjectId(id);
        setIsSample(false);
        setLastSavedAt(rec.updatedAt);

        if (withSnapshot) {
          const snap: ProjectSnapshot = {
            id: 'snap_' + Date.now(),
            projectId: id,
            label: snapshotLabel || 'Хадгалсан хувилбар',
            createdAt: Date.now(),
            isAuto: !snapshotLabel,
            thumbBlob: data.thumbBlob,
            data: {
              docW: data.docW,
              docH: data.docH,
              bgColor: data.bgColor,
              stitchWidthMode: data.stitchWidthMode,
              customSplitYs: data.customSplitYs,
              scriptText: data.scriptText,
              baseBlob: data.baseBlob,
              rawPages: data.rawPages,
              paintLayers: data.paintLayers,
              texts: data.texts,
              logos: data.logos,
            },
          };
          await StudioDB.putSnapshot(snap);
          await StudioDB.pruneSnapshots(id, 10);
          setSnapshots(await StudioDB.listSnapshots(id));
        }
        setProjects(await StudioDB.listProjects());
        if (!silent) showToast(`«${projectName}» хадгалагдлаа`);
      } catch {
        if (!silent) showToast('Хадгалахад алдаа гарлаа');
      } finally {
        setIsSaving(false);
      }
    },
    [isSaving, projectId, projectName, serializeCurrentProjectData, showToast]
  );

  // Debounced Auto-Save (3.5s after edits once not in initial untouched sample)
  useEffect(() => {
    if (isSample && historyEntries.length === 0) return;
    const timer = window.setTimeout(() => {
      saveProjectToDB(false, undefined, true);
    }, 3500);
    return () => window.clearTimeout(timer);
  }, [texts, logos, paintLayers, rawPages, customSplitYs, renderVersion, isSample, historyEntries.length]);

  const loadProjectDataIntoWorkspace = useCallback(
    async (
      id: string | null,
      name: string,
      data: Omit<ProjectRecord, 'id' | 'name' | 'updatedAt' | 'thumbBlob'>
    ) => {
      const base = document.createElement('canvas');
      base.width = data.docW;
      base.height = data.docH;
      if (data.baseBlob) {
        const u = URL.createObjectURL(data.baseBlob);
        const img = await loadImage(u);
        base.getContext('2d')!.drawImage(img, 0, 0, data.docW, data.docH);
        URL.revokeObjectURL(u);
      } else {
        const ctx = base.getContext('2d')!;
        ctx.fillStyle = data.bgColor || '#ffffff';
        ctx.fillRect(0, 0, data.docW, data.docH);
      }
      baseCanvasRef.current = base;

      const loadedPaint: PaintLayer[] = [];
      for (const sp of data.paintLayers || []) {
        const u = URL.createObjectURL(sp.blob);
        const img = await loadImage(u);
        const c = document.createElement('canvas');
        c.width = data.docW;
        c.height = data.docH;
        c.getContext('2d')!.drawImage(img, 0, 0, data.docW, data.docH);
        URL.revokeObjectURL(u);
        loadedPaint.push({
          id: sp.id,
          name: sp.name,
          visible: sp.visible,
          locked: sp.locked,
          opacity: sp.opacity,
          canvas: c,
        });
      }
      if (!loadedPaint.length) {
        loadedPaint.push({
          id: 'pl_main',
          name: 'Цэвэрлэх давхарга 1',
          visible: true,
          locked: false,
          opacity: 1,
          canvas: createPaintCanvas(data.docW, data.docH),
        });
      }

      const loadedRaw: RawPageItem[] = [];
      let accY = 0;
      for (const sr of data.rawPages || []) {
        const u = URL.createObjectURL(sr.blob);
        const img = await loadImage(u);
        const h = Math.round(img.height * (data.docW / img.width));
        loadedRaw.push({ id: sr.id, name: sr.name, img, url: u, blob: sr.blob, yStart: accY, height: h });
        accY += h;
      }

      const loadedLogos: LogoLayer[] = [];
      for (const sl of data.logos || []) {
        const u = URL.createObjectURL(sl.blob);
        const img = await loadImage(u);
        loadedLogos.push({ ...sl, img, url: u });
      }

      setProjectId(id);
      setProjectName(name);
      setIsSample(false);
      setDocW(data.docW);
      setDocH(data.docH);
      setBgColor(data.bgColor || '#ffffff');
      setStitchWidthMode(data.stitchWidthMode || '800');
      setCustomSplitYs(data.customSplitYs || []);
      setScriptInput(data.scriptText || '');
      setPaintLayers(loadedPaint);
      setActivePaintLayerId(loadedPaint[0].id);
      setRawPages(loadedRaw);
      setTexts(cloneTexts(data.texts || []));
      setLogos(loadedLogos);
      setSelection(null);
      setHistoryEntries([]);
      setHistoryIndex(-1);
      setRenderVersion((v) => v + 1);
      if (id) setSnapshots(await StudioDB.listSnapshots(id));
      setTimeout(() => fitWidth(data.docW), 50);
    },
    [fitWidth]
  );

  // Page navigation helpers
  const pageStarts = useMemo(() => {
    const starts = new Set<number>([0]);
    rawPages.forEach((p) => {
      if (p.yStart > 0 && p.yStart < docH) starts.add(p.yStart);
    });
    customSplitYs.forEach((y) => {
      if (y > 20 && y < docH - 20) starts.add(Math.round(y));
    });
    if (starts.size === 1 && docH > 1500) {
      const step = Math.max(900, Math.round(docW * 1.45));
      for (let y = step; y < docH; y += step) starts.add(y);
    }
    return Array.from(starts).sort((a, b) => a - b);
  }, [rawPages, customSplitYs, docW, docH]);

  const updateCurrentPageOnScroll = useCallback(() => {
    const ws = workspaceRef.current;
    if (!ws) return;
    const viewY = (ws.scrollTop + ws.clientHeight * 0.3) / zoom;
    let cur = 1;
    for (let i = 0; i < pageStarts.length; i++) {
      if (viewY >= pageStarts[i] - 20) cur = i + 1;
    }
    setCurrentPageNum(cur);
  }, [pageStarts, zoom]);

  const jumpPage = useCallback(
    (dir: number) => {
      const nextIdx = Math.max(0, Math.min(pageStarts.length - 1, currentPageNum - 1 + dir));
      const ws = workspaceRef.current;
      if (ws) {
        ws.scrollTo({ top: Math.max(0, pageStarts[nextIdx] * zoom - 16), behavior: 'smooth' });
      }
    },
    [pageStarts, currentPageNum, zoom]
  );

  // Global Keyboard Shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.code === 'KeyS') {
        e.preventDefault();
        saveProjectToDB(true, 'Гар хадгалалт');
        return;
      }

      const tag = document.activeElement?.tagName;
      const isEditingInput =
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        (tag === 'INPUT' && ['text', 'number'].includes((document.activeElement as HTMLInputElement).type));

      if (isEditingInput) return;

      if (mod && e.code === 'KeyA') {
        e.preventDefault();
        const ids = textsRef.current.filter((t) => t.visible && !t.locked).map((t) => t.id);
        if (ids.length) {
          setSelection({ kind: 'text', ids });
          showToast(`${ids.length} текст сонгогдлоо`);
        }
        return;
      }
      if (mod && e.code === 'KeyZ') {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
        return;
      }
      if (mod && e.code === 'KeyY') {
        e.preventDefault();
        handleRedo();
        return;
      }
      if (mod && e.code === 'KeyB' && selection?.kind === 'text') {
        e.preventDefault();
        const first = textsRef.current.find((t) => t.id === selection.ids[0]);
        if (first) handleBatchUpdateTexts({ bold: !first.bold }, 'Тод');
        return;
      }
      if (mod && e.code === 'KeyI' && selection?.kind === 'text') {
        e.preventDefault();
        const first = textsRef.current.find((t) => t.id === selection.ids[0]);
        if (first) handleBatchUpdateTexts({ italic: !first.italic }, 'Налуу');
        return;
      }
      if (mod && e.code === 'KeyU' && selection?.kind === 'text') {
        e.preventDefault();
        const first = textsRef.current.find((t) => t.id === selection.ids[0]);
        if (first) handleBatchUpdateTexts({ underline: !first.underline }, 'Доогуур зураас');
        return;
      }
      if (mod && e.code === 'KeyD' && selection) {
        e.preventDefault();
        if (selection.kind === 'text') {
          const idSet = new Set(selection.ids);
          const copies = textsRef.current
            .filter((t) => idSet.has(t.id))
            .map((t) => ({
              ...JSON.parse(JSON.stringify(t)),
              id: 't_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5),
              x: t.x + 24,
              y: t.y + 24,
            }));
          updateTextsWithOptionalHistory((prev) => [...prev, ...copies], 'Текст хувилах');
          setSelection({ kind: 'text', ids: copies.map((c) => c.id) });
        }
        return;
      }

      if (mod) return;

      if ((e.code === 'Delete' || e.code === 'Backspace') && selection) {
        e.preventDefault();
        const idSet = new Set(selection.ids);
        if (selection.kind === 'text') {
          updateTextsWithOptionalHistory((prev) => prev.filter((t) => !idSet.has(t.id)), 'Текст устгах');
        } else {
          updateLogosWithOptionalHistory((prev) => prev.filter((l) => !idSet.has(l.id)), 'Лого устгах');
        }
        setSelection(null);
        return;
      }

      if (e.code === 'PageUp') {
        e.preventDefault();
        jumpPage(-1);
        return;
      }
      if (e.code === 'PageDown') {
        e.preventDefault();
        jumpPage(1);
        return;
      }
      if (e.code === 'Escape') {
        setFocusMode(false);
        setQuickTextWin((w) => ({ ...w, open: false }));
        setMobileInspectorOpen(false);
        setSelection(null);
        setNewProjectOpen(false);
        setExportOpen(false);
        setShortcutsOpen(false);
        return;
      }
      if (e.code === 'KeyF') {
        e.preventDefault();
        setFocusMode((v) => !v);
        return;
      }
      if (selection && e.code.startsWith('Arrow')) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const dx = e.code === 'ArrowRight' ? step : e.code === 'ArrowLeft' ? -step : 0;
        const dy = e.code === 'ArrowDown' ? step : e.code === 'ArrowUp' ? -step : 0;
        const idSet = new Set(selection.ids);
        if (selection.kind === 'text') {
          updateTextsWithOptionalHistory(
            (prev) => prev.map((t) => (idSet.has(t.id) ? { ...t, x: t.x + dx, y: t.y + dy } : t)),
            'Зөөх'
          );
        } else {
          updateLogosWithOptionalHistory(
            (prev) => prev.map((l) => (idSet.has(l.id) ? { ...l, x: l.x + dx, y: l.y + dy } : l)),
            'Лого зөөх'
          );
        }
        return;
      }

      const toolMap: Record<string, ToolId> = {
        KeyV: 'select',
        KeyT: 'text',
        KeyL: 'logo',
        KeyC: 'bubble',
        KeyB: 'brush',
        KeyS: 'clone',
        KeyE: 'eraser',
        KeyI: 'eyedrop',
        KeyH: 'hand',
      };
      if (toolMap[e.code]) {
        handleSelectTool(toolMap[e.code]);
        return;
      }
      if (e.code === 'BracketLeft' || e.code === 'BracketRight') {
        setBrush((b) => ({
          ...b,
          size: Math.max(1, Math.min(150, b.size + (e.code === 'BracketRight' ? 4 : -4))),
        }));
        return;
      }
      if (e.code === 'Digit0') fitWidth();
      else if (e.code === 'Equal' || e.code === 'NumpadAdd') setZoom((z) => Math.min(6, z + 0.15));
      else if (e.code === 'Minus' || e.code === 'NumpadSubtract') setZoom((z) => Math.max(0.15, z - 0.15));
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    selection,
    saveProjectToDB,
    handleUndo,
    handleRedo,
    handleBatchUpdateTexts,
    updateTextsWithOptionalHistory,
    updateLogosWithOptionalHistory,
    jumpPage,
    handleSelectTool,
    fitWidth,
    showToast,
  ]);

  const selectedTexts = useMemo(
    () => (selection?.kind === 'text' ? texts.filter((t) => selection.ids.includes(t.id)) : []),
    [selection, texts]
  );

  const selectedLogo = useMemo(
    () => (selection?.kind === 'logo' ? logos.find((l) => l.id === selection.ids[0]) || null : null),
    [selection, logos]
  );

  const allPresets = useMemo(() => [...DEFAULT_PRESETS, ...customPresets], [customPresets]);
  const allGradients = useMemo(() => [...DEFAULT_GRADIENTS, ...customGradients], [customGradients]);

  return (
    <div className="h-screen h-dvh w-screen overflow-hidden flex flex-col bg-neutral-100 dark:bg-[#0b0f0e] text-neutral-900 dark:text-neutral-100">
      {/* Hidden File Inputs */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          const files = Array.from(e.target.files || []);
          e.target.value = '';
          const pName = pendingProjectName || undefined;
          setPendingProjectName(null);
          if (files.length) handleAddImageFiles(files, pName);
        }}
      />
      <input
        ref={logoInputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          const files = Array.from(e.target.files || []);
          e.target.value = '';
          if (files.length) handleAddLogoFiles(files);
        }}
      />

      {/* Top Studio Bar (hidden in Focus Mode) */}
      {!focusMode && (
        <TopBar
          projectName={projectName}
          onRenameProject={(nm) => setProjectName(nm)}
          lastSavedAt={lastSavedAt}
          isSaving={isSaving}
          canUndo={historyIndex >= 0}
          canRedo={historyIndex < historyEntries.length - 1}
          onUndo={handleUndo}
          onRedo={handleRedo}
          currentPage={currentPageNum}
          totalPages={pageStarts.length}
          onJumpPage={jumpPage}
          zoom={zoom}
          onZoomChange={(z) => setZoom(Math.min(6, Math.max(0.15, z)))}
          onFitWidth={() => fitWidth()}
          beforeAfterMode={beforeAfterMode}
          onToggleBeforeAfterSplit={() =>
            setBeforeAfterMode((m) => (m === 'split' ? 'off' : 'split'))
          }
          onPeekStart={() => setBeforeAfterMode('peek')}
          onPeekEnd={() => setBeforeAfterMode((m) => (m === 'peek' ? 'off' : m))}
          onUploadImages={() => {
            setPendingProjectName(null);
            imageInputRef.current?.click();
          }}
          onSaveProject={() => saveProjectToDB(true, 'Гар хадгалалт')}
          onOpenNewProject={() => setNewProjectOpen(true)}
          onOpenExport={() => setExportOpen(true)}
          onOpenShortcuts={() => setShortcutsOpen(true)}
          workspaceSettings={workspaceSettings}
          onUpdateWorkspaceSettings={(patch) =>
            setWorkspaceSettings((prev) => ({ ...prev, ...patch }))
          }
          focusMode={focusMode}
          onToggleFocusMode={() => setFocusMode((v) => !v)}
        />
      )}

      {/* Main Studio Body */}
      <div
        className={`flex-1 flex min-h-0 relative ${
          workspaceSettings.toolbarSide === 'right' ? 'flex-row-reverse' : 'flex-row'
        }`}
      >
        {/* Zone 1: Unified Toolbar */}
        {!focusMode && (
          <Toolbar
            activeTool={activeTool}
            onSelectTool={handleSelectTool}
            side={workspaceSettings.toolbarSide}
            onToggleQuickText={() =>
              setQuickTextWin((w) => ({ ...w, open: !w.open, minimized: false }))
            }
            onAddLogo={() => logoInputRef.current?.click()}
          />
        )}

        {/* Zone 2: Canvas Viewport + Collapsible/Draggable Quick Windows & Bottom Tool Dock */}
        <div ref={workAreaWrapRef} className="flex-1 relative flex min-w-0 min-h-0">
          <CanvasStage
            docW={docW}
            docH={docH}
            zoom={zoom}
            onZoomChange={setZoom}
            activeTool={activeTool}
            onSelectTool={handleSelectTool}
            baseCanvasRef={baseCanvasRef}
            paintLayers={paintLayers}
            activePaintLayerId={activePaintLayerId}
            texts={texts}
            logos={logos}
            rawPages={rawPages}
            customSplitYs={customSplitYs}
            selection={selection}
            onSelectObjects={(sel) => {
              setSelection(sel);
              if (sel?.kind === 'text' && activeTool === 'text') {
                setQuickTextWin((w) => ({ ...w, open: true, minimized: false }));
              }
            }}
            onUpdateTextsDirect={updateTextsWithOptionalHistory}
            onUpdateLogosDirect={updateLogosWithOptionalHistory}
            onCreateTextAt={handleCreateTextAt}
            onOpenQuickText={() => setQuickTextWin((w) => ({ ...w, open: true, minimized: false }))}
            onCloseQuickText={() => setQuickTextWin((w) => ({ ...w, open: false }))}
            onOpenLogoUpload={() => logoInputRef.current?.click()}
            onCanvasTapDismiss={() => setMobileInspectorOpen(false)}
            brush={brush}
            clean={clean}
            onPickColor={(hex) => {
              setBrush((b) => ({ ...b, color: hex }));
              setRecentColors((prev) => {
                const next = [hex, ...prev.filter((c) => c.toLowerCase() !== hex.toLowerCase())].slice(0, 12);
                safeLocalSet('pf_recent_colors_v2', next);
                return next;
              });
            }}
            onCleanFeedback={(msg) => setCleanStatus(msg)}
            onCommitPaintHistory={(layerId, bx, by, before, after, label) => {
              pushHistory({
                kind: 'paint',
                label,
                payload: { layerId, bx, by, before, after },
              });
              setRenderVersion((v) => v + 1);
            }}
            beforeAfterMode={beforeAfterMode}
            showPageMarkers={workspaceSettings.showPageMarkers}
            showGridSnap={workspaceSettings.showGridSnap}
            autoBubbleDetect={workspaceSettings.autoBubbleDetect}
            workspaceRef={workspaceRef}
            stageRefExternal={stageRef}
            onPageScrollUpdate={updateCurrentPageOnScroll}
            renderVersion={renderVersion}
            onDropFiles={(files) => {
              const imgs = files.filter((f) => f.type.startsWith('image/'));
              const fonts = files.filter((f) => /\.(ttf|otf|woff2?)$/i.test(f.name));
              if (imgs.length) handleAddImageFiles(imgs);
              if (fonts.length) handleUploadFonts(fonts);
            }}
            onUndo={handleUndo}
            onRedo={handleRedo}
            clonePickMode={clonePickMode}
            onClonePicked={() => {
              setClonePickMode(false);
              showToast('Хуулах эх цэг сонгогдлоо');
            }}
          />

          {/* Floating Script Queue Bar */}
          <ScriptQueueBar
            lines={scriptLines}
            used={scriptUsed}
            nextIdx={scriptNext}
            onStep={(dir) => {
              if (!scriptLines.length) return;
              setScriptNext((cur) => (cur < 0 ? 0 : (cur + dir + scriptLines.length) % scriptLines.length));
            }}
            onDropAtCenter={() => {
              const ws = workspaceRef.current;
              const vy = ws
                ? Math.max(80, Math.min(docH - 80, Math.round((ws.scrollTop + ws.clientHeight * 0.35) / zoom)))
                : Math.round(docH / 2);
              handleCreateTextAt(Math.round(docW / 2), vy, 210);
            }}
            onClose={() => setScriptNext(-1)}
          />

          {/* Floating Quick Windows */}
          <QuickTextWindow
            win={quickTextWin}
            onUpdateWin={(patch) => setQuickTextWin((w) => ({ ...w, ...patch }))}
            selectedTexts={selectedTexts}
            savedFonts={savedFonts}
            presets={allPresets}
            docW={docW}
            onBatchUpdateTexts={handleBatchUpdateTexts}
            onPasteText={async () => {
              try {
                const clip = await navigator.clipboard.readText();
                if (clip) {
                  if (selectedTexts.length) handleBatchUpdateTexts({ text: clip }, 'Текст наах');
                  else handleCreateTextAt(Math.round(docW / 2), 300, 220);
                }
              } catch {
                showToast('Ctrl+V дарж наана уу');
              }
            }}
            onInsertNextText={() => {
              const cur = selectedTexts[0];
              const nx = cur ? cur.x : Math.round(docW / 2);
              const ny = cur ? Math.min(docH - 60, cur.y + 84) : 300;
              handleCreateTextAt(nx, ny, cur?.boxWidth || 210);
            }}
            onBubbleFit={handleBubbleFitSelected}
            onAutoFitText={handleBubbleFitSelected}
            onDuplicateSelected={handleDuplicateSelectedText}
            onDeleteSelected={() => {
              if (!selection || selection.kind !== 'text') return;
              const idSet = new Set(selection.ids);
              updateTextsWithOptionalHistory((prev) => prev.filter((t) => !idSet.has(t.id)), 'Текст устгах');
              setSelection(null);
            }}
            onEnsureVisible={ensureSelectedTextVisible}
            boundsRef={workAreaWrapRef}
          />

          <BottomToolDock
            activeTool={activeTool}
            onSelectTool={handleSelectTool}
            visible={!quickTextWin.open}
            brush={brush}
            onUpdateBrush={(patch) => setBrush((b) => ({ ...b, ...patch }))}
            recentColors={recentColors}
            onCommitRecentColor={(hex) => {
              setRecentColors((prev) => {
                const next = [hex, ...prev.filter((c) => c.toLowerCase() !== hex.toLowerCase())].slice(0, 12);
                safeLocalSet('pf_recent_colors_v2', next);
                return next;
              });
            }}
            clean={clean}
            onUpdateClean={(patch) => setClean((c) => ({ ...c, ...patch }))}
            onAutoCleanAll={handleAutoCleanAllBubbles}
            onAiClean={handleAiCleanRegions}
            aiCleanBusy={aiCleanBusy}
            aiCleanFilter={aiCleanFilter}
            onChangeAiCleanFilter={setAiCleanFilter}
            cleanStatus={cleanStatus}
            clonePickMode={clonePickMode}
            onToggleClonePickMode={() => setClonePickMode((v) => !v)}
            selectedLogo={selectedLogo}
            onTriggerLogoUpload={() => logoInputRef.current?.click()}
            onPlaceLogoPreset={(pos) => {
              if (!selectedLogo) return;
              const pad = 28;
              const ws = workspaceRef.current;
              const viewTop = ws ? ws.scrollTop / zoom : 0;
              const viewH = ws ? ws.clientHeight / zoom : docH;
              const viewMidY = Math.max(
                selectedLogo.height / 2 + pad,
                Math.min(docH - selectedLogo.height / 2 - pad, Math.round(viewTop + viewH / 2))
              );
              let nx = selectedLogo.x;
              let ny = selectedLogo.y;
              if (pos === 'center') {
                nx = Math.round(docW / 2);
                ny = viewMidY;
              } else if (pos === 'top') {
                nx = Math.round(docW / 2);
                ny = Math.round(selectedLogo.height / 2 + pad);
              } else if (pos === 'bottom') {
                nx = Math.round(docW / 2);
                ny = Math.round(docH - selectedLogo.height / 2 - pad);
              } else if (pos === 'left') {
                nx = Math.round(selectedLogo.width / 2 + pad);
                ny = viewMidY;
              } else if (pos === 'right') {
                nx = Math.round(docW - selectedLogo.width / 2 - pad);
                ny = viewMidY;
              }
              updateLogosWithOptionalHistory(
                (prev) => prev.map((l) => (l.id === selectedLogo.id ? { ...l, x: nx, y: ny } : l)),
                'Лого байршуулах'
              );
            }}
            onSendLogoToBack={() => {
              if (!selectedLogo) return;
              updateLogosWithOptionalHistory(
                (prev) => [{ ...selectedLogo, aboveText: false }, ...prev.filter((l) => l.id !== selectedLogo.id)],
                'Логог ард илгээх'
              );
            }}
            onBringLogoToFront={() => {
              if (!selectedLogo) return;
              updateLogosWithOptionalHistory(
                (prev) => [...prev.filter((l) => l.id !== selectedLogo.id), { ...selectedLogo, aboveText: true }],
                'Логог урд гаргах'
              );
            }}
            onUpdateSelectedLogos={(patch, label) => {
              if (!selection || selection.kind !== 'logo') return;
              const idSet = new Set(selection.ids);
              updateLogosWithOptionalHistory(
                (prev) => prev.map((l) => (idSet.has(l.id) ? { ...l, ...patch } : l)),
                label
              );
            }}
            onDeleteSelectedLogo={() => {
              if (!selectedLogo) return;
              updateLogosWithOptionalHistory((prev) => prev.filter((l) => l.id !== selectedLogo.id), 'Лого устгах');
              setSelection(null);
            }}
            canUndo={historyIndex >= 0}
            canRedo={historyIndex < historyEntries.length - 1}
            onUndo={handleUndo}
            onRedo={handleRedo}
          />

          {!quickTextWin.open && selectedTexts.length > 0 && (
            <button
              type="button"
              onClick={() => setQuickTextWin((w) => ({ ...w, open: true, minimized: false }))}
              className="absolute bottom-14 left-3 z-20 h-8 px-3 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white/95 dark:bg-neutral-900/95 text-xs font-medium shadow-lg hover:border-emerald-500"
            >
              Текст цонх нээх
            </button>
          )}

          {/* Compact Bottom Canvas Nav Pill (shown when neither QuickTextWindow nor BottomToolDock is open) */}
          {!quickTextWin.open && !['brush', 'eraser', 'clone', 'bubble', 'logo'].includes(activeTool) && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-0.5 rounded-full border border-neutral-300/90 dark:border-neutral-700/90 bg-white/95 dark:bg-[#131b18]/95 backdrop-blur-md px-2 py-1 shadow-xl">
              <button
                type="button"
                onClick={() => jumpPage(-1)}
                title="Өмнөх хуудас"
                className="w-7 h-7 rounded-full hover:bg-neutral-200/70 dark:hover:bg-neutral-800 flex items-center justify-center text-neutral-700 dark:text-neutral-200"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="px-1.5 text-[11px] font-mono-num font-semibold text-neutral-700 dark:text-neutral-200 whitespace-nowrap">
                {currentPageNum}/{pageStarts.length}
              </span>
              <button
                type="button"
                onClick={() => jumpPage(1)}
                title="Дараагийн хуудас"
                className="w-7 h-7 rounded-full hover:bg-neutral-200/70 dark:hover:bg-neutral-800 flex items-center justify-center text-neutral-700 dark:text-neutral-200"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>

              <span className="h-4 w-px bg-neutral-200 dark:bg-neutral-800 mx-0.5" />

              <button
                type="button"
                onClick={handleUndo}
                disabled={historyIndex < 0}
                title="Буцаах"
                className="w-7 h-7 rounded-full hover:bg-neutral-200/70 dark:hover:bg-neutral-800 disabled:opacity-30 flex items-center justify-center text-neutral-700 dark:text-neutral-200"
              >
                <Undo2 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleRedo}
                disabled={historyIndex >= historyEntries.length - 1}
                title="Дахих"
                className="w-7 h-7 rounded-full hover:bg-neutral-200/70 dark:hover:bg-neutral-800 disabled:opacity-30 flex items-center justify-center text-neutral-700 dark:text-neutral-200"
              >
                <Redo2 className="w-3.5 h-3.5" />
              </button>

              <span className="h-4 w-px bg-neutral-200 dark:bg-neutral-800 mx-0.5" />

              <button
                type="button"
                onClick={() => setZoom((z) => Math.max(0.15, z - 0.15))}
                className="w-7 h-7 rounded-full hover:bg-neutral-200/70 dark:hover:bg-neutral-800 text-xs font-bold text-neutral-700 dark:text-neutral-200"
              >
                −
              </button>
              <button
                type="button"
                onClick={() => fitWidth()}
                className="px-1.5 h-7 rounded-full hover:bg-neutral-200/70 dark:hover:bg-neutral-800 text-[11px] font-mono-num font-semibold text-emerald-700 dark:text-emerald-400"
              >
                {Math.round(zoom * 100)}%
              </button>
              <button
                type="button"
                onClick={() => setZoom((z) => Math.min(6, z + 0.15))}
                className="w-7 h-7 rounded-full hover:bg-neutral-200/70 dark:hover:bg-neutral-800 text-xs font-bold text-neutral-700 dark:text-neutral-200"
              >
                +
              </button>
            </div>
          )}

          {/* Focus mode exit button */}
          {focusMode && (
            <button
              type="button"
              onClick={() => setFocusMode(false)}
              title="Төвлөрөх горимоос гарах (F / Esc)"
              className="fixed top-3 right-3 z-40 h-9 px-3 rounded-full border border-neutral-300 dark:border-neutral-700 bg-white/95 dark:bg-[#131b18]/95 backdrop-blur-md shadow-xl text-xs font-semibold text-neutral-800 dark:text-neutral-100 flex items-center gap-1.5"
            >
              <Minimize2 className="w-3.5 h-3.5 text-emerald-500" />
              Гарах
            </button>
          )}

          {/* Mobile Quick Action FABs (Hand pan toggle, Focus toggle, Inspector Drawer) */}
          {!quickTextWin.open && (
            <div className="md:hidden fixed bottom-14 right-3 z-30 flex flex-col items-end gap-2">
              <button
                type="button"
                onClick={() =>
                  handleSelectTool(activeTool === 'hand' ? prevToolRef.current || 'select' : 'hand')
                }
                title="Гүйлгэх гар"
                className={`h-10 w-10 rounded-full border shadow-lg flex items-center justify-center ${
                  activeTool === 'hand'
                    ? 'bg-emerald-600 border-emerald-500 text-white'
                    : 'bg-white/95 dark:bg-[#141c19]/95 border-neutral-300 dark:border-neutral-700 text-neutral-800 dark:text-neutral-100'
                }`}
              >
                <Hand className="w-4 h-4" />
              </button>
              {!focusMode && (
                <>
                  <button
                    type="button"
                    onClick={() => setFocusMode(true)}
                    title="Дэлгэц дүүргэх"
                    className="h-10 w-10 rounded-full border border-neutral-300 dark:border-neutral-700 bg-white/95 dark:bg-[#141c19]/95 text-neutral-800 dark:text-neutral-100 shadow-lg flex items-center justify-center"
                  >
                    <Maximize2 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setMobileInspectorOpen((v) => !v)}
                    className="h-10 px-3.5 rounded-full bg-emerald-600 text-white shadow-xl flex items-center gap-1.5 text-xs font-semibold"
                  >
                    <SlidersHorizontal className="w-4 h-4" />
                    Тохиргоо
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Zone 3 & 4: Unified Right Inspector (Properties · Layers · Projects & Pages) */}
        {!focusMode && (
          <div
            className={`${
              mobileInspectorOpen
                ? 'fixed inset-x-0 bottom-0 z-40 flex md:static md:inset-auto shadow-2xl'
                : 'hidden md:flex'
            }`}
          >
            <RightInspector
              tab={inspectorTab}
              onChangeTab={setInspectorTab}
              activeTool={activeTool}
              docW={docW}
              docH={docH}
              isDark={workspaceSettings.theme === 'dark'}
              selection={selection}
              onSelectObjects={(sel) => {
                setSelection(sel);
                if (sel?.kind === 'text') setInspectorTab('properties');
              }}
              texts={texts}
              onBatchUpdateTexts={handleBatchUpdateTexts}
              onAlignTexts={handleAlignTexts}
              onDuplicateSelectedText={handleDuplicateSelectedText}
              onDeleteSelectedText={() => {
                if (!selection || selection.kind !== 'text') return;
                const idSet = new Set(selection.ids);
                updateTextsWithOptionalHistory((prev) => prev.filter((t) => !idSet.has(t.id)), 'Текст устгах');
                setSelection(null);
              }}
              onBubbleFitSelected={handleBubbleFitSelected}
              onAddNewTextCenter={() => {
                const ws = workspaceRef.current;
                const vy = ws
                  ? Math.max(80, Math.min(docH - 80, Math.round((ws.scrollTop + ws.clientHeight / 2) / zoom)))
                  : Math.round(docH / 2);
                handleCreateTextAt(Math.round(docW / 2), vy, 210);
              }}
            onMoveTextLayer={(id, dir) => {
              updateTextsWithOptionalHistory((prev) => {
                const idx = prev.findIndex((t) => t.id === id);
                const nextIdx = idx + dir;
                if (idx < 0 || nextIdx < 0 || nextIdx >= prev.length) return prev;
                const cp = [...prev];
                [cp[idx], cp[nextIdx]] = [cp[nextIdx], cp[idx]];
                return cp;
              }, 'Давхаргын дараалал');
            }}
            onToggleTextLayerProp={(id, prop) => {
              updateTextsWithOptionalHistory(
                (prev) => prev.map((t) => (t.id === id ? { ...t, [prop]: !t[prop] } : t)),
                prop === 'visible' ? 'Харагдац' : 'Түгжих'
              );
            }}
            savedFonts={savedFonts}
            onUploadFonts={handleUploadFonts}
            onDeleteFont={async (id) => {
              await StudioDB.deleteFont(id);
              setSavedFonts((prev) => prev.filter((f) => f.id !== id));
            }}
            presets={allPresets}
            onSaveCustomPreset={(name) => {
              const t = selectedTexts[0];
              if (!t) return;
              const copy: Partial<TextLayer> = { ...t };
              delete copy.id;
              delete copy.text;
              delete copy.x;
              delete copy.y;
              delete copy._halfW;
              delete copy._halfH;
              const next = [...customPresets, { id: 'cp_' + Date.now(), name, style: copy }];
              setCustomPresets(next);
              safeLocalSet('pf_custom_presets_v2', next);
              showToast(`«${name}» загвар хадгалагдлаа`);
            }}
            onDeleteCustomPreset={(id) => {
              const next = customPresets.filter((p) => p.id !== id);
              setCustomPresets(next);
              safeLocalSet('pf_custom_presets_v2', next);
            }}
            gradients={allGradients}
            onSaveCustomGradient={(c1, c2, ang) => {
              const next = [...customGradients, { id: 'cg_' + Date.now(), c1, c2, ang }];
              setCustomGradients(next);
              safeLocalSet('pf_custom_gradients_v2', next);
              showToast('Градиент хадгалагдлаа');
            }}
            scriptInput={scriptInput}
            onChangeScriptInput={setScriptInput}
            scriptLines={scriptLines}
            scriptUsed={scriptUsed}
            scriptNext={scriptNext}
            onStartScriptLine={(idx) => {
              const nextUsed = new Set(scriptUsed);
              nextUsed.delete(idx);
              setScriptUsed(nextUsed);
              setScriptNext(idx);
              handleSelectTool('text');
            }}
            logos={logos}
            onUpdateSelectedLogos={(patch, label) => {
              if (!selection || selection.kind !== 'logo') return;
              const idSet = new Set(selection.ids);
              updateLogosWithOptionalHistory(
                (prev) => prev.map((l) => (idSet.has(l.id) ? { ...l, ...patch } : l)),
                label
              );
            }}
            onPlaceLogoPreset={(pos) => {
              if (!selectedLogo) return;
              const pad = 28;
              const ws = workspaceRef.current;
              const viewTop = ws ? ws.scrollTop / zoom : 0;
              const viewH = ws ? ws.clientHeight / zoom : docH;
              const viewMidY = Math.max(selectedLogo.height / 2 + pad, Math.min(docH - selectedLogo.height / 2 - pad, Math.round(viewTop + viewH / 2)));

              let nx = selectedLogo.x;
              let ny = selectedLogo.y;
              if (pos === 'center') {
                nx = Math.round(docW / 2);
                ny = viewMidY;
              } else if (pos === 'top') {
                nx = Math.round(docW / 2);
                ny = Math.round(selectedLogo.height / 2 + pad);
              } else if (pos === 'bottom') {
                nx = Math.round(docW / 2);
                ny = Math.round(docH - selectedLogo.height / 2 - pad);
              } else if (pos === 'left') {
                nx = Math.round(selectedLogo.width / 2 + pad);
                ny = viewMidY;
              } else if (pos === 'right') {
                nx = Math.round(docW - selectedLogo.width / 2 - pad);
                ny = viewMidY;
              }
              updateLogosWithOptionalHistory(
                (prev) => prev.map((l) => (l.id === selectedLogo.id ? { ...l, x: nx, y: ny } : l)),
                'Лого байршуулах'
              );
            }}
            onSendLogoToBack={() => {
              if (!selectedLogo) return;
              updateLogosWithOptionalHistory(
                (prev) => {
                  const rest = prev.filter((l) => l.id !== selectedLogo.id);
                  return [{ ...selectedLogo, aboveText: false }, ...rest];
                },
                'Логог ард илгээх'
              );
            }}
            onBringLogoToFront={() => {
              if (!selectedLogo) return;
              updateLogosWithOptionalHistory(
                (prev) => {
                  const rest = prev.filter((l) => l.id !== selectedLogo.id);
                  return [...rest, { ...selectedLogo, aboveText: true }];
                },
                'Логог урд гаргах'
              );
            }}
            onTileLogo={() => {
              if (!selectedLogo) return;
              const clones: LogoLayer[] = [];
              for (let y = selectedLogo.y + 1500; y < docH - 40; y += 1500) {
                clones.push({
                  ...selectedLogo,
                  id: 'ov_' + Date.now() + '_' + y,
                  y,
                });
              }
              if (clones.length) {
                updateLogosWithOptionalHistory((prev) => [...prev, ...clones], 'Лого давтах');
                showToast(`${clones.length} байрлалд давтагдлаа`);
              }
            }}
            onDeleteSelectedLogo={() => {
              if (!selectedLogo) return;
              updateLogosWithOptionalHistory((prev) => prev.filter((l) => l.id !== selectedLogo.id), 'Лого устгах');
              setSelection(null);
            }}
            onToggleLogoProp={(id, prop) => {
              updateLogosWithOptionalHistory(
                (prev) => prev.map((l) => (l.id === id ? { ...l, [prop]: !l[prop] } : l)),
                'Лого төлөв'
              );
            }}
            onSaveLogoToLibrary={async (logo) => {
              let blob = logo.blob;
              if (!blob) {
                const c = document.createElement('canvas');
                c.width = logo.img.naturalWidth || logo.width;
                c.height = logo.img.naturalHeight || logo.height;
                c.getContext('2d')!.drawImage(logo.img, 0, 0);
                blob = (await canvasToBlob(c, 'image/png')) || undefined;
              }
              if (!blob) return;
              const asset: SavedLogoAsset = {
                id: 'la_' + Date.now(),
                name: logo.name.replace(/\.[^/.]+$/, ''),
                blob,
                width: logo.width,
                height: logo.height,
                added: Date.now(),
              };
              await StudioDB.putLogo(asset);
              setSavedLogos(await StudioDB.listLogos());
              showToast('Лого санд хадгалагдлаа');
            }}
            savedLogos={savedLogos}
            onInsertSavedLogo={async (asset) => {
              const url = URL.createObjectURL(asset.blob);
              const img = await loadImage(url);
              const ws = workspaceRef.current;
              const viewY = ws
                ? Math.max(80, Math.min(docH - 80, Math.round((ws.scrollTop + ws.clientHeight / 2) / zoom)))
                : Math.round(docH / 2);
              const newLogo: LogoLayer = {
                id: 'ov_' + Date.now(),
                name: asset.name,
                img,
                url,
                blob: asset.blob,
                assetId: asset.id,
                x: Math.round(docW / 2),
                y: viewY,
                width: asset.width,
                height: asset.height,
                rotation: 0,
                opacity: 1,
                flipX: false,
                flipY: false,
                aboveText: true,
                visible: true,
                locked: false,
              };
              updateLogosWithOptionalHistory((prev) => [...prev, newLogo], 'Сангаас лого оруулах');
              setSelection({ kind: 'logo', ids: [newLogo.id] });
            }}
            onDeleteSavedLogo={async (id) => {
              await StudioDB.deleteLogo(id);
              setSavedLogos((prev) => prev.filter((a) => a.id !== id));
            }}
            onTriggerLogoUpload={() => logoInputRef.current?.click()}
            paintLayers={paintLayers}
            activePaintLayerId={activePaintLayerId}
            onSelectPaintLayer={setActivePaintLayerId}
            onAddPaintLayer={() => {
              const newId = 'pl_' + Date.now();
              const newL: PaintLayer = {
                id: newId,
                name: `Давхарга ${paintLayers.length + 1}`,
                visible: true,
                locked: false,
                opacity: 1,
                canvas: createPaintCanvas(docW, docH),
              };
              setPaintLayers((prev) => [...prev, newL]);
              setActivePaintLayerId(newId);
            }}
            onUpdatePaintLayer={(id, patch) => {
              setPaintLayers((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
              setRenderVersion((v) => v + 1);
            }}
            onMovePaintLayer={(id, dir) => {
              setPaintLayers((prev) => {
                const idx = prev.findIndex((l) => l.id === id);
                const nextIdx = idx + dir;
                if (idx < 0 || nextIdx < 0 || nextIdx >= prev.length) return prev;
                const cp = [...prev];
                [cp[idx], cp[nextIdx]] = [cp[nextIdx], cp[idx]];
                return cp;
              });
              setRenderVersion((v) => v + 1);
            }}
            onDeletePaintLayer={(id) => {
              if (paintLayers.length <= 1) return;
              const remaining = paintLayers.filter((l) => l.id !== id);
              setPaintLayers(remaining);
              if (activePaintLayerId === id) setActivePaintLayerId(remaining[0].id);
              setRenderVersion((v) => v + 1);
            }}
            brush={brush}
            onUpdateBrush={(patch) => setBrush((b) => ({ ...b, ...patch }))}
            recentColors={recentColors}
            onCommitRecentColor={(hex) => {
              setRecentColors((prev) => {
                const next = [hex, ...prev.filter((c) => c.toLowerCase() !== hex.toLowerCase())].slice(0, 12);
                safeLocalSet('pf_recent_colors_v2', next);
                return next;
              });
            }}
            clean={clean}
            onUpdateClean={(patch) => setClean((c) => ({ ...c, ...patch }))}
            onAutoCleanAll={handleAutoCleanAllBubbles}
            onAiClean={() => handleAiCleanRegions('view', aiCleanFilter)}
            aiCleanBusy={aiCleanBusy}
            onPasteScript={async () => {
              try {
                const clip = await navigator.clipboard.readText();
                if (clip) {
                  setScriptInput(clip);
                  setScriptUsed(new Set());
                  setScriptNext(0);
                  handleSelectTool('text');
                  showToast('Орчуулга буулгахад бэлэн');
                }
              } catch {
                showToast('Текст хэсэгт Ctrl+V дарж наана уу');
              }
            }}
            onClearScript={() => {
              setScriptInput('');
              setScriptUsed(new Set());
              setScriptNext(-1);
            }}
            onCloseMobileSheet={() => setMobileInspectorOpen(false)}
            rawPages={rawPages}
            stitchWidthMode={stitchWidthMode}
            onChangeStitchWidthMode={(mode) => {
              setStitchWidthMode(mode);
              rebuildStitchCanvas(rawPages, mode);
            }}
            onMoveRawPage={(idx, dir) => {
              const target = idx + dir;
              if (target < 0 || target >= rawPages.length) return;
              const cp = [...rawPages];
              [cp[idx], cp[target]] = [cp[target], cp[idx]];
              rebuildStitchCanvas(cp, stitchWidthMode);
            }}
            onRemoveRawPage={(idx) => {
              const item = rawPages[idx];
              if (item?.url) URL.revokeObjectURL(item.url);
              const next = rawPages.filter((_, i) => i !== idx);
              if (next.length) rebuildStitchCanvas(next, stitchWidthMode);
              else setRawPages([]);
            }}
            onJumpToPageY={(y) => {
              workspaceRef.current?.scrollTo({ top: Math.max(0, y * zoom - 16), behavior: 'smooth' });
            }}
            onAddCustomSplitAtCurrent={() => {
              const ws = workspaceRef.current;
              if (!ws) return;
              const curY = Math.round((ws.scrollTop + ws.clientHeight * 0.4) / zoom);
              if (curY > 40 && curY < docH - 40) {
                setCustomSplitYs((prev) => [...prev, curY].sort((a, b) => a - b));
                showToast(`Хуудасны зааг нэмэгдлээ (Y: ${curY}px)`);
              }
            }}
            onTriggerImageUpload={() => {
              setPendingProjectName(null);
              imageInputRef.current?.click();
            }}
            projects={projects}
            currentProjectId={projectId}
            snapshots={snapshots}
            onOpenProject={async (id) => {
              const rec = await StudioDB.getProject(id);
              if (rec) {
                await loadProjectDataIntoWorkspace(rec.id, rec.name, rec);
                showToast(`«${rec.name}» нээгдлээ`);
              }
            }}
            onDuplicateProject={async (id) => {
              const rec = await StudioDB.getProject(id);
              if (!rec) return;
              const dup: ProjectRecord = {
                ...rec,
                id: 'proj_' + Date.now(),
                name: `${rec.name} (Хуулбар)`,
                updatedAt: Date.now(),
              };
              await StudioDB.putProject(dup);
              setProjects(await StudioDB.listProjects());
              showToast('Төслийг хууллаа');
            }}
            onRenameProjectById={async (id, name) => {
              const rec = await StudioDB.getProject(id);
              if (!rec) return;
              await StudioDB.putProject({ ...rec, name, updatedAt: Date.now() });
              if (id === projectId) setProjectName(name);
              setProjects(await StudioDB.listProjects());
            }}
            onDeleteProject={async (id) => {
              await StudioDB.deleteProject(id);
              if (id === projectId) setProjectId(null);
              setProjects(await StudioDB.listProjects());
            }}
            onCreateSnapshot={() => saveProjectToDB(true, `Хувилбар ${snapshots.length + 1}`)}
            onRevertSnapshot={async (snap) => {
              await loadProjectDataIntoWorkspace(snap.projectId, projectName, snap.data);
              showToast(`«${snap.label}» хувилбар руу буцаалаа`);
            }}
            onDeleteSnapshot={async (id) => {
              await StudioDB.deleteSnapshot(id);
              if (projectId) setSnapshots(await StudioDB.listSnapshots(projectId));
            }}
          />
          </div>
        )}
      </div>

      {/* Modals */}
      <NewProjectModal
        open={newProjectOpen}
        onClose={() => setNewProjectOpen(false)}
        onCreateBlank={(name, w, h, bg) => {
          const base = document.createElement('canvas');
          base.width = w;
          base.height = h;
          const ctx = base.getContext('2d')!;
          ctx.fillStyle = bg;
          ctx.fillRect(0, 0, w, h);
          baseCanvasRef.current = base;

          setProjectId(null);
          setProjectName(name);
          setIsSample(false);
          setDocW(w);
          setDocH(h);
          setBgColor(bg);
          setRawPages([]);
          setCustomSplitYs([]);
          setTexts([]);
          setLogos([]);
          setSelection(null);
          setHistoryEntries([]);
          setHistoryIndex(-1);
          setPaintLayers([
            {
              id: 'pl_main',
              name: 'Цэвэрлэх давхарга 1',
              visible: true,
              locked: false,
              opacity: 1,
              canvas: createPaintCanvas(w, h),
            },
          ]);
          setActivePaintLayerId('pl_main');
          setNewProjectOpen(false);
          setRenderVersion((v) => v + 1);
          setTimeout(() => fitWidth(w), 50);
          showToast(`«${name}» шинэ төсөл үүслээ`);
        }}
        onCreateFromImages={(name) => {
          setPendingProjectName(name);
          setNewProjectOpen(false);
          imageInputRef.current?.click();
        }}
      />

      <ExportModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        defaultFilename={projectName.replace(/[\\/:*?"<>|]/g, '_')}
        hasPages={rawPages.length > 1 || customSplitYs.length > 0}
        folderSupported={typeof (window as unknown as { showDirectoryPicker?: unknown }).showDirectoryPicker === 'function'}
        folderName={exportDirHandle?.name || null}
        onPickFolder={async () => {
          try {
            const picker = (window as unknown as { showDirectoryPicker: (o: unknown) => Promise<FileSystemDirectoryHandle> }).showDirectoryPicker;
            const handle = await picker({ id: 'panelflow-export', mode: 'readwrite' });
            setExportDirHandle(handle);
            await StudioDB.setSetting('exportDirHandle', handle);
          } catch {
            // user cancelled
          }
        }}
        onRunExport={async (cfg: ExportConfig) => {
          const base = baseCanvasRef.current;
          if (!base) return;
          const { files } = await buildExportOutputs(
            cfg,
            docW,
            docH,
            base,
            paintLayers,
            texts,
            logos,
            rawPages,
            customSplitYs
          );

          if (cfg.dest === 'folder' && exportDirHandle) {
            let dir = exportDirHandle;
            if (cfg.subfolder.trim()) {
              dir = await dir.getDirectoryHandle(cfg.subfolder.trim(), { create: true });
            }
            for (const f of files) {
              const fh = await dir.getFileHandle(f.name, { create: true });
              const w = await fh.createWritable();
              await w.write(f.blob);
              await w.close();
            }
            setExportOpen(false);
            showToast(`${files.length} файл хавтас руу хадгалагдлаа`);
            return;
          }

          files.forEach((f, idx) => {
            window.setTimeout(() => {
              const u = URL.createObjectURL(f.blob);
              const a = document.createElement('a');
              a.download = f.name;
              a.href = u;
              a.click();
              window.setTimeout(() => URL.revokeObjectURL(u), 8000);
            }, idx * 250);
          });
          setExportOpen(false);
          showToast(`${files.length} файл экспорт хийгдлээ`);
        }}
      />

      <ShortcutsModal open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />

      <OfflineIndicator />

      {/* Quiet Feedback Toast */}
      {toast && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 text-xs font-medium shadow-xl pointer-events-none">
          {toast}
        </div>
      )}
    </div>
  );
}
