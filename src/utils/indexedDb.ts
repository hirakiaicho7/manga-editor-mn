import {
  GradientPreset,
  ProjectRecord,
  ProjectSnapshot,
  SavedFont,
  SavedLogoAsset,
  TextPreset,
} from '../types/editor';

const DB_NAME = 'panelflow_studio_v2';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    try {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('IndexedDB unavailable'));
        return;
      }
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('projects')) {
          db.createObjectStore('projects', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('snapshots')) {
          const snap = db.createObjectStore('snapshots', { keyPath: 'id' });
          snap.createIndex('projectId', 'projectId', { unique: false });
        }
        if (!db.objectStoreNames.contains('fonts')) {
          db.createObjectStore('fonts', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('logos')) {
          db.createObjectStore('logos', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings');
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    } catch (err) {
      reject(err);
    }
  });
  return dbPromise;
}

async function runTx<T>(
  storeName: string,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    const req = fn(store);
    tx.oncomplete = () => resolve(req.result);
    tx.onerror = () => reject(tx.error);
  });
}

export const StudioDB = {
  async listProjects(): Promise<ProjectRecord[]> {
    const list = await runTx<ProjectRecord[]>('projects', 'readonly', (s) => s.getAll());
    return (list || []).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  },
  getProject(id: string): Promise<ProjectRecord | undefined> {
    return runTx('projects', 'readonly', (s) => s.get(id));
  },
  putProject(rec: ProjectRecord): Promise<IDBValidKey> {
    return runTx('projects', 'readwrite', (s) => s.put(rec));
  },
  deleteProject(id: string): Promise<undefined> {
    return runTx('projects', 'readwrite', (s) => s.delete(id));
  },

  async listSnapshots(projectId: string): Promise<ProjectSnapshot[]> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('snapshots', 'readonly');
      const idx = tx.objectStore('snapshots').index('projectId');
      const req = idx.getAll(projectId);
      tx.oncomplete = () => {
        const res = (req.result || []) as ProjectSnapshot[];
        resolve(res.sort((a, b) => b.createdAt - a.createdAt));
      };
      tx.onerror = () => reject(tx.error);
    });
  },
  putSnapshot(snap: ProjectSnapshot): Promise<IDBValidKey> {
    return runTx('snapshots', 'readwrite', (s) => s.put(snap));
  },
  deleteSnapshot(id: string): Promise<undefined> {
    return runTx('snapshots', 'readwrite', (s) => s.delete(id));
  },
  async pruneSnapshots(projectId: string, maxKeep = 10): Promise<void> {
    const all = await this.listSnapshots(projectId);
    const autoOnes = all.filter((s) => s.isAuto);
    if (autoOnes.length > maxKeep) {
      for (const old of autoOnes.slice(maxKeep)) {
        await this.deleteSnapshot(old.id);
      }
    }
  },

  async listFonts(): Promise<SavedFont[]> {
    const list = await runTx<SavedFont[]>('fonts', 'readonly', (s) => s.getAll());
    return (list || []).sort((a, b) => a.added - b.added);
  },
  putFont(rec: SavedFont): Promise<IDBValidKey> {
    return runTx('fonts', 'readwrite', (s) => s.put(rec));
  },
  deleteFont(id: string): Promise<undefined> {
    return runTx('fonts', 'readwrite', (s) => s.delete(id));
  },

  async listLogos(): Promise<SavedLogoAsset[]> {
    const list = await runTx<SavedLogoAsset[]>('logos', 'readonly', (s) => s.getAll());
    return (list || []).sort((a, b) => b.added - a.added);
  },
  putLogo(rec: SavedLogoAsset): Promise<IDBValidKey> {
    return runTx('logos', 'readwrite', (s) => s.put(rec));
  },
  deleteLogo(id: string): Promise<undefined> {
    return runTx('logos', 'readwrite', (s) => s.delete(id));
  },

  getSetting<T>(key: string): Promise<T | undefined> {
    return runTx<T>('settings', 'readonly', (s) => s.get(key));
  },
  setSetting<T>(key: string, val: T): Promise<IDBValidKey> {
    return runTx('settings', 'readwrite', (s) => s.put(val, key));
  },
};

export function safeLocalGet<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function safeLocalSet(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore quota errors
  }
}

export const BUILTIN_FONTS: { label: string; value: string }[] = [
  { label: 'Roboto (Кирилл цэвэр)', value: "'Roboto', sans-serif" },
  { label: 'Montserrat (Орчин үеийн)', value: "'Montserrat', sans-serif" },
  { label: 'Oswald (Нарийн, өндөр)', value: "'Oswald', sans-serif" },
  { label: 'Russo One (Хүчтэй / SFX)', value: "'Russo One', sans-serif" },
  { label: 'Rubik (Бөөрөнхий)', value: "'Rubik', sans-serif" },
  { label: 'Comfortaa (Зөөлөн яриа)', value: "'Comfortaa', sans-serif" },
  { label: 'Caveat (Гар бичмэл / Бодол)', value: "'Caveat', cursive" },
  { label: 'Playfair Display (Тайлбар)', value: "'Playfair Display', serif" },
  { label: 'Plus Jakarta Sans (Цэгцтэй)', value: "'Plus Jakarta Sans', sans-serif" },
];

export const DEFAULT_PRESETS: TextPreset[] = [
  {
    id: 'p_norm',
    name: 'Энгийн яриа',
    builtIn: true,
    style: {
      fontFamily: "'Roboto', sans-serif",
      color: '#111111',
      strokeColor: '#ffffff',
      strokeWidth: 5,
      bold: true,
      italic: false,
      underline: false,
      uppercase: false,
      bgEnabled: false,
      gradEnabled: false,
      glowEnabled: false,
      shadowEnabled: false,
      bend: 0,
      perspX: 0,
      perspY: 0,
      scaleX: 1,
      scaleY: 1,
    },
  },
  {
    id: 'p_shout',
    name: 'Хашхираан SFX',
    builtIn: true,
    style: {
      fontFamily: "'Russo One', sans-serif",
      fontSize: 34,
      color: '#e11d48',
      strokeColor: '#ffffff',
      strokeWidth: 7,
      bold: true,
      italic: false,
      underline: false,
      uppercase: true,
      bgEnabled: false,
      gradEnabled: true,
      grad1: '#ef4444',
      grad2: '#facc15',
      gradAng: 90,
      glowEnabled: false,
      shadowEnabled: true,
      shadowColor: '#000000',
      shadowAngle: 135,
      shadowDistance: 4,
      shadowBlur: 4,
      shadowOpacity: 60,
      bend: 14,
      perspX: 0,
      perspY: 0,
      scaleX: 1,
      scaleY: 1.12,
    },
  },
  {
    id: 'p_glow',
    name: 'Гэрэлтэх текст',
    builtIn: true,
    style: {
      fontFamily: "'Russo One', sans-serif",
      fontSize: 30,
      color: '#ffffff',
      strokeColor: '#052e16',
      strokeWidth: 5,
      bold: true,
      italic: false,
      underline: false,
      uppercase: false,
      bgEnabled: false,
      gradEnabled: true,
      grad1: '#14b866',
      grad2: '#2dd4bf',
      gradAng: 90,
      glowEnabled: true,
      glowColor: '#14b866',
      glowRadius: 16,
      shadowEnabled: false,
      bend: 0,
      perspX: 0,
      perspY: 0,
      scaleX: 1,
      scaleY: 1,
    },
  },
  {
    id: 'p_thought',
    name: 'Бодол / Шивнээ',
    builtIn: true,
    style: {
      fontFamily: "'Caveat', cursive",
      fontSize: 28,
      color: '#334155',
      strokeColor: '#ffffff',
      strokeWidth: 4,
      bold: false,
      italic: true,
      underline: false,
      uppercase: false,
      bgEnabled: false,
      gradEnabled: false,
      glowEnabled: false,
      shadowEnabled: false,
      bend: 0,
      perspX: 0,
      perspY: 0,
      scaleX: 1,
      scaleY: 1,
    },
  },
  {
    id: 'p_box',
    name: 'Хүүрнэл хайрцаг',
    builtIn: true,
    style: {
      fontFamily: "'Playfair Display', serif",
      fontSize: 21,
      color: '#ffffff',
      strokeColor: '#000000',
      strokeWidth: 0,
      bold: false,
      italic: false,
      underline: false,
      uppercase: false,
      bgEnabled: true,
      bgColor: '#18181b',
      gradEnabled: false,
      glowEnabled: false,
      shadowEnabled: false,
      bend: 0,
      perspX: 0,
      perspY: 0,
      scaleX: 1,
      scaleY: 1,
    },
  },
];

export const DEFAULT_GRADIENTS: GradientPreset[] = [
  { id: 'g_emerald', c1: '#14b866', c2: '#2dd4bf', ang: 90 },
  { id: 'g_fire', c1: '#ef4444', c2: '#facc15', ang: 90 },
  { id: 'g_ocean', c1: '#38bdf8', c2: '#6366f1', ang: 90 },
  { id: 'g_sakura', c1: '#f472b6', c2: '#fb7185', ang: 135 },
];
