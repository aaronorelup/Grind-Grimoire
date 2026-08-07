// Generates ALL game audio via the ElevenLabs API into public/audio/.
// Idempotent: skips files that already exist. Run: npm run audio
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { VOICES, LINES, SFX_DEFS, MUSIC_DEFS } from '../src/dialogue.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'public', 'audio');
const API = 'https://api.elevenlabs.io';

async function loadKey() {
  const env = await readFile(path.join(root, '.env'), 'utf8');
  const m = env.match(/ELEVENLABS_API_KEY\s*=\s*"?([^"\r\n]+)"?/);
  if (!m) throw new Error('ELEVENLABS_API_KEY not found in .env');
  return m[1].trim();
}

const KEY = await loadKey();

async function exists(p) {
  try { const s = await stat(p); return s.size > 1000; } catch { return false; }
}

async function call(url, body, attempt = 1) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'xi-api-key': KEY, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    body: JSON.stringify(body),
  });
  if (res.ok) return Buffer.from(await res.arrayBuffer());
  const text = await res.text().catch(() => '');
  if ((res.status === 429 || res.status >= 500) && attempt <= 4) {
    const wait = 3000 * attempt;
    console.log(`  retry in ${wait}ms (${res.status})`);
    await new Promise(r => setTimeout(r, wait));
    return call(url, body, attempt + 1);
  }
  const err = new Error(`${res.status} ${text.slice(0, 300)}`);
  err.status = res.status;
  throw err;
}

async function tts(voiceId, text) {
  return call(`${API}/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`, {
    text,
    model_id: 'eleven_multilingual_v2',
    voice_settings: { stability: 0.4, similarity_boost: 0.8, style: 0.3 },
  });
}

async function sfx(prompt, seconds) {
  return call(`${API}/v1/sound-generation?output_format=mp3_44100_128`, {
    text: prompt,
    duration_seconds: Math.min(22, Math.max(0.5, seconds)),
    prompt_influence: 0.4,
  });
}

let musicAvailable = true;
async function music(prompt, ms) {
  if (musicAvailable) {
    for (const ep of ['/v1/music?output_format=mp3_44100_128', '/v1/music/compose?output_format=mp3_44100_128']) {
      try {
        return await call(`${API}${ep}`, { prompt, music_length_ms: ms });
      } catch (e) {
        console.log(`  music endpoint ${ep} failed: ${e.message.slice(0, 160)}`);
        if (e.status === 401 || e.status === 403 || e.status === 404 || e.status === 422 || e.status === 400) continue;
        throw e;
      }
    }
    musicAvailable = false;
    console.log('  -> Eleven Music unavailable on this plan; falling back to 22s sound-generation loops.');
  }
  return sfx(`instrumental music loop: ${prompt}`, 22);
}

async function usage() {
  const res = await fetch(`${API}/v1/user/subscription`, { headers: { 'xi-api-key': KEY } });
  const j = await res.json();
  return `${j.character_count}/${j.character_limit}`;
}

console.log('Credits before:', await usage());
await mkdir(path.join(outDir, 'voice'), { recursive: true });
await mkdir(path.join(outDir, 'sfx'), { recursive: true });
await mkdir(path.join(outDir, 'music'), { recursive: true });

const manifest = { voice: {}, sfx: {}, music: {} };
let made = 0, skipped = 0, failed = 0;

// ---- Voice lines ----
for (const [id, line] of Object.entries(LINES)) {
  const file = path.join(outDir, 'voice', `${id}.mp3`);
  manifest.voice[id] = `voice/${id}.mp3`;
  if (await exists(file)) { skipped++; continue; }
  try {
    process.stdout.write(`voice ${id} (${line.speaker})... `);
    await writeFile(file, await tts(VOICES[line.v], line.text));
    console.log('ok'); made++;
  } catch (e) { console.log('FAILED', e.message.slice(0, 200)); failed++; delete manifest.voice[id]; }
}

// ---- Sound effects ----
for (const [id, def] of Object.entries(SFX_DEFS)) {
  const file = path.join(outDir, 'sfx', `${id}.mp3`);
  manifest.sfx[id] = `sfx/${id}.mp3`;
  if (await exists(file)) { skipped++; continue; }
  try {
    process.stdout.write(`sfx ${id}... `);
    await writeFile(file, await sfx(def.prompt, def.seconds));
    console.log('ok'); made++;
  } catch (e) { console.log('FAILED', e.message.slice(0, 200)); failed++; delete manifest.sfx[id]; }
}

// ---- Music ----
for (const [id, def] of Object.entries(MUSIC_DEFS)) {
  const file = path.join(outDir, 'music', `${id}.mp3`);
  manifest.music[id] = `music/${id}.mp3`;
  if (await exists(file)) { skipped++; continue; }
  try {
    process.stdout.write(`music ${id}... `);
    await writeFile(file, await music(def.prompt, def.ms));
    console.log('ok'); made++;
  } catch (e) { console.log('FAILED', e.message.slice(0, 200)); failed++; delete manifest.music[id]; }
}

await writeFile(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log(`\nDone. generated=${made} skipped=${skipped} failed=${failed}`);
console.log('Credits after:', await usage());
