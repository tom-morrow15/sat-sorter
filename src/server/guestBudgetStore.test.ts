import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  createGuestBudgetServer,
  deleteGuestBudget,
  readGuestBudget,
  writeGuestBudget,
} from './guestBudgetStore.mjs';

const directories: string[] = [];

async function storePath(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'guest-budget-'));
  directories.push(directory);
  return join(directory, 'guest-budget.json');
}

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe('guest budget file', () => {
  it('starts empty, writes a revision, and keeps it after a new read', async () => {
    const file = await storePath();
    expect(await readGuestBudget(file)).toEqual({ empty: true, revision: 0 });
    const saved = await writeGuestBudget(file, { baseRevision: 0, state: { currency: 'usd', budgets: [] } });
    expect(saved.revision).toBe(1);
    const again = await readGuestBudget(file);
    expect(again.revision).toBe(1);
    expect(again.state.currency).toBe('usd');
  });

  it('refuses a stale write and leaves the first budget in place', async () => {
    const file = await storePath();
    await writeGuestBudget(file, { baseRevision: 0, state: { name: 'first' } });
    await expect(writeGuestBudget(file, { baseRevision: 0, state: { name: 'second' } })).rejects.toMatchObject({ status: 409 });
    const current = await readGuestBudget(file);
    expect(current.state.name).toBe('first');
    expect(current.revision).toBe(1);
  });

  it('rejects a budget over the size limit', async () => {
    const file = await storePath();
    const huge = 'x'.repeat(2 * 1024 * 1024);
    await expect(writeGuestBudget(file, { baseRevision: 0, state: { huge } })).rejects.toMatchObject({ status: 413 });
    expect((await readGuestBudget(file)).empty).toBe(true);
  });

  it('deletes the file back to empty', async () => {
    const file = await storePath();
    await writeGuestBudget(file, { baseRevision: 0, state: { ok: true } });
    expect(await deleteGuestBudget(file)).toEqual({ empty: true, revision: 0 });
    expect((await readGuestBudget(file)).empty).toBe(true);
  });
});

describe('guest budget http', () => {
  it('lets a second client read what the first client saved, including after a restart', async () => {
    const file = await storePath();
    const first = createGuestBudgetServer(file);
    const port = await listen(first);
    const saved = await request(port, 'PUT', { baseRevision: 0, state: { label: 'from browser A' } });
    expect(saved.status).toBe(200);
    const seen = await request(port, 'GET');
    expect(seen.body.state.label).toBe('from browser A');
    await close(first);

    const restarted = createGuestBudgetServer(file);
    const nextPort = await listen(restarted);
    const afterRestart = await request(nextPort, 'GET');
    expect(afterRestart.body.state.label).toBe('from browser A');
    expect(afterRestart.body.revision).toBe(1);
    await close(restarted);
  });
});

function listen(server: ReturnType<typeof createGuestBudgetServer>): Promise<number> {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      resolve(typeof address === 'object' && address ? address.port : 0);
    });
  });
}

function close(server: ReturnType<typeof createGuestBudgetServer>): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}

async function request(port: number, method: string, body?: unknown): Promise<{ status: number; body: { revision: number; state: { label: string } } }> {
  const response = await fetch(`http://127.0.0.1:${port}/api/guest-budget`, {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: response.status, body: await response.json() };
}
