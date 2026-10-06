/*! incdai public SDK v0.6.0 · Copyright 2026 INCPRITECH · PolyForm Perimeter 1.0.1
 * Use a incdai assistant from any software: browsers, Node.js 22+, Deno, Bun, workers.
 *
 *   import { Incdai } from "https://api.incdai.incpritech.com/sdk.js";
 *   const incdai = new Incdai({ api: "https://api.incdai.incpritech.com", site: "your-site" });
 *
 *   for await (const piece of incdai.stream("Mnafungua saa ngapi?")) process.stdout.write(piece);   // streamed text
 *   const { text, answered } = await incdai.answer("Do you deliver?");                               // whole answer
 *
 *   const live = incdai.live({ wake: "hey incdai" });        // real-time voice, like a phone call
 *   live.on("transcript", (e) => console.log("you:", e.text));
 *   live.on("token", (e) => console.log(e.text));
 *   await live.start();                                      // browser: opens the microphone and speaker for you
 */

export class Incdai {
  /** @param {{api: string, site: string, liveApi?: string, fetch?: typeof fetch}} options */
  constructor({ api, site, liveApi, fetch: f } = {}) {
    if (!api || !site) throw new Error("incdai: api and site are required");
    this.api = api.replace(/\/$/, "");
    // Vercel serves the branded HTTP API; live voice stays on the Worker because
    // external Vercel rewrites do not forward WebSocket upgrades.
    this.liveApi = (liveApi || (this.api === "https://api.incdai.incpritech.com"
      ? "https://incdai-cloud.depriver-tech.workers.dev"
      : this.api)).replace(/\/$/, "");
    this.site = site;
    this._fetch = f || globalThis.fetch.bind(globalThis);
    this.history = [];
  }

  _url(path) { return `${this.api}/v1/sites/${encodeURIComponent(this.site)}/${path}`; }
  _liveUrl(path) { return `${this.liveApi}/v1/sites/${encodeURIComponent(this.site)}/${path}`; }

  async _json(r) {
    const body = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error(body.error || `incdai: request failed (${r.status})`), { status: r.status });
    return body;
  }

  /** The assistant's public settings (name, greeting, languages, voice, …). */
  async config() { return this._json(await this._fetch(this._url("config"))); }

  /**
   * Ask a question and stream the answer as events: {type: "token", text} … then {type: "done", answered, language, sources, handoff}.
   * @param {string} question
   * @param {{history?: Array<{role: string, content: string}>, language?: "en"|"sw", spoken?: boolean, signal?: AbortSignal, remember?: boolean}} [options]
   */
  async *events(question, { history, language, spoken = false, signal, remember = true } = {}) {
    const r = await this._fetch(this._url("ask"), {
      method: "POST", signal, headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, history: history ?? this.history, ...(language ? { language } : {}), ...(spoken ? { mode: "voice" } : {}) }),
    });
    if (!r.ok || !r.body) await this._json(r);
    const reader = r.body.pipeThrough(new TextDecoderStream()).getReader();
    let buf = "", text = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += value;
      const lines = buf.split("\n");
      buf = lines.pop() || "";
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        let ev; try { ev = JSON.parse(line.slice(5)); } catch { continue; }
        if (ev.type === "token") text += ev.text;
        if (ev.type === "done" && remember && !history) this._remember(question, text);
        yield ev;
      }
    }
  }

  /** Stream only the answer text. */
  async *stream(question, options) {
    for await (const ev of this.events(question, options)) if (ev.type === "token") yield ev.text;
  }

  /** The whole answer at once: {text, answered, language, sources, handoff}. */
  async answer(question, options) {
    let text = "", done = {};
    for await (const ev of this.events(question, options)) ev.type === "token" ? (text += ev.text) : (done = ev);
    return { ...done, text };
  }

  /** Forget the conversation so far. */
  reset() { this.history = []; }
  _remember(q, a) { this.history = [...this.history, { role: "user", content: q }, { role: "assistant", content: a }].slice(-8); }

  /** Speech to text for one recording (webm, mp4, ogg, wav or mp3): {text, language}. */
  async transcribe(audio, type = audio?.type || "audio/webm") {
    return this._json(await this._fetch(this._url("transcribe"), { method: "POST", headers: { "Content-Type": type }, body: audio }));
  }

  /** Text to speech (English voices): an ArrayBuffer of MP3 audio. */
  async speak(text, { voice } = {}) {
    const r = await this._fetch(this._url("speak"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, voice }) });
    if (!r.ok) await this._json(r);
    return r.arrayBuffer();
  }

  /** Leave contact details for the business. */
  async lead({ name, contact, message = "" }) {
    return this._json(await this._fetch(this._url("leads"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, contact, message }) }));
  }

  /**
   * A real-time voice conversation. See LiveSession.
   * @param {LiveOptions} [options]
   */
  live(options = {}) { return new LiveSession(this, options); }
}

/**
 * @typedef {object} LiveOptions
 * @property {"server"|"client"|"none"} [speak="server"]  who voices the answers: incdai's natural voices (English and Swahili;
 *                                                         the device's voice when the plan doesn't include them), the device's own voice, or nobody
 * @property {string} [voice]          English voice: luna, asteria, orion, … (default from the assistant's profile)
 * @property {string} [voiceSw]        Swahili voice: rehema, daudi (Tanzania), zuri, rafiki (Kenya)
 * @property {boolean} [sounds]        browser: soft sounds when incdai hears you and when the wake word is heard (default true)
 * @property {string} [wake]           wake word, e.g. "hey incdai": only answer when called (follow-ups for 20 s don't need it)
 * @property {"en"|"sw"} [language]    answer language; default: the language the person speaks
 * @property {boolean} [microphone]    browser: capture the microphone on start() (default true in browsers)
 * @property {boolean} [playback]      browser: play incdai's voice (default true in browsers)
 * @property {boolean} [bargeIn=true]  let the person interrupt by talking; false mutes the microphone while incdai speaks
 */

const IN_RATE = 16000, OUT_RATE = 24000;
const isBrowser = typeof window !== "undefined" && typeof navigator !== "undefined";

export class LiveSession {
  constructor(incdai, options = {}) {
    this.incdai = incdai;
    this.options = { speak: "server", bargeIn: true, microphone: isBrowser, playback: isBrowser, sounds: isBrowser, ...options };
    this.handlers = new Map();
    this.state = "idle";        // idle | connecting | listening | hearing | thinking | speaking | closed
    this.ws = null;
    this._audio = null;         // browser audio graph
    this._sources = new Set();
    this._nextTime = 0;
    this._synth = 0;            // client-side sentences still being spoken
    this._replying = false;
    this._format = "pcm";       // format of the next binary frame, from the last "speak" event
    this._audioChain = Promise.resolve();   // keeps speech in order while MP3 sentences decode
    this._gen = 0;
  }

  /** Listen for an event: ready, state, level, speech_started, speech_ended, transcript, wake, token, speak, audio, done, interrupted, error, close. */
  on(type, fn) { if (!this.handlers.has(type)) this.handlers.set(type, new Set()); this.handlers.get(type).add(fn); return () => this.handlers.get(type).delete(fn); }
  _emit(type, data = {}) { for (const fn of this.handlers.get(type) || []) try { fn({ type, ...data }); } catch (e) { console.error(e); } for (const fn of this.handlers.get("*") || []) try { fn({ type, ...data }); } catch {} }
  _setState(s) { if (s !== this.state) { this.state = s; this._emit("state", { state: s }); } }

  /** Connect, then (in a browser) open the microphone and speaker. Resolves when ready. */
  async start() {
    await this.connect();
    if (this.options.playback) this._ensureAudio();
    if (this.options.microphone) await this.startMicrophone();
    return this;
  }

  /** Open the WebSocket only. Send audio yourself with sendAudio(). */
  connect() {
    if (this.ws) return this._ready;
    this._setState("connecting");
    const url = this.incdai._liveUrl("live").replace(/^http/, "ws");
    const ws = (this.ws = new WebSocket(url));
    ws.binaryType = "arraybuffer";
    this._ready = new Promise((resolve, reject) => {
      ws.onopen = () => ws.send(JSON.stringify({ type: "hello", speak: this.options.speak, voice: this.options.voice, voice_sw: this.options.voiceSw,
        wake: this.options.wake, language: this.options.language, history: this.options.history ?? this.incdai.history,
        // MP3 needs decoding: browsers do it; elsewhere ask for it with options.formats
        formats: this.options.formats || (this.options.playback ? ["pcm", "mp3"] : ["pcm"]) }));
      ws.onerror = () => { reject(new Error("incdai: could not connect for live voice")); this._emit("error", { message: "Connection failed" }); };
      ws.onclose = (e) => { this._cleanup(); this._setState("closed"); this._emit("close", { code: e.code, reason: e.reason }); };
      ws.onmessage = (e) => {
        if (typeof e.data !== "string") return this._onAudio(e.data);
        let ev; try { ev = JSON.parse(e.data); } catch { return; }
        this._onEvent(ev, resolve);
      };
    });
    return this._ready;
  }

  _onEvent(ev, resolve) {
    switch (ev.type) {
      case "ready": this._setState("listening"); resolve?.(this); break;
      case "speech_started": this._stopPlayback(); this._setState("hearing"); break;
      case "speech_ended": if (!this._replying) this._setState("thinking"); this._chime("heard"); break;
      case "wake": this._chime("wake"); break;
      case "transcript": if (!ev.text || ev.ignored) this._setState(this._busy() ? "speaking" : "listening"); else { this._replying = true; this._setState("thinking"); } break;
      // sentences the server can't voice (e.g. Swahili) are read by the device's own voice
      case "speak":
        this._format = ev.audio ? ev.format || "pcm" : this._format;
        if (!ev.audio && this.options.speak !== "none" && this.options.playback) this._say(ev.speech || ev.text, ev.language);
        break;
      case "done":
        this._replying = false;
        if (ev.text) this.incdai._remember(this._lastQuestion || "", ev.text);
        if (!this._busy()) this._setState("listening");
        break;
      case "interrupted": this._replying = false; break;
      case "audio_clear": this._stopPlayback(); break;
    }
    if (ev.type === "transcript" && ev.text && !ev.ignored) this._lastQuestion = ev.text;
    this._emit(ev.type, ev);
  }

  /** Send microphone audio: 16-bit PCM, mono, 16 kHz (Int16Array or ArrayBuffer). */
  sendAudio(pcm) {
    if (this.ws?.readyState !== 1) return;
    if (!this.options.bargeIn && this._busy()) return;   // muted while incdai speaks
    this.ws.send(pcm instanceof ArrayBuffer ? pcm : pcm.buffer.slice(pcm.byteOffset, pcm.byteOffset + pcm.byteLength));
  }
  /** A typed turn in the same conversation. */
  sendText(text) { this._send({ type: "text", text }); this._stopPlayback(); }
  /** Push-to-talk: answer what was said so far. */
  endTurn() { this._send({ type: "end_turn" }); }
  /** Stop incdai talking. */
  interrupt() { this._send({ type: "interrupt" }); this._stopPlayback(); }
  /** End the conversation. */
  close() { this._send({ type: "bye" }); try { this.ws?.close(); } catch {} this._cleanup(); }
  _send(obj) { if (this.ws?.readyState === 1) this.ws.send(JSON.stringify(obj)); }
  _busy() { return this._replying || this._sources.size > 0 || this._synth > 0; }

  // ── speaker ───────────────────────────────────────────────────────────
  _onAudio(buf) {
    if (this._format === "mp3") {
      this._emit("audio", { mp3: buf, format: "mp3" });
      if (!this.options.playback || !this._ensureAudio()) return;
      const ctx = this._audio.ctx, gen = this._gen;
      const decoded = ctx.decodeAudioData(buf.slice(0)).catch(() => null);
      this._audioChain = this._audioChain.then(async () => { const b = await decoded; if (b && gen === this._gen) this._schedule(b); });
      return;
    }
    const pcm = new Int16Array(buf);
    this._emit("audio", { pcm, sampleRate: OUT_RATE, format: "pcm" });
    if (!this.options.playback || !this._ensureAudio()) return;
    const ctx = this._audio.ctx, f = new Float32Array(pcm.length), gen = this._gen;
    for (let i = 0; i < pcm.length; i++) f[i] = pcm[i] / 32768;
    const b = ctx.createBuffer(1, f.length, OUT_RATE);
    b.copyToChannel(f, 0);
    this._audioChain = this._audioChain.then(() => { if (gen === this._gen) this._schedule(b); });
  }

  _schedule(buffer) {
    const ctx = this._audio?.ctx;
    if (!ctx) return;
    const src = ctx.createBufferSource();
    src.buffer = buffer; src.connect(ctx.destination);
    this._nextTime = Math.max(this._nextTime, ctx.currentTime + 0.04);
    src.start(this._nextTime);
    this._nextTime += buffer.duration;
    this._sources.add(src);
    this._setState("speaking");
    src.onended = () => { this._sources.delete(src); if (!this._busy()) this._setState("listening"); };
  }

  // soft cues: a tick when incdai heard you, a chime when it heard its wake word
  _chime(kind) {
    if (!this.options.sounds || !this.options.playback || !this._ensureAudio()) return;
    const ctx = this._audio.ctx, t = ctx.currentTime + 0.01;
    const notes = kind === "wake" ? [[880, 0, 0.12]] : [[587.3, 0, 0.07]];
    for (const [hz, at, len] of notes) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = hz; o.type = "sine";
      g.gain.setValueAtTime(0, t + at); g.gain.linearRampToValueAtTime(kind === "wake" ? 0.12 : 0.07, t + at + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + at + len);
      o.connect(g); g.connect(ctx.destination); o.start(t + at); o.stop(t + at + len + 0.02);
    }
  }

  _say(text, language) {
    const syn = isBrowser && window.speechSynthesis;
    if (!syn) return;
    const u = new SpeechSynthesisUtterance(text);
    const voices = syn.getVoices().filter((v) => v.lang.toLowerCase().replace("_", "-").startsWith(language));
    const v = voices.find((x) => /natural|neural|online|google|premium|enhanced/i.test(x.name)) || voices[0];
    if (v) u.voice = v;
    u.lang = v ? v.lang : language === "sw" ? "sw-TZ" : "en-US";
    this._synth++;
    let ended = false;
    const fin = () => { if (ended) return; ended = true; this._synth = Math.max(0, this._synth - 1); if (!this._busy()) this._setState("listening"); };
    u.onend = u.onerror = fin;
    setTimeout(fin, 4000 + text.length * 110);
    this._setState("speaking");
    syn.speak(u);
  }

  _stopPlayback() {
    this._gen = (this._gen || 0) + 1;   // drop sentences still decoding
    this._audioChain = Promise.resolve();
    for (const s of this._sources) { try { s.onended = null; s.stop(); } catch {} }
    this._sources.clear();
    this._nextTime = 0;
    if (this._synth && isBrowser) { window.speechSynthesis?.cancel(); this._synth = 0; }
  }

  _ensureAudio() {
    if (!isBrowser) return false;
    if (!this._audio) {
      const AC = window.AudioContext || window.webkitAudioContext;
      this._audio = { ctx: new AC() };
    }
    if (this._audio.ctx.state === "suspended") this._audio.ctx.resume().catch(() => {});
    return true;
  }

  // ── microphone (browser) ──────────────────────────────────────────────
  async startMicrophone() {
    if (!isBrowser) throw new Error("incdai: startMicrophone() needs a browser. In other runtimes, call sendAudio() with 16 kHz PCM.");
    this._ensureAudio();
    const ctx = this._audio.ctx;
    // clean voice only: the browser's echo cancellation, noise suppression and (where supported) voice isolation
    const clean = { echoCancellation: true, noiseSuppression: true, autoGainControl: true, voiceIsolation: true, channelCount: 1 };
    const stream = await navigator.mediaDevices.getUserMedia({ audio: clean });
    const track = stream.getAudioTracks()[0];
    const got = track?.getSettings?.() || {};
    if (track && (got.noiseSuppression === false || got.echoCancellation === false)) {
      await track.applyConstraints({ echoCancellation: { exact: true }, noiseSuppression: { exact: true } }).catch(() => {});
    }
    const worklet = `class C extends AudioWorkletProcessor{process(i){const c=i[0]&&i[0][0];if(c)this.port.postMessage(c.slice(0));return true}}registerProcessor("incdai-capture",C)`;
    const url = URL.createObjectURL(new Blob([worklet], { type: "application/javascript" }));
    await ctx.audioWorklet.addModule(url);
    URL.revokeObjectURL(url);
    const src = ctx.createMediaStreamSource(stream);
    const node = new AudioWorkletNode(ctx, "incdai-capture");
    const mute = ctx.createGain(); mute.gain.value = 0;
    // drop rumble, hum and wind below the voice before it is sent (the server cleans the rest)
    const hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 90;
    src.connect(hp); hp.connect(node); node.connect(mute); mute.connect(ctx.destination);
    const ratio = ctx.sampleRate / IN_RATE, frame = IN_RATE * 0.04;   // send 40 ms frames
    let acc = [], pos = 0, carry = new Float32Array(0);
    node.port.onmessage = ({ data }) => {
      const input = carry.length ? Float32Array.from([...carry, ...data]) : data;
      let sum = 0;
      for (; pos + ratio <= input.length; pos += ratio) {   // average-downsample to 16 kHz
        const a = Math.floor(pos), b = Math.min(input.length, Math.floor(pos + ratio));
        let s = 0; for (let k = a; k < b; k++) s += input[k];
        const x = s / Math.max(1, b - a); sum += x * x;
        acc.push(Math.max(-1, Math.min(1, x)));
      }
      const used = Math.floor(pos);
      carry = input.slice(used); pos -= used;
      if (acc.length >= frame) {
        const pcm = new Int16Array(acc.length);
        for (let i = 0; i < acc.length; i++) pcm[i] = acc[i] * 32767;
        this._emit("level", { level: Math.min(1, Math.sqrt(sum / Math.max(1, acc.length)) * 6) });
        this.sendAudio(pcm);
        acc = [];
      }
    };
    this._mic = { stream, src, hp, node };
  }

  stopMicrophone() {
    if (!this._mic) return;
    this._mic.node.port.onmessage = null;
    try { this._mic.src.disconnect(); this._mic.hp.disconnect(); this._mic.node.disconnect(); } catch {}
    this._mic.stream.getTracks().forEach((t) => t.stop());
    this._mic = null;
  }

  _cleanup() {
    this.stopMicrophone();
    this._stopPlayback();
    if (this._audio) { this._audio.ctx.close().catch(() => {}); this._audio = null; }
  }
}

export default Incdai;
