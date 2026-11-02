#!/usr/bin/env node
/*! NEON DRIFT | Made by bal1st1k */
'use strict';

// Local static hosting only: this process never accepts writes or binds to the LAN.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

const HOST = '127.0.0.1';
const ROOT = fs.realpathSync(__dirname);
const MIME = Object.freeze({
  '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8',
  '.js':'text/javascript; charset=utf-8', '.mjs':'text/javascript; charset=utf-8',
  '.json':'application/json; charset=utf-8', '.txt':'text/plain; charset=utf-8',
  '.md':'text/plain; charset=utf-8', '.svg':'image/svg+xml', '.png':'image/png',
  '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.webp':'image/webp',
  '.avif':'image/avif', '.gif':'image/gif', '.ico':'image/x-icon',
  '.woff':'font/woff', '.woff2':'font/woff2', '.mp3':'audio/mpeg',
  '.ogg':'audio/ogg', '.wav':'audio/wav', '.webm':'video/webm', '.mp4':'video/mp4'
});

function insideRoot(filename, root = ROOT) {
  const relative = path.relative(root,filename);
  return relative !== '..' && !relative.startsWith('..'+path.sep) && !path.isAbsolute(relative);
}

function requestPath(rawURL) {
  if (typeof rawURL !== 'string' || rawURL.length > 8192 || !rawURL.startsWith('/')) {
    const error = new Error('Invalid request path'); error.status = 400; throw error;
  }
  let decoded;
  try { decoded = decodeURIComponent(rawURL.split(/[?#]/,1)[0]); }
  catch { const error = new Error('Invalid URL encoding'); error.status = 400; throw error; }
  // Reject Windows separators, devices, drive letters, controls and encoded traversal.
  if (/[\\:\u0000-\u001f\u007f]/.test(decoded) || /%(?:2e|2f|5c|00)/i.test(decoded)) {
    const error = new Error('Forbidden path'); error.status = 403; throw error;
  }
  const segments = decoded.split('/').filter(Boolean);
  if (segments.some(part => part.startsWith('.') || /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part) || /[. ]$/.test(part))) {
    const error = new Error('Forbidden path'); error.status = 403; throw error;
  }
  const candidate = path.resolve(ROOT,...(segments.length ? segments : ['index.html']));
  if (!insideRoot(candidate)) { const error = new Error('Forbidden path'); error.status = 403; throw error; }
  return candidate;
}

function createServer() {
  return http.createServer(async (request,response) => {
    const head = request.method === 'HEAD';
    const sendError = (status,message,extra = {}) => {
      const body = Buffer.from(message+'\n','utf8');
      response.writeHead(status,{
        'Content-Type':'text/plain; charset=utf-8', 'Content-Length':body.length,
        'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff', ...extra
      });
      response.end(head ? undefined : body);
    };
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      request.resume(); sendError(405,'Method not allowed',{ Allow:'GET, HEAD' }); return;
    }
    let filename;
    try {
      filename = requestPath(request.url);
      // Resolve symlinks before checking containment so linked files cannot escape the folder.
      filename = await fs.promises.realpath(filename);
      if (!insideRoot(filename)) { sendError(403,'Forbidden'); return; }
      const stat = await fs.promises.stat(filename);
      if (!stat.isFile()) { sendError(404,'Not found'); return; }
      response.writeHead(200,{
        'Content-Type':MIME[path.extname(filename).toLowerCase()] || 'application/octet-stream',
        'Content-Length':stat.size, 'Cache-Control':'no-store',
        'X-Content-Type-Options':'nosniff', 'Referrer-Policy':'no-referrer'
      });
      if (head) { response.end(); return; }
      const stream = fs.createReadStream(filename);
      stream.on('error',() => response.destroy());
      response.on('close',() => stream.destroy());
      stream.pipe(response);
    } catch (error) {
      const status = error.status || (['ENOENT','ENOTDIR'].includes(error.code) ? 404 : ['EACCES','EPERM'].includes(error.code) ? 403 : 500);
      sendError(status,status === 404 ? 'Not found' : status === 403 ? 'Forbidden' : status === 400 ? 'Bad request' : 'Server error');
    }
  });
}

function main() {
  const suppliedPort = process.env.PORT || '4177';
  const port = Number(suppliedPort);
  if (!/^\d+$/.test(suppliedPort) || !Number.isInteger(port) || port < 1 || port > 65535) {
    console.error('NEON DRIFT: PORT должен быть числом от 1 до 65535.');
    process.exitCode = 1; return;
  }
  const server = createServer();
  server.on('error',error => {
    if (error.code === 'EADDRINUSE') {
      console.error(`NEON DRIFT: порт ${port} уже занят. Закрой другое окно игры или выбери другой порт: set PORT=4178`);
    } else console.error(`NEON DRIFT: ${error.message}`);
    process.exitCode = 1;
  });
  server.listen(port,HOST,() => {
    const url = `http://${HOST}:${port}/`;
    console.log(`\n  NEON DRIFT — Ночная смена\n  ${url}\n\n  Оставь это окно открытым. Ctrl+C — остановить сервер.\n`);
    if (process.argv.includes('--open')) {
      // Open only after listen succeeds; the URL contains a fixed host and validated port.
      const browser = spawn('cmd.exe',['/d','/c','start','',url],{
        windowsHide:true, detached:true, stdio:'ignore'
      });
      browser.on('error',() => console.error(`Открой игру вручную: ${url}`));
      browser.unref();
    }
  });
  const shutdown = () => {
    console.log('\nNEON DRIFT: сервер остановлен.');
    server.close(() => { process.exitCode = 0; });
    if (typeof server.closeIdleConnections === 'function') server.closeIdleConnections();
    const timeout = setTimeout(() => { server.closeAllConnections?.(); },1500);
    timeout.unref();
  };
  process.once('SIGINT',shutdown);
  process.once('SIGTERM',shutdown);
}

if (require.main === module) main();
module.exports = { createServer,requestPath,insideRoot };
