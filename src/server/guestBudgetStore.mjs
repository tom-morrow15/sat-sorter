/**
 * One guest budget for a self-hosted Sat Sorter.
 *
 * The file is the Umbrel copy. Browsers that are not signed in with Nostr
 * read and write it. Umbrel's app proxy is what keeps other people out;
 * this process only listens on localhost inside the web container.
 *
 * Writes are atomic (temp file, then rename) and rejected past MAX_BYTES.
 * There is no authentication secret here.
 */
import { createServer } from 'node:http';
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { pathToFileURL } from 'node:url';

export const MAX_GUEST_BUDGET_BYTES = 2 * 1024 * 1024;
export const GUEST_BUDGET_PATH = '/api/guest-budget';

let queue = Promise.resolve();

function enqueue(task) {
  const run = queue.then(task, task);
  queue = run.then(() => undefined, () => undefined);
  return run;
}

function emptyRecord() {
  return { empty: true, revision: 0 };
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && typeof value.revision === 'number' && value.state && typeof value.state === 'object';
}

export async function readGuestBudget(file) {
  let raw;
  try {
    raw = await readFile(file, 'utf8');
  } catch (error) {
    if (error && error.code === 'ENOENT') return emptyRecord();
    throw error;
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    const failed = new Error('Guest budget file is not valid JSON');
    failed.code = 'EBADJSON';
    throw failed;
  }
  if (!isRecord(parsed)) {
    const failed = new Error('Guest budget file is missing revision or state');
    failed.code = 'EBADJSON';
    throw failed;
  }
  return { empty: false, revision: parsed.revision, state: parsed.state };
}

/**
 * @param {string} file
 * @param {{ baseRevision: number, state: object }} next
 */
export async function writeGuestBudget(file, next) {
  if (!next || typeof next.state !== 'object' || next.state === null || Array.isArray(next.state)) {
    const error = new Error('Guest budget state must be a JSON object');
    error.status = 400;
    throw error;
  }
  const payload = JSON.stringify({ revision: 0, state: next.state });
  if (Buffer.byteLength(payload) > MAX_GUEST_BUDGET_BYTES) {
    const error = new Error('Guest budget is too large');
    error.status = 413;
    throw error;
  }

  return enqueue(async () => {
    const current = await readGuestBudget(file);
    const base = Number(next.baseRevision);
    if (!Number.isInteger(base) || base < 0) {
      const error = new Error('baseRevision must be a non-negative integer');
      error.status = 400;
      throw error;
    }
    if (base !== current.revision) {
      const error = new Error('Guest budget was updated by another browser');
      error.status = 409;
      error.record = current;
      throw error;
    }
    const revision = current.revision + 1;
    const body = JSON.stringify({ revision, state: next.state });
    await mkdir(dirname(file), { recursive: true });
    const temporary = `${file}.tmp`;
    await writeFile(temporary, body);
    await rename(temporary, file);
    return { empty: false, revision, state: next.state };
  });
}

export async function deleteGuestBudget(file) {
  return enqueue(async () => {
    try {
      await unlink(file);
    } catch (error) {
      if (!error || error.code !== 'ENOENT') throw error;
    }
    return emptyRecord();
  });
}

function send(response, status, body) {
  const payload = body === undefined ? '' : JSON.stringify(body);
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  response.end(payload);
}

export function createGuestBudgetServer(file) {
  return createServer(async (request, response) => {
    try {
      const url = new URL(request.url || '/', 'http://127.0.0.1');
      if (url.pathname !== GUEST_BUDGET_PATH) {
        send(response, 404, { error: 'Not found' });
        return;
      }
      if (request.method === 'GET') {
        send(response, 200, await readGuestBudget(file));
        return;
      }
      if (request.method === 'DELETE') {
        send(response, 200, await deleteGuestBudget(file));
        return;
      }
      if (request.method === 'PUT') {
        const chunks = [];
        let size = 0;
        for await (const chunk of request) {
          size += chunk.length;
          if (size > MAX_GUEST_BUDGET_BYTES) {
            send(response, 413, { error: 'Guest budget is too large' });
            return;
          }
          chunks.push(chunk);
        }
        let body;
        try {
          body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        } catch {
          send(response, 400, { error: 'Body must be JSON' });
          return;
        }
        try {
          send(response, 200, await writeGuestBudget(file, body));
        } catch (error) {
          if (error && error.status === 409) {
            send(response, 409, error.record);
            return;
          }
          send(response, error.status || 500, { error: error.message || 'Write failed' });
        }
        return;
      }
      send(response, 405, { error: 'Method not allowed' });
    } catch (error) {
      send(response, 500, { error: error.message || 'Guest budget store failed' });
    }
  });
}

export function startGuestBudgetServer(file, host = '127.0.0.1', port = 8091) {
  const server = createGuestBudgetServer(file);
  server.listen(port, host);
  return server;
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  const file = process.env.GUEST_BUDGET_FILE || '/data/guest-budget.json';
  const port = Number(process.env.GUEST_BUDGET_PORT || 8091);
  const server = startGuestBudgetServer(file, '127.0.0.1', port);
  server.on('listening', () => {
    console.log(`[guest-budget] listening on 127.0.0.1:${port} file=${file}`);
  });
}
