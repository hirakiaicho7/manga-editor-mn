import React, { useState } from 'react';
import { Download, FolderOpen, X } from 'lucide-react';
import { ExportConfig } from '../utils/exportEngine';

interface NewProjectModalProps {
  open: boolean;
  onClose: () => void;
  onCreateBlank: (name: string, w: number, h: number, bg: string) => void;
  onCreateFromImages: (name: string) => void;
}

export const NewProjectModal: React.FC<NewProjectModalProps> = ({
  open,
  onClose,
  onCreateBlank,
  onCreateFromImages,
}) => {
  const [name, setName] = useState('buleg_01');
  const [preset, setPreset] = useState('800x1280');
  const [width, setWidth] = useState(800);
  const [height, setHeight] = useState(1280);
  const [bg, setBg] = useState('#ffffff');

  if (!open) return null;

  const onPresetChange = (val: string) => {
    setPreset(val);
    if (val === 'custom') return;
    const [w, h] = val.split('x').map(Number);
    setWidth(w);
    setHeight(h);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#131b18] shadow-2xl p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Шинэ төсөл үүсгэх</h2>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center justify-center text-neutral-500"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <label className="flex flex-col gap-1 text-xs text-neutral-600 dark:text-neutral-300">
          <span>Төслийн нэр</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-9 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 px-3 text-sm text-neutral-900 dark:text-neutral-100"
          />
        </label>

        <label className="flex flex-col gap-1 text-xs text-neutral-600 dark:text-neutral-300">
          <span>Хэмжээний загвар</span>
          <select
            value={preset}
            onChange={(e) => onPresetChange(e.target.value)}
            className="h-9 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 px-3 text-xs text-neutral-900 dark:text-neutral-100"
          >
            <option value="800x1280">Вебтүүн стандарт (800 × 1280 px)</option>
            <option value="1000x1414">Манга хуудас B5 (1000 × 1414 px)</option>
            <option value="1200x1800">Өндөр чанар HD (1200 × 1800 px)</option>
            <option value="1080x1080">Дөрвөлжин (1080 × 1080 px)</option>
            <option value="custom">Өөрөө тохируулах</option>
          </select>
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-xs text-neutral-600 dark:text-neutral-300">
            <span>Өргөн (px)</span>
            <input
              type="number"
              min={100}
              max={6000}
              value={width}
              onChange={(e) => {
                setWidth(Number(e.target.value) || 800);
                setPreset('custom');
              }}
              className="h-9 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 px-3 text-xs font-mono-num text-neutral-900 dark:text-neutral-100"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-neutral-600 dark:text-neutral-300">
            <span>Өндөр (px)</span>
            <input
              type="number"
              min={100}
              max={12000}
              value={height}
              onChange={(e) => {
                setHeight(Number(e.target.value) || 1280);
                setPreset('custom');
              }}
              className="h-9 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 px-3 text-xs font-mono-num text-neutral-900 dark:text-neutral-100"
            />
          </label>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs text-neutral-600 dark:text-neutral-300">Дэвсгэр өнгө</span>
          <div className="flex items-center gap-2">
            {['#ffffff', '#f4f5f7', '#111827'].map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setBg(c)}
                className={`w-6 h-6 rounded-full border ${
                  bg === c ? 'border-emerald-500 ring-2 ring-emerald-500/40' : 'border-neutral-300 dark:border-neutral-700'
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
            <input
              type="color"
              value={bg}
              onChange={(e) => setBg(e.target.value)}
              className="w-8 h-7 rounded border border-neutral-300 dark:border-neutral-700 cursor-pointer"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-2">
          <button
            type="button"
            onClick={() => onCreateBlank(name.trim() || 'Шинэ төсөл', width, height, bg)}
            className="h-9 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold"
          >
            Хоосон хуудас үүсгэх
          </button>
          <button
            type="button"
            onClick={() => onCreateFromImages(name.trim() || 'Шинэ төсөл')}
            className="h-9 rounded-lg border border-neutral-300 dark:border-neutral-700 hover:border-emerald-500 text-xs font-semibold text-neutral-800 dark:text-neutral-200"
          >
            Зургаар эхлүүлэх
          </button>
        </div>
      </div>
    </div>
  );
};

interface ExportModalProps {
  open: boolean;
  onClose: () => void;
  defaultFilename: string;
  hasPages: boolean;
  folderSupported: boolean;
  folderName: string | null;
  onPickFolder: () => void;
  onRunExport: (cfg: ExportConfig) => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  open,
  onClose,
  defaultFilename,
  hasPages,
  folderSupported,
  folderName,
  onPickFolder,
  onRunExport,
}) => {
  const [filename, setFilename] = useState(defaultFilename);
  const [format, setFormat] = useState<'png' | 'jpeg' | 'pdf'>('png');
  const [scalePct, setScalePct] = useState(100);
  const [quality, setQuality] = useState(94);
  const [sliceMode, setSliceMode] = useState<'none' | 'pages' | 'height'>(hasPages ? 'pages' : 'none');
  const [sliceHeight, setSliceHeight] = useState(1600);
  const [dest, setDest] = useState<'download' | 'folder'>('download');
  const [subfolder, setSubfolder] = useState('');

  React.useEffect(() => {
    if (open) {
      setFilename(defaultFilename);
      setSliceMode((cur) => (hasPages && cur === 'none' ? 'pages' : !hasPages && cur === 'pages' ? 'none' : cur));
    }
  }, [open, defaultFilename, hasPages]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#131b18] shadow-2xl p-5 flex flex-col gap-3.5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Экспорт хийх (PNG / JPG / PDF)</h2>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center justify-center text-neutral-500"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <label className="flex flex-col gap-1 text-xs text-neutral-600 dark:text-neutral-300">
          <span>Файлын нэр</span>
          <input
            type="text"
            value={filename}
            onChange={(e) => setFilename(e.target.value)}
            className="h-9 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 px-3 text-sm text-neutral-900 dark:text-neutral-100"
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-xs text-neutral-600 dark:text-neutral-300">
            <span>Формат</span>
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value as ExportConfig['format'])}
              className="h-9 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 px-2.5 text-xs text-neutral-900 dark:text-neutral-100"
            >
              <option value="png">PNG (Чанар алдахгүй)</option>
              <option value="jpeg">JPG (Бага хэмжээтэй)</option>
              <option value="pdf">PDF (Олон хуудастай баримт)</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-neutral-600 dark:text-neutral-300">
            <span>Хэмжээ (Scale)</span>
            <select
              value={scalePct}
              onChange={(e) => setScalePct(Number(e.target.value))}
              className="h-9 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 px-2.5 text-xs text-neutral-900 dark:text-neutral-100"
            >
              <option value={100}>100% (Эх хэмжээ)</option>
              <option value={85}>85%</option>
              <option value={75}>75%</option>
              <option value={50}>50%</option>
            </select>
          </label>
        </div>

        {(format === 'jpeg' || format === 'pdf') && (
          <label className="flex flex-col gap-1 text-xs text-neutral-600 dark:text-neutral-300">
            <span className="flex justify-between">
              <span>Шахалтын чанар</span>
              <span className="font-mono-num">{quality}%</span>
            </span>
            <input
              type="range"
              min={50}
              max={100}
              value={quality}
              onChange={(e) => setQuality(Number(e.target.value))}
              className="accent-emerald-600"
            />
          </label>
        )}

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-xs text-neutral-600 dark:text-neutral-300">
            <span>Хувааж экспортлох</span>
            <select
              value={sliceMode}
              onChange={(e) => setSliceMode(e.target.value as ExportConfig['sliceMode'])}
              className="h-9 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 px-2.5 text-xs text-neutral-900 dark:text-neutral-100"
            >
              <option value="none">Хуваахгүй (Бүтэн)</option>
              <option value="pages">Хуудасны заагаар</option>
              <option value="height">Тогтмол өндрөөр</option>
            </select>
          </label>
          {sliceMode === 'height' && (
            <label className="flex flex-col gap-1 text-xs text-neutral-600 dark:text-neutral-300">
              <span>Өндөр (px)</span>
              <select
                value={sliceHeight}
                onChange={(e) => setSliceHeight(Number(e.target.value))}
                className="h-9 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 px-2.5 text-xs font-mono-num text-neutral-900 dark:text-neutral-100"
              >
                <option value={1600}>1600px</option>
                <option value={2500}>2500px</option>
                <option value={4000}>4000px</option>
              </select>
            </label>
          )}
        </div>

        {/* Destination */}
        <div className="p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 flex flex-col gap-2">
          <span className="text-[11px] font-medium text-neutral-500">Хадгалах байршил</span>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => setDest('download')}
              className={`h-8 rounded-md text-xs font-medium flex items-center justify-center gap-1.5 border ${
                dest === 'download'
                  ? 'border-emerald-500 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                  : 'border-neutral-300 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300'
              }`}
            >
              <Download className="w-3.5 h-3.5" />
              Татаж авах
            </button>
            <button
              type="button"
              disabled={!folderSupported}
              onClick={() => setDest('folder')}
              className={`h-8 rounded-md text-xs font-medium flex items-center justify-center gap-1.5 border disabled:opacity-40 ${
                dest === 'folder'
                  ? 'border-emerald-500 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                  : 'border-neutral-300 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300'
              }`}
            >
              <FolderOpen className="w-3.5 h-3.5" />
              Хавтас руу шууд
            </button>
          </div>

          {dest === 'folder' && (
            <div className="flex flex-col gap-2 pt-1">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onPickFolder}
                  className="h-7 px-2.5 rounded bg-neutral-200 dark:bg-neutral-800 text-xs font-medium text-neutral-800 dark:text-neutral-200"
                >
                  Хавтас сонгох
                </button>
                <span className="text-xs text-neutral-500 truncate">{folderName || 'Сонгоогүй'}</span>
              </div>
              <input
                type="text"
                value={subfolder}
                onChange={(e) => setSubfolder(e.target.value)}
                placeholder="Дэд хавтасны нэр (заавал биш)"
                className="h-8 rounded border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 px-2.5 text-xs text-neutral-900 dark:text-neutral-100"
              />
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() =>
            onRunExport({
              filename,
              format,
              scalePct,
              quality,
              sliceMode,
              sliceHeight,
              dest,
              subfolder,
            })
          }
          className="h-10 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center justify-center gap-2"
        >
          <Download className="w-4 h-4" />
          Экспорт эхлүүлэх
        </button>
      </div>
    </div>
  );
};

interface ShortcutsModalProps {
  open: boolean;
  onClose: () => void;
}

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({ open, onClose }) => {
  if (!open) return null;
  const rows: [string, string][] = [
    ['V / T / L', 'Сонгох / Текст / Лого'],
    ['C / B / E / S / I / H', 'Цэвэрлэх / Бийр / Баллуур / Clone / Өнгө / Гар'],
    ['Ctrl + Click / Shift + Click', 'Олон текст зэрэг сонгох'],
    ['Ctrl + A', 'Бүх текстийг зэрэг сонгох'],
    ['Ctrl + Z / Ctrl + Y', 'Буцаах / Дахих'],
    ['Ctrl + S', 'Төсөл болон хувилбар хадгалах'],
    ['Ctrl + D / Delete', 'Сонгосон объектыг хувилах / устгах'],
    ['Ctrl + B / I / U', 'Тод / Налуу / Доогуур зураас'],
    ['[ / ]', 'Бийрний хэмжээг багасгах / томруулах'],
    ['Space + Чирэх', 'Дэлгэцийг чөлөөтэй гүйлгэх'],
    ['Alt + Click (Clone)', 'Хуулах эх цэгийг авах'],
    ['PageUp / PageDown', 'Хуудсуудын хооронд үсрэх'],
  ];

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#131b18] shadow-2xl p-5 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            Гарын товчлол ба Ажлын зарчим
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center justify-center text-neutral-500"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed">
          Бүх цэвэрлэгээ ба зураас нь <b>Non-destructive давхарга</b> дээр хадгалагддаг тул эх зураг хэзээ ч устахгүй. Баллуураар арчихад эх зураг сэргэнэ.
        </div>

        <div className="divide-y divide-neutral-200 dark:divide-neutral-800 border border-neutral-200 dark:border-neutral-800 rounded-lg overflow-hidden">
          {rows.map(([keys, desc]) => (
            <div key={keys} className="flex items-center justify-between px-3 py-1.5 text-xs">
              <span className="font-mono-num font-semibold text-emerald-700 dark:text-emerald-400">{keys}</span>
              <span className="text-neutral-700 dark:text-neutral-300">{desc}</span>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="h-9 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold"
        >
          Ойлголоо
        </button>
      </div>
    </div>
  );
};
