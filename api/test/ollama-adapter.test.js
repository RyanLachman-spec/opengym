import test from 'node:test';
import assert from 'node:assert/strict';
import ollama from '../coach/adapters/ollama.js';

/* No temp DATA_DIR needed here — this adapter reads nothing from disk, only cfg.baseUrl/model
 * and a stubbed global.fetch. Node runs this file in its own process, so the stub never leaks
 * into another test file. */

function stubFetch(handler) {
  const original = global.fetch;
  global.fetch = handler;
  return () => { global.fetch = original; };
}

test('check() passes when the base URL is reachable and the model is pulled', async () => {
  const restore = stubFetch(async url => {
    assert.ok(String(url).endsWith('/api/tags'));
    return { ok: true, json: async () => ({ models: [{ name: 'llama3.1:8b' }, { name: 'qwen2.5:14b' }] }) };
  });
  try {
    const r = await ollama.check({ model: 'llama3.1:8b' });
    assert.equal(r.ok, true);
    assert.match(r.version, /2 model/);
  } finally { restore(); }
});

test('check() fails with a specific message when the configured model is not pulled', async () => {
  const restore = stubFetch(async () => ({ ok: true, json: async () => ({ models: [{ name: 'llama3.1:8b' }] }) }));
  try {
    const r = await ollama.check({ model: 'mistral:7b' });
    assert.equal(r.ok, false);
    assert.match(r.error, /not pulled/);
    assert.match(r.error, /ollama pull mistral:7b/);
  } finally { restore(); }
});

test('check() fails clearly when Ollama is not reachable at all', async () => {
  const restore = stubFetch(async () => { throw new Error('ECONNREFUSED'); });
  try {
    const r = await ollama.check({});
    assert.equal(r.ok, false);
    assert.match(r.error, /can't reach Ollama/);
  } finally { restore(); }
});

test('invoke() sends the prompt as a user message and asks for JSON mode', async () => {
  let sentBody;
  const restore = stubFetch(async (url, opts) => {
    assert.ok(String(url).endsWith('/api/chat'));
    sentBody = JSON.parse(opts.body);
    return { ok: true, json: async () => ({ message: { content: '{"coach_contract":1}' } }) };
  });
  try {
    const r = await ollama.invoke({ cfg: { model: 'llama3.1:8b' }, prompt: 'do the thing', timeoutMs: 5000 });
    assert.equal(r.code, 0);
    assert.equal(r.text, '{"coach_contract":1}');
    assert.equal(sentBody.model, 'llama3.1:8b');
    assert.equal(sentBody.format, 'json');
    assert.deepEqual(sentBody.messages, [{ role: 'user', content: 'do the thing' }]);
  } finally { restore(); }
});

test('invoke() prefers an explicit model over the stored config default', async () => {
  let sentBody;
  const restore = stubFetch(async (url, opts) => {
    sentBody = JSON.parse(opts.body);
    return { ok: true, json: async () => ({ message: { content: '{}' } }) };
  });
  try {
    await ollama.invoke({ cfg: { model: 'llama3.1:8b' }, model: 'qwen2.5:14b', prompt: 'x', timeoutMs: 1000 });
    assert.equal(sentBody.model, 'qwen2.5:14b');
  } finally { restore(); }
});

test('invoke() reports a missing model as a config error, not a network one', async () => {
  const r = await ollama.invoke({ cfg: {}, prompt: 'x', timeoutMs: 1000 });
  assert.equal(r.code, 1);
  assert.equal(r.spawnError, false);
  assert.match(r.stderr, /no Ollama model configured/);
});

test('invoke() surfaces an HTTP error from Ollama without pretending it timed out', async () => {
  const restore = stubFetch(async () => ({ ok: false, status: 500, text: async () => 'model crashed' }));
  try {
    const r = await ollama.invoke({ cfg: { model: 'llama3.1:8b' }, prompt: 'x', timeoutMs: 1000 });
    assert.equal(r.code, 1);
    assert.equal(r.timedOut, false);
    assert.match(r.stderr, /HTTP 500/);
  } finally { restore(); }
});

test('invoke() reports a connection failure as spawnError (Ollama is not running), not a timeout', async () => {
  const restore = stubFetch(async () => { throw new Error('connect ECONNREFUSED'); });
  try {
    const r = await ollama.invoke({ cfg: { model: 'llama3.1:8b' }, prompt: 'x', timeoutMs: 1000 });
    assert.equal(r.spawnError, true);
    assert.equal(r.timedOut, false);
  } finally { restore(); }
});

test('invoke() distinguishes an actual timeout from a connection failure', async () => {
  const restore = stubFetch(async () => { const e = new Error('timed out'); e.name = 'TimeoutError'; throw e; });
  try {
    const r = await ollama.invoke({ cfg: { model: 'llama3.1:8b' }, prompt: 'x', timeoutMs: 1000 });
    assert.equal(r.timedOut, true);
    assert.equal(r.spawnError, false);
  } finally { restore(); }
});

test('invoke() treats an empty reply as an error rather than an empty success', async () => {
  const restore = stubFetch(async () => ({ ok: true, json: async () => ({ message: { content: '' } }) }));
  try {
    const r = await ollama.invoke({ cfg: { model: 'llama3.1:8b' }, prompt: 'x', timeoutMs: 1000 });
    assert.equal(r.code, 1);
    assert.match(r.stderr, /no content/);
  } finally { restore(); }
});
