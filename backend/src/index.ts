import express from 'express';
import cors from 'cors';
import multer from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import { analyzeLogs } from './controllers/analyze.controller.js';
import { exportExcel, exportCsv, exportHtml } from './controllers/export.controller.js';
import { generatePdf } from './utils/test-generator.js';
import { reportCache, analyzeLogs as rawAnalyze } from './controllers/analyze.controller.js';

// Resolve __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());

// Setup Multer for PDF uploads (saving to a local temp folder)
const tempDir = path.join(__dirname, '..', 'temp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, tempDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + '.pdf');
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 150 * 1024 * 1024 // 150 MB upload limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf' || file.originalname.endsWith('.pdf')) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF log files are accepted.'));
    }
  }
});

// App Routes
app.post('/api/analyze', upload.single('file'), (req, res, next) => {
  analyzeLogs(req, res).catch(next);
});

app.get('/api/export/:reportId/excel', exportExcel);
app.get('/api/export/:reportId/csv', exportCsv);
app.get('/api/export/:reportId/html', exportHtml);

// Special Demo Route: Generates a mock log PDF and analyzes it in-flight
app.post('/api/test/generate-and-analyze', async (req, res, next) => {
  const pages = parseInt(req.body.pages || '10', 10);
  const tempPath = path.join(tempDir, `demo-${Date.now()}.pdf`);
  
  try {
    console.log(`Generating a demo log PDF of ${pages} pages...`);
    await generatePdf(pages, tempPath);
    
    // Create a mock Multer file structure
    const mockFile = {
      fieldname: 'file',
      originalname: `demo-${pages}p.pdf`,
      encoding: '7bit',
      mimetype: 'application/pdf',
      destination: tempDir,
      filename: path.basename(tempPath),
      path: tempPath,
      size: fs.statSync(tempPath).size,
      stream: fs.createReadStream(tempPath)
    } as any as Express.Multer.File;

    // Inject into a custom request and execute controller
    const mockReq = {
      file: mockFile,
      body: {
        geminiApiKey: req.body.geminiApiKey,
        knownFacilities: req.body.knownFacilities
      }
    } as any;

    await analyzeLogs(mockReq, res);
  } catch (error: any) {
    console.error('Demo generation failed:', error);
    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    res.status(500).json({ error: 'Failed to run demo generation: ' + error.message });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', environment: 'production' });
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled Server Error:', err);
  res.status(500).json({ error: err.message || 'An unexpected error occurred.' });
});

app.listen(PORT, () => {
  console.log(`PCC Webhook Log Analyzer server running on port ${PORT}`);
});
