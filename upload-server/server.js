/**
 * Wakeel Media + Push Server
 * Sidecar that handles:
 *   1. File uploads from the iOS app → gateway media/inbound
 *   2. Push token registration from the iOS app
 *   3. Push notification sending via Expo Push API
 * 
 * Runs on port 3100 (proxied via nginx alongside the gateway).
 * Auth: requires gateway token in Authorization header.
 */

const http = require('http');
const https = require('https');
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
const PUSH_TOKENS_FILE = process.env.PUSH_TOKENS_FILE || '/tmp/push-tokens.json';

// Ensure media dir exists
fs.mkdirSync(MEDIA_DIR, { recursive: true });

// ─── Push Token Storage ───────────────────────────────────────────────────────

function loadPushTokens() {
  try {
    return JSON.parse(fs.readFileSync(PUSH_TOKENS_FILE, 'utf8'));
  } catch {
    return { tokens: [] };
  }
}

function savePushTokens(data) {
  fs.writeFileSync(PUSH_TOKENS_FILE, JSON.stringify(data, null, 2));
}

// ─── Expo Push API ────────────────────────────────────────────────────────────

function sendExpoPush(pushToken, title, body, data) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      to: pushToken,
      title: title || 'Wakeel',
      body: body || '',
      sound: 'default',
      badge: 1,
      data: data || {},
    });

    const options = {
      hostname: 'exp.host',
      port: 443,
      path: '/--/api/v2/push/send',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          console.log('Expo push response:', JSON.stringify(json));
          resolve(json);
        } catch {
          resolve({ raw: data });
        }
      });
    });

    req.on('error', (err) => {
      console.error('Expo push error:', err.message);
      reject(err);
    });

    req.write(payload);
    req.end();
  });
}

// ─── Auth Check ───────────────────────────────────────────────────────────────

function checkAuth(req, res) {
  if (!AUTH_TOKEN) return true;
  const auth = req.headers.authorization || '';
  const token = auth.replace(/^Bearer\s+/i, '');
  if (token !== AUTH_TOKEN) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Unauthorized' }));
    return false;
  }
  return true;
}

// ─── Read JSON Body ───────────────────────────────────────────────────────────

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_SIZE) { reject(new Error('Too large')); return; }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

// ─── Route Handler ────────────────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // ─── Health Check ───────────────────────────────────────────────────────────
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, service: 'wakeel-media-push' }));
    return;
  }

  // ─── Push Token Registration ────────────────────────────────────────────────
  if (req.method === 'POST' && req.url === '/push/register') {
    if (!checkAuth(req, res)) return;
    try {
      const body = await readBody(req);
      const { token: pushToken, platform, deviceId } = JSON.parse(body.toString());

      if (!pushToken) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing token field' }));
        return;
      }

      const data = loadPushTokens();
      // Upsert by deviceId or token
      const existing = data.tokens.findIndex(t =>
        (deviceId && t.deviceId === deviceId) || t.token === pushToken
      );
      const entry = {
        token: pushToken,
        platform: platform || 'expo',
        deviceId: deviceId || 'unknown',
        registeredAt: new Date().toISOString(),
      };

      if (existing >= 0) {
        data.tokens[existing] = entry;
      } else {
        data.tokens.push(entry);
      }
      savePushTokens(data);

      console.log(`Push token registered: ${pushToken.slice(0, 30)}... (${platform || 'expo'})`);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, registered: true }));
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // ─── Send Push Notification ─────────────────────────────────────────────────
  if (req.method === 'POST' && req.url === '/push/send') {
    if (!checkAuth(req, res)) return;
    try {
      const body = await readBody(req);
      const { title, message, data: pushData, deviceId } = JSON.parse(body.toString());

      if (!message) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing message field' }));
        return;
      }

      const tokenData = loadPushTokens();
      // Send to specific device or all registered devices
      const targets = deviceId
        ? tokenData.tokens.filter(t => t.deviceId === deviceId)
        : tokenData.tokens;

      if (targets.length === 0) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'No push tokens registered' }));
        return;
      }

      const results = [];
      for (const target of targets) {
        try {
          const result = await sendExpoPush(target.token, title || 'Wakeel', message, pushData);
          results.push({ deviceId: target.deviceId, ok: true, result });
        } catch (err) {
          results.push({ deviceId: target.deviceId, ok: false, error: err.message });
        }
      }

      console.log(`Push sent to ${results.length} device(s): "${message.slice(0, 50)}..."`);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, sent: results.length, results }));
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // ─── List Push Tokens (for debugging) ───────────────────────────────────────
  if (req.method === 'GET' && req.url === '/push/tokens') {
    if (!checkAuth(req, res)) return;
    const data = loadPushTokens();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      count: data.tokens.length,
      tokens: data.tokens.map(t => ({
        deviceId: t.deviceId,
        platform: t.platform,
        registeredAt: t.registeredAt,
        tokenPrefix: t.token.slice(0, 30) + '...',
      })),
    }));
    return;
  }

  // ─── File Upload (existing) ─────────────────────────────────────────────────
  if (req.method === 'POST' && req.url === '/upload') {
    if (!checkAuth(req, res)) return;

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
      const contentType = req.headers['content-type'] || '';

      let fileData, mimeType, fileName;

      if (contentType.includes('application/json')) {
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
        fileData = body;
        mimeType = contentType.split(';')[0] || 'application/octet-stream';
        fileName = 'upload';
      }

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
    return;
  }

  // ─── 404 ────────────────────────────────────────────────────────────────────
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

function getExtension(mimeType, fileName) {
  const fnExt = path.extname(fileName);
  if (fnExt) return fnExt;

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
  console.log(`Wakeel Media + Push Server listening on port ${PORT}`);
  console.log(`Media dir: ${MEDIA_DIR}`);
  console.log(`Push tokens file: ${PUSH_TOKENS_FILE}`);
});
