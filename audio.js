/*! NEON DRIFT | Made by bal1st1k */
/* NEON DRIVE — original procedural audio. No media files or background timers. */
(function (root) {
  'use strict';

  const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
  const midi = note => 440 * Math.pow(2, (note - 69) / 12);

  // Original, deliberately stylised synthesis; these are not recordings of real cars.
  // Pulse positions describe one exhaust cycle, including unequal manifold arrivals.
  const four = [0, 0.25, 0.5, 0.75];
  const six = [0, 1 / 6, 2 / 6, 0.5, 4 / 6, 5 / 6];
  const profile = (name, values = {}) => Object.freeze({ name, idle: 850, redline: 7600,
    pulses: four, weights: [1, 0.86, 0.96, 0.9], cycle: 0.5, decay: 0.92,
    rasp: 0.12, body: 0.24, intake: 0.12, cutoff: 1650, resonance: 0.65,
    turbo: 0, spool: 0.3, whistle: 1600, cam: 1, gears: 5, roughness: 3, ...values });
  const profiles = Object.freeze({
    s14b25:profile('S14B25 · Sport Evolution',{redline:7250,gears:5,body:.2,intake:.32,rasp:.26,cutoff:2450,decay:.78}),
    s50b32:profile('S50B32 · Euro six',{redline:7600,gears:6,pulses:six,weights:[1,.98,.96,1,.97,.98],body:.35,intake:.26,rasp:.16,cutoff:2200,roughness:1.5}),
    s54b32:profile('S54B32 · high rev',{redline:8000,gears:6,pulses:six,weights:[1,.93,.98,.95,1,.94],body:.23,intake:.34,rasp:.33,cutoff:2900,decay:.72,roughness:2}),
    'modular-46-3v': profile('Modular 4.6 · American V8', {idle:750,redline:6250,gears:5,pulses:[0,.08,.25,.42,.5,.58,.75,.92],weights:[1,.86,.94,.8,1,.88,.96,.82],body:.55,decay:1.18,cutoff:1500,intake:.24,rasp:.24,roughness:5}),
    '3au': profile('3A-U · спокойная четвёрка', { redline: 6200, decay: 1.25, cutoff: 1100, rasp: 0.055, roughness: 5 }),
    '4age': profile('4A-GE · звонкий 16V', { redline: 7800, decay: 0.82, cutoff: 2050, intake: 0.18, rasp: 0.18 }),
    '4ageu': profile('4A-GEU · Akina', { redline: 8200, decay: 0.78, cutoff: 2200, intake: 0.23, rasp: 0.2, body: 0.2 }),
    'trd-4age': profile('TRD Group A · Project D', { idle: 1500, redline: 11000, decay: 0.66, cutoff: 3300,
      intake: 0.3, rasp: 0.34, body: 0.12, cam: 0.48, roughness: 7 }),
    '1zzfe': profile('1ZZ-FE · мягкая четвёрка', { redline: 6800, decay: 1.15, cutoff: 1450, intake: 0.1, rasp: 0.07 }),
    '3sge': profile('3S-GE · низкий атмосферный тон', { redline: 7600, body: 0.36, cutoff: 1800, intake: 0.17, decay: 0.96 }),
    '3sge-beams': profile('3S-GE BEAMS · впуск на верхах', { redline: 8000, body: 0.27, cutoff: 2250, intake: 0.25, cam: 0.64, rasp: 0.23 }),
    'b16b': profile('B16B · VTEC', { redline: 8600, body: 0.14, decay: 0.72, cutoff: 2600, intake: 0.29, cam: 0.64, rasp: 0.3 }),
    'b18c': profile('B18C · VTEC', { redline: 8500, body: 0.26, decay: 0.8, cutoff: 2350, intake: 0.27, cam: 0.62, rasp: 0.27 }),
    '1g-fe': profile('1G-FE · Lexus IS200', { redline: 6500, pulses:six, weights:[1,.96,.98,.94,1,.96], body:.28,decay:1.08,cutoff:1800,rasp:.09 }),
    '1jz-gte': profile('1JZ-GTE · Toyota turbo six', { redline: 7000, pulses:six, weights:[1,.97,1,.95,1,.98],turbo:.85,body:.37,decay:1.03,cutoff:1900,rasp:.12,whistle:1550,spool:.4 }),
    '2jz-ge': profile('2JZ-GE · Lexus IS300', { redline: 6800, pulses:six, weights:[1,.95,1,.94,1,.97], body:.39,decay:1.04,cutoff:1950,intake:.2,rasp:.13 }),
    'k20a': profile('K20A · Civic FD2', { redline: 8400, gears: 6, body: 0.22, decay: 0.74, cutoff: 2500, intake: 0.28, cam: 0.64, rasp: 0.28 }),
    'bp-ve': profile('BP-VE · Roadster', { redline: 7500, body: 0.24, decay: 0.9, cutoff: 1950, intake: 0.2, rasp: 0.16 }),
    'b6-ze': profile('B6-ZE · Roadster NA', { redline: 7200, body: .18, decay: .95, cutoff: 1800, intake: .18, rasp: .12 }),
    '182-b6': profile('Fiat · cinque cilindri', {redline:7200,pulses:[0,.2,.4,.6,.8],weights:[1,.88,.98,.9,.95],turbo:.82,body:.32,rasp:.2,cutoff:2100}),
    'ar67203': profile('Alfa Q4 · turbo', {redline:7000,turbo:.76,body:.33,rasp:.21}),
    'ar16102': profile('Busso · V6 24V', {redline:7200,pulses:six,weights:[1,.87,.97,.84,1,.9],body:.38,intake:.28,rasp:.22,cutoff:2350}),
    '835a8': profile('Lancia · Sedici', {redline:7000,turbo:.88,body:.35,rasp:.24,spool:.4}),
    'type-930-60': profile('Type 930/60 · Blackbird', { idle:900, redline:6800, gears:4, pulses:six, weights:[1,.92,.98,.9,1,.94], turbo:.95, body:.42, decay:1.08, cutoff:1850, intake:.22, rasp:.22, whistle:1450, spool:.52 }),
    'm102-992': profile('M102.992 · Evolution II', { redline: 7700, body: .32, decay: .87, cutoff: 2050, intake: .2, rasp: .2 }),
    'l24': profile('L24 · Fairlady Z', { redline: 7000, pulses: six, weights: [1, 0.96, 1, 0.95, 1, 0.97], body: 0.35, decay: 1.05, cutoff: 1900, rasp: 0.13 }),
    'vq35de': profile('VQ35DE · Fairlady Z', { redline: 7000, gears: 6, pulses: six, weights: [1, 0.85, 0.96, 0.82, 1, 0.88], body: 0.4, cutoff: 1850, rasp: 0.2 }),
    'f20c': profile('F20C · S2000', { idle: 950, redline: 9000, gears: 6, body: 0.17, decay: 0.67,
      cutoff: 2900, intake: 0.32, cam: 0.63, rasp: 0.32, weights: [1, 0.96, 1, 0.94] }),
    'c30a': profile('C30A · V6', { redline: 8200, pulses: six, weights: [1, 0.8, 0.94, 0.84, 1, 0.86],
      body: 0.31, decay: 0.92, cutoff: 2350, intake: 0.22, cam: 0.65, rasp: 0.15 }),
    'ca18det': profile('CA18DET · ранняя турбо Silvia', { redline: 7500, turbo: 0.72, cutoff: 1550, decay: 0.88, rasp: 0.18, whistle: 1900 }),
    'sr20det': profile('SR20DET · турбо Silvia', { redline: 7500, turbo: 0.85, body: 0.33, cutoff: 1700, rasp: 0.21, whistle: 1700 }),
    'rb25det': profile('RB25DET · рядная шестёрка', { redline: 7200, pulses: six, weights: [1, 0.98, 1, 0.96, 1, 0.98],
      turbo: 0.7, body: 0.26, decay: 1.05, cutoff: 2100, rasp: 0.1, whistle: 1500, roughness: 1.5 }),
    'rb26dett': profile('RB26DETT · GT-R', { redline: 8000, gears: 6, pulses: six, weights: [1, 0.97, 1, 0.97, 1, 0.97],
      turbo: 0.85, body: 0.24, decay: 0.83, cutoff: 2600, rasp: 0.19, whistle: 1950, roughness: 1.5 }),
    '2jzgte': profile('2JZ-GTE · глубокая шестёрка', { redline: 7200, gears: 6, pulses: six, weights: [1, 0.96, 1, 0.98, 1, 0.96],
      turbo: 1, body: 0.48, decay: 1.12, cutoff: 1700, rasp: 0.1, whistle: 1350, spool: 0.44, roughness: 2 }),
    '4g63t': profile('4G63T · Lancer Evolution', { redline: 7800, turbo: 1, body: 0.4, decay: 0.78,
      cutoff: 1850, rasp: 0.24, whistle: 2050, roughness: 4 }),
    'ej207': profile('EJ207 · оппозитный рокот', { redline: 8000, pulses: [0, 0.19, 0.5, 0.69],
      weights: [1, 0.74, 0.98, 0.76], turbo: 0.9, body: 0.48, decay: 0.95, cutoff: 1600, rasp: 0.16, roughness: 8 }),
    '13b-rew': profile('13B-REW · роторный RX-7', { idle: 1050, redline: 8500, cycle: 1, pulses: [0, 0.5],
      weights: [1, 0.94], turbo: 0.8, body: 0.13, decay: 0.65, cutoff: 3000, rasp: 0.28,
      intake: 0.2, whistle: 2300, roughness: 9 })
  });

  function getEngineProfile(engine) {
    const id = engine && (engine.engineId || engine.build?.engineId || engine.car?.stockEngineId);
    return profiles[id] || profiles['4age'];
  }

  function exhaustCoefficients(sound) {
    const real = new Float32Array(65), imag = new Float32Array(65);
    for (let harmonic = 1; harmonic < real.length; harmonic++) {
      for (let pulse = 0; pulse < sound.pulses.length; pulse++) {
        const phase = sound.pulses[pulse] * Math.PI * 2 * harmonic;
        const amplitude = sound.weights[pulse] / Math.pow(harmonic, sound.decay);
        real[harmonic] += Math.cos(phase) * amplitude;
        imag[harmonic] -= Math.sin(phase) * amplitude;
      }
    }
    return { real, imag };
  }

  class AudioSystem {
    constructor() {
      this.enabled = true;
      this.musicEnabled = false;
      this.volume = 0.42;
      this.context = null;
      this.supported = !!(root.AudioContext || root.webkitAudioContext);
      this.destroyed = false;
      this._voices = new Set();
      this._persistent = [];
      this._musicStep = 0;
      this._nextBeat = 0;
      this._lastSpeed = 0;
      this._waves = new Map();
      this._race = null;
      this._profile = null;
      this._rpm = 850;
      this._gear = 1;
      this._load = this._spool = this._release = this._shift = this._shiftCooldown = 0;
      this._beatLength = 60 / 112 / 4;
    }

    // Call from a click, pointerdown or keyboard gesture. Browsers own this gate.
    async unlock() {
      if (this.destroyed || !this.supported) return false;
      try {
        if (!this.context) this._create();
        if (this.context.state !== 'running') await this.context.resume();
        this._nextBeat = this.context.currentTime + 0.04;
        return this.context.state === 'running';
      } catch (_) {
        return false;
      }
    }

    setEnabled(enabled) {
      this.enabled = !!enabled;
      this._setMaster();
      if (!this.enabled) this._silenceMotion();
    }

    setVolume(volume) {
      const value = Number(volume);
      this.volume = Number.isFinite(value) ? clamp(value, 0, 1) : this.volume;
      this._setMaster();
    }

    setMusicEnabled(enabled) {
      this.musicEnabled = !!enabled;
      if (!this.context) return;
      this._target(this.musicBus.gain, this.musicEnabled ? 0.32 : 0, 0.2);
      this._nextBeat = this.context.currentTime + 0.04;
    }

    _create() {
      const AudioContext = root.AudioContext || root.webkitAudioContext;
      const ctx = new AudioContext({ latencyHint: 'interactive' });
      this.context = ctx;
      this.master = ctx.createGain();
      this.master.gain.value = this.enabled ? this.volume : 0;
      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -13;
      limiter.knee.value = 14;
      limiter.ratio.value = 5;
      limiter.attack.value = 0.006;
      limiter.release.value = 0.18;
      this.master.connect(limiter);
      limiter.connect(ctx.destination);
      this.effectsBus = ctx.createGain();
      this.effectsBus.gain.value = 0.65;
      this.effectsBus.connect(this.master);
      this.musicBus = ctx.createGain();
      this.musicBus.gain.value = this.musicEnabled ? 0.32 : 0;
      this.musicBus.connect(this.master);
      this._persistent.push(this.master, limiter, this.effectsBus, this.musicBus);

      const echo = ctx.createDelay(1);
      echo.delayTime.value = this._beatLength * 3;
      const feedback = ctx.createGain();
      feedback.gain.value = 0.22;
      const wet = ctx.createGain();
      wet.gain.value = 0.16;
      this.musicBus.connect(echo);
      echo.connect(feedback);
      feedback.connect(echo);
      echo.connect(wet);
      wet.connect(this.master);
      this._persistent.push(echo, feedback, wet);

      this.engineGain = ctx.createGain();
      this.engineGain.gain.value = 0;
      const engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 900;
      engineFilter.Q.value = 0.6;
      this.engineFilter = engineFilter;
      this.engineGain.connect(engineFilter);
      engineFilter.connect(this.effectsBus);
      this.engineOsc = ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 45;
      this.engineOsc.connect(this.engineGain);
      this.engineOsc.start();
      const harmonicGain = ctx.createGain();
      harmonicGain.gain.value = 0;
      this.harmonicGain = harmonicGain;
      this.engineHarmonic = ctx.createOscillator();
      this.engineHarmonic.type = 'triangle';
      this.engineHarmonic.frequency.value = 90;
      this.engineHarmonic.connect(harmonicGain);
      harmonicGain.connect(this.engineGain);
      this.engineHarmonic.start();
      this.bodyOsc = ctx.createOscillator();
      this.bodyOsc.type = 'triangle';
      this.bodyGain = ctx.createGain();
      this.bodyGain.gain.value = 0.2;
      this.bodyOsc.connect(this.bodyGain);
      this.bodyGain.connect(this.engineGain);
      this.bodyOsc.start();
      this.flutterOsc = ctx.createOscillator();
      this.flutterOsc.type = 'sine';
      this.flutterGain = ctx.createGain();
      this.flutterGain.gain.value = 3;
      this.flutterOsc.connect(this.flutterGain);
      this.flutterGain.connect(this.engineOsc.detune);
      this.flutterOsc.start();
      this._persistent.push(this.engineOsc, this.engineHarmonic,
        this.engineGain, engineFilter, harmonicGain, this.bodyOsc, this.bodyGain,
        this.flutterOsc, this.flutterGain);

      // One reusable noise buffer feeds both continuously changing road sounds.
      this.noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      let brown = 0;
      for (let i = 0; i < data.length; i++) {
        brown = (brown + (Math.random() * 2 - 1) * 0.035) / 1.035;
        data[i] = brown * 2.8;
      }
      const noise = ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;
      noise.loop = true;
      this.driftFilter = ctx.createBiquadFilter();
      this.driftFilter.type = 'bandpass';
      this.driftFilter.frequency.value = 2100;
      this.driftFilter.Q.value = 1.8;
      this.driftGain = ctx.createGain();
      this.driftGain.gain.value = 0;
      noise.connect(this.driftFilter);
      this.driftFilter.connect(this.driftGain);
      this.driftGain.connect(this.effectsBus);
      const boostFilter = ctx.createBiquadFilter();
      boostFilter.type = 'highpass';
      boostFilter.frequency.value = 400;
      this.boostGain = ctx.createGain();
      this.boostGain.gain.value = 0;
      noise.connect(boostFilter);
      boostFilter.connect(this.boostGain);
      this.boostGain.connect(this.effectsBus);
      this.intakeFilter = ctx.createBiquadFilter();
      this.intakeFilter.type = 'bandpass';
      this.intakeFilter.Q.value = 0.85;
      this.intakeGain = ctx.createGain();
      this.intakeGain.gain.value = 0;
      noise.connect(this.intakeFilter);
      this.intakeFilter.connect(this.intakeGain);
      this.intakeGain.connect(this.effectsBus);
      this.turboGain = ctx.createGain();
      this.turboGain.gain.value = 0;
      this.turboOsc = ctx.createOscillator();
      this.turboOsc.type = 'sine';
      this.turboOsc.connect(this.turboGain);
      this.turboGain.connect(this.effectsBus);
      this.turboOsc.start();
      this.releaseFilter = ctx.createBiquadFilter();
      this.releaseFilter.type = 'bandpass';
      this.releaseFilter.Q.value = 0.7;
      this.releaseFilter.frequency.value = 2300;
      this.releaseGain = ctx.createGain();
      this.releaseGain.gain.value = 0;
      noise.connect(this.releaseFilter);
      this.releaseFilter.connect(this.releaseGain);
      this.releaseGain.connect(this.effectsBus);
      noise.start();
      this._persistent.push(noise, this.driftFilter, this.driftGain,
        boostFilter, this.boostGain, this.intakeFilter, this.intakeGain,
        this.turboOsc, this.turboGain, this.releaseFilter, this.releaseGain);
    }

    _target(parameter, value, smoothing = 0.06) {
      if (!parameter || !this.context || this.context.state === 'closed') return;
      parameter.setTargetAtTime(value, this.context.currentTime, smoothing);
    }

    _setMaster() {
      if (this.master) this._target(this.master.gain, this.enabled ? this.volume : 0, 0.025);
    }

    _silenceMotion() {
      if (!this.context) return;
      this._target(this.engineGain.gain, 0, 0.08);
      this._target(this.driftGain.gain, 0, 0.06);
      this._target(this.boostGain.gain, 0, 0.08);
      this._target(this.intakeGain.gain, 0, 0.06);
      this._target(this.turboGain.gain, 0, 0.06);
      this._target(this.releaseGain.gain, 0, 0.06);
      this._load = this._spool = this._release = this._shift = 0;
    }

    _drive(engine, speed, delta, accelerating) {
      const sound = getEngineProfile(engine);
      const changed = this._profile !== sound;
      if (changed) {
        if (!this._waves.has(sound)) {
          const wave = exhaustCoefficients(sound);
          this._waves.set(sound, this.context.createPeriodicWave(wave.real, wave.imag));
        }
        this.engineOsc.setPeriodicWave(this._waves.get(sound));
        this.engineHarmonic.type = sound.cycle === 1 ? 'sawtooth' : 'triangle';
        this._profile = sound;
      }
      if (this._race !== engine || changed) {
        this._race = engine;
        this._gear = 1;
        this._rpm = sound.idle;
        this._load = this._spool = this._release = this._shift = this._shiftCooldown = 0;
      }
      const player = engine.player;
      const throttle = Number.isFinite(player.throttle) ? clamp(player.throttle, 0, 1) : (accelerating ? 1 : 0);
      const oldLoad = this._load;
      this._load += (throttle - this._load) * (1 - Math.exp(-delta / 0.07));
      const tuning = engine.effectiveUpgrades || engine.upgrades || {};
      const level = key => Number.isFinite(tuning[key]) ? clamp(tuning[key], 0, 3) : 0;
      const turbo = Math.max(sound.turbo, level('turbo') * 0.25);
      const exhaust = level('exhaust');
      const maxSpeed = Number.isFinite(engine._maxSpeed) ? engine._maxSpeed * 0.44 : 235;
      const limits = sound.gears === 4 ? [.26,.48,.73,1] : sound.gears === 6 ? [0.2, 0.34, 0.49, 0.66, 0.83, 1] : [0.22, 0.39, 0.58, 0.79, 1];
      const kmh = speed * 3.6;
      if (kmh < 1) this._gear = 1;
      const wheelRPM = gear => kmh / Math.max(20, maxSpeed * limits[gear - 1]) * sound.redline;
      this._shiftCooldown = Math.max(0, this._shiftCooldown - delta);
      this._shift = Math.max(0, this._shift - delta);
      let upshift = false;
      if (!this._shiftCooldown) {
        const previousGear = this._gear;
        if (wheelRPM(this._gear) > sound.redline * 0.94 && this._gear < sound.gears) {
          this._gear++;
          upshift = true;
        } else if (wheelRPM(this._gear) < sound.redline * 0.39 && this._gear > 1) {
          this._gear--;
        }
        if (this._gear !== previousGear) {
          this._shift = 0.13;
          this._shiftCooldown = 0.3;
        }
      }
      const clutch = clamp(kmh / 24, 0, 1);
      const freeRPM = sound.idle + throttle * (sound.redline - sound.idle) * 0.58;
      const targetRPM = clamp(freeRPM * (1 - clutch) + wheelRPM(this._gear) * clutch,
        sound.idle, sound.redline);
      this._rpm += (targetRPM - this._rpm) * (1 - Math.exp(-delta / (this._shift ? 0.045 : 0.11)));
      const rev = clamp((this._rpm - sound.idle) / (sound.redline - sound.idle), 0, 1);
      const cam = clamp((rev - sound.cam + 0.06) / 0.12, 0, 1);
      const spoolTarget = turbo * this._load * clamp((rev - 0.25) / 0.5, 0, 1);
      if ((oldLoad > 0.55 && throttle < 0.15) || upshift) this._release = Math.max(this._release, this._spool);
      this._spool += (spoolTarget - this._spool) * (1 - Math.exp(-delta / sound.spool));
      this._release *= Math.exp(-delta / 0.14);
      const firing = this._rpm / 60 * sound.cycle * sound.pulses.length;
      const shiftDip = this._shift ? 0.55 : 1;
      const limiter = rev > 0.975 && throttle > 0.8 ? (Math.sin(this.context.currentTime * 95) > 0 ? 0.55 : 1) : 1;
      this._target(this.engineOsc.frequency, this._rpm / 60 * sound.cycle, 0.025);
      this._target(this.engineHarmonic.frequency, firing * (sound.cycle === 1 ? 1.003 : 2.002), 0.025);
      this._target(this.bodyOsc.frequency, this._rpm / 120, 0.03);
      this._target(this.bodyGain.gain, sound.body + exhaust * 0.025, 0.08);
      this._target(this.harmonicGain.gain, sound.rasp * (0.12 + rev * this._load * (1 + cam * 0.5)), 0.055);
      this._target(this.flutterOsc.frequency, 13 + rev * 22, 0.12);
      this._target(this.flutterGain.gain, sound.roughness * (1 - rev * 0.65), 0.1);
      this._target(this.engineFilter.frequency, 350 + sound.cutoff * (0.22 + rev * 0.85) *
        (0.6 + this._load * 0.4) + cam * 650 + exhaust * 110, 0.065);
      this._target(this.engineFilter.Q, sound.resonance, 0.1);
      this._target(this.engineGain.gain, (0.055 + this._load * 0.075 + rev * 0.025) * shiftDip * limiter, 0.035);
      this._target(this.intakeFilter.frequency, 650 + firing * 3.5, 0.08);
      this._target(this.intakeGain.gain, sound.intake * rev * this._load * (0.3 + cam * 0.7), 0.07);
      this._target(this.turboOsc.frequency, sound.whistle * (0.65 + this._spool * 0.85), 0.1);
      this._target(this.turboGain.gain, this._spool * 0.018, 0.09);
      this._target(this.releaseGain.gain, this._release * 0.45, 0.018);
      this._target(this.releaseFilter.frequency, 1300 + this._release * 2200, 0.035);
    }

    update(engine, dt) {
      const ctx = this.context;
      if (!ctx || this.destroyed || ctx.state !== 'running') return;
      if (!this.enabled) {
        this._nextBeat = ctx.currentTime + 0.04;
        return;
      }
      const player = engine && engine.player;
      const active = !!player && (engine.state === 'running' || engine.state === 'countdown');
      if (active) {
        const rawSpeed = Number(player.speed);
        // Physics uses world units; its HUD maps one unit to 0.44 km/h.
        const speed = Number.isFinite(rawSpeed) ? Math.abs(rawSpeed) * (0.44 / 3.6) : 0;
        const delta = Number.isFinite(dt) ? clamp(dt, 1 / 240, 0.1) : 1 / 60;
        const accelerating = speed > this._lastSpeed + delta * 0.5;
        this._drive(engine, speed, delta, accelerating);
        this._target(this.driftGain.gain, player.drifting && speed > 5 ?
          clamp(speed / 80, 0.15, 0.7) : 0, 0.045);
        this._target(this.driftFilter.frequency, 1500 + Math.min(speed, 100) * 16, 0.15);
        this._target(this.boostGain.gain, player.boosting ? 0.25 : 0, 0.1);
        this._lastSpeed = speed;
      } else {
        this._silenceMotion();
        this._lastSpeed = 0;
      }
      if (this.musicEnabled) this._sequence();
      else this._nextBeat = ctx.currentTime + 0.04;
    }

    _trackVoice(source, nodes) {
      const voice = { source, nodes };
      this._voices.add(voice);
      source.onended = () => {
        this._voices.delete(voice);
        nodes.forEach(node => { try { node.disconnect(); } catch (_) {} });
      };
    }

    _tone(frequency, time, duration = 0.15, level = 0.12, type = 'triangle',
      destination = this.effectsBus, endFrequency = frequency) {
      if (!this.context || this._voices.size >= 48) return;
      const ctx = this.context;
      const osc = ctx.createOscillator();
      const envelope = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(frequency, time);
      if (endFrequency !== frequency) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), time + duration);
      }
      envelope.gain.setValueAtTime(0, time);
      envelope.gain.linearRampToValueAtTime(level, time + Math.min(0.012, duration / 4));
      envelope.gain.exponentialRampToValueAtTime(0.0001, time + duration);
      osc.connect(envelope);
      envelope.connect(destination);
      this._trackVoice(osc, [osc, envelope]);
      osc.start(time);
      osc.stop(time + duration + 0.02);
    }

    _noiseShot(time, duration, level, highpass) {
      if (!this.context || this._voices.size >= 48) return;
      const ctx = this.context;
      const source = ctx.createBufferSource();
      source.buffer = this.noiseBuffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = highpass;
      const envelope = ctx.createGain();
      envelope.gain.setValueAtTime(level, time);
      envelope.gain.exponentialRampToValueAtTime(0.0001, time + duration);
      source.connect(filter);
      filter.connect(envelope);
      envelope.connect(this.musicBus);
      this._trackVoice(source, [source, filter, envelope]);
      source.start(time);
      source.stop(time + duration + 0.02);
    }

    _sequence() {
      const now = this.context.currentTime;
      if (!this._nextBeat || this._nextBeat < now - 0.3) this._nextBeat = now + 0.025;
      // Bounded lookahead: hidden tabs never queue minutes of old music.
      let scheduled = 0;
      while (this._nextBeat < now + 0.12 && scheduled++ < 3) {
        const step = this._musicStep;
        const local = step % 16;
        const chord = Math.floor(step / 16) % 4;
        const roots = [45, 41, 48, 43];
        const intervals = chord === 0 ? [0, 3, 7, 10] : [0, 4, 7, 11];
        const pattern = [0, 2, 1, 3, 2, 1, 0, 2, 3, 2, 1, 2, 0, 1, 2, 3];
        const time = this._nextBeat;
        if (local % 2 === 0) {
          this._tone(midi(roots[chord] + 24 + intervals[pattern[local]]), time,
            0.19, 0.055, 'triangle', this.musicBus);
        }
        if ([0, 3, 6, 8, 11, 14].includes(local)) {
          this._tone(midi(roots[chord] - 12), time, 0.19, 0.13, 'triangle', this.musicBus);
        }
        if (local % 4 === 0) this._tone(110, time, 0.15, 0.22, 'sine', this.musicBus, 38);
        if (local === 4 || local === 12) this._noiseShot(time, 0.12, 0.23, 1200);
        if (local % 2 === 0) this._noiseShot(time, 0.035, 0.12, 6500);
        this._musicStep = (step + 1) % 64;
        this._nextBeat += this._beatLength;
      }
    }

    play(name) {
      if (!this.enabled || this.destroyed || !this.context || this.context.state !== 'running') return;
      const now = this.context.currentTime + 0.005;
      const note = (frequency, offset, duration, level = 0.14, type = 'triangle') =>
        this._tone(frequency, now + offset, duration, level, type);
      switch (name) {
        case 'click': note(740, 0, 0.045, 0.075); break;
        case 'start':
          [220, 330, 440].forEach((value, i) => note(value, i * 0.085, 0.18)); break;
        case 'countdown': note(440, 0, 0.14, 0.17, 'sine'); break;
        case 'go':
          note(660, 0, 0.36, 0.18); note(990, 0, 0.42, 0.08); break;
        case 'lap':
          [523.25, 659.25, 783.99].forEach((value, i) => note(value, i * 0.09, 0.25)); break;
        case 'finish':
          [440, 554.37, 659.25, 880].forEach((value, i) => note(value, i * 0.11, 0.55, 0.15)); break;
        case 'buy':
          note(659.25, 0, 0.12); note(987.77, 0.09, 0.24); break;
        case 'error':
          note(185, 0, 0.13, 0.11, 'sine'); note(138.59, 0.13, 0.18, 0.1, 'sine'); break;
        default: break;
      }
    }

    destroy() {
      if (this.destroyed) return;
      this.destroyed = true;
      for (const voice of this._voices) {
        voice.source.onended = null;
        try { voice.source.stop(); } catch (_) {}
        voice.nodes.forEach(node => { try { node.disconnect(); } catch (_) {} });
      }
      this._voices.clear();
      for (const node of this._persistent) {
        try { if (typeof node.stop === 'function') node.stop(); } catch (_) {}
        try { node.disconnect(); } catch (_) {}
      }
      this._persistent.length = 0;
      this._waves.clear();
      this._race = this._profile = null;
      if (this.context && this.context.state !== 'closed') {
        try { const closing = this.context.close(); if (closing && closing.catch) closing.catch(() => {}); }
        catch (_) {}
      }
      this.context = null;
      this.master = this.effectsBus = this.musicBus = null;
      this.engineOsc = this.engineHarmonic = this.engineGain = this.engineFilter = null;
      this.bodyOsc = this.bodyGain = this.flutterOsc = this.flutterGain = this.harmonicGain = null;
      this.intakeFilter = this.intakeGain = this.turboOsc = this.turboGain = this.releaseFilter = this.releaseGain = null;
      this.driftFilter = this.driftGain = this.boostGain = this.noiseBuffer = null;
    }
  }

  root.NDAudio = { AudioSystem, profiles, getEngineProfile, exhaustCoefficients };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.NDAudio;
})(typeof globalThis !== 'undefined' ? globalThis : window);
