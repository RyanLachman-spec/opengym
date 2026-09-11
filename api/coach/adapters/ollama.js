/* Ollama running on the same machine as this server — no CLI to spawn, no credential to hold.
 * The interface is the same one every other adapter speaks (see adapters/index.js), but the
 * shape underneath is different: a plain HTTP call from this process instead of a sandboxed
 * subprocess. That's a smaller blast radius, not a bigger one — there is no arbitrary code
 * running on the Coach's behalf, only a request to an address the admin configured themselves.
 *
 * Ollama's own /api/chat (not the OpenAI-compatible route) is used deliberately: its
 * `format: "json"` forces the reply to be syntactically valid JSON, which is the single
 * biggest reliability gap between a small local model and a frontier one on this task — most
 * of what would otherwise show up as "the answer was not JSON" never happens at all.
 */
const DEFAULT_BASE_URL = 'http://host.docker.internal:11434';

const baseUrlOf = cfg => String((cfg && cfg.baseUrl) || DEFAULT_BASE_URL).replace(/\/+$/, '');

async function listModels(base) {
  const r = await fetch(base + '/api/tags', { signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const data = await r.json();
  return (data.models || []).map(m => m.name);
}

const ollama = {
  id: 'ollama',
  runtime: 'Ollama',

  async check(cfg) {
    const base = baseUrlOf(cfg);
    let names;
    try { names = await listModels(base); }
    catch (e) { return { ok: false, error: `can't reach Ollama at ${base} — is it running on this machine? (${e.message})` }; }
    if (cfg?.model && !names.includes(cfg.model)) {
      return { ok: false, error: `"${cfg.model}" is not pulled on this Ollama — run: ollama pull ${cfg.model}` };
    }
    return { ok: true, version: names.length ? `${names.length} model(s) available` : 'reachable, nothing pulled yet' };
  },

  async invoke({ cfg, prompt, model, timeoutMs }) {
    const base = baseUrlOf(cfg);
    const useModel = model || cfg?.model;
    if (!useModel) return { code: 1, text: '', stderr: 'no Ollama model configured', timedOut: false, spawnError: false };

    let r;
    try {
      r = await fetch(base + '/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: useModel,
          messages: [{ role: 'user', content: prompt }],
          stream: false,
          format: 'json',
          options: { temperature: 0.2 }
        }),
        signal: AbortSignal.timeout(timeoutMs)
      });
    } catch (e) {
      const timedOut = e.name === 'TimeoutError' || e.name === 'AbortError';
      return { code: -1, text: '', stderr: e.message, timedOut, spawnError: !timedOut };
    }

    if (!r.ok) {
      const body = await r.text().catch(() => '');
      return { code: 1, text: '', stderr: `Ollama HTTP ${r.status}: ${body.slice(0, 300)}`, timedOut: false, spawnError: false };
    }
    const data = await r.json().catch(() => null);
    const text = data?.message?.content;
    if (!text) return { code: 1, text: '', stderr: 'Ollama returned no content', timedOut: false, spawnError: false };
    return { code: 0, text: text.trim(), stderr: '', timedOut: false, spawnError: false };
  }
};

export default ollama;
