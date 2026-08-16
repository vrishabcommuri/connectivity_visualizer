import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json({ limit: '100mb' }));
  app.use(express.static('public'));

  // API Routes
  app.get('/api/batch/list-files', (req, res) => {
    const dirPath = req.query.path as string;
    if (!dirPath) return res.status(400).json({ error: 'Path is required' });

    try {
      const resolvedPath = path.isAbsolute(dirPath) ? dirPath : path.resolve(process.cwd(), dirPath);
      if (!fs.existsSync(resolvedPath)) {
        return res.status(404).json({ error: `Directory not found: ${resolvedPath}` });
      }

      const files = fs.readdirSync(resolvedPath)
        .filter(f => f.toLowerCase().endsWith('.json'))
        .sort();

      res.json({ files, resolvedPath });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  app.get('/api/batch/load-file', (req, res) => {
    const filePath = req.query.path as string;
    if (!filePath) return res.status(400).json({ error: 'Path is required' });

    try {
      const resolvedPath = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
      if (!fs.existsSync(resolvedPath)) {
        return res.status(404).json({ error: 'File not found' });
      }

      const content = fs.readFileSync(resolvedPath, 'utf-8');
      res.header('Content-Type', 'application/json');
      res.send(content);
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  app.post('/api/batch/save-screenshot', express.raw({ type: 'image/png', limit: '50mb' }), (req, res) => {
    const filename = req.query.filename as string;
    const outputDir = req.query.outputDir as string;

    if (!filename || !outputDir) {
      return res.status(400).json({ error: 'Filename and outputDir are required' });
    }

    try {
      const resolvedDir = path.isAbsolute(outputDir) ? outputDir : path.join(process.cwd(), outputDir);
      if (!fs.existsSync(resolvedDir)) {
        fs.mkdirSync(resolvedDir, { recursive: true });
      }

      const filePath = path.join(resolvedDir, filename);
      fs.writeFileSync(filePath, req.body);
      res.json({ success: true, path: filePath });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  // Vite Middleware
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
