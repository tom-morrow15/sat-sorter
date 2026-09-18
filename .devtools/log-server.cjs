#!/usr/bin/env node
/**
 * Dev-only console log collector (pairs with src/lib/devConsoleBridge.ts).
 * Receives POST /log from the app in Bionic's preview browser and appends
 * everything to /tmp/app-console.log so the agent can read the app's logs.
 */
const http = require('http');
const fs = require('fs');

const OUT = '/tmp/app-console.log';

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
  if (req.method === 'POST' && req.url === '/log') {
    let body = '';
    req.on('data', (c) => { body += c; if (body.length > 1e6) req.destroy(); });
    req.on('end', () => { fs.appendFileSync(OUT, body + '\n'); res.writeHead(204); res.end(); });
    return;
  }
  if (req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end(fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '(no logs yet)');
    return;
  }
  res.writeHead(404); res.end();
});

server.listen(8099, () => console.log('[log-server] listening on http://localhost:8099'));
