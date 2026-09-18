#!/usr/bin/env node
/**
 * Local relay proxy for dev (Bionic preview browser).
 *
 * Bionic's in-app browser only allows localhost connections, so Nostr relay
 * websockets (wss://) are blocked in the preview. This proxy accepts plain
 * ws:// connections on localhost and fans them out to one or more upstream
 * relays:
 *
 *   Bionic preview → ws://localhost:8090 (trusted) → wss://relay1, wss://relay2 ...
 *
 * Client REQ/EVENT/CLOSE messages are broadcast to every upstream; responses
 * are forwarded back with EVENT duplicates (same subscription + event id)
 * deduplicated, mirroring how a multi-relay NPool behaves.
 *
 * Usage:
 *   npm i ws            (in .devtools/)
 *   UPSTREAM="wss://premium.primal.net,wss://nos.lol" node relay-proxy.cjs
 *
 * The app side maps all relay URLs here in dev via src/lib/devRelayProxy.ts,
 * which reads VITE_RELAY_PROXY from .env.local (gitignored).
 */
const http = require('http');
const { WebSocket, WebSocketServer } = require('ws');

const PORT = process.env.PROXY_PORT || 8090;
const UPSTREAMS = (process.env.UPSTREAM || 'wss://premium.primal.net')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const server = http.createServer((req, res) => {
  res.writeHead(426, { 'Content-Type': 'text/plain' });
  res.end('Upgrade Required: connect with ws://');
});

const wss = new WebSocketServer({ server });

wss.on('connection', (client) => {
  console.log(`[relay-proxy] client connected (${wss.clients.size} active) -> ${UPSTREAMS.join(', ')}`);

  // Dedupe EVENT responses across upstreams, per client connection.
  // Nostr event ids are content hashes, so id equality == duplicate.
  const seen = new Set();
  const isDup = (m) => {
    if (m[0] !== 'EVENT') return false;
    const key = `${m[1]}:${m[2] && m[2].id}`;
    if (seen.has(key)) return true;
    seen.add(key);
    return false;
  };

  let openCount = 0;
  let pending = [];
  let closedByUs = false;

  const closeAll = () => {
    closedByUs = true;
    ups.forEach((u) => { try { u.ws.close(); } catch {} });
    try { client.close(); } catch {}
  };

  const ups = UPSTREAMS.map((url) => {
    const u = { url, ws: null };
    try {
      u.ws = new WebSocket(url);
    } catch (e) {
      console.error(`[relay-proxy] ${url} connect failed:`, e.message);
      return u;
    }
    u.ws.on('open', () => {
      openCount++;
      console.log(`[relay-proxy] upstream open: ${url} (${openCount}/${UPSTREAMS.length})`);
      pending.forEach((m) => { try { u.ws.send(m); } catch {} });
      // If this upstream was slow to open, other upstreams may have already
      // consumed the buffer; only clear when every upstream has flushed once.
      if (openCount === UPSTREAMS.length) pending = [];
    });
    let eventCount = 0;
    u.ws.on('message', (data) => {
      if (client.readyState !== WebSocket.OPEN) return;
      try {
        const m = JSON.parse(data.toString());
        if (Array.isArray(m)) {
          if (m[0] === 'EVENT' && ++eventCount % 10 === 0) console.log(`[relay-proxy] ${url}: ${eventCount}+ events forwarded`);
          if (m[0] === 'EOSE') console.log(`[relay-proxy] ${url}: EOSE after ${eventCount} events (sub ${m[1]})`);
          if (m[0] === 'OK') console.log(`[relay-proxy] ${url}: OK ${m[2] === false ? 'REJECTED: ' + (m[3] || '') : 'accepted'}`);
          if (m[0] === 'CLOSED') console.log(`[relay-proxy] ${url}: CLOSED ${m[1]} ${m[2] || ''}`);
          if (m[0] === 'NOTICE') console.log(`[relay-proxy] ${url}: NOTICE ${m[1]}`);
        }
      } catch {}
      const msg = data.toString();
      try {
        const parsed = JSON.parse(msg);
        if (Array.isArray(parsed) && isDup(parsed)) return;
      } catch {}
      client.send(msg);
    });
    u.ws.on('error', (e) => console.error(`[relay-proxy] ${url} error:`, e.message));
    u.ws.on('close', () => {
      if (!closedByUs) console.log(`[relay-proxy] upstream closed: ${url}`);
    });
    return u;
  });

  client.on('message', (data) => {
    const msg = data.toString();
    try {
      const m = JSON.parse(msg);
      if (Array.isArray(m)) {
        const brief = m[0] === 'REQ'
          ? `REQ ${m[1]} ${JSON.stringify(m[2]).slice(0, 120)}`
          : m[0] === 'EVENT'
            ? `EVENT kind=${m[2] && m[2].kind}`
            : m[0];
        console.log(`[relay-proxy] client -> ${brief}`);
      }
    } catch {}
    let anyOpen = false;
    ups.forEach((u) => {
      if (u.ws && u.ws.readyState === WebSocket.OPEN) { u.ws.send(msg); anyOpen = true; }
    });
    if (!anyOpen) pending.push(msg);
  });

  client.on('error', () => closeAll());
  client.on('close', () => closeAll());
});

// Bind all interfaces (IPv4 + IPv6) so 'localhost' resolves whichever way
// the browser prefers (::1 vs 127.0.0.1)
server.listen(PORT, () => console.log(`[relay-proxy] listening on ws://localhost:${PORT} -> ${UPSTREAMS.join(', ')}`));
