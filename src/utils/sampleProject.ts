import { TextLayer } from '../types/editor';

export function renderSampleComicBase(canvas: HTMLCanvasElement) {
  const w = canvas.width;
  const h = canvas.height;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#f4f5f7';
  ctx.fillRect(0, 0, w, h);

  // Panel 1
  const g1 = ctx.createLinearGradient(30, 30, 30, 510);
  g1.addColorStop(0, '#dbeafe');
  g1.addColorStop(1, '#ede9fe');
  ctx.fillStyle = g1;
  ctx.strokeStyle = '#111827';
  ctx.lineWidth = 4;
  ctx.fillRect(30, 30, 740, 480);
  ctx.strokeRect(30, 30, 740, 480);

  // Silhouette character
  ctx.fillStyle = '#334155';
  ctx.beginPath();
  ctx.arc(230, 290, 88, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(142, 370, 176, 140);

  // Speech bubble 1 with Japanese sample text to clean
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(545, 165, 165, 92, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#111827';
  ctx.font = 'bold 28px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('こんにちは！', 545, 155);
  ctx.fillText('ここを消してね', 545, 195);

  // Panel 2
  const g2 = ctx.createLinearGradient(30, 540, 770, 1060);
  g2.addColorStop(0, '#fed7aa');
  g2.addColorStop(1, '#fecaca');
  ctx.fillStyle = g2;
  ctx.fillRect(30, 540, 740, 520);
  ctx.strokeRect(30, 540, 740, 520);

  ctx.fillStyle = '#18181b';
  ctx.font = 'bold 58px Impact';
  ctx.fillText('ドゴォォン!!', 265, 760);

  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(560, 905, 160, 88, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#111827';
  ctx.font = 'bold 24px Arial';
  ctx.fillText('여기를 지우고', 560, 895);
  ctx.fillText('번역해 보세요!', 560, 932);
}

export function createDefaultTextLayer(overrides: Partial<TextLayer> = {}): TextLayer {
  return {
    id: 't_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    name: overrides.name || 'Текст',
    text: overrides.text ?? 'Шинэ текст',
    x: overrides.x ?? 400,
    y: overrides.y ?? 300,
    boxWidth: overrides.boxWidth ?? 220,
    fontFamily: overrides.fontFamily ?? "'Montserrat', sans-serif",
    fontSize: overrides.fontSize ?? 24,
    scaleX: overrides.scaleX ?? 1,
    scaleY: overrides.scaleY ?? 1,
    color: overrides.color ?? '#111111',
    strokeColor: overrides.strokeColor ?? '#ffffff',
    strokeWidth: overrides.strokeWidth ?? 5,
    gradEnabled: overrides.gradEnabled ?? false,
    grad1: overrides.grad1 ?? '#14b866',
    grad2: overrides.grad2 ?? '#2dd4bf',
    gradAng: overrides.gradAng ?? 90,
    glowEnabled: overrides.glowEnabled ?? false,
    glowColor: overrides.glowColor ?? '#14b866',
    glowRadius: overrides.glowRadius ?? 14,
    shadowEnabled: overrides.shadowEnabled ?? false,
    shadowColor: overrides.shadowColor ?? '#000000',
    shadowAngle: overrides.shadowAngle ?? 135,
    shadowDistance: overrides.shadowDistance ?? 4,
    shadowBlur: overrides.shadowBlur ?? 6,
    shadowOpacity: overrides.shadowOpacity ?? 70,
    bold: overrides.bold ?? true,
    italic: overrides.italic ?? false,
    underline: overrides.underline ?? false,
    uppercase: overrides.uppercase ?? false,
    align: overrides.align ?? 'center',
    letterSpacing: overrides.letterSpacing ?? 0,
    lineHeight: overrides.lineHeight ?? 1.25,
    rotation: overrides.rotation ?? 0,
    bend: overrides.bend ?? 0,
    perspX: overrides.perspX ?? 0,
    perspY: overrides.perspY ?? 0,
    bgEnabled: overrides.bgEnabled ?? false,
    bgColor: overrides.bgColor ?? '#ffffff',
    visible: overrides.visible ?? true,
    locked: overrides.locked ?? false,
    opacity: overrides.opacity ?? 1,
  };
}
