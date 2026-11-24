import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

const PORT = Number(process.env.PORT) || 3000;
const ALLOWED_MIMES = new Set(['image/png', 'image/jpeg', 'image/webp']);

interface DetectedRegion {
  box_2d: [number, number, number, number];
  kind: 'bubble_text' | 'sfx_text' | 'caption_text';
  polarity: 'dark' | 'light' | 'auto';
  hasOutline: boolean;
}

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function detectWithRetry(
  ai: GoogleGenAI,
  imageBase64: string,
  mimeType: string,
  targetFilter: 'all' | 'bubble' | 'sfx'
): Promise<DetectedRegion[]> {
  const filterInstruction =
    targetFilter === 'bubble'
      ? 'Detect ONLY dialogue text inside speech bubbles and narration/caption boxes (`bubble_text`, `caption_text`). Ignore floating action/SFX text outside bubbles.'
      : targetFilter === 'sfx'
      ? 'Detect ONLY floating action / sound-effect / onomatopoeia text (`sfx_text`) drawn over artwork or backgrounds. Ignore normal dialogue inside white speech bubbles.'
      : 'Detect ALL text in the image: (1) dialogue text inside speech bubbles (`bubble_text`), (2) floating sound-effect / action / onomatopoeia words (`sfx_text`), and (3) narration/caption text (`caption_text`).';

  const prompt = [
    'You are a precision manga/comic/webtoon text-region detector.',
    filterInstruction,
    'Rules:',
    '- Return a tight bounding box (`box_2d`: [ymin, xmin, ymax, xmax] normalized 0..1000) around ONLY the text glyphs/letters (including any text outline/glow).',
    '- Do NOT include speech bubble borders, character faces, hair, clothing, or non-text background objects inside the box unless directly behind the letters.',
    '- Set `polarity` to "dark" for black/dark text on light background, "light" for white/light text on dark background, or "auto" for outlined/multi-color/gradient SFX text.',
    '- Set `hasOutline` to true if the text has a contrasting outline/stroke around the letters.',
    '- If there is no matching text in the image, return an empty array [].',
  ].join('\n');

  let lastErr: unknown = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType,
                data: imageBase64,
              },
            },
            { text: prompt },
          ],
        },
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                box_2d: {
                  type: Type.ARRAY,
                  items: { type: Type.INTEGER },
                  description: '[ymin, xmin, ymax, xmax] normalized 0..1000',
                },
                kind: {
                  type: Type.STRING,
                  description: 'bubble_text | sfx_text | caption_text',
                },
                polarity: {
                  type: Type.STRING,
                  description: 'dark | light | auto',
                },
                hasOutline: {
                  type: Type.BOOLEAN,
                  description: 'Whether text has a contrasting outline/stroke',
                },
              },
              required: ['box_2d', 'kind', 'polarity', 'hasOutline'],
            },
          },
        },
      });

      const raw = (response.text ?? '[]').trim();
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];

      return parsed
        .filter((item): item is DetectedRegion => {
          if (!item || !Array.isArray(item.box_2d) || item.box_2d.length !== 4) return false;
          const [y1, x1, y2, x2] = item.box_2d;
          return (
            Number.isFinite(y1) &&
            Number.isFinite(x1) &&
            Number.isFinite(y2) &&
            Number.isFinite(x2) &&
            y2 > y1 &&
            x2 > x1
          );
        })
        .map((item) => ({
          box_2d: [
            Math.max(0, Math.min(1000, Math.round(item.box_2d[0]))),
            Math.max(0, Math.min(1000, Math.round(item.box_2d[1]))),
            Math.max(0, Math.min(1000, Math.round(item.box_2d[2]))),
            Math.max(0, Math.min(1000, Math.round(item.box_2d[3]))),
          ] as [number, number, number, number],
          kind:
            item.kind === 'sfx_text' || item.kind === 'caption_text'
              ? item.kind
              : 'bubble_text',
          polarity:
            item.polarity === 'dark' || item.polarity === 'light' ? item.polarity : 'auto',
          hasOutline: Boolean(item.hasOutline),
        }));
    } catch (err) {
      lastErr = err;
      const status = (err as { status?: number })?.status;
      if (status && status >= 400 && status < 500 && status !== 429) {
        throw err;
      }
      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, 400 * Math.pow(2, attempt)));
      }
    }
  }
  throw lastErr;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '15mb' }));

  app.post('/api/ai/detect-text-regions', async (req, res) => {
    try {
      const { imageBase64, mimeType, targetFilter } = req.body ?? {};
      if (typeof imageBase64 !== 'string' || !imageBase64.length || imageBase64.length > 14_000_000) {
        res.status(400).json({ error: 'Зургийн өгөгдөл буруу эсвэл хэт том байна.' });
        return;
      }
      if (typeof mimeType !== 'string' || !ALLOWED_MIMES.has(mimeType)) {
        res.status(400).json({ error: 'Дэмжигдээгүй зургийн формат байна.' });
        return;
      }
      if (!/^[A-Za-z0-9+/=]+$/.test(imageBase64)) {
        res.status(400).json({ error: 'Base64 өгөгдөл буруу байна.' });
        return;
      }
      const filter: 'all' | 'bubble' | 'sfx' =
        targetFilter === 'bubble' || targetFilter === 'sfx' ? targetFilter : 'all';

      const ai = getGeminiClient();
      if (!ai) {
        res.status(503).json({
          error: 'GEMINI_API_KEY тохируулаагүй байна. Settings > Secrets хэсэгт түлхүүрээ нэмнэ үү.',
        });
        return;
      }

      const regions = await detectWithRetry(ai, imageBase64, mimeType, filter);
      res.json({ regions });
    } catch (err) {
      const status = (err as { status?: number })?.status;
      const msg = err instanceof Error ? err.message : String(err);
      if (status === 403 || status === 400 || /API_KEY_INVALID|PERMISSION_DENIED/i.test(msg)) {
        res.status(403).json({
          error: 'API түлхүүр хүчингүй эсвэл эрхгүй байна. Settings > Secrets хэсгийг шалгана уу.',
        });
        return;
      }
      if (status === 429 || /RESOURCE_EXHAUSTED/i.test(msg)) {
        res.status(429).json({
          error: 'AI хүсэлтийн хязгаар түр хэтэрлээ. Хэдэн секундийн дараа дахин оролдоно уу.',
        });
        return;
      }
      res.status(500).json({ error: 'AI шинжилгээний үед алдаа гарлаа.' });
    }
  });

  app.get('/PanelFlow-Studio.html', (_req, res) => {
    const prodFile = path.resolve(process.cwd(), 'dist', 'PanelFlow-Studio.html');
    const pubFile = path.resolve(process.cwd(), 'public', 'PanelFlow-Studio.html');
    const filePath = fs.existsSync(pubFile) ? pubFile : prodFile;
    if (!fs.existsSync(filePath)) {
      res.status(404).send('PanelFlow-Studio.html not built yet.');
      return;
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="PanelFlow-Studio.html"');
    res.sendFile(filePath);
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'custom',
    });
    app.use(vite.middlewares);

    app.use(async (req, res, next) => {
      if (req.method !== 'GET' || req.path.startsWith('/api/')) {
        next();
        return;
      }
      try {
        const htmlPath = path.resolve(process.cwd(), 'index.html');
        let html = fs.readFileSync(htmlPath, 'utf-8');
        html = await vite.transformIndexHtml(req.originalUrl, html);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
      } catch (e) {
        next(e);
      }
    });
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.use((req, res, next) => {
      if (req.method !== 'GET' || req.path.startsWith('/api/')) {
        next();
        return;
      }
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`PanelFlow Studio server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
