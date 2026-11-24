export type ToolId =
  | 'select'
  | 'text'
  | 'logo'
  | 'bubble'
  | 'brush'
  | 'clone'
  | 'eraser'
  | 'eyedrop'
  | 'hand';

export type InspectorTab = 'properties' | 'layers' | 'projects';

export type BrushType = 'gpen' | 'airbrush' | 'marker' | 'screentone' | 'blur';

export type CleanMode = 'erase' | 'inpaint' | 'fill';
export type CleanShape = 'brush' | 'box' | 'ellipse' | 'flood';
export type InpaintPolarity = 'auto' | 'dark' | 'light';

export interface PaintLayer {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  opacity: number; // 0..1
  canvas: HTMLCanvasElement;
}

export interface TextLayer {
  id: string;
  name: string;
  text: string;
  x: number;
  y: number;
  boxWidth: number;
  fontFamily: string;
  fontSize: number;
  scaleX: number;
  scaleY: number;
  color: string;
  strokeColor: string;
  strokeWidth: number;
  gradEnabled: boolean;
  grad1: string;
  grad2: string;
  gradAng: number;
  glowEnabled: boolean;
  glowColor: string;
  glowRadius: number;
  shadowEnabled: boolean;
  shadowColor: string;
  shadowAngle: number; // degrees 0..360
  shadowDistance: number; // px
  shadowBlur: number; // px
  shadowOpacity: number; // 0..100
  bold: boolean;
  italic: boolean;
  underline: boolean;
  uppercase: boolean;
  align: 'left' | 'center' | 'right';
  letterSpacing: number;
  lineHeight: number;
  rotation: number;
  bend: number;
  perspX: number;
  perspY: number;
  bgEnabled: boolean;
  bgColor: string;
  visible: boolean;
  locked: boolean;
  opacity: number; // 0..1
  _halfW?: number;
  _halfH?: number;
}

export interface LogoLayer {
  id: string;
  name: string;
  img: HTMLImageElement;
  url: string;
  blob?: Blob;
  assetId?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  flipX: boolean;
  flipY: boolean;
  aboveText: boolean; // false = behind text ("Send to back")
  visible: boolean;
  locked: boolean;
  _halfW?: number;
  _halfH?: number;
}

export interface RawPageItem {
  id: string;
  name: string;
  img: HTMLImageElement;
  url: string;
  blob?: Blob;
  yStart: number;
  height: number;
}

export interface BrushSettings {
  type: BrushType;
  size: number;
  opacity: number; // 1..100
  hardness: number; // 0..100
  spacing: number; // 5..100 (%)
  color: string;
  stabilizer?: number; // 0..10 (ibisPaint X stroke stabilizer)
  taper?: boolean; // natural nib tapering with velocity/pressure
}

export type AiCleanFilter = 'all' | 'bubble' | 'sfx';

export interface AiDetectedRegion {
  box_2d: [number, number, number, number]; // [ymin, xmin, ymax, xmax] 0..1000
  kind: 'bubble_text' | 'sfx_text' | 'caption_text';
  polarity: 'dark' | 'light' | 'auto';
  hasOutline: boolean;
}

export interface SmartCleanSettings {
  mode: CleanMode;
  shape: CleanShape;
  polarity: InpaintPolarity;
  brushSize: number;
  tolerance: number;
  feather: number;
  floodColor?: string;
}

export interface WorkspaceSettings {
  theme: 'dark' | 'light';
  toolbarSide: 'left' | 'right';
  showPageMarkers: boolean;
  showGridSnap: boolean;
  autoBubbleDetect: boolean;
  autoSaveIntervalSec: number;
}

export interface FloatingWindowState {
  open: boolean;
  minimized: boolean;
  expanded: boolean;
  x: number;
  y: number;
}

export interface TextPreset {
  id: string;
  name: string;
  builtIn?: boolean;
  style: Partial<TextLayer>;
}

export interface GradientPreset {
  id: string;
  c1: string;
  c2: string;
  ang: number;
}

export interface SavedFont {
  id: string;
  name: string;
  data: ArrayBuffer;
  added: number;
}

export interface SavedLogoAsset {
  id: string;
  name: string;
  blob: Blob;
  width: number;
  height: number;
  added: number;
}

export interface SerializedPaintLayer {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  opacity: number;
  blob: Blob;
}

export interface SerializedLogoLayer {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  flipX: boolean;
  flipY: boolean;
  aboveText: boolean;
  visible: boolean;
  locked: boolean;
  blob: Blob;
  assetId?: string;
}

export interface SerializedRawPage {
  id: string;
  name: string;
  blob: Blob;
}

export interface ProjectRecord {
  id: string;
  name: string;
  docW: number;
  docH: number;
  bgColor: string;
  updatedAt: number;
  stitchWidthMode: string;
  customSplitYs: number[];
  scriptText: string;
  baseBlob: Blob | null;
  thumbBlob: Blob | null;
  rawPages: SerializedRawPage[];
  paintLayers: SerializedPaintLayer[];
  texts: TextLayer[];
  logos: SerializedLogoLayer[];
}

export interface ProjectSnapshot {
  id: string;
  projectId: string;
  label: string;
  createdAt: number;
  isAuto: boolean;
  thumbBlob: Blob | null;
  data: Omit<ProjectRecord, 'id' | 'name' | 'updatedAt' | 'thumbBlob'>;
}

export interface HistoryEntry {
  id: string;
  label: string;
  kind: 'paint' | 'objects' | 'layers' | 'pages';
  timestamp: number;
  payload: unknown;
}

export interface AlignmentGuide {
  axis: 'x' | 'y';
  pos: number;
  from: number;
  to: number;
  kind: 'center' | 'edge' | 'spacing';
}

export interface SelectionTarget {
  kind: 'text' | 'logo';
  ids: string[];
}
