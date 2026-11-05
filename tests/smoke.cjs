/* Run with: node tests/smoke.cjs — built-in Node modules only. */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const http = require('node:http');
const base = path.resolve(__dirname, '..');
let checks = 0;

function check(name, work) {
  const result = work();
  if (result && typeof result.then === 'function') {
    return result.then(() => { checks++; console.log(`PASS ${name}`); });
  }
  checks++;
  console.log(`PASS ${name}`);
}

// A deterministic WebAudio stand-in checks lifecycle and scheduled values,
// without requiring audio hardware or relaxing browser gesture restrictions.
class Param {
  constructor(value = 0) { this.value = value; }
  setValueAtTime(value, time) { this._set(value, time); }
  linearRampToValueAtTime(value, time) { this._set(value, time); }
  exponentialRampToValueAtTime(value, time) {
    assert.ok(value > 0, 'Exponential audio values must stay positive');
    this._set(value, time);
  }
  setTargetAtTime(value, time, constant) {
    assert.ok(constant > 0);
    this._set(value, time);
  }
  _set(value, time) {
    assert.ok(Number.isFinite(value), 'Scheduled audio value must be finite');
    assert.ok(Number.isFinite(time) && time >= 0, 'Scheduled audio time must be valid');
    this.value = value;
  }
}

class AudioNode {
  constructor(context) {
    this.context = context;
    this.gain = new Param();
    this.frequency = new Param();
    this.detune = new Param();
    this.Q = new Param();
    this.delayTime = new Param();
    this.threshold = new Param();
    this.knee = new Param();
    this.ratio = new Param();
    this.attack = new Param();
    this.release = new Param();
    this.connections = [];
    this.ended = false;
    context.nodes.push(this);
  }
  connect(node) { this.connections.push(node); return node; }
  disconnect() { this.connections.length = 0; }
  start(time = 0) { assert.ok(time >= 0); this.started = true; }
  setPeriodicWave(wave) { this.wave = wave; }
  stop(time = this.context.currentTime) { this.stopAt = time; }
}

class FakeAudioContext {
  static instances = [];
  constructor() {
    this.currentTime = 0;
    this.sampleRate = 8000;
    this.state = 'suspended';
    this.destination = {};
    this.nodes = [];
    FakeAudioContext.instances.push(this);
  }
  createGain() { return new AudioNode(this); }
  createDynamicsCompressor() { return new AudioNode(this); }
  createDelay() { return new AudioNode(this); }
  createBiquadFilter() { return new AudioNode(this); }
  createOscillator() { return new AudioNode(this); }
  createPeriodicWave(real, imag) {
    assert.equal(real.length, imag.length);
    assert.ok([...real, ...imag].every(Number.isFinite));
    return { real, imag };
  }
  createBufferSource() { return new AudioNode(this); }
  createBuffer(channels, length) {
    assert.equal(channels, 1);
    const data = new Float32Array(length);
    return { getChannelData: () => data };
  }
  async resume() { this.state = 'running'; }
  async close() { this.state = 'closed'; }
  advance(seconds) {
    this.currentTime += seconds;
    for (const node of this.nodes) {
      if (!node.ended && node.stopAt !== undefined && node.stopAt <= this.currentTime) {
        node.ended = true;
        if (node.onended) node.onended();
      }
    }
  }
}

function begin(engine) {
  for (let i = 0; i < 7 && engine.state === 'countdown'; i++) engine.update(0.5);
  assert.equal(engine.state, 'running');
}

function finitePlayer(engine) {
  for (const key of ['x', 'y', 'angle', 'vx', 'vy', 'speed', 'yawRate', 'nitro', 'integrity', 'progress']) {
    assert.ok(Number.isFinite(engine.player[key]), `Player ${key} must stay finite`);
  }
  assert.ok(engine.player.nitro >= 0 && engine.player.nitro <= 1);
  assert.ok(engine.player.integrity >= 0.25 && engine.player.integrity <= 1);
  assert.ok(engine.particles.length <= 130);
}

function engineChecks() {
  const core = require(path.join(base, 'engine.js'));
  const { Engine, tracks, cars, engines, upgrades, createTrack, computeBuild, getSwapPrice, getUpgradePrice } = core;
  check('all twenty-one routes preserve open endpoints, ordered gates and finite geometry', () => {
    assert.equal(tracks.length, 21);
    assert.equal(tracks.filter(track => track.closed === false).length, 18);
    assert.equal(new Set(tracks.map(track => track.id)).size, tracks.length);
    assert.equal(new Engine().track.id, 'akina');
    for (const meta of tracks) {
      const track = createTrack(meta.id);
      assert.ok(track.points.length >= 320);
      assert.ok(track.checkpoints.length >= 12 && track.checkpoints.length <= 31);
      assert.ok(track.length > 5000);
      assert.equal(track.segmentLengths.length, track.points.length - (track.closed ? 0 : 1));
      assert.ok(track.segmentLengths.every(length => length > 0 && Number.isFinite(length)));
      track.points.forEach(point => {
        assert.ok(Number.isFinite(point.angle));
        assert.ok(point.x > track.bounds.minX && point.x < track.bounds.maxX);
        assert.ok(point.y > track.bounds.minY && point.y < track.bounds.maxY);
        assert.ok(Math.abs(Math.hypot(point.normalX, point.normalY) - 1) < 1e-8);
      });
      for (let gate = 1; gate < track.checkpoints.length; gate++) {
        assert.ok(track.checkpoints[gate].distance > track.checkpoints[gate - 1].distance);
      }
      if (!track.closed) {
        const last = track.points[track.points.length - 1];
        const control = track.controlPoints[track.controlPoints.length - 1];
        assert.ok(Math.hypot(last.x - control.x, last.y - control.y) < 1e-6);
        assert.ok(Math.abs(last.distance - track.length) < 1e-6);
        assert.equal(track.checkpoints[track.checkpoints.length - 1].pointIndex, track.points.length - 1);
        assert.equal(track.raceType, 'sprint');
      } else assert.equal(track.raceType, 'circuit');
    }
    assert.equal(createTrack('missing').id, 'akina');
  });
  check('the supplied 55 cars, 43 engines and 11 upgrades form a complete usable catalogue', () => {
    assert.equal(cars.length, 55); assert.equal(engines.length, 43); assert.equal(upgrades.length, 11);
    assert.equal(cars[0].id, 'ae85');
    assert.equal(new Set(cars.map(car => car.id)).size, cars.length);
    for (let i = 0; i < cars.length; i++) {
      const car = cars[i], build = computeBuild(car.id);
      assert.ok(fs.statSync(path.join(base, car.sprite)).isFile(), 'Missing supplied car sprite: ' + car.id);
      assert.equal(build.powerHp, car.stockPowerHp);
      assert.equal(build.weightKg, car.weightKg);
      assert.equal(build.engineId, car.stockEngineId);
      assert.equal(getSwapPrice(car.id, car.stockEngineId), 0);
      assert.ok(car.price >= 6000);
      if (i) {
        assert.ok(car.powerToWeight >= cars[i - 1].powerToWeight);
        if(!car.shopExclusive){const previous=cars.slice(0,i).filter(item=>!item.shopExclusive).at(-1);if(previous)assert.ok(car.price>=previous.price);}
      }
      for (const engine of engines) {
        const swap = computeBuild(car.id, {}, engine.id);
        assert.ok(swap.weightKg > 500 && swap.powerHp > 0);
        assert.ok(Number.isFinite(swap.hpPerTonne));
        if(engine.priceBasis!=='fixed')assert.ok(getSwapPrice(car.id, engine.id) <= car.price * 0.75 + 50);
      }
    }
    for (const upgrade of upgrades) {
      assert.equal(upgrade.maxLevel, 3);
      assert.ok(getUpgradePrice(upgrade.id, 1, 'ae85') > getUpgradePrice(upgrade.id, 0, 'ae85'));
    }
    const stock = computeBuild('ae85');
    const swap = computeBuild('ae85', {}, 'rb26dett');
    assert.notEqual(swap.powerHp, stock.powerHp);
    assert.notEqual(swap.weightKg, stock.weightKg);
    assert.ok(swap.hpPerTonne > stock.hpPerTonne);
    const levels = Object.fromEntries(upgrades.map(upgrade => [upgrade.id, 3]));
    const tuned = computeBuild('ae85', levels, 'rb26dett');
    assert.ok(tuned.powerHp > swap.powerHp && tuned.weightKg < swap.weightKg);
  });
  check('all eleven upgrade types change actual acceleration, steering, braking, drift or nitro', () => {
    function response(levels, controls, speed = 0) {
      const race = new Engine({ trackId: 'harbor', carId: 'ae85', upgrades: levels });
      begin(race);
      race.player.vx = Math.cos(race.player.angle) * speed;
      race.player.vy = Math.sin(race.player.angle) * speed;
      race.player.speed = speed;
      race.update(0.4, controls);
      finitePlayer(race);
      return race.player;
    }
    const acceleration = response({}, { throttle: 1 }).speed;
    for (const id of ['turbo', 'intake', 'exhaust', 'ecu', 'weight', 'gearbox']) {
      assert.ok(response({ [id]: 3 }, { throttle: 1 }).speed > acceleration, id + ' must accelerate differently');
    }
    const steering = response({}, { throttle: 1, right: 0.3 }, 180).angle;
    for (const id of ['tires', 'suspension']) assert.notEqual(response({ [id]: 3 }, { throttle: 1, right: 0.3 }, 180).angle, steering);
    assert.ok(response({ brakes: 3 }, { brake: 1 }, 250).speed < response({}, { brake: 1 }, 250).speed);
    assert.notEqual(response({ differential: 3 }, { throttle: 1, right: 0.3, drift: 1 }, 250).vy,
      response({}, { throttle: 1, right: 0.3, drift: 1 }, 250).vy);
    const ordinary = response({}, { throttle: 1, boost: 1 }, 200);
    const nitro = response({ nitro: 3 }, { throttle: 1, boost: 1 }, 200);
    assert.ok(nitro.nitro > ordinary.nitro && nitro.speed > ordinary.speed);
  });
  check('stock 0–100 acceleration matches manufacturer references and tuning scales the result', () => {
    function benchmark(carId, options = {}) {
      const engine = new Engine({ trackId: 'harbor', carId, ...options }); begin(engine);
      let frames = 0;
      while (engine.player.speed * 0.44 < 100 && frames++ < 4200) {
        engine.update(1 / 120, { throttle: 1 });
        // Rolling-road fixture: retain real drivetrain updates without introducing road bends.
        engine.player.x = engine.track.start.x; engine.player.y = engine.track.start.y;
      }
      assert.ok(frames < 4200, carId + ' must reach 100 km/h');
      return { engine, time: frames / 120 };
    }
    for (const [id, seconds] of [['ae86', 8.3], ['mrs', 7.9], ['fd3s', 5.3]]) {
      const result = benchmark(id);
      assert.ok(Math.abs(result.time - seconds) < 0.12, id + ': ' + result.time);
      assert.equal(result.engine.performance.basis, 'manufacturer-reference');
      assert.ok(result.engine.performance.source.startsWith('https://'));
    }
    const starter = benchmark('ae85');
    assert.ok(starter.time > 10 && starter.time < 16);
    assert.equal(starter.engine.performance.basis, 'power-to-weight-estimate');
    const tuned = benchmark('ae86', { upgrades: { turbo: 3, gearbox: 3, weight: 3 } });
    assert.ok(tuned.time > 3.5 && tuned.time < 7);
    for (const car of cars) {
      const engine = new Engine({ carId: car.id, trackId: 'harbor' }); begin(engine);
      for (let frame = 0; frame < 240; frame++) {
        engine.update(1 / 120, { throttle: 1 });
        engine.player.x = engine.track.start.x; engine.player.y = engine.track.start.y;
      }
      assert.ok(engine.player.speed < engine._maxSpeed * 0.65, car.id + ' must not reach top speed in two seconds');
    }
  });
  check('mass creates steering and yaw inertia while weight reduction changes the response', () => {
    function pulse(weightLevel) {
      const engine = new Engine({ carId: 'bnr34', trackId: 'harbor', upgrades: { weight: weightLevel } }); begin(engine);
      const angle = engine.player.angle;
      engine.player.vx = Math.cos(angle) * 180; engine.player.vy = Math.sin(angle) * 180; engine.player.speed = 180;
      engine.update(0.15, { right: 1, throttle: 1 });
      return { engine, deflection: Math.abs(engine.player.angle - angle) };
    }
    const heavy = pulse(0), light = pulse(3);
    assert.ok(light.engine.build.weightKg < heavy.engine.build.weightKg);
    assert.ok(light.deflection > heavy.deflection * 1.1);
    assert.ok(light.engine.player.yawRate > heavy.engine.player.yawRate);
    const before = heavy.engine.player.angle;
    heavy.engine.update(0.05, {});
    assert.ok(heavy.engine.player.angle > before, 'Yaw cannot vanish instantly when the steering wheel is released');
    for (let frame = 0; frame < 180; frame++) heavy.engine.update(1 / 120, {});
    assert.ok(Math.abs(heavy.engine.player.yawRate) < 0.02);
    finitePlayer(heavy.engine); finitePlayer(light.engine);
  });
  check('equipped tuning cards affect the real build and preserve stronger paid legacy tuning', () => {
    const equipped = { turbo: 'turbo-red', weight: 'weight-yellow', tires: 'tires-red' };
    const cardRace = new Engine({ carId: 'ae86', cards: equipped });
    const legacyRace = new Engine({ carId: 'ae86', upgrades: { turbo: 3, weight: 2, tires: 3 } });
    assert.equal(cardRace.build.powerHp, legacyRace.build.powerHp);
    assert.equal(cardRace.build.weightKg, legacyRace.build.weightKg);
    assert.equal(cardRace._acceleration, legacyRace._acceleration);
    assert.equal(cardRace._grip, legacyRace._grip);
    assert.equal(cardRace.effectiveUpgrades.turbo, 3);
    assert.equal(cardRace.upgrades.turbo, 0, 'Equipping a card must not overwrite paid legacy levels');
    assert.equal(computeBuild('ae86', {}, undefined, equipped).powerHp, cardRace.build.powerHp);
    const strongerLegacy = new Engine({ upgrades: { turbo: 3 }, cards: { turbo: 'turbo-blue', tires: 'turbo-red' } });
    assert.equal(strongerLegacy.effectiveUpgrades.turbo, 3);
    assert.equal(strongerLegacy.effectiveUpgrades.tires, 0);
    cardRace.reset(); assert.equal(cardRace.build.powerHp, legacyRace.build.powerHp);
  });
  check('seeded rivals use diverse supplied sprites, accelerate fairly and maintain a close race pace', () => {
    const seen = new Set();
    for (let seed = 1; seed <= 32; seed++) {
      const engine = new Engine({ seed });
      const ids = engine.rivals.map(rival => rival.carId);
      assert.equal(new Set(ids).size, 3); assert.ok(!ids.includes(engine.car.id));
      ids.forEach(id => seen.add(id));
      assert.deepEqual(new Engine({ seed }).rivals.map(rival => rival.carId), ids);
    }
    assert.ok(seen.size >= 20);
    for (const options of [{ carId: 'ae85' }, { carId: 'gc8', upgrades: { turbo: 3, tires: 3, gearbox: 3 } }]) {
      const engine = new Engine({ trackId: 'akina', ...options }); begin(engine);
      for (let frame = 0; frame < 3600; frame++) {
        const previous = engine.rivals.map(rival => ({ distance: rival.raceDistance, speed: rival.speed }));
        engine.update(1 / 60, engine.getAutopilotInput());
        engine.rivals.forEach((rival, index) => {
          const moved = rival.raceDistance - previous[index].distance;
          assert.ok(moved >= 0);
          const withinFrameAcceleration = engine._acceleration * (2 + engine._nitroPower) / 3600;
          assert.ok(moved <= Math.max(rival.speed, previous[index].speed) / 60 + withinFrameAcceleration + 0.000001, 'Rivals must advance through speed, never teleport');
        });
      }
      const front = Math.max(...engine.rivals.map(rival => rival.raceDistance));
      assert.ok(front > engine._raceDistance * 0.86, 'Rivals must keep pace with the selected build');
      assert.ok(front < engine._raceDistance * 1.2 + 200, 'Rivals must not gain an unfair build-independent speed advantage');
    }
  });
  check('finish rewards require sustained progression and drift bonuses stay capped', () => {
    for (let position = 1; position <= 4; position++) for (const drift of [0, 1e9]) {
      const engine = new Engine(); engine.time = 100; engine.lapTimes = [100]; engine.bestLap = 100; engine.driftScore = drift;
      engine.rivals.forEach((rival, index) => { rival.finished = index < position - 1; rival.raceDistance = 0; });
      engine._finish();
      assert.equal(engine.position, position);
      assert.equal(engine.credits, [1000, 250, 175, 120][position - 1] + (drift ? 150 : 0));
      assert.ok(engine.credits >= 120 && engine.credits <= 1150);
      assert.equal(engine.result.credits, engine.credits);
    }
  });
  check('countdown, invalid time steps and oversized frames stay predictable', () => {
    const engine = new Engine();
    const snapshot = JSON.stringify(engine.getHUD());
    for (const delta of [0, -1, NaN, Infinity, undefined]) engine.update(delta, { throttle: 1 });
    assert.equal(JSON.stringify(engine.getHUD()), snapshot);
    engine.update(100, { throttle: 1 });
    assert.ok(Math.abs(engine.countdown - 2.5) < 1e-8);
    assert.equal(engine.player.speed, 0);
    begin(engine); assert.equal(engine.time, 0);
    engine.update(0.5, { throttle: 1 });
    assert.ok(engine.player.speed > 0);
    assert.ok(Math.abs(engine.time - 0.5) < 1e-8);
  });
  check('wet asphalt lengthens braking and lateral slide while fog keeps dry grip', () => {
    function sample(weather) {
      const engine = new Engine({ carId: 's2000', weather });
      engine.reset();
      begin(engine);
      const { player } = engine, x = Math.cos(player.angle), y = Math.sin(player.angle);
      player.vx = 160 * x - 30 * y;
      player.vy = 160 * y + 30 * x;
      player.steer = .1;
      engine.update(.2, { brake: 1, drift: 1, right: .1 });
      return { weather: engine.weather, speed: player.speed, lateral: -player.vx * Math.sin(player.angle) + player.vy * Math.cos(player.angle) };
    }
    const dry = sample(), rain = sample('rain'), fog = sample('fog');
    assert.deepEqual(sample('unknown'), dry);
    assert.equal(rain.weather, 'rain');
    assert.ok(rain.speed > dry.speed && rain.lateral > dry.lateral);
    assert.deepEqual(fog, { ...dry, weather: 'fog' });
  });
  check('rivals get ten distinct bounded lines ranked for the build and weather', () => {
    const dry = new Engine({ trackId: 'akina', carId: 's2000', seed: 1 });
    const wet = new Engine({ trackId: 'akina', carId: 's2000', weather: 'rain', seed: 1 });
    const lines = wet.racingLines;
    assert.equal(lines.length, 10);
    assert.equal(new Set(lines.map(line => line.points.map(({ x, y }) => x + ',' + y).join(';'))).size, 10);
    assert.equal(new Set(dry.rivals.map(rival => rival.lineRank)).size, 3);
    assert.equal(dry.rivals[0].lineRank, 1);
    assert.ok(lines[0].estimate > dry.racingLines[0].estimate);
    for (let rank = 0; rank < lines.length; rank++) {
      assert.ok(rank === 0 || lines[rank - 1].estimate <= lines[rank].estimate);
      lines[rank].points.forEach((point, i) => {
        const center = wet.track.points[i];
        assert.ok(Math.hypot(point.x - center.x, point.y - center.y) <= wet.track.width * .321);
      });
    }
    assert.equal(wet.rivals.length, 3);
    assert.deepEqual(wet.rivals.map(rival => rival.carId), dry.rivals.map(rival => rival.carId));
    assert.equal(new Engine({ mode:'random', weather:'fog' }).rivals.length, 3);
    assert.notEqual(wet.rivals[0].carId, wet.car.id);
    for (let seed = 1; seed <= 12; seed++) {
      const duel = new Engine({ mode: 'duel', seed });
      assert.ok(duel.rivals[0].lineRank <= 3);
    }
  });
  check('the three competitive lines match or beat player autopilot on dry and wet Akina', () => {
    for (const weather of ['dry', 'rain']) {
      for (const rank of [1, 2, 3]) {
        const duel = new Engine({ trackId: 'akina', carId: 'ae85', mode: 'duel', duelRole: 'lead', weather });
        const rival = duel.rivals[0];
        rival.lineRank = rank;
        begin(duel);
        for (let frame = 0; frame < 18000 && duel.state !== 'finished'; frame++) duel.update(1 / 60, duel.getAutopilotInput());
        assert.equal(duel.state, 'finished');
        const rivalTime = rival.finishTime - rival.releaseAt;
        assert.ok(rivalTime <= duel.result.time, `${weather} line ${rank}: ${rivalTime} vs ${duel.result.time}`);
      }
    }
  });
  check('Cat & Mouse holds the follower for 1.5 seconds and judges the gap at both finishes', () => {
    for (const role of ['lead', 'chase']) {
      const engine = new Engine({ mode: 'duel', duelRole: role, seed: 42 });
      begin(engine);
      for (let i = 0; i < 120; i++) engine.update(1 / 120, { throttle: 1 });
      assert.equal(engine.player.speed > 0, role === 'lead');
      assert.equal(engine.rivals[0].speed > 0, role === 'chase');
      for (let i = 0; i < 72; i++) engine.update(1 / 120, { throttle: 1 });
      assert.ok(engine.player.speed > 0 && engine.rivals[0].speed > 0);
      engine.time = 100;
      engine._finish();
      assert.equal(engine.state, 'running');
      assert.equal(engine.player.speed, 0);
      engine.rivals[0].finished = true;
      engine.rivals[0].finishTime = role === 'lead' ? 102 : 99;
      engine.update(1 / 120);
      assert.equal(engine.state, 'finished');
      assert.deepEqual(engine.result.duel, { role, margin: .5, won: true });
      assert.equal(engine.result.time, 100);
    }
  });
  check('Time Attack records a finished sprint and replays its own previous ghost', () => {
    const options = { mode: 'time-attack', trackId: 'akina', carId: 's2000', weather: 'fog' };
    const engine = new Engine(options);
    assert.equal(engine.rivals.length, 0);
    begin(engine);
    for (let i = 0; i < 18000 && engine.state !== 'finished'; i++) engine.update(1 / 60, engine.getAutopilotInput());
    assert.equal(engine.state, 'finished');
    const ghost = engine.bestGhost;
    assert.equal(ghost.time, engine.result.time);
    assert.equal(ghost.carId, 's2000');
    assert.ok(ghost.frames.length > 100);
    assert.equal(ghost.frames.at(-1)[0], Math.round(ghost.time * 1000));
    const retry = new Engine({ ...options, ghost });
    const x = retry.ghost.x, y = retry.ghost.y;
    begin(retry);
    for (let i = 0; i < 60; i++) retry.update(1 / 60);
    assert.ok(retry.ghost.visible);
    assert.ok(Math.hypot(retry.ghost.x - x, retry.ghost.y - y) > 10);
    assert.equal(retry.bestGhost, ghost);
    const circuit = new Engine({ ...options, trackId: 'harbor' });
    begin(circuit);
    for (let i = 0; i < 18000 && circuit.state !== 'finished'; i++) circuit.update(1 / 60, circuit.getAutopilotInput());
    assert.equal(circuit.lapTimes.length, 3);
    assert.equal(circuit.bestGhost.time, Math.min(...circuit.lapTimes));
  });
  check('ordered gates reject finish shortcuts, repeated starts and reverse crossings', () => {
    for (const trackId of ['akina', 'harbor']) {
      const engine = new Engine({ trackId });
      begin(engine);
      for (let i = 0; i < 30; i++) {
        engine.player.x = engine.track.start.x; engine.player.y = engine.track.start.y;
        engine.player.vx = engine.player.vy = 0; engine.update(1 / 60);
      }
      assert.equal(engine.lap, 1); assert.equal(engine.checkpoint, 0);
      assert.equal(engine.lapTimes.length, 0); assert.equal(engine.result, null);
      const gate = engine.track.checkpoints[1];
      engine.player.x = gate.x; engine.player.y = gate.y; engine.player.angle = gate.angle + Math.PI;
      engine.update(1 / 60);
      assert.equal(engine.checkpoint, 0, 'A reverse crossing must not count');
      engine.player.x = engine.track.finish.x; engine.player.y = engine.track.finish.y;
      engine.player.angle = engine.track.finish.angle; engine.update(1 / 60);
      assert.notEqual(engine.state, 'finished', 'Reaching the finish without gates must not finish');
    }
  });
  check('nitro, reverse, road barriers and drift retain finite working physics', () => {
    const engine = new Engine({ trackId: 'harbor' }); begin(engine);
    engine.player.vx = Math.cos(engine.player.angle) * 250;
    engine.player.vy = Math.sin(engine.player.angle) * 250;
    engine.player.speed = 250;
    engine.update(0.3, { throttle: 1, boost: 1 });
    assert.equal(engine.player.boosting, true); assert.ok(engine.player.nitro < 1);
    const spent = engine.player.nitro;
    engine.update(0.3, { throttle: 1 }); assert.ok(engine.player.nitro > spent);
    const reverse = new Engine(); begin(reverse); reverse.update(0.5, { brake: 1 });
    assert.ok(reverse.player.speed < -5 && reverse.player.speed > -25);
    const collision = new Engine(); begin(collision);
    collision.player.x += 100000; collision.player.y += 100000;
    collision.update(1 / 60, { throttle: 1 });
    assert.ok(collision.player.integrity < 1);
    assert.ok(collision.player.x < collision.track.bounds.maxX && collision.player.y < collision.track.bounds.maxY);
    const drift = new Engine({ trackId: 'harbor' }); begin(drift);
    drift.player.vx = Math.cos(drift.player.angle) * 300;
    drift.player.vy = Math.sin(drift.player.angle) * 300;
    drift.player.speed = 300;
    for (let i = 0; i < 40; i++) drift.update(1 / 60, { throttle: 1, right: 0.3, drift: 1 });
    assert.ok(drift.driftScore > 0 && drift.particles.length > 0);
    [engine, reverse, collision, drift].forEach(finitePlayer);
  });
  check('all sixteen reference sprints finish on starter, fast stock and fully swapped builds', () => {
    let races = 0;
    for (const track of tracks.filter(track => track.closed === false&&track.family!=='wangan')) {
      const variants = [
        { carId: 'ae85' },
        { carId: cars[cars.length - 1].id },
        { carId: 'ae85', engineId: 'rb26dett', upgrades: Object.fromEntries(upgrades.map(upgrade => [upgrade.id, 3])) }
      ];
      for (const variant of variants) {
        const engine = new Engine({ ...variant, trackId: track.id, seed: 7181 });
        let frame = 0;
        while (engine.state !== 'finished' && frame++ < 36000) {
          engine.update(1 / 60, engine.getAutopilotInput());
          if (frame % 240 === 0) finitePlayer(engine);
        }
        const label = track.id + '/' + variant.carId + '/' + (variant.engineId || 'stock');
        assert.equal(engine.state, 'finished', label);
        assert.equal(engine.totalLaps, 1); assert.equal(engine.lapTimes.length, 1);
        assert.equal(engine.checkpoint, engine.track.checkpoints.length - 1, label);
        assert.equal(engine.splits.length, engine.track.checkpoints.length - 1, label);
        assert.equal(engine.bestLap, engine.time);
        assert.ok(engine.time > 10 && engine.time < 550, label);
        assert.ok(engine.player.integrity > 0.95, label);
        assert.ok(engine.position >= 1 && engine.position <= 4);
        assert.equal(engine.getHUD().progress, 1);
        assert.equal(engine.getHUD().raceType, 'sprint');
        assert.equal(engine.result.credits, engine.credits);
        assert.ok(engine.result.credits >= 120 && engine.result.credits <= 1150);
        assert.equal(engine.result.lapTimes[0], engine.time);
        const snapshot = JSON.stringify([engine.player, engine.rivals, engine.result]);
        engine.update(10, { throttle: 1, boost: 1 });
        assert.equal(JSON.stringify([engine.player, engine.rivals, engine.result]), snapshot);
        races++;
      }
    }
    assert.equal(races, 48);
  });
  check('three legacy circuits still finish three ordered laps with the new garage', () => {
    for (const track of tracks.filter(track => track.closed !== false)) {
      const engine = new Engine({ trackId: track.id, carId: 'ae86' });
      let frame = 0;
      while (engine.state !== 'finished' && frame++ < 18000) engine.update(1 / 60, engine.getAutopilotInput());
      assert.equal(engine.state, 'finished', track.id);
      assert.equal(engine.totalLaps, 3); assert.equal(engine.lapTimes.length, 3);
      assert.ok(engine.lapTimes.every(time => time > 10));
      assert.ok(Math.abs(engine.lapTimes.reduce((a, b) => a + b, 0) - engine.time) < 1e-6);
    }
  });
  check('seeded simulation, reset and invalid upgrade inputs stay reproducible', () => {
    const options = { trackId: 'akina', carId: 's15', engineId: '2jzgte', seed: 6767,
      upgrades: { turbo: 2, tires: 1, nitro: 3 } };
    const a = new Engine(options), b = new Engine(options);
    for (let frame = 0; frame < 900; frame++) {
      a.update(1 / 60, a.getAutopilotInput()); b.update(1 / 60, b.getAutopilotInput());
    }
    assert.deepEqual(a.player, b.player); assert.deepEqual(a.rivals, b.rivals);
    a.reset(); assert.equal(a.track.id, options.trackId); assert.equal(a.car.id, options.carId);
    assert.equal(a.engineId, options.engineId); assert.equal(a.upgrades.turbo, 2);
    assert.equal(a.upgrades.tires, 1); assert.equal(a.upgrades.nitro, 3);
    assert.equal(a.time, 0); assert.equal(a.state, 'countdown');
    const sanitized = new Engine({ upgrades: { turbo: 500, tires: -1, nitro: 'bad', brakes: Infinity } });
    assert.equal(sanitized.upgrades.turbo, 3); assert.equal(sanitized.upgrades.tires, 0);
    assert.equal(sanitized.upgrades.nitro, 0); assert.equal(sanitized.upgrades.brakes, 0);
    finitePlayer(sanitized);
  });
  check('mixed extreme controls keep the simulation finite and particles bounded', () => {
    const engine = new Engine({ seed: 12 }); begin(engine);
    let state = 17;
    const random = () => { state = (state * 1664525 + 1013904223) >>> 0; return state / 4294967296; };
    for (let frame = 0; frame < 3600; frame++) {
      engine.update(frame % 13 === 0 ? 0.08 : 1 / 60, {
        throttle: random() > 0.2 ? 1 : NaN, brake: random() > 0.85 ? 1 : 0,
        right: random(), left: random(), drift: random() > 0.4 ? Infinity : 0,
        boost: random() > 0.4 ? 1 : 0
      });
      if (frame % 20 === 0) finitePlayer(engine);
    }
    finitePlayer(engine);
  });
}

function rendererChecks() {
  const core = require(path.join(base, 'engine.js'));
  const listeners = new Set();
  let drawCalls = 0;
  const validate = values => {
    for (const value of values) if (typeof value === 'number') {
      assert.ok(Number.isFinite(value), 'Canvas commands must contain finite coordinates');
    }
  };
  function fakeContext() {
    const target = { imageSmoothingEnabled: true };
    return new Proxy(target, {
      get(object, property) {
        if (property in object) return object[property];
        if (property === 'createLinearGradient' || property === 'createRadialGradient') {
          return (...args) => {
            validate(args);
            if (property === 'createRadialGradient') {
              assert.ok(args[2] >= 0 && args[5] >= 0, 'Gradient radii must stay non-negative');
            }
            return { addColorStop: (position, color) => {
              assert.ok(position >= 0 && position <= 1);
              assert.equal(typeof color, 'string');
            } };
          };
        }
        return (...args) => {
          drawCalls++;
          validate(args);
          if (property === 'arc') assert.ok(args[2] >= 0, 'Canvas arc radius must be non-negative');
          if (property === 'ellipse') assert.ok(args[2] >= 0 && args[3] >= 0);
        };
      }
    });
  }
  class FakeCanvas {
    constructor(width = 1280, height = 720) {
      this.width = this.clientWidth = width;
      this.height = this.clientHeight = height;
      this.context = fakeContext();
    }
    getContext() { return this.context; }
    getBoundingClientRect() { return { width: this.clientWidth, height: this.clientHeight }; }
  }
  const sandbox = {
    window: {
      devicePixelRatio: 3,
      addEventListener: (name, listener) => listeners.add(listener),
      removeEventListener: (name, listener) => listeners.delete(listener)
    },
    document: { createElement: name => {
      assert.equal(name, 'canvas');
      return new FakeCanvas();
    } }
  };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(base, 'renderer.js'), 'utf8'), sandbox);
  const { Renderer, drawMiniMap } = sandbox.NDRenderer;
  check('renderer draws every track, quality, minimap and reduced-motion path', () => {
    const canvas = new FakeCanvas();
    const renderer = new Renderer(canvas);
    assert.equal(renderer.dpr, 2);
    for (const quality of ['high', 'low']) {
      renderer.setQuality(quality);
      assert.ok(renderer.dpr <= (quality === 'high' ? 2 : 1.25));
      for (const track of core.tracks) {
        const engine = new core.Engine({ trackId: track.id });
        renderer.render(engine, 1 / 60, { overview: true });
        begin(engine);
        for (let frame = 0; frame < 120; frame++) {
          engine.update(1 / 60, { throttle: 1, right: 0.2, drift: 1, boost: 1 });
          renderer.render(engine, 1 / 60, { reducedMotion: frame % 2 === 0 });
        }
        renderer.render(engine, Infinity, { reducedMotion: true });
        engine.player.drifting = true;
        const frozenSkids = renderer.skids.length;
        const frozenParticles = renderer.particles.length;
        for (let frame = 0; frame < 30; frame++) renderer.render(engine, 0);
        assert.equal(renderer.skids.length, frozenSkids, 'Paused frames must not add skid marks');
        assert.equal(renderer.particles.length, frozenParticles, 'Paused frames must not add particles');
        drawMiniMap(new FakeCanvas(170, 120), engine.track, engine.player, engine.rivals);
        drawMiniMap(new FakeCanvas(170, 120), engine.track, null);
        assert.ok(Number.isFinite(renderer.camera.x) && Number.isFinite(renderer.camera.zoom));
        assert.ok(renderer.camera.zoom > 0);
        assert.ok(renderer.skids.length <= (quality === 'high' ? 650 : 250));
        assert.ok(renderer.particles.length <= (quality === 'high' ? 180 : 65));
      }
    }
    assert.ok(drawCalls > 1000);
    assert.equal(listeners.size, 1);
    renderer.destroy();
    renderer.destroy();
    assert.equal(listeners.size, 0);
    assert.equal(renderer.cache, null);
    assert.equal(renderer.skids.length, 0);
    renderer.render(new core.Engine(), 1 / 60);
  });
}

function documentChecks() {
  const html = fs.readFileSync(path.join(base, 'index.html'), 'utf8');
  const app = fs.readFileSync(path.join(base, 'app.js'), 'utf8');
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  const available = new Set(ids);
  check('page IDs, local assets and script dependency order match the application', () => {
    assert.equal(available.size, ids.length, 'HTML IDs must be unique');
    const scripts = [...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)].map(match => match[1].split('?')[0]);
    assert.deepEqual(scripts, ['catalog.js', 'tuning-cards.js', 'tracks.js', 'traffic.js', 'engine.js', 'shop.js', 'radio.js', 'autumn.js', 'progress.js', 'loot.js', 'renderer.js', 'audio.js', 'bmw-archive.js', 'bmw.js', 'vw.js', 'audi.js', 'garage.js', 'app.js']);
    const styles = [...html.matchAll(/<link\b[^>]*\bhref="([^"]+\.css(?:\?[^"]*)?)"/g)].map(match => match[1].split('?')[0]);
    for (const asset of [...scripts, ...styles]) {
      assert.ok(!asset.includes('://'), 'The game must remain independent of a network connection');
      assert.ok(fs.statSync(path.join(base, asset)).isFile(), `Missing asset ${asset}`);
    }
    assert.ok(styles.length > 0);
    for (const match of app.matchAll(/\$\(['"]#([\w-]+)/g)) {
      assert.ok(available.has(match[1]), `Missing DOM target #${match[1]}`);
    }
    for (const key of ['position', 'time', 'lap', 'progress', 'speed', 'nitro', 'integrity', 'best', 'combo', 'drift']) {
      assert.ok(available.has(`hud-${key}`), `Missing HUD target ${key}`);
    }
    for (const modal of ['settings', 'help', 'pause', 'results', 'import']) assert.ok(available.has(`modal-${modal}`));
    for (const match of html.matchAll(/<use\b[^>]*\bhref="#([^"]+)"/g)) {
      assert.ok(available.has(match[1]), `Missing SVG symbol #${match[1]}`);
    }
    assert.match(html, /<html\s+lang="ru"/);
  });

  const core = require(path.join(base, 'engine.js'));
  const { defaults, sanitize } = require(path.join(base, 'progress.js'));
  const plain = value => JSON.parse(JSON.stringify(value));
  check('version three defaults and schema mismatches restore the starter touge garage', () => {
    const clean = plain(defaults());
    assert.equal(clean.version, 3); assert.equal(clean.credits, 1200);
    assert.deepEqual(clean.owned, ['ae85']); assert.equal(clean.selectedCar, 'ae85');
    assert.equal(clean.selectedTrack, 'akina');
    assert.deepEqual(clean.inventory, { cases: { street: 0, s2000: 0, 'ae86-akina':0, 'ae86-project-d':0, legends:0,brothers:0,roadster:0,mercedes:0,blackbird:0,italy:0,mustang:0,bmw:0,vw:0,audi:0 }, cards: {} });
    for (const car of core.cars) assert.deepEqual(clean.equippedCards[car.id], {});
    for (const car of core.cars) {
      assert.equal(clean.selectedEngines[car.id], car.stockEngineId);
      assert.deepEqual(clean.ownedEngines[car.id], [car.stockEngineId]);
      assert.equal(Object.keys(clean.upgrades[car.id]).length, 11);
    }
    for (const input of [null, [], 5, { schema: 'other', version: 2 }, { schema: 'neon-drift', version: 9 }]) {
      assert.deepEqual(plain(sanitize(input)), clean);
    }
  });
  check('save validation bounds tuning and money, validates engine ownership and rejects unknown IDs', () => {
    const clean = plain(sanitize({
      schema: 'neon-drift', version: 2, credits: 1e40,
      owned: ['fd3s', 'fd3s', 'missing', 4], selectedCar: 'missing', selectedTrack: 'missing',
      upgrades: { ae85: { turbo: 99.8, tires: -50, nitro: '2.8' }, fd3s: { turbo: Infinity } },
      selectedEngines: { ae85: 'rb26dett', fd3s: 'sr20det' },
      ownedEngines: { ae85: ['rb26dett', 'rb26dett', '<script>'], fd3s: [] },
      career: { races: 2.7, wins: 100, totalDrift: -99, totalCredits: Infinity },
      records: {
        akina: { bestTime: 80, bestLap: 25, bestPosition: 999, bestDrift: -5, carId: '<script>', races: 0 },
        ridge: { bestTime: -2 }, downtown: { bestTime: '20' }, missing: { bestTime: 8 }
      },
      settings: { sound: 'false', music: true, volume: Infinity, quality: 'ultra', reducedMotion: true }
    }));
    assert.equal(clean.credits, 1e9);
    assert.deepEqual(clean.owned, ['ae85', 'fd3s']);
    assert.equal(clean.selectedCar, 'ae85'); assert.equal(clean.selectedTrack, 'akina');
    assert.equal(clean.upgrades.ae85.turbo, 3); assert.equal(clean.upgrades.ae85.tires, 0);
    assert.equal(clean.upgrades.ae85.nitro, 0); assert.equal(clean.upgrades.fd3s.turbo, 0);
    assert.equal(clean.selectedEngines.ae85, 'rb26dett');
    assert.equal(clean.selectedEngines.fd3s, core.cars.find(car => car.id === 'fd3s').stockEngineId);
    assert.equal(clean.ownedEngines.ae85.filter(engine => engine === 'rb26dett').length, 1);
    assert.ok(!clean.ownedEngines.ae85.includes('<script>'));
    assert.deepEqual(clean.career, { races: 2, wins: 2, totalDrift: 0, totalCredits: 0, totalCases: 0, openedCases: 0, craftedCards: 0 });
    assert.deepEqual(Object.keys(clean.records), ['akina']);
    assert.equal(clean.records.akina.carId, 'ae85'); assert.equal(clean.records.akina.bestPosition, 4);
    assert.equal(clean.records.akina.races, 1);
    assert.deepEqual(clean.settings, { sound: true, music: true, radio:false, radioStation:'eurobeat', radioVolume:.65, volume: .42, quality: 'high', reducedMotion: true });
    assert.deepEqual(plain(sanitize(clean)), clean, 'Sanitizing a clean save must stay stable');
  });
  check('version one migration preserves cars, old circuits, records, settings and tuning', () => {
    const clean = plain(sanitize({
      schema: 'neon-drift', version: 1, credits: 1234,
      owned: ['vector', 'specter', 'comet'], selectedCar: 'comet', selectedTrack: 'harbor',
      upgrades: { vector: { engine: 2, grip: 3, nitro: 1 }, specter: { engine: 1 } },
      records: { harbor: { bestTime: 76, bestLap: 24, bestPosition: 1, bestDrift: 560, carId: 'comet', races: 7 } },
      career: { races: 10, wins: 4, totalDrift: 4567, totalCredits: 3000 },
      settings: { sound: false, music: true, volume: .3, quality: 'low', reducedMotion: true }
    }));
    assert.equal(clean.version, 3); assert.equal(clean.credits, 12340);
    assert.deepEqual(clean.owned, ['ae85', 'ae86', 's15', 'fd3s']);
    assert.equal(clean.selectedCar, 'fd3s'); assert.equal(clean.selectedTrack, 'harbor');
    assert.equal(clean.upgrades.ae86.turbo, 2); assert.equal(clean.upgrades.ae86.tires, 3);
    assert.equal(clean.upgrades.ae86.nitro, 1); assert.equal(clean.upgrades.s15.turbo, 1);
    assert.equal(clean.upgrades.ae86.exhaust, 0);
    assert.equal(clean.records.harbor.carId, 'fd3s'); assert.equal(clean.records.harbor.bestTime, 76);
    assert.equal(clean.records.harbor.bestLap, 24); assert.equal(clean.records.harbor.races, 7);
    assert.equal(clean.career.totalCredits, 30000); assert.equal(clean.career.totalDrift, 4567);
    assert.deepEqual(clean.settings, { sound: false, music: true, radio:false, radioStation:'eurobeat', radioVolume:.65, volume: .3, quality: 'low', reducedMotion: true });
    assert.deepEqual(plain(sanitize(clean)), clean);
  });
  check('version two migration keeps earned money and paid tuning while adding an empty inventory', () => {
    const saved = plain(defaults());
    saved.version = 2; saved.credits = 23456;
    saved.upgrades.ae85.turbo = 3; saved.upgrades.ae85.tires = 2;
    saved.owned.push('ae86'); saved.selectedCar = 'ae86';
    saved.selectedEngines.ae86 = 'sr20det'; saved.ownedEngines.ae86.push('sr20det');
    delete saved.inventory; delete saved.equippedCards; delete saved.lastDrop;
    const clean = plain(sanitize(saved));
    assert.equal(clean.version, 3); assert.equal(clean.credits, 23456);
    assert.equal(clean.upgrades.ae85.turbo, 3); assert.equal(clean.upgrades.ae85.tires, 2);
    assert.equal(clean.selectedCar, 'ae86'); assert.equal(clean.selectedEngines.ae86, 'sr20det');
    assert.deepEqual(clean.inventory, { cases: { street: 0, s2000: 0, 'ae86-akina':0, 'ae86-project-d':0, legends:0,brothers:0,roadster:0,mercedes:0,blackbird:0,italy:0,mustang:0,bmw:0,vw:0,audi:0 }, cards: {} });
    assert.deepEqual(clean.equippedCards.ae86, {});
  });
}

async function serverChecks() {
  const { createServer, requestPath, insideRoot } = require(path.join(base, 'server.cjs'));
  check('local server rejects encoded traversal, device paths and hidden files', () => {
    for (const request of ['/../agents.md', '/%2e%2e/agents.md', '/%252e%252e/agents.md',
      '/C:%5CWindows', '/.git/config', '/%00', '/con', '/aux.txt', '/folder./file']) {
      assert.throws(() => requestPath(request), error => error.status === 403, request);
    }
    assert.throws(() => requestPath('/%zz'), error => error.status === 400);
    assert.throws(() => requestPath('http://example.com/'), error => error.status === 400);
    assert.equal(requestPath('/?v=1'), path.join(base, 'index.html'));
    assert.equal(insideRoot(path.resolve(base, '..', 'agents.md')), false);
    assert.equal(insideRoot(path.join(base, 'audio.js')), true);
  });
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const request = (url, method = 'GET') => new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port: server.address().port, path: url, method }, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => resolve({ status: response.statusCode, headers: response.headers, body: Buffer.concat(chunks).toString('utf8') }));
      response.on('error', reject);
    });
    req.on('error', reject);
    req.end();
  });
  try {
    await check('local hosting serves the game and handles HEAD, missing files and rejected writes', async () => {
      const home = await request('/');
      assert.equal(home.status, 200);
      assert.match(home.headers['content-type'], /text\/html/);
      assert.match(home.body, /NEON DRIFT/);
      assert.equal(home.headers['x-content-type-options'], 'nosniff');
      const style = await request('/styles.css');
      assert.equal(style.status, 200);
      assert.match(style.headers['content-type'], /text\/css/);
      const head = await request('/audio.js', 'HEAD');
      assert.equal(head.status, 200);
      assert.equal(head.body, '');
      assert.equal(Number(head.headers['content-length']), fs.statSync(path.join(base, 'audio.js')).size);
      assert.equal((await request('/missing-file.txt')).status, 404);
      assert.equal((await request('/../agents.md')).status, 403);
      const write = await request('/index.html', 'POST');
      assert.equal(write.status, 405);
      assert.equal(write.headers.allow, 'GET, HEAD');
      assert.equal(server.address().address, '127.0.0.1');
    });
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

async function audioChecks() {
  const { AudioSystem } = require(path.join(base, 'audio.js'));
  const original = global.AudioContext;
  const originalWebkit = global.webkitAudioContext;
  delete global.AudioContext;
  delete global.webkitAudioContext;
  await check('audio gracefully handles an unsupported browser', async () => {
    const audio = new AudioSystem();
    assert.equal(audio.supported, false);
    assert.equal(await audio.unlock(), false);
    audio.play('start');
    audio.setVolume(0.5);
    audio.setEnabled(false);
    audio.setMusicEnabled(true);
    audio.update(null, 1 / 60);
    audio.destroy();
    audio.destroy();
  });
  try {
    global.AudioContext = FakeAudioContext;
    const audio = new AudioSystem();
    await check('audio waits for an explicit unlock gesture', async () => {
      audio.play('start');
      audio.update({ state: 'running', player: { speed: 50 } }, 1 / 60);
      assert.equal(FakeAudioContext.instances.length, 0);
      assert.equal(await audio.unlock(), true);
      assert.equal(FakeAudioContext.instances.length, 1);
    });
    const ctx = audio.context;
    check('every installed engine has its own bounded audio profile; Evos share 4G63T', () => {
      const { profiles, getEngineProfile, exhaustCoefficients } = require(path.join(base, 'audio.js'));
      const catalog = require(path.join(base, 'catalog.js'));
      assert.deepEqual(Object.keys(profiles).sort(), catalog.engines.map(item => item.id).sort());
      for (const car of catalog.cars) assert.equal(getEngineProfile({ car }), profiles[car.stockEngineId]);
      const evos = catalog.cars.filter(car => car.id.startsWith('evo'));
      assert.equal(evos.length, 5);
      assert.equal(new Set(evos.map(car => getEngineProfile({ car }))).size, 1);
      assert.equal(getEngineProfile({ car: evos[0], engineId: '13b-rew' }), profiles['13b-rew']);
      assert.equal(getEngineProfile({ build: { engineId: 'f20c' } }), profiles.f20c);
      assert.equal(getEngineProfile({ engineId: 'unknown' }), profiles['4age']);
      const spectra = Object.values(profiles).map(sound => {
        const { real, imag } = exhaustCoefficients(sound);
        return [...real, ...imag].map(value => value.toFixed(5)).join(',');
      });
      assert.ok(new Set(spectra).size >= 12, 'Character must change the waveform, not just the label/pitch');
      const nodes = ctx.nodes.length;
      for (const id of Object.keys(profiles)) {
        const race = { engineId: id, state: 'running', _maxSpeed: 500,
          player: { speed: 0, throttle: 1 }, effectiveUpgrades: {} };
        for (let frame = 0; frame < 300; frame++) {
          race.player.speed = Math.min(500, frame * 2);
          ctx.advance(1 / 60);
          audio.update(race, 1 / 60);
          assert.ok(audio._rpm >= profiles[id].idle && audio._rpm <= profiles[id].redline);
          assert.ok(audio._gear >= 1 && audio._gear <= profiles[id].gears);
        }
      }
      assert.equal(ctx.nodes.length, nodes, 'Driving/switching cars must reuse the continuous audio graph');
      assert.equal(audio._waves.size, catalog.engines.length);
      const swapped = { engineId: 'f20c', state: 'running', _maxSpeed: 500,
        player: { speed: 500, throttle: 1 } };
      for (let i = 0; i < 180; i++) { ctx.advance(1 / 60); audio.update(swapped, 1 / 60); }
      assert.equal(audio._gear, 6);
      audio.update(null, 1 / 60);
      audio.update(swapped, 1 / 60);
      assert.equal(audio._gear, 6, 'Resuming a paused race must preserve the current gear');
      swapped.engineId = '4age';
      audio.update(swapped, 1 / 60);
      assert.ok(audio._gear <= 5 && Number.isFinite(audio._rpm), 'Changing a six-speed sound to five-speed must reset its gearbox');
    });
    check('turbo spools under load, vents on lift, and every engine bus stops on pause', () => {
      const race = { engineId: '4g63t', state: 'running', _maxSpeed: 500,
        player: { speed: 380, throttle: 1 }, effectiveUpgrades: {} };
      for (let i = 0; i < 180; i++) { ctx.advance(1 / 60); audio.update(race, 1 / 60); }
      assert.ok(audio.turboGain.gain.value > 0.001);
      race.player.throttle = 0;
      audio.update(race, 1 / 60);
      assert.ok(audio.releaseGain.gain.value > 0.05);
      audio.update(null, 1 / 60);
      for (const bus of ['engineGain', 'intakeGain', 'turboGain', 'releaseGain', 'driftGain', 'boostGain']) {
        assert.equal(audio[bus].gain.value, 0, bus);
      }
      race.engineId = '4age';
      for (let i = 0; i < 180; i++) { ctx.advance(1 / 60); audio.update(race, 1 / 60); }
      assert.equal(audio.turboGain.gain.value, 0, 'A stock atmospheric engine must not whistle');
      race.effectiveUpgrades.turbo = 3;
      race.player.throttle = 1;
      for (let i = 0; i < 180; i++) { ctx.advance(1 / 60); audio.update(race, 1 / 60); }
      assert.ok(audio.turboGain.gain.value > 0.001, 'Installing a turbo must change the sound');
      audio.update(null, 1 / 60);
    });
    check('audio reacts to driving and pauses its motion buses', () => {
      audio.update({ state: 'running', player: { speed: 64, drifting: true, boosting: true } }, 1 / 60);
      assert.ok(audio.engineGain.gain.value > 0);
      assert.ok(audio.driftGain.gain.value > 0);
      assert.ok(audio.boostGain.gain.value > 0);
      audio.update({ state: 'running', player: { speed: 150 } }, 1 / 60);
      const slowPitch = audio.engineOsc.frequency.value;
      audio.update({ state: 'running', player: { speed: 300 } }, 1 / 60);
      assert.notEqual(audio.engineOsc.frequency.value, slowPitch,
        'World-unit speed must retain useful engine pitch changes');
      audio.update(null, 1 / 60);
      assert.equal(audio.engineGain.gain.value, 0);
      assert.equal(audio.driftGain.gain.value, 0);
      assert.equal(audio.boostGain.gain.value, 0);
      audio.update({ state: 'running', player: { speed: NaN } }, NaN);
      audio.setVolume(10);
      assert.equal(audio.volume, 1);
      audio.setVolume(-1);
      assert.equal(audio.volume, 0);
      audio.setVolume(NaN);
      assert.equal(audio.volume, 0);
      audio.setVolume(0.42);
    });
    check('stationary rev preview reaches the limiter, blows off on lift and silences its buses', () => {
      const preview = { mode:'rev', state:'running', engineId:'vw-axx', player:{ speed:0, throttle:1 } };
      const step = () => { ctx.advance(1 / 60); audio.update(preview, 1 / 60); };
      for (let i = 0; i < 90; i++) step();
      assert.ok(audio._rpm > 6800 * .98 && audio._rpm <= 6800);
      assert.equal(audio._gear, 1);
      assert.ok(audio.turboGain.gain.value > .001);
      const limiterGains = new Set();
      for (let i = 0; i < 12; i++) {
        step();
        limiterGains.add(audio.engineGain.gain.value.toFixed(2));
      }
      assert.ok(limiterGains.size > 1);
      preview.player.throttle = 0;
      step();
      assert.ok(audio.releaseGain.gain.value > .05);
      for (let i = 0; i < 42; i++) step();
      assert.ok(audio._rpm < 1300);
      audio.update(null, 1 / 60);
      assert.equal(audio.engineGain.gain.value, 0);
      assert.equal(audio.releaseGain.gain.value, 0);
    });
    check('audio bounds simultaneous effects and releases ended nodes', () => {
      for (const name of ['click', 'start', 'countdown', 'go', 'lap', 'finish', 'buy', 'error']) audio.play(name);
      for (let i = 0; i < 300; i++) audio.play('click');
      assert.ok(audio._voices.size <= 48);
      ctx.advance(2);
      assert.equal(audio._voices.size, 0);
      const finishedNodes = ctx.nodes.filter(node => node.ended);
      assert.ok(finishedNodes.length > 0);
      assert.ok(finishedNodes.every(node => node.connections.length === 0));
    });
    check('procedural music stays bounded through a long run and tab suspension', () => {
      audio.setMusicEnabled(true);
      let peakVoices = 0;
      for (let frame = 0; frame < 3600; frame++) {
        ctx.advance(1 / 60);
        audio.update(null, 1 / 60);
        peakVoices = Math.max(peakVoices, audio._voices.size);
      }
      assert.ok(peakVoices > 2 && peakVoices <= 48);
      ctx.state = 'suspended';
      const before = audio._musicStep;
      audio.update(null, 90);
      assert.equal(audio._musicStep, before);
      ctx.state = 'running';
      ctx.advance(90);
      audio.update(null, 90);
      const beats = (audio._musicStep - before + 64) % 64;
      assert.ok(beats <= 3, 'Resuming must not replay stale music');
      audio.setEnabled(false);
      const voiceCount = audio._voices.size;
      audio.play('finish');
      assert.equal(audio._voices.size, voiceCount);
      assert.equal(audio.master.gain.value, 0);
    });
    await check('audio disposes every node and tolerates repeated destruction', async () => {
      audio.destroy();
      audio.destroy();
      assert.equal(audio._voices.size, 0);
      assert.equal(audio._persistent.length, 0);
      assert.equal(ctx.state, 'closed');
      assert.ok(ctx.nodes.every(node => node.connections.length === 0));
      assert.equal(await audio.unlock(), false);
    });
    await check('a rejected audio resume resolves without an unhandled promise', async () => {
      class DeniedContext extends FakeAudioContext {
        async resume() { throw new Error('Gesture denied'); }
      }
      global.AudioContext = DeniedContext;
      const denied = new AudioSystem();
      assert.equal(await denied.unlock(), false);
      denied.destroy();
    });
  } finally {
    if (original === undefined) delete global.AudioContext;
    else global.AudioContext = original;
    if (originalWebkit === undefined) delete global.webkitAudioContext;
    else global.webkitAudioContext = originalWebkit;
  }
}

async function main() {
  check('JavaScript files parse without external dependencies', () => {
    for (const name of ['catalog.js', 'tuning-cards.js', 'tracks.js', 'traffic.js', 'engine.js', 'radio.js', 'autumn.js', 'progress.js', 'loot.js', 'renderer.js', 'audio.js', 'vw.js', 'audi.js', 'garage.js', 'app.js', 'server.cjs']) {
      const file = path.join(base, name);
      assert.ok(fs.existsSync(file), `Missing application file ${name}`);
      new vm.Script(fs.readFileSync(file, 'utf8'), { filename: name });
    }
  });
  engineChecks();
  // The renderer sweep is expensive; rerun other checks separately after it passed.
  if(!process.argv.includes('--skip-renderer'))rendererChecks();
  documentChecks();
  await serverChecks();
  await audioChecks();
  console.log(`\n${checks} checks passed.`);
}

main().catch(error => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
