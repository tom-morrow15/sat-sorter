#!/usr/bin/env node
/**
 * Sat Sorter agent connector.
 *
 * Run one copy per agent, next to Hermes:
 *   SAT_SORTER_CODE='satsorter:agent:...' SAT_SORTER_AGENT_NAME='Tars' node agent/server.mjs
 *
 * A second agent uses the same code and a different name:
 *   SAT_SORTER_CODE='satsorter:agent:...' SAT_SORTER_AGENT_NAME='Wadsworth' node agent/server.mjs
 *
 * Hermes speaks to this process over stdin/stdout. Do not print anything else to stdout.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { finalizeEvent, generateSecretKey, getPublicKey } from 'nostr-tools/pure';
import { SimplePool, nip44 } from 'nostr-tools';

const RELAYS = [
  'wss://relay.primal.net',
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.ditto.pub',
  'wss://relay.nostr.band',
];
const KIND = 30078;
const TAG = 'sat-sorter-thread';

const name = (process.env.SAT_SORTER_AGENT_NAME || 'Agent').trim().slice(0, 40);
const code = (process.env.SAT_SORTER_CODE || '').trim();
const parts = code.split(':');
const budgetId = parts[2] || '';
const ownerPubkey = (parts[3] || '').toLowerCase();
const partnerPubkey = parts[4] && parts[4] !== '0' ? parts[4].toLowerCase() : '';

function log(message) {
  fs.writeSync(2, `[sat-sorter-agent] ${message}\n`);
}

function keyPath() {
  if (process.env.SAT_SORTER_KEY) return process.env.SAT_SORTER_KEY;
  const dir = path.join(os.homedir(), '.sat-sorter-agent');
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'agent'}.json`);
}

function loadKey() {
  const file = keyPath();
  if (fs.existsSync(file)) {
    const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
    return Buffer.from(saved.secret, 'hex');
  }
  const secret = Buffer.from(generateSecretKey());
  fs.writeFileSync(file, JSON.stringify({ secret: secret.toString('hex'), name }), { mode: 0o600 });
  return secret;
}

if (!budgetId || !/^[0-9a-f]{64}$/.test(ownerPubkey)) {
  log('Set SAT_SORTER_CODE to the code from Sat Sorter → Agents.');
  process.exit(1);
}

const secret = new Uint8Array(loadKey());
const pubkey = getPublicKey(secret);
const recipients = [ownerPubkey, partnerPubkey].filter(Boolean);
const pool = new SimplePool();
let catalog = null;

function encryptTo(recipient, payload) {
  const key = nip44.v2.utils.getConversationKey(secret, recipient);
  return nip44.v2.encrypt(JSON.stringify(payload), key);
}

async function publish(recipient, dTag, payload) {
  const event = finalizeEvent({
    kind: KIND,
    created_at: Math.floor(Date.now() / 1000),
    tags: [['d', dTag], ['t', TAG], ['p', recipient], ['b', budgetId]],
    content: encryptTo(recipient, payload),
  }, secret);
  const writes = pool.publish(RELAYS, event).map((result) => result.then(() => true).catch(() => false));
  const results = await Promise.race([
    Promise.all(writes),
    new Promise((resolve) => setTimeout(() => resolve([]), 8000)),
  ]);
  return Array.isArray(results) && results.some(Boolean);
}

async function sayHello() {
  const payload = { type: 'agent-hello', budgetId, pubkey, name };
  const at = Date.now();
  await Promise.all(recipients.map((recipient) => publish(
    recipient,
    `sat-sorter/agent-hello/${budgetId}/${pubkey.slice(0, 8)}/${at}/${recipient.slice(0, 8)}`,
    payload,
  )));
}

async function publishProfile() {
  const event = finalizeEvent({
    kind: 0,
    created_at: Math.floor(Date.now() / 1000),
    tags: [],
    content: JSON.stringify({ name, display_name: name }),
  }, secret);
  await Promise.all(pool.publish(RELAYS, event).map((result) => result.catch(() => undefined)));
}

async function refreshCatalog() {
  const events = await pool.querySync(
    RELAYS,
    { kinds: [KIND], '#p': [pubkey], '#t': [TAG], limit: 10 },
    { maxWait: 5000 },
  );
  let best = null;
  for (const event of events) {
    try {
      const key = nip44.v2.utils.getConversationKey(secret, event.pubkey);
      const body = JSON.parse(nip44.v2.decrypt(event.content, key));
      if (body?.type !== 'agent-catalog' || body.budgetId !== budgetId) continue;
      if (!best || (event.created_at || 0) >= best.at) best = { at: event.created_at || 0, body };
    } catch {
      // a relay event we cannot read
    }
  }
  if (best) catalog = best.body;
  return catalog;
}

function monthNow() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function findLine(label) {
  const want = String(label || '').trim().toLowerCase();
  if (!want || !catalog) return null;
  for (const category of catalog.categories || []) {
    for (const line of category.lineItems || []) {
      if (String(line.name || '').trim().toLowerCase() === want) return { category, line };
    }
  }
  return null;
}

function lineNames() {
  return (catalog?.categories || []).flatMap((category) => (category.lineItems || []).map((line) => line.name));
}

async function addExpense(args) {
  const description = String(args.description || '').trim();
  const amountUsd = Number(args.amount_usd);
  if (!description) return { error: 'A description is required.' };
  if (!Number.isFinite(amountUsd) || amountUsd <= 0) return { error: 'amount_usd must be a number greater than zero.' };
  if (!catalog) {
    await refreshCatalog();
  }
  if (!catalog) {
    return { error: 'Sat Sorter has not approved this agent yet. Open Sat Sorter, leave Agents open, and try again.' };
  }

  const methods = (catalog.paymentMethods || []).map((method) => String(method));
  let paymentMethod;
  if (args.payment_method) {
    const wanted = String(args.payment_method).trim().toLowerCase();
    const match = methods.find((method) => method.trim().toLowerCase() === wanted);
    if (!match && methods.length > 0) {
      return { error: `That card is not on this budget. Use one of: ${methods.join(', ')}` };
    }
    paymentMethod = match || String(args.payment_method).trim();
  }

  const id = crypto.randomUUID();
  const date = args.date ? new Date(args.date).toISOString() : new Date().toISOString();
  const transaction = {
    id,
    amount: 0,
    amountUsd: Math.round(amountUsd * 100) / 100,
    description,
    date,
    lineItemId: null,
    bucketId: null,
    isIncome: args.is_income === true,
    partnerPubkey: pubkey,
    paymentMethod,
  };

  const splits = Array.isArray(args.splits) ? args.splits : [];
  if (splits.length > 0) {
    const built = [];
    let sum = 0;
    for (const split of splits) {
      const found = findLine(split.line_item);
      if (!found) return { error: `No line named "${split.line_item}". Lines: ${lineNames().join(', ')}` };
      const part = Number(split.amount_usd);
      if (!Number.isFinite(part) || part <= 0) return { error: 'Each split needs an amount_usd greater than zero.' };
      sum += part;
      built.push({
        id: crypto.randomUUID(),
        bucketId: found.category.id,
        lineItemId: found.line.id,
        amount: 0,
        amountUsd: Math.round(part * 100) / 100,
      });
    }
    if (Math.abs(sum - amountUsd) > 0.02) {
      return { error: `The split amounts add up to ${sum}, not ${amountUsd}.` };
    }
    transaction.splits = built;
    transaction.isSplit = true;
  } else if (args.line_item) {
    const found = findLine(args.line_item);
    if (!found) return { error: `No line named "${args.line_item}". Leave it out to log the expense unassigned. Lines: ${lineNames().join(', ')}` };
    transaction.lineItemId = found.line.id;
    transaction.bucketId = found.category.id;
    transaction.isIncome = found.category.isIncome === true || args.is_income === true;
  }

  const note = {
    id: crypto.randomUUID(),
    budgetId,
    month: catalog.month || monthNow(),
    entity: 'transaction',
    entityId: id,
    op: 'upsert',
    at: Date.now(),
    authorPubkey: pubkey,
    transaction,
  };
  const payload = { type: 'notes', budgetId, notes: [note] };
  const at = note.at;
  const sent = await Promise.all(recipients.map((recipient) => publish(
    recipient,
    `sat-sorter/agent-note/${budgetId}/${note.id}/${recipient.slice(0, 8)}/${at}`,
    payload,
  )));
  if (!sent.some(Boolean)) return { error: 'The expense could not be sent. Leave Sat Sorter open and try again.' };
  return {
    logged: true,
    description,
    amountUsd: transaction.amountUsd,
    line: transaction.lineItemId ? args.line_item : (splits.length ? 'split' : 'unassigned'),
    paymentMethod: paymentMethod || null,
  };
}

const tools = [
  {
    name: 'list_budget',
    description: 'Read this month’s categories, what is left on each line, and the payment methods on the budget. Call this before logging an expense.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'add_expense',
    description: 'Log one expense on the Sat Sorter budget. Ask the person which card and which line if they did not say. If they are not sure of the line, omit line_item and it stays unassigned. Use splits only when they say the expense belongs on more than one line.',
    inputSchema: {
      type: 'object',
      properties: {
        description: { type: 'string' },
        amount_usd: { type: 'number' },
        date: { type: 'string', description: 'ISO date. Omit for today.' },
        payment_method: { type: 'string', description: 'Must match a payment method from list_budget.' },
        line_item: { type: 'string', description: 'A line name from list_budget. Omit if unknown.' },
        is_income: { type: 'boolean' },
        splits: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              line_item: { type: 'string' },
              amount_usd: { type: 'number' },
            },
            required: ['line_item', 'amount_usd'],
          },
        },
      },
      required: ['description', 'amount_usd'],
    },
  },
];

function respond(id, result) {
  if (id === undefined || id === null) return;
  sendMessage({ jsonrpc: '2.0', id, result });
}

function fail(id, message) {
  if (id === undefined || id === null) return;
  sendMessage({ jsonrpc: '2.0', id, error: { code: -32000, message } });
}

function sendMessage(message) {
  const json = JSON.stringify(message);
  process.stdout.write(`Content-Length: ${Buffer.byteLength(json)}\r\n\r\n${json}`);
}

async function handle(message) {
  const { id, method, params } = message;
  if (method === 'initialize') {
    respond(id, {
      protocolVersion: '2024-11-05',
      capabilities: { tools: {} },
      serverInfo: { name: 'sat-sorter-agent', version: '1.0.0' },
    });
    return;
  }
  if (method === 'notifications/initialized' || method === 'initialized') return;
  if (method === 'tools/list') {
    respond(id, { tools });
    return;
  }
  if (method === 'tools/call') {
    const tool = params?.name;
    const args = params?.arguments || {};
    try {
      if (tool === 'list_budget') {
        const current = await refreshCatalog();
        if (!current) {
          await sayHello();
          respond(id, { content: [{ type: 'text', text: 'Not connected yet. Ask the person to open Sat Sorter and leave the Agents screen open, then try again.' }], isError: true });
          return;
        }
        respond(id, { content: [{ type: 'text', text: JSON.stringify(current) }] });
        return;
      }
      if (tool === 'add_expense') {
        const result = await addExpense(args);
        respond(id, { content: [{ type: 'text', text: JSON.stringify(result) }], isError: !!result.error });
        return;
      }
      fail(id, `Unknown tool ${tool}`);
    } catch (error) {
      fail(id, error instanceof Error ? error.message : 'Tool failed');
    }
    return;
  }
  if (method === 'ping') {
    respond(id, {});
  }
}

let buffer = Buffer.alloc(0);
process.stdin.on('data', (chunk) => {
  buffer = Buffer.concat([buffer, chunk]);
  for (;;) {
    const headerEnd = buffer.indexOf('\r\n\r\n');
    if (headerEnd === -1) return;
    const header = buffer.slice(0, headerEnd).toString('utf8');
    const match = header.match(/Content-Length:\s*(\d+)/i);
    if (!match) {
      buffer = buffer.slice(headerEnd + 4);
      continue;
    }
    const length = Number(match[1]);
    const start = headerEnd + 4;
    if (buffer.length < start + length) return;
    const body = buffer.slice(start, start + length).toString('utf8');
    buffer = buffer.slice(start + length);
    try {
      void handle(JSON.parse(body));
    } catch (error) {
      log(error instanceof Error ? error.message : 'bad message');
    }
  }
});

log(`${name} ready as ${pubkey.slice(0, 8)}`);
void publishProfile();
void sayHello();
const helloTimer = setInterval(() => {
  if (catalog) {
    clearInterval(helloTimer);
    return;
  }
  void sayHello();
}, 20000);
