import React from 'react';
import {
  Eraser,
  Hand,
  Image as ImageIcon,
  MousePointer2,
  Paintbrush,
  Pipette,
  Sparkles,
  Stamp,
  Type,
} from 'lucide-react';
import { ToolId } from '../types/editor';

interface ToolbarProps {
  activeTool: ToolId;
  onSelectTool: (tool: ToolId) => void;
  side: 'left' | 'right';
  onToggleQuickText: () => void;
  onAddLogo: () => void;
}

const TOOLS: { id: ToolId; label: string; key: string; icon: React.FC<{ className?: string }> }[] = [
  { id: 'select', label: 'Сонгох', key: 'V', icon: MousePointer2 },
  { id: 'text', label: 'Текст', key: 'T', icon: Type },
  { id: 'logo', label: 'Лого', key: 'L', icon: ImageIcon },
  { id: 'bubble', label: 'Цэвэрлэх', key: 'C', icon: Sparkles },
  { id: 'brush', label: 'Бийр', key: 'B', icon: Paintbrush },
  { id: 'clone', label: 'Хуулах', key: 'S', icon: Stamp },
  { id: 'eraser', label: 'Баллуур', key: 'E', icon: Eraser },
  { id: 'eyedrop', label: 'Өнгө', key: 'I', icon: Pipette },
  { id: 'hand', label: 'Гүйлгэх', key: 'H', icon: Hand },
];

export const Toolbar: React.FC<ToolbarProps> = ({
  activeTool,
  onSelectTool,
  side,
  onToggleQuickText,
  onAddLogo,
}) => {
  const showTextStrip = activeTool === 'text';

  return (
    <div
      className={`relative flex shrink-0 z-20 ${
        side === 'right' ? 'flex-row-reverse border-l' : 'flex-row border-r'
      } border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#111715]`}
    >
      {/* Unified Tool Rail */}
      <aside className="w-14 py-2 px-1.5 flex flex-col items-center gap-1 overflow-y-auto">
        {TOOLS.map((tool, idx) => {
          const Icon = tool.icon;
          const isActive = activeTool === tool.id;
          return (
            <React.Fragment key={tool.id}>
              {(idx === 3 || idx === 8) && (
                <div className="w-7 h-px bg-neutral-200 dark:bg-neutral-800 my-0.5 shrink-0" />
              )}
              <button
                type="button"
                onClick={() => onSelectTool(tool.id)}
                title={`${tool.label} (${tool.key})`}
                className={`relative w-11 h-11 rounded-lg flex flex-col items-center justify-center gap-0.5 transition-colors shrink-0 ${
                  isActive
                    ? 'bg-emerald-600 text-white font-semibold'
                    : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800/80 hover:text-neutral-900 dark:hover:text-neutral-100'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="text-[9.5px] leading-none whitespace-nowrap">{tool.label}</span>
                <span
                  className={`absolute top-1 right-1 text-[8px] font-mono-num leading-none ${
                    isActive ? 'text-emerald-100' : 'text-neutral-400 dark:text-neutral-500'
                  }`}
                >
                  {tool.key}
                </span>
              </button>
            </React.Fragment>
          );
        })}
      </aside>

      {/* Contextual Text Quick Strip */}
      {showTextStrip && (
        <div
          className={`hidden md:flex flex-col justify-start gap-2.5 w-14 py-2.5 px-1.5 border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-[#0e1412] ${
            side === 'right' ? 'border-r' : 'border-l'
          }`}
        >
          <button
            type="button"
            onClick={onToggleQuickText}
            className="w-10 mx-auto py-2 rounded-md border border-neutral-300 dark:border-neutral-700 text-[9.5px] font-medium text-neutral-700 dark:text-neutral-200 hover:border-emerald-500"
            title="Текст бичих хөвөгч цонх"
          >
            Цонх
          </button>
          <button
            type="button"
            onClick={onAddLogo}
            className="w-10 mx-auto py-2 rounded-md border border-neutral-300 dark:border-neutral-700 text-[9.5px] font-medium text-neutral-700 dark:text-neutral-200 hover:border-emerald-500"
            title="Лого оруулах"
          >
            Лого
          </button>
        </div>
      )}
    </div>
  );
};
