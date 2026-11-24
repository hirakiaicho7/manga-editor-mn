import React, { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Columns2,
  Download,
  Eye,
  FileDown,
  FolderPlus,
  HelpCircle,
  Maximize2,
  Minimize2,
  Moon,
  Plus,
  Redo2,
  Save,
  Settings2,
  Sun,
  Undo2,
} from 'lucide-react';
import { WorkspaceSettings } from '../types/editor';
import { PWAInstallButton } from './PWAInstall';

interface TopBarProps {
  projectName: string;
  onRenameProject: (name: string) => void;
  lastSavedAt: number | null;
  isSaving: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  currentPage: number;
  totalPages: number;
  onJumpPage: (dir: number) => void;
  zoom: number;
  onZoomChange: (z: number) => void;
  onFitWidth: () => void;
  beforeAfterMode: 'off' | 'split' | 'peek';
  onToggleBeforeAfterSplit: () => void;
  onPeekStart: () => void;
  onPeekEnd: () => void;
  onUploadImages: () => void;
  onSaveProject: () => void;
  onOpenNewProject: () => void;
  onOpenExport: () => void;
  onOpenShortcuts: () => void;
  workspaceSettings: WorkspaceSettings;
  onUpdateWorkspaceSettings: (patch: Partial<WorkspaceSettings>) => void;
  focusMode?: boolean;
  onToggleFocusMode?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  projectName,
  onRenameProject,
  lastSavedAt,
  isSaving,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  currentPage,
  totalPages,
  onJumpPage,
  zoom,
  onZoomChange,
  onFitWidth,
  beforeAfterMode,
  onToggleBeforeAfterSplit,
  onPeekStart,
  onPeekEnd,
  onUploadImages,
  onSaveProject,
  onOpenNewProject,
  onOpenExport,
  onOpenShortcuts,
  workspaceSettings,
  onUpdateWorkspaceSettings,
  focusMode = false,
  onToggleFocusMode,
}) => {
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState(projectName);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const commitName = () => {
    setEditingName(false);
    const trimmed = draftName.trim();
    if (trimmed && trimmed !== projectName) onRenameProject(trimmed);
    else setDraftName(projectName);
  };

  const formatSaved = (ts: number | null) => {
    if (isSaving) return 'Хадгалж байна…';
    if (!ts) return 'Авто хадгалалт идэвхтэй';
    const d = new Date(ts);
    return `Хадгалсан · ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  return (
    <header className="h-12 shrink-0 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#111715] px-3 flex items-center justify-between gap-3 relative z-30">
      {/* Left: Brand & Project title */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-7 h-7 rounded-lg bg-emerald-600 dark:bg-emerald-500 flex items-center justify-center text-white dark:text-neutral-950 font-bold text-sm">
            PF
          </div>
          <span className="font-bold text-sm tracking-tight text-neutral-900 dark:text-neutral-100 whitespace-nowrap hidden sm:inline">
            PanelFlow
          </span>
        </div>

        <span className="text-neutral-300 dark:text-neutral-700 hidden sm:inline">/</span>

        {editingName ? (
          <input
            autoFocus
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitName();
              if (e.key === 'Escape') {
                setDraftName(projectName);
                setEditingName(false);
              }
            }}
            className="h-7 px-2 text-xs font-semibold rounded border border-emerald-500 bg-neutral-50 dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 w-36 focus:outline-none"
          />
        ) : (
          <button
            type="button"
            onClick={() => {
              setDraftName(projectName);
              setEditingName(true);
            }}
            title="Төслийн нэр засах"
            className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 hover:text-emerald-600 dark:hover:text-emerald-400 truncate max-w-[140px] whitespace-nowrap"
          >
            {projectName}
          </button>
        )}

        <span className="text-[11px] text-neutral-500 dark:text-neutral-400 font-mono-num hidden lg:inline whitespace-nowrap">
          {formatSaved(lastSavedAt)}
        </span>
      </div>

      {/* Center: Compact Canvas Controls (Undo/Redo · Pages · Zoom · Before/After) */}
      <div className="flex items-center gap-1.5 overflow-x-auto">
        <div className="flex items-center border border-neutral-200 dark:border-neutral-800 rounded-lg bg-neutral-50 dark:bg-neutral-900/70 p-0.5">
          <button
            type="button"
            onClick={onUndo}
            disabled={!canUndo}
            title="Буцаах (Ctrl+Z)"
            className="h-7 w-7 flex items-center justify-center rounded-md text-neutral-700 dark:text-neutral-200 hover:bg-neutral-200/70 dark:hover:bg-neutral-800 disabled:opacity-30"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onRedo}
            disabled={!canRedo}
            title="Дахих (Ctrl+Y)"
            className="h-7 w-7 flex items-center justify-center rounded-md text-neutral-700 dark:text-neutral-200 hover:bg-neutral-200/70 dark:hover:bg-neutral-800 disabled:opacity-30"
          >
            <Redo2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Page Jump */}
        <div className="hidden md:flex items-center border border-neutral-200 dark:border-neutral-800 rounded-lg bg-neutral-50 dark:bg-neutral-900/70 p-0.5">
          <button
            type="button"
            onClick={() => onJumpPage(-1)}
            title="Өмнөх хуудас (PageUp)"
            className="h-7 w-6 flex items-center justify-center rounded-md text-neutral-700 dark:text-neutral-200 hover:bg-neutral-200/70 dark:hover:bg-neutral-800"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <span className="px-2 text-xs font-mono-num text-neutral-700 dark:text-neutral-200 whitespace-nowrap">
            {currentPage}/{totalPages}
          </span>
          <button
            type="button"
            onClick={() => onJumpPage(1)}
            title="Дараагийн хуудас (PageDown)"
            className="h-7 w-6 flex items-center justify-center rounded-md text-neutral-700 dark:text-neutral-200 hover:bg-neutral-200/70 dark:hover:bg-neutral-800"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Zoom */}
        <div className="hidden sm:flex items-center border border-neutral-200 dark:border-neutral-800 rounded-lg bg-neutral-50 dark:bg-neutral-900/70 p-0.5">
          <button
            type="button"
            onClick={() => onZoomChange(zoom - 0.15)}
            className="h-7 w-6 flex items-center justify-center rounded-md text-xs font-semibold text-neutral-700 dark:text-neutral-200 hover:bg-neutral-200/70 dark:hover:bg-neutral-800"
            title="Жижигрүүлэх (-)"
          >
            −
          </button>
          <button
            type="button"
            onClick={onFitWidth}
            title="Дэлгэцэнд тааруулах (0)"
            className="px-2 h-7 text-xs font-mono-num font-semibold text-emerald-700 dark:text-emerald-400 hover:bg-neutral-200/70 dark:hover:bg-neutral-800 rounded-md whitespace-nowrap"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            type="button"
            onClick={() => onZoomChange(zoom + 0.15)}
            className="h-7 w-6 flex items-center justify-center rounded-md text-xs font-semibold text-neutral-700 dark:text-neutral-200 hover:bg-neutral-200/70 dark:hover:bg-neutral-800"
            title="Томруулах (+)"
          >
            +
          </button>
        </div>

        {/* Before / After */}
        <div className="flex items-center border border-neutral-200 dark:border-neutral-800 rounded-lg bg-neutral-50 dark:bg-neutral-900/70 p-0.5">
          <button
            type="button"
            onPointerDown={onPeekStart}
            onPointerUp={onPeekEnd}
            onPointerLeave={onPeekEnd}
            onPointerCancel={onPeekEnd}
            title="Дарж байхдаа эх зургийг харах"
            className={`h-7 px-2 flex items-center gap-1 rounded-md text-xs font-medium whitespace-nowrap ${
              beforeAfterMode === 'peek'
                ? 'bg-emerald-600 text-white'
                : 'text-neutral-700 dark:text-neutral-200 hover:bg-neutral-200/70 dark:hover:bg-neutral-800'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">Эх</span>
          </button>
          <button
            type="button"
            onClick={onToggleBeforeAfterSplit}
            title="Before / After харьцуулах шугам"
            className={`h-7 px-2 flex items-center gap-1 rounded-md text-xs font-medium whitespace-nowrap ${
              beforeAfterMode === 'split'
                ? 'bg-emerald-600 text-white'
                : 'text-neutral-700 dark:text-neutral-200 hover:bg-neutral-200/70 dark:hover:bg-neutral-800'
            }`}
          >
            <Columns2 className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">Before/After</span>
          </button>
        </div>
      </div>

      {/* Right: Primary Studio Actions */}
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          onClick={onOpenNewProject}
          title="Шинэ төсөл"
          className="h-8 px-2.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 hover:border-emerald-500 text-xs font-medium text-neutral-700 dark:text-neutral-200 flex items-center gap-1.5 whitespace-nowrap shrink-0"
        >
          <FolderPlus className="w-3.5 h-3.5" />
          <span className="hidden xl:inline">Шинэ</span>
        </button>

        <button
          type="button"
          onClick={onUploadImages}
          title="Хуудас зураг нэмэх"
          className="h-8 px-2.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 hover:border-emerald-500 text-xs font-medium text-neutral-700 dark:text-neutral-200 flex items-center gap-1.5 whitespace-nowrap shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="hidden md:inline">Зураг</span>
        </button>

        <button
          type="button"
          onClick={onSaveProject}
          title="Хадгалах ба хувилбар үүсгэх (Ctrl+S)"
          className="h-8 px-2.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 hover:border-emerald-500 text-xs font-medium text-neutral-700 dark:text-neutral-200 flex items-center gap-1.5 whitespace-nowrap shrink-0"
        >
          <Save className="w-3.5 h-3.5" />
          <span className="hidden xl:inline">Хадгалах</span>
        </button>

        <button
          type="button"
          onClick={onOpenExport}
          className="h-8 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Экспорт</span>
        </button>

        {typeof window !== 'undefined' && window.location.protocol !== 'file:' && (
          <a
            href="/PanelFlow-Studio.html"
            download="PanelFlow-Studio.html"
            title="Офлайн ганц HTML файлаар татах"
            className="h-8 px-2.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs font-semibold flex items-center gap-1 whitespace-nowrap shrink-0 transition-colors"
          >
            <FileDown className="w-3.5 h-3.5" />
            <span>HTML</span>
          </a>
        )}

        <PWAInstallButton />

        {/* Workspace Settings Popover */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setSettingsOpen((v) => !v)}
            title="Ажлын орчны тохиргоо"
            className="h-8 w-8 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 hover:border-emerald-500 text-neutral-700 dark:text-neutral-200 flex items-center justify-center shrink-0"
          >
            <Settings2 className="w-3.5 h-3.5" />
          </button>

          {settingsOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setSettingsOpen(false)} />
              <div className="absolute right-0 mt-2 w-64 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#141c19] shadow-xl p-3 z-50 flex flex-col gap-3">
                <div className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                  Ажлын орчны тохиргоо
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-neutral-600 dark:text-neutral-300">Дэлгэцийн горим</span>
                  <div className="flex items-center gap-1 p-0.5 rounded-lg bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
                    <button
                      type="button"
                      onClick={() => onUpdateWorkspaceSettings({ theme: 'light' })}
                      className={`px-2 py-1 rounded-md flex items-center gap-1 text-xs ${
                        workspaceSettings.theme === 'light'
                          ? 'bg-white text-neutral-900 shadow-sm font-medium'
                          : 'text-neutral-500'
                      }`}
                    >
                      <Sun className="w-3 h-3" />
                      Light
                    </button>
                    <button
                      type="button"
                      onClick={() => onUpdateWorkspaceSettings({ theme: 'dark' })}
                      className={`px-2 py-1 rounded-md flex items-center gap-1 text-xs ${
                        workspaceSettings.theme === 'dark'
                          ? 'bg-neutral-800 text-white shadow-sm font-medium'
                          : 'text-neutral-500'
                      }`}
                    >
                      <Moon className="w-3 h-3" />
                      Dark
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-neutral-600 dark:text-neutral-300">Хэрэгслийн байрлал</span>
                  <div className="flex items-center gap-1 p-0.5 rounded-lg bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
                    <button
                      type="button"
                      onClick={() => onUpdateWorkspaceSettings({ toolbarSide: 'left' })}
                      className={`px-2 py-1 rounded-md text-xs ${
                        workspaceSettings.toolbarSide === 'left'
                          ? 'bg-emerald-600 text-white font-medium'
                          : 'text-neutral-500'
                      }`}
                    >
                      Зүүн
                    </button>
                    <button
                      type="button"
                      onClick={() => onUpdateWorkspaceSettings({ toolbarSide: 'right' })}
                      className={`px-2 py-1 rounded-md text-xs ${
                        workspaceSettings.toolbarSide === 'right'
                          ? 'bg-emerald-600 text-white font-medium'
                          : 'text-neutral-500'
                      }`}
                    >
                      Баруун
                    </button>
                  </div>
                </div>

                <label className="flex items-center justify-between text-xs cursor-pointer">
                  <span className="text-neutral-600 dark:text-neutral-300">Smart Alignment чиглүүлэгч</span>
                  <input
                    type="checkbox"
                    checked={workspaceSettings.showGridSnap}
                    onChange={(e) => onUpdateWorkspaceSettings({ showGridSnap: e.target.checked })}
                    className="accent-emerald-600"
                  />
                </label>

                <label className="flex items-center justify-between text-xs cursor-pointer">
                  <span className="text-neutral-600 dark:text-neutral-300">Хуудасны зааг шугам</span>
                  <input
                    type="checkbox"
                    checked={workspaceSettings.showPageMarkers}
                    onChange={(e) => onUpdateWorkspaceSettings({ showPageMarkers: e.target.checked })}
                    className="accent-emerald-600"
                  />
                </label>

                <label className="flex items-center justify-between text-xs cursor-pointer">
                  <span className="text-neutral-600 dark:text-neutral-300">Авто бөмбөлөг таних</span>
                  <input
                    type="checkbox"
                    checked={workspaceSettings.autoBubbleDetect}
                    onChange={(e) => onUpdateWorkspaceSettings({ autoBubbleDetect: e.target.checked })}
                    className="accent-emerald-600"
                  />
                </label>
              </div>
            </>
          )}
        </div>

        {onToggleFocusMode && (
          <button
            type="button"
            onClick={onToggleFocusMode}
            title="Төвлөрөх горим (F)"
            className={`h-8 w-8 rounded-lg border flex items-center justify-center shrink-0 transition-colors ${
              focusMode
                ? 'border-emerald-500 bg-emerald-600 text-white'
                : 'border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 hover:border-emerald-500 text-neutral-700 dark:text-neutral-200'
            }`}
          >
            {focusMode ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        )}

        <button
          type="button"
          onClick={onOpenShortcuts}
          title="Товчлол ба Заавар (?)"
          className="h-8 w-8 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 hover:border-emerald-500 text-neutral-700 dark:text-neutral-200 flex items-center justify-center shrink-0"
        >
          <HelpCircle className="w-3.5 h-3.5" />
        </button>
      </div>
    </header>
  );
};
