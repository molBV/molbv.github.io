/* Option Trading Hero V4
   Offline browser game. No external libraries.
   V4 adds music playlist + volume controls and simulation levels generated from loaded candles.
   Live candles are drawn tick-by-tick from synthetic intrabar paths.
*/

(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const roundCent = (v) => Math.max(0.01, Math.round(v * 100) / 100);
  const fmtMoney = (v, decimals = Math.abs(v) < 100 ? 2 : 0) => {
    const s = v < 0 ? "-" : "";
    return s + "$" + Math.abs(v).toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  };
  const fmtPct = (v) => (v >= 0 ? "+" : "") + (v * 100).toFixed(1) + "%";
  const fmtOpt = (v) => "$" + roundCent(v).toFixed(2);

  function seededNoise(seed) {
    const x = Math.sin(seed * 999.1337) * 43758.5453;
    return x - Math.floor(x);
  }

  function hashString(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < String(str).length; i++) {
      h ^= String(str).charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function() {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function erf(x) {
    const sign = x >= 0 ? 1 : -1;
    x = Math.abs(x);
    const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
    const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
    const t = 1 / (1 + p * x);
    const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
    return sign * y;
  }
  const normCdf = (x) => 0.5 * (1 + erf(x / Math.sqrt(2)));

  function blackScholes(S, K, T, sigma, isCall) {
    if (T <= 0 || sigma <= 0) return Math.max(isCall ? S - K : K - S, 0);
    const r = 0.04;
    const sqrtT = Math.sqrt(T);
    const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * sqrtT);
    const d2 = d1 - sigma * sqrtT;
    if (isCall) return S * normCdf(d1) - K * Math.exp(-r * T) * normCdf(d2);
    return K * Math.exp(-r * T) * normCdf(-d2) - S * normCdf(-d1);
  }

  class Game {
    constructor() {
      this.canvas = $("game");
      this.ctx = this.canvas.getContext("2d", { alpha: false });
      this.audio = $("bgAudio");
      this.musicTracks = [
        "music/background.mp3",
        "music/solarflex-retro-arcade-game-music-491487.mp3",
        "music/mondamusic-retro-arcade-game-music-491667.mp3"
      ];
      this.trackIndex = 0;
      this.musicVolume = 0.42;
      this.level = window.DEFAULT_LEVEL || {};
      this.sourceLevelForSimulation = this.level;
      this.sourceLevelKey = "QQQ_2026_05_08";
      this.isSimulation = false;
      this.candles = [];
      this.vwap = [];
      this.cumPVBefore = [];
      this.cumVolBefore = [];
      this.intrabarPaths = [];
      this.symbol = "QQQ";
      this.date = "2026-05-08";
      this.levelKey = "QQQ_2026_05_08";

      this.bankrolls = { easy: 10000, normal: 1000, hard: 100 };
      this.difficulty = "normal";
      this.candleSeconds = 10;
      this.running = false;
      this.paused = false;
      this.ended = false;
      this.lastFrame = 0;
      this.gameMs = 0;
      this.cash = 1000;
      this.startCash = 1000;
      this.score = 0;
      this.combo = 0;
      this.bestCombo = 0;
      this.trades = [];
      this.position = null;
      this.currentChoices = [];
      this.currentRead = null;
      this.lastAutoSonicBlock = -1;
      this.messages = [];
      this.particles = [];
      this.shake = 0;
      this.musicOn = false;

      this.viewBars = 90;
      this.panOffsetBars = 0;
      this.dragging = false;
      this.dragLastX = 0;
      this.lastRenderedChainKey = "";

      this.normalizeLevel(this.level);
      this.bindEvents();
      this.resize();
      this.resetState(false);
      this.drawIdle();
    }

    bindEvents() {
      $("startBtn").addEventListener("click", () => this.start());
      $("restartBtn").addEventListener("click", () => this.restart());
      $("resumeBtn").addEventListener("click", () => this.togglePause(false));
      $("closeEndBtn").addEventListener("click", () => $("endOverlay").classList.remove("show"));
      $("runSonicBtn").addEventListener("click", () => this.runSonic("manual"));
      $("musicBtn").addEventListener("click", () => this.toggleMusic());
      $("generateSimBtn").addEventListener("click", () => { $("simSeed").value = `sim-${Date.now().toString(36)}`; this.generateSimulationLevel(); });
      $("volumeSlider").addEventListener("input", (e) => this.setMusicVolume(Number(e.target.value) / 100));
      $("levelModeSelect").addEventListener("change", (e) => {
        if (e.target.value === "recorded") this.restoreRecordedLevel();
        else this.toast("Simulation mode will generate a fresh level from the loaded candles.", "good");
      });
      if (this.audio) {
        this.audio.addEventListener("ended", () => this.nextTrack());
        this.loadTrack(0, false);
      }
      $("positionPanel").addEventListener("click", () => this.sellPosition("panel"));
      $("followBtn").addEventListener("click", () => { this.panOffsetBars = 0; this.toast("Following live candle."); });
      $("difficultySelect").addEventListener("change", (e) => { this.difficulty = e.target.value; this.updateHighScoreLine(); });
      $("speedSlider").addEventListener("input", (e) => {
        this.candleSeconds = Number(e.target.value);
        $("speedLabel").textContent = `${this.candleSeconds}s / candle · ${(60 / this.candleSeconds).toFixed(1)}x market speed`;
      });
      $("fileLoader").addEventListener("change", (e) => this.loadLevelFile(e));
      $("optionChain").addEventListener("click", (e) => {
        const btn = e.target.closest("button[data-dir]");
        if (!btn) return;
        this.buyOption(btn.dataset.dir, Number(btn.dataset.strike), this.selectedQty(), "chain");
      });
      $("choiceCards").addEventListener("click", (e) => {
        const card = e.target.closest(".choiceCard[data-choice]");
        if (!card) return;
        const choice = this.currentChoices[Number(card.dataset.choice)];
        if (choice) this.takeChoice(choice);
      });

      this.canvas.addEventListener("mousedown", (e) => this.onPointerDown(e));
      window.addEventListener("mousemove", (e) => this.onPointerMove(e));
      window.addEventListener("mouseup", () => this.onPointerUp());
      this.canvas.addEventListener("wheel", (e) => this.onWheel(e), { passive: false });
      this.canvas.addEventListener("dblclick", () => { this.viewBars = 90; this.panOffsetBars = 0; this.toast("Chart view reset."); });

      document.addEventListener("keydown", (e) => {
        if (e.target && ["INPUT", "SELECT", "TEXTAREA"].includes(e.target.tagName)) return;
        const key = e.key.toLowerCase();
        if (key === " " || key === "spacebar") { e.preventDefault(); this.runSonic("manual"); }
        else if (key === "s") this.sellPosition("keyboard");
        else if (key === "p") this.togglePause();
        else if (key === "r") this.restart();
        else if (key === "m") this.toggleMusic();
        else if (["1", "2", "3"].includes(key)) {
          const c = this.currentChoices[Number(key) - 1];
          if (c) this.takeChoice(c);
        }
      });
      window.addEventListener("resize", () => this.resize());
    }

    normalizeLevel(json) {
      this.level = json || {};
      this.symbol = this.level.symbol || this.level.summary?.symbol || "QQQ";
      this.date = this.level.date || this.level.summary?.date || "Unknown date";
      this.candles = Array.isArray(this.level.candles) ? this.level.candles.map(c => ({
        time: c.time,
        open: Number(c.open), high: Number(c.high), low: Number(c.low), close: Number(c.close), volume: Number(c.volume || 1)
      })).filter(c => Number.isFinite(c.open) && Number.isFinite(c.high) && Number.isFinite(c.low) && Number.isFinite(c.close)) : [];
      if (!this.candles.length) throw new Error("Level does not contain a candles array.");

      this.vwap = [];
      this.cumPVBefore = [];
      this.cumVolBefore = [];
      let pv = 0, vol = 0;
      for (const c of this.candles) {
        this.cumPVBefore.push(pv);
        this.cumVolBefore.push(vol);
        const typ = (c.high + c.low + c.close) / 3;
        pv += typ * Math.max(1, c.volume || 1);
        vol += Math.max(1, c.volume || 1);
        this.vwap.push(pv / vol);
      }
      this.buildIntrabarPaths();
      const modeText = this.isSimulation ? "SIM" : "REC";
      $("levelTitle").textContent = `${this.symbol} // ${this.date} // ${this.candles.length} candles // ${modeText}`;
      this.renderOptionChain(true);
      this.updateHighScoreLine();
    }

    cloneLevel(level) {
      return JSON.parse(JSON.stringify(level || {}));
    }

    restoreRecordedLevel() {
      if (!this.sourceLevelForSimulation) return;
      this.isSimulation = false;
      this.levelKey = this.sourceLevelKey || "recorded_level";
      this.normalizeLevel(this.cloneLevel(this.sourceLevelForSimulation));
      this.resetState(false);
      $("startOverlay").classList.add("show");
      this.toast("Restored recorded candle level.", "good");
      this.drawIdle();
    }

    generateSimulationLevel(options = {}) {
      const srcLevel = this.sourceLevelForSimulation || this.level || {};
      const srcCandles = Array.isArray(srcLevel.candles) ? srcLevel.candles : this.candles;
      if (!srcCandles || srcCandles.length < 25) { this.toast("Need a loaded candle level before simulation mode.", "bad"); return; }
      let seedText = ($("simSeed")?.value || "sonic-v4").trim();
      if (!seedText) seedText = `sim-${Date.now()}`;
      const sim = this.buildSyntheticLevel(srcLevel, seedText);
      this.isSimulation = true;
      this.levelKey = `SIM_${this.sourceLevelKey || "level"}_${seedText}`.replace(/\W+/g, "_");
      this.normalizeLevel(sim);
      this.resetState(false);
      if ($("levelModeSelect")) $("levelModeSelect").value = "simulation";
      if (!options.silent) {
        $("startOverlay").classList.add("show");
        this.toast(`Generated simulation from ${this.sourceLevelKey || "loaded level"}.`, "good");
        this.drawIdle();
      }
    }

    buildSyntheticLevel(srcLevel, seedText) {
      const rng = mulberry32(hashString(seedText));
      const src = (srcLevel.candles || this.candles).map(c => ({
        time: c.time, open: Number(c.open), high: Number(c.high), low: Number(c.low), close: Number(c.close), volume: Number(c.volume || 1)
      })).filter(c => Number.isFinite(c.open) && Number.isFinite(c.high) && Number.isFinite(c.low) && Number.isFinite(c.close));
      const out = [];
      let price = src[0].open * (0.995 + rng() * 0.010);
      let blockStart = Math.floor(rng() * Math.max(1, src.length - 60));
      let blockLen = 12 + Math.floor(rng() * 42);
      let blockPos = 0;
      let drift = (rng() - 0.5) * 0.00035;
      let volScale = 0.75 + rng() * 0.75;
      for (let i = 0; i < src.length; i++) {
        if (blockPos >= blockLen || i === 0) {
          blockStart = Math.floor(rng() * Math.max(1, src.length - 60));
          blockLen = 12 + Math.floor(rng() * 46);
          blockPos = 0;
          drift = (rng() - 0.5) * 0.00050;
          volScale = 0.55 + rng() * 1.10;
        }
        const j = Math.min(src.length - 1, blockStart + blockPos);
        const c = src[j];
        const prev = src[Math.max(0, j - 1)];
        const gap = prev.close > 0 ? Math.log(c.open / prev.close) : 0;
        const ret = c.open > 0 ? Math.log(c.close / c.open) : 0;
        const highExcess = Math.max(0.00003, (c.high - Math.max(c.open, c.close)) / Math.max(1, c.open));
        const lowExcess = Math.max(0.00003, (Math.min(c.open, c.close) - c.low) / Math.max(1, c.open));
        const jitter = (rng() - 0.5) * 0.00055;
        const open = price * Math.exp(gap * 0.22 + (rng() - 0.5) * 0.00016);
        const close = open * Math.exp(ret * (0.70 + rng() * 0.75) + drift + jitter);
        const hiMult = highExcess * (0.55 + rng() * 1.15);
        const loMult = lowExcess * (0.55 + rng() * 1.15);
        const high = Math.max(open, close) * (1 + hiMult);
        const low = Math.min(open, close) * (1 - loMult);
        const volNoise = 0.45 + rng() * 1.35;
        const volume = Math.max(1000, Math.round((c.volume || 1) * volScale * volNoise));
        out.push({
          time: src[i].time,
          open: Number(open.toFixed(4)),
          high: Number(high.toFixed(4)),
          low: Number(low.toFixed(4)),
          close: Number(close.toFixed(4)),
          volume
        });
        price = close;
        blockPos++;
      }
      const baseSymbol = srcLevel.symbol || srcLevel.summary?.symbol || this.symbol || "QQQ";
      return {
        file_type: "option_trading_hero_synthetic_level",
        version: "4.0.0",
        symbol: `${baseSymbol}-SIM`,
        date: `SIM ${seedText}`,
        generated_from: { symbol: baseSymbol, date: srcLevel.date || srcLevel.summary?.date || this.date, seed: seedText },
        candles: out
      };
    }

    loadLevelFile(e) {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const json = JSON.parse(String(reader.result));
          this.sourceLevelForSimulation = this.cloneLevel(json);
          this.sourceLevelKey = file.name.replace(/\W+/g, "_");
          this.isSimulation = false;
          this.levelKey = this.sourceLevelKey;
          if ($("levelModeSelect")) $("levelModeSelect").value = "recorded";
          this.normalizeLevel(json);
          this.resetState(false);
          $("startOverlay").classList.add("show");
          $("endOverlay").classList.remove("show");
          this.toast(`Loaded level: ${file.name}`);
          this.drawIdle();
        } catch (err) {
          console.error(err);
          this.toast("Could not read that JSON level.", "bad");
        }
      };
      reader.readAsText(file);
    }

    selectedQty() { return Math.max(1, Number($("qtySelect").value || 1)); }

    resetState(keepRunning = false) {
      this.running = keepRunning;
      this.paused = false;
      this.ended = false;
      this.gameMs = 0;
      this.difficulty = $("difficultySelect")?.value || this.difficulty;
      this.cash = this.bankrolls[this.difficulty] || 1000;
      this.startCash = this.cash;
      this.score = 0;
      this.combo = 0;
      this.bestCombo = 0;
      this.trades = [];
      this.position = null;
      this.currentChoices = [];
      this.currentRead = null;
      this.lastAutoSonicBlock = -1;
      this.messages = [];
      this.particles = [];
      this.shake = 0;
      this.panOffsetBars = 0;
      this.lastRenderedChainKey = "";
      this.updateHud();
      this.renderPosition();
      this.renderChoices();
      this.renderOptionChain(true);
    }

    start() {
      this.candleSeconds = Number($("speedSlider").value);
      this.setMusicVolume(Number($("volumeSlider")?.value ?? 42) / 100);
      if ($("levelModeSelect")?.value === "simulation") this.generateSimulationLevel({ silent: true });
      this.resetState(true);
      $("startOverlay").classList.remove("show");
      $("endOverlay").classList.remove("show");
      $("pauseOverlay").classList.remove("show");
      this.toast(`Level start: ${this.symbol} ${this.date}`);
      this.runSonic("manual");
      this.tryPlayMusic();
      this.lastFrame = performance.now();
      requestAnimationFrame((t) => this.loop(t));
    }

    restart() { this.start(); }

    togglePause(force) {
      if (!this.running || this.ended) return;
      this.paused = typeof force === "boolean" ? force : !this.paused;
      $("pauseOverlay").classList.toggle("show", this.paused);
      if (!this.paused) { this.lastFrame = performance.now(); requestAnimationFrame((t) => this.loop(t)); }
    }

    setMusicVolume(v) {
      this.musicVolume = clamp(Number.isFinite(v) ? v : 0.42, 0, 1);
      if (this.audio) this.audio.volume = this.musicVolume;
      const pct = Math.round(this.musicVolume * 100);
      if ($("volumeLabel")) $("volumeLabel").textContent = `Volume ${pct}%`;
    }

    loadTrack(index, autoplay = false) {
      if (!this.audio || !this.musicTracks.length) return;
      this.trackIndex = ((index % this.musicTracks.length) + this.musicTracks.length) % this.musicTracks.length;
      const src = this.musicTracks[this.trackIndex];
      const currentSrc = this.audio.getAttribute("src") || "";
      if (!currentSrc.endsWith(src)) this.audio.src = src;
      this.audio.loop = false;
      this.audio.volume = this.musicVolume;
      if ($("musicNowPlaying")) $("musicNowPlaying").innerHTML = `Now loaded: <code>${src.replace("music/", "")}</code>. Tracks auto-cycle from the <code>music/</code> folder.`;
      if (autoplay && this.musicOn) this.tryPlayMusic();
    }

    nextTrack() {
      this.loadTrack(this.trackIndex + 1, true);
      if (this.musicOn) this.toast("Next music track.", "good");
    }

    toggleMusic() {
      this.musicOn = !this.musicOn;
      $("musicBtn").textContent = `Music: ${this.musicOn ? "on" : "off"}`;
      if (this.musicOn) this.tryPlayMusic();
      else if (this.audio) this.audio.pause();
    }

    tryPlayMusic() {
      if (!this.musicOn || !this.audio) return;
      this.audio.volume = this.musicVolume;
      if (!this.audio.getAttribute("src")) this.loadTrack(this.trackIndex, false);
      this.audio.play().then(() => {
        $("musicBtn").textContent = "Music: on";
      }).catch(() => {
        this.toast("Browser blocked autoplay. Click Music after starting.", "warn");
      });
    }

    loop(now) {
      if (!this.running || this.paused) return;
      const dt = Math.min(50, now - this.lastFrame);
      this.lastFrame = now;
      this.update(dt);
      this.draw();
      if (!this.ended) requestAnimationFrame((t) => this.loop(t));
    }

    update(dt) {
      this.gameMs += dt;
      this.updateParticles(dt);
      this.updateMessages(dt);
      this.shake *= 0.9;
      const idx = this.currentIndex();
      this.panOffsetBars = clamp(this.panOffsetBars, 0, idx);

      const rawIdx = (this.gameMs / 1000) / this.candleSeconds;
      if (rawIdx >= this.candles.length) { this.endLevel(); return; }

      const autoBlock = Math.floor(idx / 5);
      if (idx >= 2 && autoBlock !== this.lastAutoSonicBlock) {
        this.lastAutoSonicBlock = autoBlock;
        this.runSonic("auto");
      }
      if (this.position) this.position.lastQuote = this.quote(this.position.direction, this.position.strike);
      this.updateHud();
      this.renderPosition();
      this.renderOptionChain(false);
    }

    rawIndex() { return (this.gameMs / 1000) / this.candleSeconds; }
    currentIndex() { return clamp(Math.floor(this.rawIndex()), 0, this.candles.length - 1); }
    fractionInCandle() {
      const raw = this.rawIndex();
      if (raw >= this.candles.length) return 1;
      return clamp(raw - Math.floor(raw), 0, 0.999);
    }

    buildIntrabarPaths() {
      const steps = 72;
      this.intrabarPaths = this.candles.map((c, idx) => {
        const range = Math.max(0.01, c.high - c.low);
        const body = Math.abs(c.close - c.open);
        const up = c.close >= c.open;
        const doji = body < range * 0.16;
        let firstExtreme = up ? "low" : "high";
        if (doji && seededNoise(idx * 7.19) > 0.5) firstExtreme = firstExtreme === "low" ? "high" : "low";

        // Use the actual OHLC, but choose a deterministic, natural intraminute route.
        // This avoids leaking the completed high/low before the replayed price touches them.
        const early = 0.13 + seededNoise(idx * 4.7 + 2) * 0.22;
        const late = 0.58 + seededNoise(idx * 5.3 + 9) * 0.28;
        const i1 = clamp(Math.round(early * steps), 3, Math.round(steps * 0.43));
        const i2 = clamp(Math.round(late * steps), i1 + 4, steps - 4);
        const firstVal = firstExtreme === "low" ? c.low : c.high;
        const secondVal = firstExtreme === "low" ? c.high : c.low;
        const anchors = [
          { i: 0, v: c.open },
          { i: i1, v: firstVal },
          { i: i2, v: secondVal },
          { i: steps, v: c.close }
        ];
        const path = new Array(steps + 1).fill(c.open);
        for (let a = 0; a < anchors.length - 1; a++) {
          const A = anchors[a], B = anchors[a + 1];
          const len = Math.max(1, B.i - A.i);
          for (let j = A.i; j <= B.i; j++) {
            const t = (j - A.i) / len;
            const base = lerp(A.v, B.v, t);
            const wave = Math.sin(t * Math.PI) * (seededNoise(idx * 1000 + j * 17 + a) - 0.5) * range * 0.11;
            const lo = Math.min(A.v, B.v), hi = Math.max(A.v, B.v);
            path[j] = clamp(base + wave, lo, hi);
          }
        }
        anchors.forEach(a => { path[a.i] = a.v; });
        path[0] = c.open; path[steps] = c.close;
        return path;
      });
    }

    priceInsideCandle(c, f, idx) {
      const path = this.intrabarPaths[idx];
      if (!path || path.length < 2) return c.close;
      const pos = clamp(f, 0, 1) * (path.length - 1);
      const i = Math.floor(pos);
      const j = Math.min(path.length - 1, i + 1);
      return lerp(path[i], path[j], pos - i);
    }

    observedCandle(idx, f = null) {
      const c = this.candles[idx];
      if (!c) return null;
      const live = idx === this.currentIndex();
      const frac = f === null ? (live ? this.fractionInCandle() : 1) : f;
      if (!live && frac >= 1) return c;
      if (frac >= 0.999) return c;
      const path = this.intrabarPaths[idx] || [c.open, c.close];
      const pos = clamp(frac, 0, 1) * (path.length - 1);
      const end = Math.floor(pos);
      const cur = this.priceInsideCandle(c, frac, idx);
      const seen = path.slice(0, Math.max(1, end + 1));
      seen.push(cur);
      return {
        ...c,
        high: Math.max(c.open, ...seen),
        low: Math.min(c.open, ...seen),
        close: cur,
        volume: Math.max(1, Math.round((c.volume || 1) * clamp(frac, 0.015, 1)))
      };
    }

    observedVwap(idx = this.currentIndex(), f = null) {
      const c = this.observedCandle(idx, f);
      if (!c) return this.currentPrice();
      const typ = (c.high + c.low + c.close) / 3;
      const pv = (this.cumPVBefore[idx] || 0) + typ * Math.max(1, c.volume || 1);
      const vol = (this.cumVolBefore[idx] || 0) + Math.max(1, c.volume || 1);
      return vol > 0 ? pv / vol : c.close;
    }

    currentPrice() {
      const idx = this.currentIndex();
      return this.priceInsideCandle(this.candles[idx], this.fractionInCandle(), idx);
    }

    displayTime(idx = this.currentIndex()) {
      const iso = this.candles[idx]?.time;
      if (!iso) return "--:--";
      return new Date(iso).toLocaleTimeString("en-US", { timeZone: "America/New_York", hour: "2-digit", minute: "2-digit", hour12: false });
    }

    minutesToClose(idx = this.currentIndex()) { return Math.max(1, this.candles.length - 1 - idx); }

    computeFeatures(idx = this.currentIndex()) {
      idx = clamp(idx, 0, this.candles.length - 1);
      const c = this.observedCandle(idx, idx === this.currentIndex() ? this.fractionInCandle() : 1);
      const current = c.close;
      const day = [];
      for (let i = 0; i <= idx; i++) day.push(i === idx ? c : this.candles[i]);
      const dayHigh = Math.max(...day.map(x => x.high));
      const dayLow = Math.min(...day.map(x => x.low));
      const range = Math.max(0.01, dayHigh - dayLow);
      const rangePos = (current - dayLow) / range;
      const vwapNow = idx === this.currentIndex() ? this.observedVwap(idx, this.fractionInCandle()) : (this.vwap[idx] || current);
      const aboveVwap = current > vwapNow ? 1 : 0;
      const closeN = (n) => {
        const j = Math.max(0, idx - n);
        return j === idx ? current : (this.candles[j]?.close ?? c.close);
      };
      const slope3 = current - closeN(3);
      const slope6 = current - closeN(6);
      const slope12 = current - closeN(12);
      const norm3 = clamp(slope3 / 0.85, -1, 1);
      const norm6 = clamp(slope6 / 1.25, -1, 1);
      const norm12 = clamp(slope12 / 1.8, -1, 1);
      const last5 = [];
      for (let i = Math.max(0, idx - 5); i <= idx; i++) last5.push(i === idx ? c : this.candles[i]);
      const recentHigh = Math.max(...last5.map(x => x.high));
      const recentLow = Math.min(...last5.map(x => x.low));
      const red = c.close < c.open;
      const green = c.close >= c.open;
      const upperWick = c.high - Math.max(c.open, c.close);
      const lowerWick = Math.min(c.open, c.close) - c.low;

      const trendCall = clamp(0.40 * Math.max(0, norm6) + 0.25 * Math.max(0, norm12) + 0.20 * aboveVwap + 0.15 * rangePos, 0, 1);
      const trendPut = clamp(0.40 * Math.max(0, -norm6) + 0.25 * Math.max(0, -norm12) + 0.20 * (1 - aboveVwap) + 0.15 * (1 - rangePos), 0, 1);
      const openWindow = idx < 50 ? 1 : 0;
      const openCall = clamp(openWindow * (0.55 * Math.max(0, norm3) + 0.25 * aboveVwap + 0.20 * rangePos), 0, 1);
      const openPut = clamp(openWindow * (0.55 * Math.max(0, -norm3) + 0.25 * (1 - aboveVwap) + 0.20 * (1 - rangePos)), 0, 1);
      const failBreakoutPut = clamp((red ? 0.28 : 0) + (upperWick > lowerWick ? 0.20 : 0) + (current < recentHigh - 0.15 ? 0.22 : 0) + (rangePos > 0.70 ? 0.18 : 0) + Math.max(0, -norm3) * 0.18, 0, 1);
      const failBreakdownCall = clamp((green ? 0.28 : 0) + (lowerWick > upperWick ? 0.20 : 0) + (current > recentLow + 0.15 ? 0.22 : 0) + (rangePos < 0.30 ? 0.18 : 0) + Math.max(0, norm3) * 0.18, 0, 1);
      const speed = Math.max(Math.abs(norm3), Math.abs(norm6), Math.abs(norm12));
      const middle = 1 - Math.abs(rangePos - 0.5) * 2;
      const chop = clamp(0.62 * middle + 0.38 * (1 - speed), 0, 1);
      const call = clamp(0.18 + 0.43 * trendCall + 0.22 * openCall + 0.21 * failBreakdownCall - 0.34 * chop - 0.18 * trendPut, 0.03, 0.92);
      const put = clamp(0.18 + 0.43 * trendPut + 0.22 * openPut + 0.21 * failBreakoutPut - 0.34 * chop - 0.18 * trendCall, 0.03, 0.92);

      let state = "mixed_wait";
      if (chop > Math.max(call, put) && chop > 0.55) state = "mixed_wait";
      else if (failBreakdownCall > 0.55 && call > put) state = "failed_breakdown_call";
      else if (failBreakoutPut > 0.55 && put > call) state = "failed_breakout_put";
      else if (idx < 50 && call > put) state = "opening_momentum_call";
      else if (idx < 50 && put > call) state = "opening_momentum_put";
      else state = call > put ? "trend_call" : "trend_put";

      return {
        current_price: current, time: this.displayTime(idx), vwap: vwapNow,
        slope_3: slope3, slope_6: slope6, range_pos: rangePos, minutes_to_close: this.minutesToClose(idx),
        state,
        trend_call_score: trendCall, trend_put_score: trendPut,
        failed_breakout_put_score: failBreakoutPut, failed_breakdown_call_score: failBreakdownCall,
        aggressive_call_prob: call, aggressive_put_prob: put, chop_score: chop,
        dayHigh, dayLow
      };
    }

    realizedVol(idx) {
      const lookback = 18;
      const start = Math.max(1, idx - lookback);
      const rets = [];
      for (let i = start; i <= idx; i++) {
        const prev = this.candles[i - 1].close;
        const cur = this.candles[i].close;
        if (prev > 0) rets.push(Math.log(cur / prev));
      }
      if (rets.length < 2) return 0.18;
      const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
      const sd = Math.sqrt(rets.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / Math.max(1, rets.length - 1));
      return clamp(sd * Math.sqrt(252 * 390), 0.10, 0.55);
    }

    quote(direction, strike, priceOverride) {
      const idx = this.currentIndex();
      const S = priceOverride || this.currentPrice();
      const K = Number(strike);
      const minLeft = this.minutesToClose(idx);
      const T = Math.max(minLeft / (252 * 390), 1 / (252 * 390 * 10));
      const features = this.computeFeatures(idx);
      const volBump = 0.045 * Math.max(features.aggressive_call_prob, features.aggressive_put_prob) + 0.03 * features.chop_score;
      const iv = clamp(0.15 + this.realizedVol(idx) * 0.33 + volBump, 0.14, 0.60);
      const isCall = direction === "call";
      let mid = blackScholes(S, K, T, iv, isCall);
      const intrinsic = Math.max(isCall ? S - K : K - S, 0);
      const lotteryFloor = 0.01 + 0.025 * Math.exp(-Math.abs(S - K) / 1.9) * Math.sqrt(minLeft / 390);
      const micro = 0.002 + 0.004 * features.chop_score + 0.004 * seededNoise(idx + K * 0.13 + (isCall ? 1 : 2));
      mid = roundCent(Math.max(mid, intrinsic + lotteryFloor) + micro);

      let spread = 0.01;
      if (mid > 0.75) spread = 0.02;
      if (mid > 1.75) spread = 0.03;
      if (mid > 3.00) spread = 0.04;
      if (minLeft < 30) spread += 0.01;
      if (this.difficulty === "hard") spread += 0.01;
      if (features.chop_score > 0.72) spread += 0.01;
      if (seededNoise((idx + 1) * (K + 7) * (isCall ? 1.1 : 1.3)) > 0.86) spread += 0.01;
      spread = Math.round(spread * 100) / 100;
      const bid = Math.max(0.01, Math.round((mid - spread / 2) * 100) / 100);
      const ask = Math.max(bid + 0.01, Math.round((mid + spread / 2) * 100) / 100);
      return { bid, ask, mid, spread: Math.round((ask - bid) * 100) / 100, iv };
    }

    roundStrike(x) { return Math.round(x); }

    buildChoices() {
      const f = this.computeFeatures();
      const S = f.current_price;
      const atm = this.roundStrike(S);
      const callProb = f.aggressive_call_prob;
      const putProb = f.aggressive_put_prob;
      const noTradeProb = clamp(f.chop_score * 0.72 + (1 - Math.max(callProb, putProb)) * 0.35, 0.05, 0.92);
      const callStrike = Math.ceil(S) + (callProb > 0.76 ? 1 : 0);
      const putStrike = Math.floor(S) - (putProb > 0.76 ? 1 : 0);
      const choices = [
        this.choice("call", callStrike, clamp(callProb * (1 - f.chop_score * 0.18), 0.03, 0.91), "sonic call signal"),
        this.choice("put", putStrike, clamp(putProb * (1 - f.chop_score * 0.18), 0.03, 0.91), "sonic put signal"),
        { action: "none", label: "STAY / NO TRADE", prob: noTradeProb, reason: f.chop_score > 0.55 ? "chop protection" : "wait for cleaner level" }
      ];
      choices.sort((a, b) => b.prob - a.prob);
      return { features: f, choices };
    }

    choice(direction, strike, prob, reason) {
      const q = this.quote(direction, strike);
      return { action: "buy", direction, strike, qty: 1, quote: q, prob, reason, label: `BUY ${direction.toUpperCase()} ${strike} x1` };
    }

    runSonic(source) {
      if (!this.running && source !== "manual") return;
      const read = this.buildChoices();
      this.currentRead = read;
      this.currentChoices = read.choices;
      const f = read.features;
      $("sonicPill").textContent = `SONIC: ${source} read fired`;
      $("sonicState").textContent = `${f.state.replaceAll("_", " ")} · call ${Math.round(f.aggressive_call_prob * 100)}% · put ${Math.round(f.aggressive_put_prob * 100)}% · chop ${f.chop_score.toFixed(2)}`;
      this.renderChoices();
      this.toast(source === "auto" ? "Sonic auto-read." : "Sonic manual read fired.", "good");
      this.burst(this.canvas.clientWidth - 240, 125, "#00e5ff", 18);
      this.shake = Math.max(this.shake, 4);
    }

    renderChoices() {
      const root = $("choiceCards");
      if (!this.currentChoices.length) {
        root.innerHTML = `<div class="choiceCard"><div class="choiceTop"><span>Waiting for Sonic</span><span>--</span></div><div class="choiceMeta"><div>Press Space</div><div>or Run Sonic</div><div>every 5 min auto</div></div></div>`;
        return;
      }
      root.innerHTML = this.currentChoices.map((c, i) => {
        if (c.action === "none") {
          return `<div class="choiceCard" data-choice="${i}"><div class="choiceTop"><span>${i + 1}. ${c.label}</span><span>${Math.round(c.prob * 100)}%</span></div><div class="choiceMeta"><div>Bid / Ask<br><b>--</b></div><div>Spread<br><b>--</b></div><div>Reason<br><b>${c.reason}</b></div></div></div>`;
        }
        const cls = c.direction === "call" ? "call" : "put";
        return `<div class="choiceCard ${cls}" data-choice="${i}"><div class="choiceTop"><span>${i + 1}. ${c.label}</span><span>${Math.round(c.prob * 100)}%</span></div><div class="choiceMeta"><div>Bid / Ask<br><b>${fmtOpt(c.quote.bid)} / ${fmtOpt(c.quote.ask)}</b></div><div>Spread<br><b>${fmtOpt(c.quote.spread)}</b></div><div>Reason<br><b>${c.reason}</b></div></div></div>`;
      }).join("");
    }

    takeChoice(choice) {
      if (choice.action === "none") {
        this.toast("Good discipline: no trade.", "good");
        this.score += 25;
        this.updateHud();
        return;
      }
      this.buyOption(choice.direction, choice.strike, choice.qty || 1, "sonic");
    }

    buyOption(direction, strike, qty, source = "manual") {
      if (!this.running || this.ended) { this.toast("Start the level first.", "warn"); return; }
      if (this.position && (this.position.direction !== direction || this.position.strike !== strike)) {
        this.toast("Sell current position before switching strike/direction.", "warn");
        return;
      }
      const q = this.quote(direction, strike);
      const costPerContract = q.ask * 100;
      let useQty = Math.max(1, Math.floor(qty));
      if (costPerContract * useQty > this.cash) useQty = Math.floor(this.cash / costPerContract);
      if (useQty < 1) { this.toast(`Not enough cash for ${direction} ${strike} at ${fmtOpt(q.ask)} ask.`, "bad"); return; }
      const cost = costPerContract * useQty;
      this.cash -= cost;
      const nowIdx = this.currentIndex();
      if (this.position) {
        const oldCost = this.position.entryCost;
        const oldQty = this.position.qty;
        this.position.qty += useQty;
        this.position.entryCost += cost;
        this.position.avgAsk = this.position.entryCost / (this.position.qty * 100);
        this.position.adds += 1;
        this.toast(`Scaled ${direction.toUpperCase()} ${strike}: +${useQty} at ask ${fmtOpt(q.ask)}.`, "good");
        this.trades.push({ type: "add", direction, strike, qty: useQty, ask: q.ask, idx: nowIdx, source });
        if (oldQty > 0 && oldCost > 0) this.score += 10;
      } else {
        this.position = {
          direction, strike, qty: useQty, avgAsk: q.ask, entryCost: cost, entryIdx: nowIdx, entryPrice: this.currentPrice(),
          entryTime: this.displayTime(), lastQuote: q, maxBid: q.bid, minBid: q.bid, adds: 0, source
        };
        this.toast(`Bought ${useQty} ${this.symbol} ${strike} ${direction.toUpperCase()} at ask ${fmtOpt(q.ask)}.`, "good");
        this.trades.push({ type: "buy", direction, strike, qty: useQty, ask: q.ask, idx: nowIdx, source });
      }
      this.combo += 1;
      this.bestCombo = Math.max(this.bestCombo, this.combo);
      this.score += Math.round(40 + useQty * 3);
      this.burst(this.canvas.clientWidth * 0.50, this.canvas.clientHeight * 0.45, direction === "call" ? "#20ff9d" : "#ff4d6d", 28);
      this.shake = Math.max(this.shake, 6);
      this.updateHud();
      this.renderPosition();
    }

    sellPosition(source = "manual") {
      if (!this.position) { this.toast("No open position.", "warn"); return; }
      const p = this.position;
      const q = this.quote(p.direction, p.strike);
      const proceeds = q.bid * 100 * p.qty;
      const pnl = proceeds - p.entryCost;
      const pnlPct = pnl / Math.max(1, p.entryCost);
      this.cash += proceeds;
      this.trades.push({ type: "sell", direction: p.direction, strike: p.strike, qty: p.qty, bid: q.bid, pnl, pnlPct, idx: this.currentIndex(), source });
      this.score += Math.max(0, Math.round(pnl * 1.8)) + (pnl > 0 ? 120 + Math.round(100 * pnlPct) : -60);
      this.combo = pnl > 0 ? this.combo + 1 : 0;
      this.bestCombo = Math.max(this.bestCombo, this.combo);
      this.toast(`Sold at bid ${fmtOpt(q.bid)}. Profit ${fmtMoney(pnl, 2)} (${fmtPct(pnlPct)}).`, pnl >= 0 ? "good" : "bad");
      this.burst(this.canvas.clientWidth * 0.50, this.canvas.clientHeight * 0.45, pnl >= 0 ? "#20ff9d" : "#ff4d6d", pnl >= 0 ? 42 : 24);
      this.shake = Math.max(this.shake, pnl >= 0 ? 11 : 7);
      this.position = null;
      this.updateHud();
      this.renderPosition();
    }

    equity() {
      let eq = this.cash;
      if (this.position) {
        const q = this.quote(this.position.direction, this.position.strike);
        eq += q.bid * 100 * this.position.qty;
      }
      return eq;
    }

    updateHud() {
      const eq = this.equity();
      const pl = eq - this.startCash;
      $("cashVal").textContent = fmtMoney(this.cash);
      $("equityVal").textContent = fmtMoney(eq);
      $("pnlVal").textContent = fmtMoney(pl, 2);
      $("pnlVal").style.color = pl >= 0 ? "#20ff9d" : "#ff4d6d";
      $("scoreVal").textContent = Math.max(0, Math.round(this.score)).toLocaleString();
      $("comboVal").textContent = `${this.combo}x`;
      $("timePill").textContent = this.displayTime();
      $("pricePill").textContent = `${this.symbol} $${this.currentPrice().toFixed(2)}`;
    }

    renderPosition() {
      const body = $("positionBody");
      if (!this.position) { body.innerHTML = "Flat. Wait for a clean setup."; return; }
      const p = this.position;
      const q = this.quote(p.direction, p.strike);
      p.maxBid = Math.max(p.maxBid || q.bid, q.bid);
      p.minBid = Math.min(p.minBid || q.bid, q.bid);
      const val = q.bid * 100 * p.qty;
      const pnl = val - p.entryCost;
      const pnlPct = pnl / Math.max(1, p.entryCost);
      const cls = pnl >= 0 ? "posGood" : "posBad";
      body.innerHTML = `<b>${p.qty}x ${this.symbol} ${p.strike} ${p.direction.toUpperCase()}</b> · avg ask ${fmtOpt(p.avgAsk)} · sell bid ${fmtOpt(q.bid)}<br>
        Value ${fmtMoney(val, 2)} · P/L <span class="${cls}">${fmtMoney(pnl, 2)} (${fmtPct(pnlPct)})</span><br>
        Underlying entry $${p.entryPrice.toFixed(2)} → now $${this.currentPrice().toFixed(2)} · adds ${p.adds}`;
    }

    renderOptionChain(force) {
      const S = this.currentPrice();
      const atm = this.roundStrike(S);
      const idx = this.currentIndex();
      const key = `${idx}_${atm}_${this.selectedQty()}_${this.difficulty}_${Math.round(S * 10)}`;
      if (!force && key === this.lastRenderedChainKey) return;
      this.lastRenderedChainKey = key;
      $("deckSub").textContent = `${this.symbol} $${S.toFixed(2)} · ${this.displayTime()} · ${this.minutesToClose()} min left · buy ask / sell bid · QQQ-style spread simulated`;
      const strikes = [];
      for (let k = -4; k <= 4; k++) strikes.push(atm + k);
      $("optionChain").innerHTML = strikes.map(strike => {
        const cq = this.quote("call", strike);
        const pq = this.quote("put", strike);
        const atmCls = strike === atm ? " atm" : "";
        return `<div class="chainCol${atmCls}">
          <div class="strikeHead">${strike}</div>
          <button class="optBtn call" data-dir="call" data-strike="${strike}"><span>CALL</span><span>${fmtOpt(cq.ask)}<span class="small">bid ${fmtOpt(cq.bid)}</span></span></button>
          <button class="optBtn put" data-dir="put" data-strike="${strike}"><span>PUT</span><span>${fmtOpt(pq.ask)}<span class="small">bid ${fmtOpt(pq.bid)}</span></span></button>
        </div>`;
      }).join("");
    }

    highScoreKey() { return `optionTradingHeroV4_${this.levelKey}_${this.difficulty}`; }
    updateHighScoreLine() {
      const raw = localStorage.getItem(this.highScoreKey());
      if (!raw) { $("highScoreLine").textContent = `High score (${this.difficulty}): --`; return; }
      try {
        const x = JSON.parse(raw);
        $("highScoreLine").textContent = `High score (${this.difficulty}): ${Math.round(x.score).toLocaleString()} · equity ${fmtMoney(x.equity, 2)}`;
      } catch { $("highScoreLine").textContent = `High score (${this.difficulty}): --`; }
    }
    saveHighScore() {
      const key = this.highScoreKey();
      let old = null;
      try { old = JSON.parse(localStorage.getItem(key) || "null"); } catch {}
      const score = Math.max(0, Math.round(this.score));
      const equity = this.equity();
      if (!old || score > old.score) localStorage.setItem(key, JSON.stringify({ score, equity, date: new Date().toISOString(), trades: this.trades.length }));
      this.updateHighScoreLine();
    }

    endLevel() {
      if (this.ended) return;
      if (this.position) this.sellPosition("close");
      this.ended = true;
      this.running = false;
      this.saveHighScore();
      const eq = this.equity();
      const pl = eq - this.startCash;
      $("endTitle").textContent = pl >= 0 ? "You beat the tape." : "Level complete. Study the misses.";
      $("endStats").innerHTML = `
        <div><span>Final equity</span><b>${fmtMoney(eq, 2)}</b></div>
        <div><span>Net P/L</span><b style="color:${pl >= 0 ? "#20ff9d" : "#ff4d6d"}">${fmtMoney(pl, 2)}</b></div>
        <div><span>Score</span><b>${Math.max(0, Math.round(this.score)).toLocaleString()}</b></div>
        <div><span>Trades</span><b>${this.trades.filter(t => t.type === "sell").length}</b></div>
        <div><span>Best combo</span><b>${this.bestCombo}x</b></div>
        <div><span>Difficulty</span><b>${this.difficulty}</b></div>`;
      $("endOverlay").classList.add("show");
    }

    resize() {
      const rect = this.canvas.parentElement.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      this.canvas.width = Math.floor(rect.width * dpr);
      this.canvas.height = Math.floor(rect.height * dpr);
      this.canvas.style.width = rect.width + "px";
      this.canvas.style.height = rect.height + "px";
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (!this.running) this.drawIdle();
    }

    chartRect() {
      const w = this.canvas.clientWidth || window.innerWidth;
      const h = this.canvas.clientHeight || window.innerHeight;
      const rightReserve = w > 980 ? 460 : 38;
      const bottomReserve = 190;
      return { x: 44, y: 64, w: Math.max(340, w - rightReserve - 76), h: Math.max(245, h - bottomReserve - 72) };
    }

    isInChart(x, y) {
      const r = this.chartRect();
      return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
    }

    onPointerDown(e) {
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left, y = e.clientY - rect.top;
      if (!this.isInChart(x, y)) return;
      this.dragging = true;
      this.dragLastX = x;
      this.canvas.classList.add("dragging");
    }

    onPointerMove(e) {
      if (!this.dragging) return;
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const r = this.chartRect();
      const pixelsPerBar = Math.max(4, r.w / this.viewBars);
      const dx = x - this.dragLastX;
      if (Math.abs(dx) >= pixelsPerBar * 0.3) {
        this.panOffsetBars = clamp(this.panOffsetBars + Math.round(dx / pixelsPerBar), 0, this.currentIndex());
        this.dragLastX = x;
      }
    }

    onPointerUp() { this.dragging = false; this.canvas.classList.remove("dragging"); }

    onWheel(e) {
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left, y = e.clientY - rect.top;
      if (!this.isInChart(x, y)) return;
      e.preventDefault();
      const old = this.viewBars;
      const factor = e.deltaY > 0 ? 1.15 : 0.85;
      const maxBars = Math.min(260, this.candles.length);
      this.viewBars = clamp(Math.round(this.viewBars * factor), 18, maxBars);
      const change = this.viewBars - old;
      this.panOffsetBars = clamp(this.panOffsetBars + Math.round(change / 2), 0, this.currentIndex());
    }

    drawIdle() {
      this.draw(true);
    }

    draw(idle = false) {
      const ctx = this.ctx;
      const w = this.canvas.clientWidth || window.innerWidth;
      const h = this.canvas.clientHeight || window.innerHeight;
      ctx.clearRect(0, 0, w, h);
      const sx = idle ? 0 : (seededNoise(this.gameMs * 0.01) - 0.5) * this.shake;
      const sy = idle ? 0 : (seededNoise(this.gameMs * 0.017 + 99) - 0.5) * this.shake;
      ctx.save();
      ctx.translate(sx, sy);
      this.drawBackground(ctx, w, h);
      this.drawChart(ctx, w, h, idle);
      this.drawMessages(ctx);
      this.drawParticles(ctx);
      ctx.restore();
    }

    drawBackground(ctx, w, h) {
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, "#030711"); grad.addColorStop(0.55, "#071425"); grad.addColorStop(1, "#030711");
      ctx.fillStyle = grad; ctx.fillRect(0, 0, w, h);
      ctx.save(); ctx.globalAlpha = 0.32;
      for (let x = 0; x < w; x += 40) { ctx.strokeStyle = x % 120 === 0 ? "rgba(0,229,255,.10)" : "rgba(255,255,255,.035)"; ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,h); ctx.stroke(); }
      for (let y = 0; y < h; y += 40) { ctx.strokeStyle = y % 120 === 0 ? "rgba(32,255,157,.08)" : "rgba(255,255,255,.035)"; ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(w,y); ctx.stroke(); }
      ctx.restore();
      const glow = ctx.createRadialGradient(w * .22, h * .2, 0, w * .22, h * .2, Math.max(w, h) * .8);
      glow.addColorStop(0, "rgba(0,229,255,.10)"); glow.addColorStop(.45, "rgba(155,92,255,.055)"); glow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = glow; ctx.fillRect(0, 0, w, h);
    }

    drawChart(ctx, w, h, idle) {
      const r = this.chartRect();
      const nowIdx = idle ? 0 : this.currentIndex();
      const visibleEnd = clamp(nowIdx - this.panOffsetBars, 0, nowIdx);
      const visibleStart = Math.max(0, visibleEnd - this.viewBars + 1);
      const liveFrac = idle ? 0.01 : this.fractionInCandle();
      const drawCandles = [];
      for (let i = visibleStart; i <= visibleEnd; i++) {
        const isLive = !idle && this.panOffsetBars === 0 && i === nowIdx;
        drawCandles.push({ idx: i, candle: isLive ? this.observedCandle(i, liveFrac) : this.candles[i], live: isLive });
      }
      if (!drawCandles.length) return;
      let minP = Math.min(...drawCandles.map(d => d.candle.low));
      let maxP = Math.max(...drawCandles.map(d => d.candle.high));
      const cur = idle ? this.candles[0].open : this.currentPrice();
      minP = Math.min(minP, cur); maxP = Math.max(maxP, cur);
      const pad = Math.max(0.25, (maxP - minP) * 0.14);
      minP -= pad; maxP += pad;
      const py = (p) => r.y + r.h - ((p - minP) / Math.max(0.01, maxP - minP)) * r.h;
      const px = (i) => r.x + ((i - visibleStart) / Math.max(1, this.viewBars - 1)) * r.w;

      ctx.save();
      ctx.fillStyle = "rgba(5,12,22,.63)"; ctx.strokeStyle = "rgba(255,255,255,.10)";
      this.roundRect(ctx, r.x - 12, r.y - 12, r.w + 24, r.h + 24, 24); ctx.fill(); ctx.stroke();

      for (let k = 0; k <= 5; k++) {
        const y = r.y + r.h * k / 5;
        ctx.strokeStyle = "rgba(255,255,255,.06)"; ctx.beginPath(); ctx.moveTo(r.x, y); ctx.lineTo(r.x + r.w, y); ctx.stroke();
        const val = maxP - (maxP - minP) * k / 5;
        ctx.fillStyle = "rgba(210,235,249,.62)"; ctx.font = "11px ui-sans-serif, system-ui"; ctx.fillText("$" + val.toFixed(2), r.x + r.w + 8, y + 4);
      }
      for (let i = visibleStart; i <= visibleEnd; i += 5) {
        const x = px(i);
        ctx.strokeStyle = "rgba(0,229,255,.10)"; ctx.beginPath(); ctx.moveTo(x, r.y); ctx.lineTo(x, r.y + r.h); ctx.stroke();
      }

      ctx.strokeStyle = "rgba(255,209,102,.72)"; ctx.lineWidth = 1.4; ctx.beginPath();
      for (let i = visibleStart; i <= visibleEnd; i++) {
        const x = px(i);
        const isLive = !idle && this.panOffsetBars === 0 && i === nowIdx;
        const y = py(isLive ? this.observedVwap(i, liveFrac) : (this.vwap[i] || this.candles[i].close));
        if (i === visibleStart) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();

      const cw = Math.max(3, r.w / Math.max(18, this.viewBars) * 0.58);
      const vMax = Math.max(...drawCandles.map(d => d.candle.volume || 1));
      for (const d of drawCandles) {
        const c = d.candle;
        const i = d.idx;
        const x = px(i);
        const up = c.close >= c.open;
        const color = up ? "#20ff9d" : "#ff4d6d";
        ctx.strokeStyle = color;
        ctx.globalAlpha = d.live ? 1 : 0.88;
        ctx.lineWidth = d.live ? 2.2 : 1.2;
        ctx.beginPath(); ctx.moveTo(x, py(c.high)); ctx.lineTo(x, py(c.low)); ctx.stroke();
        ctx.fillStyle = color;
        const y1 = py(c.open), y2 = py(c.close);
        const top = Math.min(y1, y2), bh = Math.max(2, Math.abs(y2 - y1));
        ctx.shadowColor = d.live ? color : "transparent";
        ctx.shadowBlur = d.live ? 10 : 0;
        ctx.fillRect(x - cw / 2, top, cw, bh);
        ctx.shadowBlur = 0;
        const bar = ((c.volume || 1) / vMax) * 45;
        ctx.globalAlpha = d.live ? 0.28 : 0.18;
        ctx.fillRect(x - cw / 2, r.y + r.h - bar, cw, bar);
        ctx.globalAlpha = 1;
        ctx.lineWidth = 1;
      }

      if (!idle && this.panOffsetBars === 0) {
        const curX = px(nowIdx); const curY = py(cur);
        ctx.strokeStyle = "rgba(0,229,255,.76)"; ctx.setLineDash([5, 7]); ctx.beginPath(); ctx.moveTo(r.x, curY); ctx.lineTo(r.x + r.w, curY); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = "#00e5ff"; ctx.shadowColor = "#00e5ff"; ctx.shadowBlur = 18; ctx.beginPath(); ctx.arc(curX, curY, 7 + Math.sin(this.gameMs / 160) * 2, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
        ctx.fillStyle = "rgba(2,10,20,.88)"; ctx.strokeStyle = "rgba(0,229,255,.50)"; this.roundRect(ctx, curX + 10, curY - 18, 108, 32, 12); ctx.fill(); ctx.stroke();
        ctx.fillStyle = "#e8f6ff"; ctx.font = "bold 13px ui-sans-serif, system-ui"; ctx.fillText(`${this.symbol} $${cur.toFixed(2)}`, curX + 20, curY + 2);

        const pulseH = 5 + Math.sin(this.gameMs / 90) * 2;
        ctx.fillStyle = "rgba(0,229,255,.85)";
        ctx.fillRect(curX - cw * 0.42, r.y + r.h + 10, cw * 0.84, pulseH);
      }

      ctx.fillStyle = "rgba(232,246,255,.92)"; ctx.font = "900 18px ui-sans-serif, system-ui"; ctx.fillText(`${this.symbol} ${this.date}`, r.x, r.y - 25);
      ctx.fillStyle = "rgba(138,163,180,.95)"; ctx.font = "12px ui-sans-serif, system-ui";
      const viewText = this.panOffsetBars > 0 ? `viewing ${this.panOffsetBars} candles behind live` : "following live";
      ctx.fillText(`Future hidden · live candle builds tick-by-tick · ${this.viewBars} bars visible · ${viewText} · wheel zoom / drag pan`, r.x, r.y - 7);

      if (idle) {
        ctx.fillStyle = "rgba(0,229,255,.14)"; this.roundRect(ctx, r.x + r.w * .25, r.y + r.h * .38, r.w * .50, 64, 22); ctx.fill();
        ctx.fillStyle = "#e8f6ff"; ctx.textAlign = "center"; ctx.font = "900 24px ui-sans-serif, system-ui"; ctx.fillText("Press Start to reveal the day", r.x + r.w * .5, r.y + r.h * .38 + 40); ctx.textAlign = "left";
      }
      ctx.restore();
    }

    updateParticles(dt) {
      for (const p of this.particles) { p.x += p.vx * dt / 1000; p.y += p.vy * dt / 1000; p.vx *= .985; p.vy *= .985; p.vy += 28 * dt / 1000; p.life -= dt; }
      this.particles = this.particles.filter(p => p.life > 0);
    }
    updateMessages(dt) { for (const m of this.messages) m.life -= dt; this.messages = this.messages.filter(m => m.life > 0); }

    burst(x, y, color, n) {
      for (let i = 0; i < n; i++) {
        const a = seededNoise(this.gameMs + i * 17) * Math.PI * 2;
        const sp = 60 + seededNoise(this.gameMs + i * 33) * 260;
        this.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 2 + seededNoise(i + this.gameMs) * 4, color, life: 500 + seededNoise(i * 5) * 700, maxLife: 1200 });
      }
    }

    toast(text, tone = "info") {
      this.messages.unshift({ text, tone, life: 2300 });
      this.messages = this.messages.slice(0, 4);
    }

    drawMessages(ctx) {
      if (!this.messages.length) return;
      const w = this.canvas.clientWidth;
      let x = Math.min(w * 0.50 - 230, w - 720); if (!Number.isFinite(x) || x < 20) x = 20;
      let y = 20;
      ctx.save();
      this.messages.slice(0, 3).forEach(m => {
        const alpha = clamp(m.life / 650, 0, 1);
        ctx.globalAlpha = alpha;
        const color = m.tone === "good" ? "#20ff9d" : m.tone === "bad" ? "#ff4d6d" : m.tone === "warn" ? "#ffd166" : "#00e5ff";
        ctx.fillStyle = "rgba(2,10,20,.80)"; ctx.strokeStyle = color; this.roundRect(ctx, x, y, 480, 35, 14); ctx.fill(); ctx.stroke();
        ctx.fillStyle = color; ctx.font = "800 13px ui-sans-serif, system-ui"; ctx.fillText(m.text, x + 14, y + 23); y += 43;
      });
      ctx.restore();
    }

    drawParticles(ctx) {
      ctx.save();
      for (const p of this.particles) {
        const a = clamp(p.life / p.maxLife, 0, 1);
        ctx.globalAlpha = a;
        ctx.fillStyle = p.color; ctx.shadowColor = p.color; ctx.shadowBlur = 12;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }

    roundRect(ctx, x, y, w, h, r) {
      const rr = Math.min(r, w / 2, h / 2);
      ctx.beginPath(); ctx.moveTo(x + rr, y); ctx.arcTo(x + w, y, x + w, y + h, rr); ctx.arcTo(x + w, y + h, x, y + h, rr); ctx.arcTo(x, y + h, x, y, rr); ctx.arcTo(x, y, x + w, y, rr); ctx.closePath();
    }
  }

  window.addEventListener("DOMContentLoaded", () => new Game());
})();
