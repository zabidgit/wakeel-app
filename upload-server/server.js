/**
 * Wakeel Media Upload Server
 * Tiny sidecar that accepts file uploads from the iOS app
 * and saves them to the gateway's media/inbound folder.
 * 
 * Runs on port 3100 (proxied via nginx alongside the gateway).
 * Auth: requires gateway token in Authorization header.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = parseInt(process.env.UPLOAD_PORT || '3100');
const MEDIA_DIR = process.env.MEDIA_DIR || path.join(
  process.env.HOME || '/home/openclaw',
  '.openclaw', 'media', 'inbound'
);
const AUTH_TOKEN = process.env.AUTH_TOKEN || '';
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

// Ensure media dir exists
fs.mkdirSync(MEDIA_DIR, { recursive: true });

const server = http.createServer((req, res) => {
  // CORS headers for the app
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method !== 'POST' || req.url !== '/upload') {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
    return;
  }

  // Auth check
  if (AUTH_TOKEN) {
    const auth = req.headers.authorization || '';
    const token = auth.replace(/^Bearer\s+/i, '');
    if (token !== AUTH_TOKEN) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized' }));
      return;
    }
  }

  // Read body
  const chunks = [];
  let size = 0;

  req.on('data', (chunk) => {
    size += chunk.length;
    if (size > MAX_SIZE) {
      res.writeHead(413, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'File too large (max 10MB)' }));
      req.destroy();
      return;
    }
    chunks.push(chunk);
  });

  req.on('end', () => {
    if (res.writableEnded) return;

    const body = Buffer.concat(chunks);
    
    // Parse multipart or raw body
    const contentType = req.headers['content-type'] || '';
    
    let fileData, mimeType, fileName;

    if (contentType.includes('application/json')) {
      // JSON body with base64 data
      try {
        const json = JSON.parse(body.toString());
        fileData = Buffer.from(json.data, 'base64');
        mimeType = json.mimeType || 'application/octet-stream';
        fileName = json.fileName || 'upload';
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON body' }));
        return;
      }
    } else {
      // Raw binary upload
      fileData = body;
      mimeType = contentType.split(';')[0] || 'application/octet-stream';
      fileName = 'upload';
    }

    // Generate UUID filename with correct extension
    const ext = getExtension(mimeType, fileName);
    const uuid = crypto.randomUUID();
    const savedFileName = `${uuid}${ext}`;
    const filePath = path.join(MEDIA_DIR, savedFileName);

    fs.writeFile(filePath, fileData, (err) => {
      if (err) {
        console.error('Failed to save file:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Failed to save file' }));
        return;
      }

      console.log(`Saved: ${savedFileName} (${fileData.length} bytes, ${mimeType})`);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        path: filePath,
        fileName: savedFileName,
        mimeType,
        size: fileData.length,
      }));
    });
  });
});

function getExtension(mimeType, fileName) {
  // Try from filename first
  const fnExt = path.extname(fileName);
  if (fnExt) return fnExt;

  // Fall back to mime type
  const map = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'image/heic': '.heic',
    'video/mp4': '.mp4',
    'video/quicktime': '.mov',
    'application/pdf': '.pdf',
    'text/plain': '.txt',
  };
  return map[mimeType] || '';
}

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Wakeel Upload Server listening on port ${PORT}`);
  console.log(`Media dir: ${MEDIA_DIR}`);
});
