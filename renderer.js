/*! NEON DRIFT | Made by bal1st1k */
/* Nightdrive — deterministic scenery and a deliberately unrotated world camera. */
(function () {
  'use strict';

  const TAU = Math.PI * 2;
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const mix = (a, b, t) => a + (b - a) * t;
  const accentOf = track => track.accent || '#83f5cf';
  const COLORS = { ink: '#070b13', cyan: '#79edd7', lime: '#d7ff63', pink: '#fa78bc' };
  const spriteCache = new Map();
  const trackPaths = new WeakMap();
  const lanePaths = new WeakMap();
  const rasterScene=track=>track?.family==='wangan'||['iroha-autumn-night','usui-gorge-night','tsuchisaka-forest-day','akagi-night','enna-night'].includes(track?.sceneryTheme);

  function sourceNose(path) {
    if (/SiR-II|NSX|Subaru/i.test(path)) return Math.PI / 2;
    if (/Type R \(EK9\)|Integra|180sx|Aero_S14|K_s_S13|MR-S_|Supra_|Mazda RX|Evolution III|Evolution VI GSR/i.test(path)) return Math.PI;
    return -Math.PI / 2;
  }

  // Only edge-connected background pixels are removed. White paint enclosed by
  // the car's outline is retained; the owner's JPEG files are never changed.
  function prepareSprite(image) {
    const ratio = Math.min(1, 420 / Math.max(image.naturalWidth || image.width, image.naturalHeight || image.height));
    const canvas = makeCanvas((image.naturalWidth || image.width) * ratio, (image.naturalHeight || image.height) * ratio);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const bitmap = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = bitmap.data, w = canvas.width, h = canvas.height, n = w * h;
    let white = 0, black = 0;
    const inspect = p => {
      const i = p * 4, lo = Math.min(data[i], data[i + 1], data[i + 2]);
      const hi = Math.max(data[i], data[i + 1], data[i + 2]);
      if (lo > 235) white++; else if (hi < 23) black++;
    };
    for (let x = 0; x < w; x += Math.max(1, Math.floor(w / 35))) { inspect(x); inspect((h - 1) * w + x); }
    for (let y = 0; y < h; y += Math.max(1, Math.floor(h / 35))) { inspect(y * w); inspect(y * w + w - 1); }
    const whiteBackground = white >= black;
    const visited = new Uint8Array(n), queue = new Int32Array(n);
    let head = 0, tail = 0;
    const enqueue = p => {
      if (visited[p]) return;
      visited[p] = 1;
      const i = p * 4, lo = Math.min(data[i], data[i + 1], data[i + 2]);
      const hi = Math.max(data[i], data[i + 1], data[i + 2]);
      if (data[i + 3] === 0 || (whiteBackground ? lo >= 235 && hi - lo <= 25 : hi <= 23)) queue[tail++] = p;
    };
    for (let x = 0; x < w; x++) { enqueue(x); enqueue((h - 1) * w + x); }
    for (let y = 0; y < h; y++) { enqueue(y * w); enqueue(y * w + w - 1); }
    while (head < tail) {
      const p = queue[head++], x = p % w;
      data[p * 4 + 3] = 0;
      if (x > 0) enqueue(p - 1);
      if (x + 1 < w) enqueue(p + 1);
      if (p >= w) enqueue(p - w);
      if (p + w < n) enqueue(p + w);
    }
    let minX = w, minY = h, maxX = 0, maxY = 0;
    for (let p = 0; p < n; p++) if (data[p * 4 + 3] > 0) {
      const x = p % w, y = Math.floor(p / w);
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }
    if (minX > maxX || minY > maxY) return null;
    ctx.putImageData(bitmap, 0, 0);
    const trimmed = makeCanvas(maxX - minX + 1, maxY - minY + 1);
    trimmed.getContext('2d').drawImage(canvas, minX, minY, trimmed.width, trimmed.height, 0, 0, trimmed.width, trimmed.height);
    canvas.width = 1; canvas.height = 1;
    return trimmed;
  }

  function getSprite(path, angle) {
    if (!path || typeof Image === 'undefined') return null;
    if (spriteCache.has(path)) return spriteCache.get(path);
    while (spriteCache.size >= 64) {
      const oldest = spriteCache.keys().next().value;
      const entry = spriteCache.get(oldest);
      if (entry.canvas) { entry.canvas.width = 1; entry.canvas.height = 1; }
      spriteCache.delete(oldest);
    }
    const entry = { status: 'loading', canvas: null, angle: Number.isFinite(angle) ? angle : sourceNose(path) };
    spriteCache.set(path, entry);
    entry.ready = new Promise(resolve => {
      const image = new Image();
      image.onload = () => {
        try {
          // Prepared PNGs already contain transparency and face right. Drawing
          // an Image is permitted under file://; pixel readback is not needed.
          entry.canvas = /\.png(?:[?#]|$)/i.test(path) ? image : prepareSprite(image);
          entry.status = entry.canvas ? 'ready' : 'error';
        } catch (_) { entry.status = 'error'; }
        resolve(entry);
      };
      image.onerror = () => { entry.status = 'error'; resolve(entry); };
      image.src = path;
    });
    return entry;
  }

  function preloadSprites(cars) {
    return Promise.all((cars || []).map(car => getSprite(car.raceSprite || car.sprite, car.raceSprite ? 0 : car.spriteAngle)?.ready).filter(Boolean));
  }

  function rng(seed) {
    let s = (Number(seed) || 75619) >>> 0;
    return () => {
      s += 0x6D2B79F5;
      let t = Math.imul(s ^ s >>> 15, 1 | s);
      t ^= t + Math.imul(t ^ t >>> 7, 61 | t);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function rgba(hex, a) {
    if (!hex || hex[0] !== '#') return `rgba(121,237,215,${a})`;
    let h = hex.slice(1);
    if (h.length === 3) h = h.split('').map(v => v + v).join('');
    const n = parseInt(h.slice(0, 6), 16);
    return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`;
  }

  function pointsOf(track) { return track.points || []; }

  function getBounds(track) {
    if (track.bounds && Number.isFinite(track.bounds.minX)) return track.bounds;
    const p = pointsOf(track);
    if (!p.length) return { minX: -1600, minY: -1200, maxX: 1600, maxY: 1200 };
    return p.reduce((b, v) => ({
      minX: Math.min(b.minX, v.x), minY: Math.min(b.minY, v.y),
      maxX: Math.max(b.maxX, v.x), maxY: Math.max(b.maxY, v.y)
    }), { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity });
  }

  function trace(ctx, points, closed = true) {
    if (!points.length) return;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
    if (closed) ctx.closePath();
  }

  function getTrackPath(track) {
    if (typeof Path2D === 'undefined') return null;
    if (trackPaths.has(track)) return trackPaths.get(track);
    const points=pointsOf(track);
    if (!points.length) return null;
    const path=new Path2D(); path.moveTo(points[0].x,points[0].y);
    for(let i=1;i<points.length;i++) path.lineTo(points[i].x,points[i].y);
    if(track.closed!==false) path.closePath();
    trackPaths.set(track,path); return path;
  }

  function distanceToRoad(x, y, points, closed = true) {
    let nearest = Infinity;
    for (let i = closed ? 0 : 1; i < points.length; i++) {
      const a = points[i === 0 ? points.length - 1 : i - 1], b = points[i];
      const dx = b.x - a.x, dy = b.y - a.y;
      const t = clamp(((x - a.x) * dx + (y - a.y) * dy) / (dx * dx + dy * dy || 1), 0, 1);
      const xx = x - a.x - t * dx, yy = y - a.y - t * dy;
      nearest = Math.min(nearest, xx * xx + yy * yy);
    }
    return Math.sqrt(nearest);
  }

  function makeRoadQuery(points, closed) {
    const buckets = new Map(), cell = 420, reach = 1100;
    for (let i = closed ? 0 : 1; i < points.length; i++) {
      const a = points[i === 0 ? points.length - 1 : i - 1], b = points[i];
      const segment = { a, b, dx: b.x - a.x, dy: b.y - a.y };
      segment.squared = segment.dx * segment.dx + segment.dy * segment.dy || 1;
      const minX = Math.floor((Math.min(a.x, b.x) - reach) / cell);
      const maxX = Math.floor((Math.max(a.x, b.x) + reach) / cell);
      const minY = Math.floor((Math.min(a.y, b.y) - reach) / cell);
      const maxY = Math.floor((Math.max(a.y, b.y) + reach) / cell);
      for (let gx = minX; gx <= maxX; gx++) for (let gy = minY; gy <= maxY; gy++) {
        const key = gx + ':' + gy;
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key).push(segment);
      }
    }
    return (x, y) => {
      const nearby = buckets.get(Math.floor(x / cell) + ':' + Math.floor(y / cell));
      if (!nearby) return Infinity;
      let best = Infinity;
      for (const s of nearby) {
        const t = clamp(((x - s.a.x) * s.dx + (y - s.a.y) * s.dy) / s.squared, 0, 1);
        const dx = x - s.a.x - t * s.dx, dy = y - s.a.y - t * s.dy;
        best = Math.min(best, dx * dx + dy * dy);
      }
      return Math.sqrt(best);
    };
  }

  function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function makeCanvas(w, h) {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(w));
    canvas.height = Math.max(1, Math.round(h));
    return canvas;
  }

  class Renderer {
    constructor(canvas, options = {}) {
      if (!canvas || !canvas.getContext) throw new Error('Renderer requires a canvas.');
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d', { alpha: false });
      this.quality = options.quality === 'low' ? 'low' : 'high';
      this.width = 0;
      this.height = 0;
      this.dpr = 1;
      this.camera = { x: 0, y: 0, zoom: .7, ready: false };
      this.cache = null;
      this.cachedTrack = null;
      this.particles = [];
      this.skids = [];
      this.lastCars = new Map();
      this.elapsed = 0;
      this.lastIntegrity = 1;
      this.shake = 0;
      this.sceneryProps = [];
      this.sceneryGrid = new Map();
      this.sceneryReach = 190;
      this.roadTexture = [];
      this.usuiBridge = null; this.usuiBridgeArt = null; this.usuiBridgePattern = null;
      this.sceneryTiles = new Map();
      this.sceneryTileQueue = [];
      this.sceneryTilePending = new Set();
      this.sceneryGeneration = 0;
      this.sceneryIdleHandle = null;
      this.roadPath = null;
      this.highwayWorker = null;
      this.highwayWorkerReady = false;
      this.highwayWorkerTile = null;
      this.highwayViewKey = '';
      this.destroyed = false;
      this._resize = () => this.resize();
      window.addEventListener('resize', this._resize, { passive: true });
      this.resize();
    }

    resize() {
      if (this.destroyed) return;
      const rect = this.canvas.getBoundingClientRect();
      this.width = Math.max(1, Math.round(rect.width || this.canvas.clientWidth || 960));
      this.height = Math.max(1, Math.round(rect.height || this.canvas.clientHeight || 640));
      this.dpr = Math.min(window.devicePixelRatio || 1, this.quality === 'high' ? 2 : 1.25);
      this.canvas.width = Math.round(this.width * this.dpr);
      this.canvas.height = Math.round(this.height * this.dpr);
      this.ctx.imageSmoothingEnabled = true;
      const vignette = this.ctx.createRadialGradient(this.width * .5, this.height * .48, Math.min(this.width, this.height) * .15, this.width * .5, this.height * .5, Math.max(this.width, this.height) * .72);
      vignette.addColorStop(0, 'rgba(5,9,16,0)'); vignette.addColorStop(.6, 'rgba(5,9,16,.06)');
      vignette.addColorStop(1, 'rgba(5,9,16,.55)'); this.vignette = vignette;
    }

    setQuality(quality) {
      quality = quality === 'low' ? 'low' : 'high';
      if (quality === this.quality) return;
      this.quality = quality;
      this.cachedTrack = null;
      this.resize();
    }

    _buildEnvironment(track) {
      this._clearSceneryTiles();
      if(this.usuiBridgeArt){this.usuiBridgeArt.width=1;this.usuiBridgeArt.height=1;}this.usuiBridgeArt=null;this.usuiBridge=null;this.usuiBridgePattern=null;
      this.roadPath = null;
      if (this.cache) { this.cache.canvas.width = 1; this.cache.canvas.height = 1; this.cache = null; }
      this.sceneryProps = [];
      this.sceneryGrid = new Map();
      this.sceneryReach = 190;
      this.roadTexture = [];
      this._bakingEnvironment = true;
      const bounds = getBounds(track);
      const pad = 700;
      const world = {
        x: bounds.minX - pad, y: bounds.minY - pad,
        w: bounds.maxX - bounds.minX + pad * 2,
        h: bounds.maxY - bounds.minY + pad * 2
      };
      const scale = Math.min(this.quality === 'high' ? .8 : .48, Math.sqrt(6500000 / (world.w * world.h)));
      this._bakeScale = scale;
      const canvas = makeCanvas(world.w * scale, world.h * scale);
      const ctx = canvas.getContext('2d', { alpha: false });
      ctx.scale(scale, scale);
      ctx.translate(-world.x, -world.y);
      const random = rng(track.scenerySeed || ({ harbor: 7131, ridge: 9198, downtown: 4507 }[track.id]) || 911);
      const points = pointsOf(track);
      const roadDistance = makeRoadQuery(points, track.closed !== false);
      const width = track.width || 220;
      const accent = accentOf(track);
      const harbor = /harbor|port/i.test(track.id || '');
      const ridge = track.family !== 'wangan' && (track.closed === false || /ridge|mountain/i.test(track.id || ''));
      const akina = track.sceneryTheme === 'akina-rework';
      const iroha = track.sceneryTheme === 'iroha-autumn-night';
      const roadside = track.sceneryTheme==='akagi-night'||track.sceneryTheme==='enna-night';
      const usui = track.sceneryTheme === 'usui-gorge-night';
      const tsuchisaka=track.sceneryTheme==='tsuchisaka-forest-day';
      const bespoke=akina||iroha||usui||tsuchisaka||roadside;
      const base = ctx.createLinearGradient(world.x, world.y, world.x + world.w, world.y + world.h);
      base.addColorStop(0, tsuchisaka?'#70845a':usui?'#040911':iroha?'#03060c':akina ? '#101f20' : ridge ? '#101e20' : '#141722');
      base.addColorStop(.5, tsuchisaka?'#425f44':usui?'#07101b':iroha?'#060911':akina ? '#0a1720' : '#0d1520');
      base.addColorStop(1, tsuchisaka?'#89936a':usui?'#03080e':iroha?'#090c13':akina ? '#112024' : '#161321');
      ctx.fillStyle = base;
      ctx.fillRect(world.x, world.y, world.w, world.h);

      // A faint cadastral grid gives the city scale without competing with the circuit.
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(110,145,163,.045)';
      const grid = 110;
      ctx.beginPath();
      for (let x = Math.floor(world.x / grid) * grid; x < world.x + world.w; x += grid) {
        ctx.moveTo(x, world.y); ctx.lineTo(x, world.y + world.h);
      }
      for (let y = Math.floor(world.y / grid) * grid; y < world.y + world.h; y += grid) {
        ctx.moveTo(world.x, y); ctx.lineTo(world.x + world.w, y);
      }
      if (!bespoke) ctx.stroke();

      if (harbor) this._water(ctx, world, bounds, random, accent);
      if (ridge&&!iroha&&!usui&&!tsuchisaka&&!roadside) this._contours(ctx, world, bounds, random);
      if (ridge&&!iroha&&!usui&&!tsuchisaka&&!roadside) this._terrain(ctx, world, random);
      if (akina) this._akinaRelief(ctx, world, random);
      if(iroha)this._irohaRelief(ctx,world,random);
      if(usui)this._irohaRelief(ctx,world,random);

      // Empty parcels are selected against the actual road, including their full footprint.
      const cells = track.family==='wangan'?240:ridge ? scale < .3 ? 275 : 190 : 185;
      for (let y = world.y + 35; !bespoke && y < world.y + world.h; y += cells) {
        for (let x = world.x + 30; x < world.x + world.w; x += cells) {
          const cx = x + (random() - .5) * 65;
          const cy = y + (random() - .5) * 65;
          const bw = 70 + random() * (harbor ? 110 : 90);
          const bh = 66 + random() * 100;
          const d = roadDistance(cx, cy);
          if (d < width / 2 + Math.hypot(bw, bh) / 2 + 35) continue;
          if ((ridge && d > 1000)||(track.family==='wangan'&&d>900)) continue;
          if (harbor && cy > bounds.maxY - 235) {
            if (cy < bounds.maxY + 75 && random() > .32) this._containers(ctx, cx, cy, bw, random);
            continue;
          }
          if (ridge && random() < .8) {
            for (let t = 0; t < 3 + random() * 8; t++) {
              this._tree(ctx, cx + (random() - .5) * 130, cy + (random() - .5) * 120, 14 + random() * 24, random);
            }
          } else {
            this._building(ctx, cx, cy, bw, bh, random, accent, harbor);
          }
        }
      }

      // Small scattered foliage and light posts fill the verge, never the racing line.
      for (let i = 0; i < (bespoke ? 0 : ridge ? 180 : 85); i++) {
        const x = world.x + random() * world.w, y = world.y + random() * world.h;
        const d = roadDistance(x, y);
        if (d < width / 2 + 50 || d > 450 || (harbor && y > bounds.maxY - 260)) continue;
        this._tree(ctx, x, y, 10 + random() * 15, random);
      }

      if (ridge && !bespoke) for (let i = 4; i < points.length; i += 7) {
        const point = points[i], side = random() < .5 ? -1 : 1;
        const normalX = Number.isFinite(point.normalX) ? point.normalX : -Math.sin(point.angle || 0);
        const normalY = Number.isFinite(point.normalY) ? point.normalY : Math.cos(point.angle || 0);
        const offset = (width / 2 + 34 + random() * 180) * side;
        this._rock(ctx, point.x + normalX * offset, point.y + normalY * offset, 9 + random() * 18, random);
      }

      this._road(ctx, track, random);
      if (akina) this._buildAkinaScenery(ctx, track, roadDistance, rng((track.scenerySeed || 911) + 42876));
      if(iroha)this._buildIrohaScenery(ctx,track,roadDistance,rng((track.scenerySeed||911)+72019));
      if(roadside)this._buildRoadsideNight(ctx,track,roadDistance,rng((track.scenerySeed||911)+9421));
      if(usui){this._buildUsuiScenery(ctx,track,roadDistance,rng((track.scenerySeed||911)+57345));this._road(ctx,track,null,true);this._drawUsuiBridgeShadow(ctx,this.usuiBridge);}
      if(tsuchisaka){this._buildTsuchisakaScenery(ctx,track,roadDistance,rng(track.scenerySeed+6712));this._road(ctx,track,null,true);this._drawTsuchisakaRoadDetail(ctx,{x:world.x+world.w/2,y:world.y+world.h/2,zoom:1},world.w,world.h);}
      this._roadFurniture(ctx, track, random);
      if(track.family==='wangan'){
        this._buildWangan(ctx,track);
        this._drawWanganOverhead(ctx,track,{x:world.x+world.w/2,y:world.y+world.h/2,zoom:Math.min(this.width/world.w,this.height/world.h)});
      }
      this.roadPath = getTrackPath(track);
      this.cache = { canvas, world, scale };
      this.cachedTrack = track;
      this.lastCars.clear();
      this.skids.length = 0;
      this.particles.length = 0;
      this.camera.ready = false;
      this._bakingEnvironment = false;
      if(rasterScene(track))this._startHighwayWorker();
    }

    _rememberProp(prop) {
      this.sceneryProps.push(prop);
      this.sceneryReach = Math.max(this.sceneryReach, prop.radius || 0);
      const key = Math.floor(prop.x / 400) + ':' + Math.floor(prop.y / 400);
      if (!this.sceneryGrid.has(key)) this.sceneryGrid.set(key, []);
      this.sceneryGrid.get(key).push(prop);
    }

    _clearSceneryTiles() {
      this.sceneryGeneration++;
      if(this.highwayWorker)this.highwayWorker.terminate();
      this.highwayWorker=null;this.highwayWorkerReady=false;this.highwayWorkerTile=null;this.highwayViewKey='';
      if (this.sceneryIdleHandle !== null) {
        if (typeof cancelIdleCallback === 'function') cancelIdleCallback(this.sceneryIdleHandle);
        else if (typeof clearTimeout === 'function') clearTimeout(this.sceneryIdleHandle);
      }
      this.sceneryIdleHandle = null;
      for (const tile of this.sceneryTiles.values()) this._releaseTile(tile);
      this.sceneryTiles.clear(); this.sceneryTileQueue.length = 0; this.sceneryTilePending.clear();
    }

    _queueSceneryTile(gx, gy) {
      const key = gx + ':' + gy;
      if (this.sceneryTiles.has(key) || this.sceneryTilePending.has(key)) return;
      if (!this.highwayWorker && typeof requestIdleCallback !== 'function' && typeof setTimeout !== 'function') return;
      this.sceneryTilePending.add(key); this.sceneryTileQueue.push({gx,gy,key});
      this._scheduleSceneryTile();
    }

    _scheduleSceneryTile() {
      if (this.sceneryIdleHandle !== null || !this.sceneryTileQueue.length || this.destroyed) return;
      if(this.highwayWorker){
        if(!this.highwayWorkerReady||this.highwayWorkerTile)return;
        const tile=this.sceneryTileQueue.shift();this.highwayWorkerTile=tile;
        this.highwayWorker.postMessage({type:'tile',generation:this.sceneryGeneration,...tile});return;
      }
      const generation = this.sceneryGeneration;
      const work = () => {
        this.sceneryIdleHandle = null;
        if (this.destroyed || generation !== this.sceneryGeneration) return;
        const tile = this.sceneryTileQueue.shift();
        if (!tile) return;
        this.sceneryTilePending.delete(tile.key);
        const highway=rasterScene(this.cachedTrack), size=highway?512:400;
        const canvas = makeCanvas(size+2, size+2), ctx = canvas.getContext('2d');
        ctx.translate(1-tile.gx*size,1-tile.gy*size);
        if(highway)this._paintHighwayTile(ctx,tile.gx,tile.gy);
        else this._drawSceneryVector(ctx, {x:(tile.gx+.5)*size,y:(tile.gy+.5)*size,zoom:1}, size/2+1, size/2+1);
        this._storeSceneryTile(tile.key,canvas,highway?96:64);
        this._scheduleSceneryTile();
      };
      this.sceneryIdleHandle = typeof requestIdleCallback === 'function' ? requestIdleCallback(work, {timeout: 500}) : setTimeout(work, 16);
    }

    _releaseTile(tile) {
      if(typeof tile.close==='function')tile.close();else{tile.width=1;tile.height=1;}
    }

    _storeSceneryTile(key,tile,limit) {
      const previous=this.sceneryTiles.get(key);if(previous)this._releaseTile(previous);
      this.sceneryTiles.delete(key);
      while(this.sceneryTiles.size>=limit){const oldest=this.sceneryTiles.keys().next().value;this._releaseTile(this.sceneryTiles.get(oldest));this.sceneryTiles.delete(oldest);}
      this.sceneryTiles.set(key,tile);
    }

    _startHighwayWorker() {
      if(typeof Worker==='undefined'||typeof OffscreenCanvas==='undefined')return;
      const generation=this.sceneryGeneration;
      try{
        const worker=new Worker('highway-cache-worker.js?v=4.0.2');this.highwayWorker=worker;
        worker.onmessage=event=>{
          const data=event.data;
          if(this.destroyed||generation!==this.sceneryGeneration||worker!==this.highwayWorker){if(data.bitmap)data.bitmap.close();return;}
          if(data.type==='ready'){this.highwayWorkerReady=true;this._scheduleSceneryTile();}
          else if(data.type==='tile'){
            this.sceneryTilePending.delete(data.key);this.highwayWorkerTile=null;
            this._storeSceneryTile(data.key,data.bitmap,96);this._scheduleSceneryTile();
          }
        };
        worker.onerror=()=>{
          if(worker!==this.highwayWorker)return;
          worker.terminate();this.highwayWorker=null;this.highwayWorkerReady=false;
          if(this.highwayWorkerTile)this.sceneryTileQueue.unshift(this.highwayWorkerTile);
          this.highwayWorkerTile=null;this._scheduleSceneryTile();
        };
        worker.postMessage({type:'init',generation,track:this.cachedTrack,quality:this.quality,props:this.sceneryProps,texture:this.roadTexture});
      }catch(_){if(this.highwayWorker)this.highwayWorker.terminate();this.highwayWorker=null;}
    }

    _paintHighwayTile(ctx,gx,gy) {
      const size=512,camera={x:(gx+.5)*size,y:(gy+.5)*size,zoom:1};
      this._drawSceneryVector(ctx,camera,size/2+1,size/2+1);
      this._road(ctx,this.cachedTrack,null,true);
      this._drawRoadTexture(ctx,camera);
      if(this.cachedTrack.family==='wangan')this._drawWanganOverhead(ctx,this.cachedTrack,camera);
      if(this.cachedTrack.sceneryTheme==='iroha-autumn-night')this._drawIrohaRoadDetail(ctx,camera);
      if(this.cachedTrack.sceneryTheme==='usui-gorge-night')this._drawUsuiBridgeShadow(ctx,this.usuiBridge||this._usuiBridgeAt(this.cachedTrack));
      if(this.cachedTrack.sceneryTheme==='tsuchisaka-forest-day')this._drawTsuchisakaRoadDetail(ctx,camera);
    }

    _drawHighwayTiles(ctx,camera,player) {
      const size=512,halfW=this.width/camera.zoom/2+4,halfH=this.height/camera.zoom/2+4;
      const minX=Math.floor((camera.x-halfW)/size),maxX=Math.floor((camera.x+halfW)/size),minY=Math.floor((camera.y-halfH)/size),maxY=Math.floor((camera.y+halfH)/size);
      // Queue visible tiles first, then a ring and 1.5 seconds of travel ahead.
      const aheadX=(player?.vx||0)*1.5,aheadY=(player?.vy||0)*1.5;
      const aheadGX=Math.round(aheadX/size),aheadGY=Math.round(aheadY/size);
      const signature=[minX,maxX,minY,maxY,aheadGX,aheadGY].join(':');
      if(signature!==this.highwayViewKey){
        this.highwayViewKey=signature;
        const left=minX-1+Math.min(0,aheadGX),right=maxX+1+Math.max(0,aheadGX),top=minY-1+Math.min(0,aheadGY),bottom=maxY+1+Math.max(0,aheadGY);
        const requests=[];
        for(let gx=left;gx<=right;gx++)for(let gy=top;gy<=bottom;gy++){
          const visible=gx>=minX&&gx<=maxX&&gy>=minY&&gy<=maxY;
          requests.push({gx,gy,key:gx+':'+gy,priority:(visible?0:1000)+Math.hypot(gx-(camera.x+aheadX*.5)/size,gy-(camera.y+aheadY*.5)/size)});
        }
        requests.sort((a,b)=>a.priority-b.priority);
        const wanted=new Set(requests.slice(0,96).map(tile=>tile.key));
        this.sceneryTileQueue=this.sceneryTileQueue.filter(tile=>{if(wanted.has(tile.key))return true;this.sceneryTilePending.delete(tile.key);return false;});
        for(const tile of requests.slice(0,96))this._queueSceneryTile(tile.gx,tile.gy);
        const priorities=new Map(requests.map(tile=>[tile.key,tile.priority]));
        this.sceneryTileQueue.sort((a,b)=>(priorities.get(a.key)||0)-(priorities.get(b.key)||0));
      }
      for(let gx=minX;gx<=maxX;gx++)for(let gy=minY;gy<=maxY;gy++){
        const key=gx+':'+gy,tile=this.sceneryTiles.get(key);
        if(!tile)continue; // The complete low-resolution terrain is already underneath.
        this.sceneryTiles.delete(key);this.sceneryTiles.set(key,tile);
        ctx.drawImage(tile,1,1,size,size,gx*size,gy*size,size,size);
      }
    }

    _drawScenery(ctx, camera) {
      const size=400, halfW=this.width/camera.zoom/2+4, halfH=this.height/camera.zoom/2+4;
      const minX=Math.floor((camera.x-halfW)/size), maxX=Math.floor((camera.x+halfW)/size);
      const minY=Math.floor((camera.y-halfH)/size), maxY=Math.floor((camera.y+halfH)/size);
      this.sceneryTileQueue = this.sceneryTileQueue.filter(tile=>{
        const visible=tile.gx>=minX&&tile.gx<=maxX&&tile.gy>=minY&&tile.gy<=maxY;
        if (!visible) this.sceneryTilePending.delete(tile.key);
        return visible;
      });
      if ((maxX-minX+1)*(maxY-minY+1)>64) { this._drawSceneryVector(ctx,camera); return; }
      const tiles=[]; let ready=true;
      for(let gx=minX;gx<=maxX;gx++) {
        for(let gy=minY;gy<=maxY;gy++) {
          const key=gx+':'+gy, canvas=this.sceneryTiles.get(key);
          if (!canvas) { ready=false; this._queueSceneryTile(gx,gy); }
          tiles.push({gx,gy,key,canvas});
        }
      }
      if (!ready) { this._drawSceneryVector(ctx,camera); return; }
      for(const tile of tiles) {
        this.sceneryTiles.delete(tile.key); this.sceneryTiles.set(tile.key,tile.canvas);
        ctx.drawImage(tile.canvas,1,1,size,size,tile.gx*size,tile.gy*size,size,size);
      }
    }

    _drawSceneryVector(ctx, camera, viewHalfW = this.width / camera.zoom / 2, viewHalfH = this.height / camera.zoom / 2) {
      const halfW = viewHalfW + this.sceneryReach, halfH = viewHalfH + this.sceneryReach;
      const visible = [];
      for (let gx = Math.floor((camera.x - halfW) / 400); gx <= Math.floor((camera.x + halfW) / 400); gx++) {
        for (let gy = Math.floor((camera.y - halfH) / 400); gy <= Math.floor((camera.y + halfH) / 400); gy++) {
          const props = this.sceneryGrid.get(gx + ':' + gy);
          if (!props) continue;
          for (const p of props) if (Math.abs(p.x - camera.x) < halfW && Math.abs(p.y - camera.y) < halfH) visible.push(p);
        }
      }
      visible.sort((a, b) => (a.layer||0)-(b.layer||0)||a.y-b.y);
      for (const p of visible) {
        const random = rng(p.seed);
        if(p.type==='tsuchisaka-slope')this._tsuchisakaSlope(ctx,p);
        else if(p.type==='tsuchisaka-tree')this._tsuchisakaTree(ctx,p);
        else if(p.type==='tsuchisaka-wall')this._tsuchisakaWall(ctx,p);
        else if(p.type==='tsuchisaka-road')continue;
        else if(p.type==='tsuchisaka-detail')this._tsuchisakaDetail(ctx,p);
        else if(p.type==='usui-slope')this._usuiSlope(ctx,p);
        else if(p.type==='usui-cliff')this._usuiCliff(ctx,p);
        else if(p.type==='iroha-tree')this._irohaTree(ctx,p);
        else if(p.type==='iroha-wall')this._irohaWall(ctx,p);
        else if(p.type==='iroha-road')continue;
        else if(p.type==='roadside-tree')this._roadsideTree(ctx,p);
        else if(p.type==='roadside-slope')this._roadsideSlope(ctx,p);
        else if(p.type==='roadside-feature')this._roadsideFeature(ctx,p);
        else if(p.type==='roadside-relief')this._roadsideRelief(ctx,p);
        else if (p.type === 'tree') this._tree(ctx, p.x, p.y, p.size, random, false, p.evergreenOnly, p.night);
        else if (p.type === 'rock') this._rock(ctx, p.x, p.y, p.size, random, false);
        else if (p.type === 'massif') this._akinaMassif(ctx, p, false);
        else if (p.type === 'guardrail') this._akinaGuardrail(ctx, p);
        else if (p.type === 'highway-detail') this._wanganDetail(ctx,p);
        else if (p.type === 'highway-landmark') this._wanganLandmark(ctx,p);
        else if (p.type === 'mountain-sign') this._akinaSign(ctx, p);
        else this._building(ctx, p.x, p.y, p.w, p.h, random, p.accent, p.industrial, false);
      }
    }

    _buildWangan(ctx,track) {
      const east=track.id==='wangan-east';
      for(let i=0;i<track.points.length-4;i+=4)for(const side of [-1,1]){
        const p=track.points[i],q=track.points[i+4],offset=(track.width/2+14)*side;
        const a={x:p.x+p.normalX*offset,y:p.y+p.normalY*offset},b={x:q.x+q.normalX*offset,y:q.y+q.normalY*offset};
        const prop={type:'guardrail',x:(a.x+b.x)/2,y:(a.y+b.y)/2,a,b,radius:Math.hypot(b.x-a.x,b.y-a.y)/2+15,post:true,reflector:i%12===0};
        this._rememberProp(prop);this._akinaGuardrail(ctx,prop);
      }
      // Repeating highway furniture is baked and included in the scenery tile cache.
      for(let i=8;i<track.points.length-8;i+=8){
        const p=track.points[i],q=track.points[i+8],span=Math.hypot(q.x-p.x,q.y-p.y);
        const side=i%16===0?1:-1;
        const wall={type:'highway-detail',kind:'wall',x:(p.x+q.x)/2,y:(p.y+q.y)/2,angle:Math.atan2(q.y-p.y,q.x-p.x),width:track.width,span,side,radius:span/2+210};
        this._rememberProp(wall);this._wanganDetail(ctx,wall);
        if(i%24===0){
          const prop={type:'highway-detail',kind:i%48===0?'tower':'junction',x:p.x+p.normalX*side*360,y:p.y+p.normalY*side*360,angle:p.angle,width:track.width,side,seed:i,radius:i%48===0?230:720};
          this._rememberProp(prop);this._wanganDetail(ctx,prop);
        }
      }
      const landmarks=east?[[.12,'bridge','鶴見つばさ橋 / TSURUMI'],[.32,'industry','扇島 / OHGISHIMA'],[.64,'tunnel','羽田空港 / HANEDA'],[.88,'toll','大井 / OHI TOLLGATE']]:[[.18,'airport','羽田空港 / HANEDA'],[.38,'airport','空港中央 / AIRPORT'],[.59,'tunnel','多摩川 / TAMAGAWA'],[.8,'toll','浮島 / UKIMA TOLLGATE']];
      for(const [fraction,kind,label] of landmarks){
        const p=track.points[Math.floor(fraction*(track.points.length-1))];
        const prop={type:'highway-landmark',x:p.x,y:p.y,angle:p.angle,width:track.width,kind,label,radius:360};
        this._rememberProp(prop);this._wanganLandmark(ctx,prop);
      }
    }

    _wanganDetail(ctx,p) {
      ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.angle);
      if(p.kind==='wall'){
        const edge=(p.width/2+38)*p.side,l=p.span;
        ctx.fillStyle='#0b151c';ctx.fillRect(-l/2+6,edge-5,l,32);
        ctx.fillStyle='#40555b';ctx.fillRect(-l/2,edge-12,l,22);
        ctx.fillStyle='#637a7d';ctx.fillRect(-l/2,edge-12,l,3);
        ctx.strokeStyle='#293f49';ctx.lineWidth=3;
        for(let x=-l/2;x<l/2;x+=22){ctx.beginPath();ctx.moveTo(x,edge-11);ctx.lineTo(x,edge+10);ctx.stroke();}
        ctx.fillStyle='#819a9b';ctx.fillRect(-3,edge-3,6,35*p.side);
        ctx.fillStyle='#e5d6a4';ctx.fillRect(-9,edge-8,18,5);
        const glow=ctx.createRadialGradient(0,edge,2,0,edge,55);glow.addColorStop(0,'rgba(255,225,157,.15)');glow.addColorStop(1,'rgba(255,225,157,0)');ctx.fillStyle=glow;ctx.fillRect(-55,edge-55,110,110);
      }else if(p.kind==='tower'){
        ctx.fillStyle='#080f18';ctx.fillRect(-52,-42,140,175);
        ctx.fillStyle='#253a4b';ctx.fillRect(-75,-80,140,160);
        ctx.fillStyle='#344e60';ctx.beginPath();ctx.moveTo(65,-80);ctx.lineTo(94,-52);ctx.lineTo(94,106);ctx.lineTo(65,80);ctx.closePath();ctx.fill();
        ctx.fillStyle='#4c6772';ctx.fillRect(-70,-76,130,10);
        for(let row=0;row<11;row++)for(let col=0;col<8;col++){ctx.fillStyle=(row+col+p.seed)%4===0?'#8baf9f':'#3c5869';ctx.fillRect(-66+col*16,-58+row*12,9,5);}
        ctx.fillStyle='#172934';ctx.fillRect(-24,-20,42,42);ctx.strokeStyle='#6c8790';ctx.lineWidth=2;ctx.strokeRect(-24,-20,42,42);ctx.fillStyle='#ab4b57';ctx.fillRect(10,-74,4,4);
      }else{
        ctx.strokeStyle='#111e25';ctx.lineCap='round';ctx.lineWidth=92;ctx.beginPath();ctx.moveTo(-650,p.side*100);ctx.bezierCurveTo(-240,p.side*100,170,-p.side*100,650,-p.side*100);ctx.stroke();
        ctx.strokeStyle='#64777b';ctx.lineWidth=78;ctx.stroke();ctx.strokeStyle='#27343d';ctx.lineWidth=72;ctx.stroke();
        ctx.setLineDash([18,24]);ctx.strokeStyle='#b6bcb4';ctx.lineWidth=2;ctx.stroke();ctx.setLineDash([]);
        ctx.fillStyle='#26533f';ctx.fillRect(80,-p.side*100-28,100,30);ctx.strokeStyle='#91bda1';ctx.lineWidth=1;ctx.strokeRect(80,-p.side*100-28,100,30);
        ctx.fillStyle='#d9e6d7';ctx.font='10px sans-serif';ctx.textAlign='center';ctx.fillText('出口 EXIT ↗',130,-p.side*100-9);
      }
      ctx.restore();
    }

    _drawWanganOverhead(ctx,track,camera) {
      for(const fraction of [.09,.28,.48,.7,.9]){
        const p=track.points[Math.floor(fraction*(track.points.length-1))];
        if(Math.abs(p.x-camera.x)>this.width/camera.zoom/2+220||Math.abs(p.y-camera.y)>this.height/camera.zoom/2+220)continue;
        const edge=track.width/2+25;
        ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.angle);
        ctx.fillStyle='rgba(0,0,0,.3)';ctx.fillRect(6,-edge,14,edge*2);
        ctx.fillStyle='#6b858a';ctx.fillRect(-4,-edge,8,edge*2);ctx.fillRect(-10,-edge-9,20,18);ctx.fillRect(-10,edge-9,20,18);
        for(const lane of [-1,0,1]){ctx.save();ctx.translate(0,lane*track.width/3);ctx.rotate(-Math.PI/2);ctx.fillStyle='#1e523d';ctx.fillRect(-29,-18,58,36);ctx.strokeStyle='#bdd7c3';ctx.lineWidth=1;ctx.strokeRect(-27,-16,54,32);ctx.fillStyle='#e0eddd';ctx.font='8px sans-serif';ctx.textAlign='center';ctx.fillText(lane===0?'湾岸線':'首都高速',0,-4);ctx.font='bold 12px sans-serif';ctx.fillText('↑',0,11);ctx.restore();}
        ctx.restore();
      }
    }

    _wanganLandmark(ctx,p) {
      const edge=p.width/2+24;
      ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.angle);
      for(const side of [-1,1]){
        ctx.fillStyle='#435760';ctx.fillRect(-115,side*edge-9,240,18);
        ctx.fillStyle='#9eaeb0';ctx.fillRect(-112,side*edge-7,234,3);
        if(p.kind==='bridge'){
          ctx.fillStyle='#708790';ctx.fillRect(-80,side*(edge+35)-14,32,28);ctx.fillRect(80,side*(edge+35)-14,32,28);
          ctx.strokeStyle='#a5b7b9';ctx.lineWidth=2;
          for(let i=-100;i<=100;i+=25){ctx.beginPath();ctx.moveTo(-65,side*(edge+35));ctx.lineTo(i,side*edge);ctx.stroke();}
        }else if(p.kind==='tunnel'){
          ctx.fillStyle='#586467';ctx.fillRect(-200,side*(edge+20)-18,400,36);
          ctx.fillStyle='#cfbe87';for(let x=-180;x<200;x+=40)ctx.fillRect(x,side*edge-3,14,6);
        }else if(p.kind==='industry'){
          for(let i=0;i<3;i++){ctx.fillStyle='#30474b';ctx.beginPath();ctx.arc(i*70-70,side*(edge+100),27,0,TAU);ctx.fill();ctx.strokeStyle='#698181';ctx.lineWidth=3;ctx.stroke();}
        }else if(p.kind==='airport'){
          ctx.fillStyle='#2a3945';ctx.fillRect(-130,side*(edge+110)-30,260,60);ctx.fillStyle='#7d989b';ctx.fillRect(-126,side*(edge+110)-25,252,8);
        }else{
          ctx.fillStyle='#30503d';ctx.fillRect(-40,side*(edge+20)-25,80,50);ctx.strokeStyle='#9fc2a4';ctx.lineWidth=2;ctx.strokeRect(-40,side*(edge+20)-25,80,50);
        }
      }
      ctx.save();ctx.translate(0,-edge-90);ctx.rotate(-Math.PI/2);ctx.fillStyle='#b3d1ba';ctx.font='bold 13px sans-serif';ctx.textAlign='center';ctx.fillText(p.label,0,0);ctx.restore();
      ctx.restore();
    }

    _building(ctx, x, y, w, h, random, accent, industrial, remember = true) {
      if (remember) {
        const seed = Math.floor(random() * 0x7fffffff);
        this._rememberProp({ type: 'building', x, y, w, h, seed, accent, industrial });
        random = rng(seed);
      }
      ctx.save();
      ctx.translate(x, y);
      // Broad displacement is a baked night shadow, not a realtime blur.
      ctx.fillStyle = 'rgba(0,0,0,.28)';
      roundRect(ctx, -w / 2 + 13, -h / 2 + 16, w + 5, h + 5, 5); ctx.fill();
      const roof = ctx.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2);
      roof.addColorStop(0, industrial ? '#26343d' : '#27303f');
      roof.addColorStop(1, '#141c29');
      ctx.fillStyle = roof;
      roundRect(ctx, -w / 2, -h / 2, w, h, 4); ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#3b4857'; ctx.stroke();
      ctx.strokeStyle = 'rgba(116,145,166,.12)';
      ctx.strokeRect(-w / 2 + 7, -h / 2 + 7, w - 14, h - 14);
      ctx.fillStyle = '#101824';
      ctx.fillRect(-w / 2 + 15, -h / 2 + 15, 20 + random() * 22, 16 + random() * 13);
      ctx.fillStyle = '#344450';
      for (let j = 0; j < 3; j++) ctx.fillRect(-w / 2 + 18, -h / 2 + 18 + j * 5, 15, 2);
      if (random() > .5) {
        ctx.fillStyle = '#1e2b38';
        ctx.fillRect(w / 2 - 35, h / 2 - 32, 22, 18);
        ctx.strokeStyle = '#465566'; ctx.lineWidth = 1;
        ctx.strokeRect(w / 2 - 35, h / 2 - 32, 22, 18);
      }
      const light = random() > .48 ? '#f4c995' : accent;
      for (let yy = -h / 2 + 13; yy < h / 2 - 12; yy += 15) {
        if (random() > .36) {
          ctx.fillStyle = rgba(light, .22 + random() * .25);
          ctx.fillRect(-w / 2 - 2, yy, 3, 7);
        }
      }
      for (let xx = -w / 2 + 14; xx < w / 2 - 9; xx += 16) {
        if (random() > .25) {
          ctx.fillStyle = rgba(light, .18 + random() * .3);
          ctx.fillRect(xx, h / 2 - 1, 7, 3);
        }
      }
      if (random() > .73) {
        ctx.strokeStyle = rgba(accent, .55);
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(-w / 2 + 8, -h / 2); ctx.lineTo(w / 2 - 8, -h / 2); ctx.stroke();
      }
      if (!(this._bakingEnvironment && this._bakeScale < .45)) {
        // Parapets, rain seams, roof access, ducts and fan housings are drawn
        // at the camera's native resolution instead of enlarging a tiny bitmap.
        ctx.strokeStyle = 'rgba(133,157,176,.12)'; ctx.lineWidth = .7;
        for (let yy = -h / 2 + 18; yy < h / 2 - 8; yy += 14) {
          ctx.beginPath(); ctx.moveTo(-w / 2 + 8, yy); ctx.lineTo(w / 2 - 8, yy); ctx.stroke();
        }
        ctx.fillStyle = '#0d1520'; ctx.fillRect(-w / 2 + 10, h / 2 - 26, w - 20, 5);
        ctx.fillStyle = 'rgba(139,171,182,.18)'; ctx.fillRect(-w / 2 + 10, h / 2 - 27, w - 20, 1);
        const fanX = w / 2 - 31, fanY = -h / 2 + 27;
        ctx.fillStyle = '#15212c'; ctx.fillRect(fanX - 12, fanY - 12, 25, 25);
        ctx.strokeStyle = '#465564'; ctx.lineWidth = .8; ctx.strokeRect(fanX - 12, fanY - 12, 25, 25);
        ctx.fillStyle = '#0c151e'; ctx.beginPath(); ctx.arc(fanX, fanY, 8, 0, TAU); ctx.fill();
        ctx.strokeStyle = '#344652';
        for (let j = 0; j < 4; j++) {
          const a = j * Math.PI / 2 + .35;
          ctx.beginPath(); ctx.moveTo(fanX, fanY); ctx.lineTo(fanX + Math.cos(a) * 7, fanY + Math.sin(a) * 7); ctx.stroke();
        }
        ctx.strokeStyle = '#46535e'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(-w / 2 + 28, -h / 2 + 40); ctx.lineTo(-w / 2 + 28, 0);
        ctx.lineTo(fanX, 0); ctx.lineTo(fanX, fanY + 14); ctx.stroke();
        ctx.strokeStyle = 'rgba(174,196,199,.16)'; ctx.lineWidth = .5; ctx.stroke();
        ctx.fillStyle = '#151e28'; roundRect(ctx, -15, -h / 2 + 12, 23, 17, 1); ctx.fill();
        ctx.strokeStyle = '#50616a'; ctx.lineWidth = .8; ctx.stroke();
        ctx.fillStyle = 'rgba(151,205,207,.13)'; ctx.fillRect(-12, -h / 2 + 15, 17, 11);
        ctx.strokeStyle = 'rgba(205,230,224,.09)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(-w / 2 + 1, -h / 2 + 3); ctx.lineTo(w / 2 - 3, -h / 2 + 3); ctx.stroke();
        ctx.fillStyle = '#0c141dd0'; ctx.fillRect(-w / 2 + 3, h / 2 + 1, w - 3, 8);
        for (let xx = -w / 2 + 12; xx < w / 2 - 10; xx += 15) {
          ctx.fillStyle = rgba(light, .35 + random() * .3); ctx.fillRect(xx, h / 2 + 2, 7, 4);
          ctx.fillStyle = '#132028'; ctx.fillRect(xx + 3, h / 2 + 2, .8, 4);
        }
      }
      ctx.restore();
    }

    _tree(ctx, x, y, size, random, remember = true, evergreenOnly = false, night = false) {
      if (remember) {
        const seed = Math.floor(random() * 0x7fffffff);
        this._rememberProp({ type: 'tree', x, y, size, seed, evergreenOnly, night }); random = rng(seed);
      }
      const simple = this.quality === 'low' || (this._bakingEnvironment && this._bakeScale < .45);
      const evergreen = evergreenOnly || random() < .27;
      const tone = random();
      const palette = night
        ? tone < .32 ? ['#10251f', '#173329', '#244432'] : tone < .69 ? ['#112724', '#1b342e', '#254236'] : ['#192d28', '#24392d', '#304735']
        : tone < .32 ? ['#183b32', '#244b3c', '#315a45'] : tone < .69 ? ['#1a3833', '#28483c', '#345944'] : ['#263e32', '#354d38', '#415c40'];
      ctx.fillStyle = night ? 'rgba(0,0,0,.32)' : 'rgba(0,0,0,.22)';
      ctx.beginPath(); ctx.ellipse(x + size * .3, y + size * .52, size * 1.04, size * .82, -.4, 0, TAU); ctx.fill();
      ctx.fillStyle = night ? '#2d302a' : '#483d2d'; ctx.fillRect(x - 1.5, y - 2, 3, size * .55);
      if (evergreen) {
        const points = simple ? 12 : 22;
        for (let layer = 0; layer < (simple ? 2 : 3); layer++) {
          const radius = size * (1 - layer * .24);
          ctx.fillStyle = palette[Math.min(layer, 2)]; ctx.beginPath();
          for (let i = 0; i < points; i++) {
            const a = i / points * TAU + layer * .19;
            const r = radius * (i % 2 ? .65 : 1);
            const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r - layer * size * .08;
            if (!i) ctx.moveTo(px, py); else ctx.lineTo(px, py);
          }
          ctx.closePath(); ctx.fill();
        }
      } else {
        ctx.fillStyle = palette[0]; ctx.beginPath();
        const points = simple ? 10 : 18;
        for (let i = 0; i < points; i++) {
          const a = i / points * TAU, r = size * (.83 + random() * .22);
          const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
          if (!i) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath(); ctx.fill();
        const lobes = simple ? 4 : 9;
        for (let i = 0; i < lobes; i++) {
          const a = i / lobes * TAU, rr = size * (.35 + random() * .22);
          const lx = x + Math.cos(a) * size * .48, ly = y + Math.sin(a) * size * .48;
          ctx.fillStyle = palette[i % 3]; ctx.beginPath(); ctx.arc(lx, ly, rr, 0, TAU); ctx.fill();
          if (!simple) {
            ctx.strokeStyle = 'rgba(130,175,123,.13)'; ctx.lineWidth = .8;
            ctx.beginPath(); ctx.arc(lx - rr * .04, ly - rr * .08, rr * .8, 3.5, 5.2); ctx.stroke();
          }
        }
        ctx.fillStyle = palette[1]; ctx.beginPath(); ctx.arc(x - size * .1, y - size * .15, size * .47, 0, TAU); ctx.fill();
      }
      if (!simple) {
        ctx.strokeStyle = night ? 'rgba(114,147,130,.12)' : 'rgba(156,180,126,.17)'; ctx.lineWidth = .7;
        for (let i = 0; i < 16; i++) {
          const a = random() * TAU, radius = Math.sqrt(random()) * size * .82;
          const lx = x + Math.cos(a) * radius, ly = y + Math.sin(a) * radius;
          ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(lx + 2.2, ly - 1.5); ctx.stroke();
        }
      }
    }

    _rock(ctx, x, y, size, random, remember = true) {
      if (remember) {
        const seed = Math.floor(random() * 0x7fffffff);
        this._rememberProp({ type: 'rock', x, y, size, seed }); random = rng(seed);
      }
      ctx.save(); ctx.translate(x, y); ctx.rotate(random() * TAU);
      ctx.fillStyle = 'rgba(0,0,0,.23)'; ctx.beginPath(); ctx.ellipse(4, 5, size, size * .62, 0, 0, TAU); ctx.fill();
      const vertices = [];
      for (let i = 0; i < 7; i++) {
        const a = i / 7 * TAU, r = size * (.7 + random() * .3);
        vertices.push([Math.cos(a) * r, Math.sin(a) * r * .65]);
      }
      ctx.fillStyle = '#34413c'; ctx.beginPath();
      vertices.forEach((v, i) => { if (i) ctx.lineTo(v[0], v[1]); else ctx.moveTo(v[0], v[1]); });
      ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#405048'; ctx.lineWidth = .6; ctx.stroke();
      ctx.fillStyle = '#46524a'; ctx.beginPath(); ctx.moveTo(vertices[3][0], vertices[3][1]);
      ctx.lineTo(vertices[4][0], vertices[4][1]); ctx.lineTo(vertices[5][0], vertices[5][1]); ctx.lineTo(-size * .1, -size * .05); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(12,23,21,.5)'; ctx.lineWidth = .9;
      ctx.beginPath(); ctx.moveTo(-size * .4, -size * .2); ctx.lineTo(-size * .12, size * .1); ctx.lineTo(size * .34, size * .18); ctx.stroke();
      ctx.fillStyle = 'rgba(111,132,82,.22)'; ctx.beginPath(); ctx.ellipse(size * .3, -size * .2, size * .18, size * .1, -.4, 0, TAU); ctx.fill();
      ctx.restore();
    }

    _buildTsuchisakaScenery(ctx,track,roadDistance,random) {
      const points=track.points,half=track.width/2;
      const sideAt=(p,side,d)=>({x:p.x+p.normalX*side*d,y:p.y+p.normalY*side*d});
      const add=p=>{p.seed=Math.floor(random()*0x7fffffff);this._rememberProp(p);return p;};
      let lastTrees=-100,lastSign=-400,lastPole=-400;
      for(let i=1;i<points.length-3;i++){
        const p=points[i],q=points[i+1],progress=p.distance/track.length;
        if(i%2===0){
          const end=points[i+2],a=sideAt(p,-1,half+22),b=sideAt(end,-1,half+22),nx=-(p.normalX+end.normalX)/2,ny=-(p.normalY+end.normalY)/2;
          const sa=sideAt(p,1,half+20),sb=sideAt(end,1,half+20),depthA=240+35*Math.sin(p.distance/430),depthB=240+35*Math.sin(end.distance/430);
          const slope=add({type:'tsuchisaka-slope',layer:-3,x:(sa.x+sb.x)/2,y:(sa.y+sb.y)/2,a:sa,b:sb,naX:p.normalX,naY:p.normalY,nbX:end.normalX,nbY:end.normalY,depthA,depthB,radius:340});this._tsuchisakaSlope(ctx,slope);
          const depth=45+random()*28;
          const clear=[0,.25,.5,.75,1].every(t=>[0,depth*.5,depth].every(d=>roadDistance(mix(a.x,b.x,t)+nx*d,mix(a.y,b.y,t)+ny*d)>half+12));
          if(clear){const wall=add({type:'tsuchisaka-wall',layer:-1,x:(a.x+b.x)/2,y:(a.y+b.y)/2,a,b,nx,ny,depth,radius:depth+75});this._tsuchisakaWall(ctx,wall);}
        }
        // Steel rail follows the edge; test every piece against adjacent hairpins.
        for(const side of progress>.21&&progress<.25?[-1,1]:[1]){
          const a=sideAt(p,side,half+14),b=sideAt(q,side,half+14),center={x:(a.x+b.x)/2,y:(a.y+b.y)/2};
          if([a,b,center].every(v=>roadDistance(v.x,v.y)>half+8)){
            const rail=add({type:'guardrail',...center,a,b,radius:Math.hypot(b.x-a.x,b.y-a.y)/2+15,post:i%2===0,reflector:i%6===0});this._akinaGuardrail(ctx,rail);
          }
        }
        if(p.distance-lastTrees>48){lastTrees=p.distance;
          for(const side of [-1,1])for(let row=0;row<4;row++){
            const size=23+random()*18,tree=sideAt(p,side,half+85+row*78+random()*38);
            if(roadDistance(tree.x,tree.y)>half+size*1.65+12){
              const prop=add({type:'tsuchisaka-tree',...tree,size,radius:size*1.65+12,cedar:random()<.78});this._tsuchisakaTree(ctx,prop);
            }
          }
        }
        if(i%3===0)add({type:'tsuchisaka-road',...p,span:32,radius:95,kind:'shade'});
        const before=points[Math.max(0,i-3)],after=points[i+3],turn=Math.atan2(Math.sin(after.angle-before.angle),Math.cos(after.angle-before.angle));
        if(Math.abs(turn)>.24&&p.distance-lastSign>260){
          const pos=sideAt(p,1,half+42);
          if(roadDistance(pos.x,pos.y)>half+31){const sign=add({type:'mountain-sign',...pos,radius:24,angle:p.angle,turn});this._akinaSign(ctx,sign);lastSign=p.distance;}
        }
        if(p.distance-lastPole>330){
          const pos=sideAt(p,1,half+62);
          if(roadDistance(pos.x,pos.y)>half+39){const pole=add({type:'tsuchisaka-detail',...pos,kind:'pole',radius:35,angle:p.angle});this._tsuchisakaDetail(ctx,pole);lastPole=p.distance;}
        }
      }
      // Positions are an artistic adaptation: the source photographs have no survey coordinates.
      for(const landmark of track.landmarks||[]){
        const p=points.reduce((best,q)=>Math.abs(q.distance/track.length-landmark.progress)<Math.abs(best.distance/track.length-landmark.progress)?q:best,points[0]);
        if(landmark.id==='forest-bridge'){
          const joints=[-90,90].map(offset=>points.reduce((best,q)=>Math.abs(q.distance-p.distance-offset)<Math.abs(best.distance-p.distance-offset)?q:best,p));
          add({type:'tsuchisaka-road',...p,kind:'bridge',joints,radius:180});
          for(const side of [-1,1]){
            const pos=sideAt(p,side,half+45);
            if(roadDistance(pos.x,pos.y)>half+24){const stream=add({type:'tsuchisaka-detail',...pos,kind:'stream',angle:p.angle,radius:45});this._tsuchisakaDetail(ctx,stream);}
          }
        }else if(landmark.id==='construction-straight'){
          for(let j=-4;j<=4;j++){
            const q=points[Math.max(0,Math.min(points.length-1,points.indexOf(p)+j*2))],pos=sideAt(q,1,half+35);
            if(roadDistance(pos.x,pos.y)>half+25){const barrier=add({type:'tsuchisaka-detail',...pos,kind:'construction',angle:q.angle,radius:22,sign:j===-4});this._tsuchisakaDetail(ctx,barrier);}
          }
        }
      }
    }

    _tsuchisakaSlope(ctx,p) {
      const at=(v,nx,ny,d,f)=>({x:v.x+nx*d*f,y:v.y+ny*d*f});
      const band=(near,far,color)=>{trace(ctx,[at(p.a,p.naX,p.naY,p.depthA,near),at(p.b,p.nbX,p.nbY,p.depthB,near),at(p.b,p.nbX,p.nbY,p.depthB,far),at(p.a,p.naX,p.naY,p.depthA,far)],true);ctx.fillStyle=color;ctx.fill();};
      ctx.save();band(0,1,'#243d32');band(0,.18,'#9b9b7c');band(.18,.43,'#737e65');band(.43,.7,'#526a55');band(.7,.9,'#344e40');
      ctx.strokeStyle='rgba(218,214,173,.38)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(p.a.x,p.a.y);ctx.lineTo(p.b.x,p.b.y);ctx.stroke();ctx.restore();
    }

    _tsuchisakaTree(ctx,p) {
      const random=rng(p.seed),s=p.size;
      ctx.save();ctx.translate(p.x,p.y);
      ctx.fillStyle='rgba(17,32,22,.24)';ctx.beginPath();ctx.ellipse(s*.35,s*.45,s*1.15,s*.78,.65,0,TAU);ctx.fill();
      ctx.fillStyle='#65543a';ctx.fillRect(-3,-3,6,s*.75);
      const lobes=p.cedar?9:7;
      for(let i=0;i<lobes;i++){
        const angle=i/lobes*TAU,r=s*(.35+random()*.18),x=Math.cos(angle)*r,y=Math.sin(angle)*r;
        ctx.fillStyle=['#294e37','#365d3b','#456d43','#557a49'][i%4];
        ctx.beginPath();ctx.ellipse(x,y,s*(.58+random()*.16),s*(p.cedar?.34:.54),angle,0,TAU);ctx.fill();
        ctx.strokeStyle='rgba(160,174,104,.3)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(x*1.8,y*1.8);ctx.stroke();
      }
      ctx.fillStyle='#6f8b50';ctx.beginPath();ctx.ellipse(-s*.2,-s*.25,s*.45,s*.31,-.5,0,TAU);ctx.fill();
      ctx.fillStyle='rgba(179,191,119,.25)';ctx.beginPath();ctx.ellipse(-s*.29,-s*.35,s*.22,s*.12,-.5,0,TAU);ctx.fill();ctx.restore();
    }

    _tsuchisakaWall(ctx,p) {
      const {a,b,nx,ny,depth}=p,random=rng(p.seed);
      ctx.save();trace(ctx,[a,b,{x:b.x+nx*depth,y:b.y+ny*depth},{x:a.x+nx*depth,y:a.y+ny*depth}],true);
      const rock=ctx.createLinearGradient(p.x,p.y,p.x+nx*depth,p.y+ny*depth);rock.addColorStop(0,'#a4a38a');rock.addColorStop(.3,'#777f69');rock.addColorStop(1,'#425c3f');ctx.fillStyle=rock;ctx.fill();
      const len=Math.hypot(b.x-a.x,b.y-a.y);
      for(let i=0;i<6;i++){const t=random(),d=random()*depth;ctx.strokeStyle='rgba(44,52,40,.45)';ctx.lineWidth=1+random()*2;ctx.beginPath();ctx.moveTo(mix(a.x,b.x,t)+nx*d,mix(a.y,b.y,t)+ny*d);ctx.lineTo(mix(a.x,b.x,t)+nx*(d+12)+6,mix(a.y,b.y,t)+ny*(d+12)+9);ctx.stroke();}
      // Rockfall mesh and patches of moss are part of the cached wall texture.
      ctx.strokeStyle='rgba(207,213,182,.22)';ctx.lineWidth=.65;
      for(let d=0;d<len;d+=13){const t=d/Math.max(1,len);ctx.beginPath();ctx.moveTo(mix(a.x,b.x,t),mix(a.y,b.y,t));ctx.lineTo(mix(a.x,b.x,t)+nx*depth,mix(a.y,b.y,t)+ny*depth);ctx.stroke();}
      for(let d=12;d<depth;d+=14){ctx.beginPath();ctx.moveTo(a.x+nx*d,a.y+ny*d);ctx.lineTo(b.x+nx*d,b.y+ny*d);ctx.stroke();}
      ctx.strokeStyle='#bdc0a6';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.restore();
    }

    _tsuchisakaDetail(ctx,p) {
      ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.angle);
      if(p.kind==='construction'){
        ctx.fillStyle='#494b3b';ctx.fillRect(-21,-9,42,18);ctx.fillStyle='#e6d8aa';ctx.fillRect(-19,-8,38,10);
        ctx.fillStyle='#d76e39';for(let x=-16;x<18;x+=13){ctx.beginPath();ctx.moveTo(x,-8);ctx.lineTo(x+7,-8);ctx.lineTo(x+1,2);ctx.lineTo(x-6,2);ctx.fill();}
        ctx.fillStyle='#e79447';ctx.beginPath();ctx.arc(0,-11,3,0,TAU);ctx.fill();
        if(p.sign){ctx.fillStyle='#e7b85e';ctx.fillRect(-17,-30,34,18);ctx.fillStyle='#353b30';ctx.font='bold 8px monospace';ctx.textAlign='center';ctx.fillText('工事中',0,-18);}
      }else if(p.kind==='stream'){
        ctx.fillStyle='#6b7563';ctx.fillRect(-38,-23,76,46);ctx.fillStyle='#537c79';ctx.fillRect(-36,-12,72,24);ctx.strokeStyle='#adc0a1';ctx.lineWidth=2;
        ctx.beginPath();ctx.moveTo(-32,-3);ctx.lineTo(-8,1);ctx.lineTo(18,-2);ctx.lineTo(34,2);ctx.stroke();
      }else{
        ctx.strokeStyle='rgba(28,44,29,.32)';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(27,19);ctx.stroke();
        ctx.fillStyle='#8f9481';ctx.fillRect(-4,-4,8,8);ctx.fillStyle='#c6c6aa';ctx.fillRect(-2,-18,4,36);ctx.fillStyle='#4d5948';ctx.fillRect(-6,-16,12,3);ctx.fillRect(-6,13,12,3);
      }
      ctx.restore();
    }

    _drawTsuchisakaRoadDetail(ctx,camera,viewW=514,viewH=514) {
      for(const p of this.sceneryProps){
        if(p.type!=='tsuchisaka-road'||Math.abs(p.x-camera.x)>viewW/2+p.radius||Math.abs(p.y-camera.y)>viewH/2+p.radius)continue;
        ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.angle);
        if(p.kind==='bridge'){
          // The deck follows the curve; its rails already follow the sampled road.
          for(const q of p.joints){const dx=q.x-p.x,dy=q.y-p.y;ctx.save();ctx.translate(dx*Math.cos(p.angle)+dy*Math.sin(p.angle),-dx*Math.sin(p.angle)+dy*Math.cos(p.angle));ctx.rotate(q.angle-p.angle);ctx.fillStyle='#b4b5a0';ctx.fillRect(-1.5,-54,3,108);ctx.fillStyle='#3f4944';ctx.fillRect(1.5,-54,2,108);ctx.restore();}
        }else{
          const random=rng(p.seed);ctx.fillStyle='rgba(15,39,29,.12)';
          for(let j=0;j<5;j++){ctx.beginPath();ctx.ellipse((random()-.5)*p.span,(random()-.5)*75,7+random()*12,3+random()*6,-.6,0,TAU);ctx.fill();}
        }
        ctx.restore();
      }
    }

    _buildUsuiScenery(ctx,track,roadDistance,random) {
      const points=track.points,half=track.width/2;
      const sideAt=(p,side,offset)=>({x:p.x+p.normalX*side*offset,y:p.y+p.normalY*side*offset});
      const clear=(p,r)=>roadDistance(p.x,p.y)>half+r+9;
      let lastTree=-100,lastSign=-400;
      for(let i=2;i<points.length-3;i++){
        const p=points[i],q=points[i+1];
        if(i%2===0){
          const end=points[i+2],a=sideAt(p,1,half+18),b=sideAt(end,1,half+18);
          const depthAt=d=>230+28*Math.sin(d/620)+14*Math.sin(d/170),depthA=depthAt(p.distance),depthB=depthAt(end.distance),depth=(depthA+depthB)/2;
          const slope={type:'usui-slope',layer:-2,x:(a.x+b.x)/2,y:(a.y+b.y)/2,a,b,nx:(p.normalX+end.normalX)/2,ny:(p.normalY+end.normalY)/2,naX:p.normalX,naY:p.normalY,nbX:end.normalX,nbY:end.normalY,depthA,depthB,depth,radius:Math.max(depthA,depthB)+85,seed:Math.floor(random()*0x7fffffff)};
          this._rememberProp(slope);this._usuiSlope(ctx,slope);
          const ca=sideAt(p,-1,half+26),cb=sideAt(end,-1,half+26),nx=-(p.normalX+end.normalX)/2,ny=-(p.normalY+end.normalY)/2,depthRock=55+random()*25;
          const footprint=[];for(const t of [0,.25,.5,.75,1])for(const d of [0,depthRock/2,depthRock])footprint.push({x:mix(ca.x,cb.x,t)+nx*d,y:mix(ca.y,cb.y,t)+ny*d});
          if(footprint.every(v=>roadDistance(v.x,v.y)>half+12)){
            const cliff={type:'usui-cliff',layer:-1,x:(ca.x+cb.x)/2,y:(ca.y+cb.y)/2,a:ca,b:cb,nx,ny,depth:depthRock,radius:depthRock+70,seed:Math.floor(random()*0x7fffffff)};
            this._rememberProp(cliff);this._usuiCliff(ctx,cliff);
          }
        }
        const a=sideAt(p,1,half+15),b=sideAt(q,1,half+15),center={x:(a.x+b.x)/2,y:(a.y+b.y)/2};
        if([a,b,center].every(v=>roadDistance(v.x,v.y)>half+8)){
          const rail={type:'guardrail',...center,a,b,radius:Math.hypot(b.x-a.x,b.y-a.y)/2+15,post:i%2===0,reflector:i%5===0};this._rememberProp(rail);this._akinaGuardrail(ctx,rail);
        }
        if(p.distance-lastTree>53){lastTree=p.distance;
          for(const side of [-1,1])for(let row=0;row<3;row++){
            const size=(side<0?25:15)+random()*(side<0?24:14),radius=size*1.65+5;
            const tree=sideAt(p,side,half+(side<0?140:295)+row*98+random()*30);
            if(clear(tree,radius))this._tree(ctx,tree.x,tree.y,size,random,true,random()<.42,true);
          }
        }
        const before=points[Math.max(0,i-3)],after=points[Math.min(points.length-1,i+3)],turn=Math.atan2(Math.sin(after.angle-before.angle),Math.cos(after.angle-before.angle));
        if(Math.abs(turn)>.23&&p.distance-lastSign>260){const sign=sideAt(p,1,half+43);if(clear(sign,24)){const prop={type:'mountain-sign',...sign,radius:24,angle:p.angle,turn};this._rememberProp(prop);this._akinaSign(ctx,prop);lastSign=p.distance;}}
      }
      this.usuiBridge=this._usuiBridgeAt(track);
      this.usuiBridgeArt=this._makeUsuiBridgeArt();
    }

    _usuiSlope(ctx,p) {
      const {a,b,nx,ny,depth}=p;
      ctx.save();
      const atA=f=>({x:a.x+p.naX*p.depthA*f,y:a.y+p.naY*p.depthA*f}),atB=f=>({x:b.x+p.nbX*p.depthB*f,y:b.y+p.nbY*p.depthB*f});
      const band=(near,far,color)=>{trace(ctx,[atA(near),atB(near),atB(far),atA(far)],true);ctx.fillStyle=color;ctx.fill();};
      band(0,1,'#02070d');band(0,.2,'#24373d');band(.2,.55,'#13242d');band(.55,.81,'#0b1a25');
      const random=rng(p.seed);ctx.lineWidth=1;
      for(let i=0;i<5;i++){const t=random(),x=mix(a.x,b.x,t),y=mix(a.y,b.y,t);ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+nx*depth*.24+3,y+ny*depth*.24);ctx.lineTo(x+nx*depth*.64-5,y+ny*depth*.64);ctx.strokeStyle='rgba(85,111,119,.16)';ctx.stroke();}
      // A thin, dim watercourse at the foot of the cliff reinforces the drop.
      const riverA=atA(.91),riverB=atB(.91);ctx.beginPath();ctx.moveTo(riverA.x,riverA.y);ctx.lineTo(riverB.x,riverB.y);ctx.strokeStyle='#16313e';ctx.lineWidth=5;ctx.stroke();ctx.strokeStyle='#27424d';ctx.lineWidth=1;ctx.stroke();
      ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.strokeStyle='#596964';ctx.lineWidth=3;ctx.stroke();ctx.restore();
    }

    _usuiCliff(ctx,p) {
      const {a,b,nx,ny,depth}=p,random=rng(p.seed);
      ctx.save();trace(ctx,[a,b,{x:b.x+nx*depth,y:b.y+ny*depth},{x:a.x+nx*depth,y:a.y+ny*depth}],true);
      const face=ctx.createLinearGradient(p.x,p.y,p.x+nx*depth,p.y+ny*depth);face.addColorStop(0,'#465651');face.addColorStop(.27,'#334641');face.addColorStop(1,'#111f23');ctx.fillStyle=face;ctx.fill();
      for(let i=1;i<5;i++){const d=depth*i/5;ctx.beginPath();ctx.moveTo(a.x+nx*d,a.y+ny*d);ctx.lineTo(b.x+nx*d,b.y+ny*d);ctx.lineWidth=i===1?3:1;ctx.strokeStyle=i%2?'#1b302e':'rgba(108,124,101,.22)';ctx.stroke();}
      ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.strokeStyle='#75807a';ctx.lineWidth=2;ctx.stroke();
      // Sparse rockfall netting, baked into the tile rather than drawn per frame.
      const len=Math.hypot(b.x-a.x,b.y-a.y);ctx.strokeStyle='rgba(151,163,147,.13)';ctx.lineWidth=.6;
      for(let d=0;d<len;d+=12){const t=d/Math.max(1,len),x=mix(a.x,b.x,t),y=mix(a.y,b.y,t);ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+nx*depth*.85,y+ny*depth*.85);ctx.stroke();}
      ctx.fillStyle='rgba(61,91,62,.55)';for(let i=0;i<3;i++){const t=random(),d=random()*depth;ctx.beginPath();ctx.ellipse(mix(a.x,b.x,t)+nx*d,mix(a.y,b.y,t)+ny*d,3+random()*4,2,random()*TAU,0,TAU);ctx.fill();}ctx.restore();
    }

    _usuiBridgeAt(track) {
      const landmark=track?.landmarks?.find(item=>item.id==='megane-bridge');if(!landmark)return null;
      const target=track.length*landmark.progress,points=track.points;
      const index=points.findIndex(p=>p.distance>=target),b=points[Math.max(1,index)],a=points[Math.max(0,index-1)];
      const t=clamp((target-a.distance)/(b.distance-a.distance||1),0,1),angle=Math.atan2(b.y-a.y,b.x-a.x);
      return {x:mix(a.x,b.x,t),y:mix(a.y,b.y,t),angle:angle+Math.PI/2,progress:landmark.progress,arches:landmark.arches,halfLength:8000,radius:8050};
    }

    _drawUsuiBridgeShadow(ctx,bridge) {
      if(!bridge)return;ctx.save();ctx.translate(bridge.x,bridge.y);ctx.rotate(bridge.angle);
      const shade=ctx.createLinearGradient(0,-62,0,82);shade.addColorStop(0,'rgba(0,3,9,0)');shade.addColorStop(.3,'rgba(0,3,9,.6)');shade.addColorStop(.72,'rgba(0,3,9,.42)');shade.addColorStop(1,'rgba(0,3,9,0)');ctx.fillStyle=shade;ctx.fillRect(-bridge.halfLength,-62,bridge.halfLength*2,144);ctx.restore();
    }

    _makeUsuiBridgeArt() {
      const scale=this.quality==='high'?1.5:1,canvas=makeCanvas(192*scale,96*scale),ctx=canvas.getContext('2d');
      ctx.scale(scale,scale);
      // A seamless top-down section; only the walkway and brick parapet caps are visible.
      ctx.fillStyle='#182225';ctx.fillRect(0,12,192,72);
      ctx.fillStyle='#4a4b40';ctx.fillRect(0,24,192,48);
      for(let row=0;row<3;row++)for(let x=-24*(row%2);x<192;x+=48){ctx.strokeStyle='rgba(24,32,31,.5)';ctx.lineWidth=1;ctx.strokeRect(x,24+row*16,48,16);}
      const random=rng(575);
      for(let i=0;i<95;i++){ctx.fillStyle=i%2?'rgba(157,148,116,.12)':'rgba(6,18,18,.16)';ctx.fillRect(random()*192,25+random()*45,1+random()*2,1+random());}
      for(const y of [12,73]){
        ctx.fillStyle='#78503e';ctx.fillRect(0,y,192,11);
        ctx.fillStyle='#a1835e';ctx.fillRect(0,y,192,2);
        ctx.fillStyle='#3d302a';ctx.fillRect(0,y+9,192,2);
        for(let x=0;x<192;x+=24){ctx.fillStyle='#302c28';ctx.fillRect(x,y+2,1,7);ctx.fillStyle='rgba(185,139,96,.28)';ctx.fillRect(x+1,y+2,22,1);}
      }
      return canvas;
    }

    _drawUsuiOverhead(ctx,camera) {
      const bridge=this.usuiBridge;if(!bridge||!this.usuiBridgeArt)return;
      const c=Math.cos(bridge.angle),s=Math.sin(bridge.angle),dx=camera.x-bridge.x,dy=camera.y-bridge.y;
      const along=dx*c+dy*s,across=-dx*s+dy*c,halfW=this.width/camera.zoom/2,halfH=this.height/camera.zoom/2;
      const extentAlong=Math.abs(c)*halfW+Math.abs(s)*halfH+96,extentAcross=Math.abs(s)*halfW+Math.abs(c)*halfH+48;
      if(Math.abs(across)>extentAcross||Math.abs(along)>bridge.halfLength+extentAlong)return;
      const from=Math.max(-bridge.halfLength,along-extentAlong),to=Math.min(bridge.halfLength,along+extentAlong),scale=this.usuiBridgeArt.width/192;
      ctx.save();ctx.translate(bridge.x,bridge.y);ctx.rotate(bridge.angle);ctx.translate(0,-48);ctx.scale(1/scale,1/scale);
      if(!this.usuiBridgePattern)this.usuiBridgePattern=ctx.createPattern(this.usuiBridgeArt,'repeat-x');
      ctx.fillStyle=this.usuiBridgePattern;ctx.fillRect(from*scale,0,(to-from)*scale,96*scale);ctx.restore();
    }

    _irohaRelief(ctx,world,random) {
      // Opaque blue-black slopes: no sunset or warm sky wash.
      for(let y=world.y-400;y<world.y+world.h;y+=780)for(let x=world.x-400;x<world.x+world.w;x+=920){
        const cx=x+300+random()*160,cy=y+240+random()*150;
        trace(ctx,[{x:x-140,y:y+300},{x:x+150,y:y-80},{x:cx,y:cy-160},{x:x+780,y:y+70},{x:x+1040,y:y+640},{x:x+210,y:y+830}]);
        ctx.fillStyle=random()<.5?'#0b101b':'#090e17';ctx.fill();
        trace(ctx,[{x:cx,y:cy-160},{x:x+780,y:y+70},{x:x+1040,y:y+640},{x:cx+140,y:cy+320}]);ctx.fillStyle='#040810';ctx.fill();
        ctx.strokeStyle='rgba(64,77,102,.09)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x+150,y-80);ctx.lineTo(cx,cy-160);ctx.lineTo(x+780,y+70);ctx.stroke();
      }
    }

    _buildRoadsideNight(ctx,track,roadDistance,random) {
      const points=track.points,half=track.width/2,enna=track.sceneryTheme==='enna-night';
      const sideAt=(p,side,d)=>({x:p.x+p.normalX*side*d,y:p.y+p.normalY*side*d});
      const remember=p=>{p.seed=Math.floor(random()*0x7fffffff);this._rememberProp(p);return p;};
      let lastTree=-100,lastSign=-500,lastFeature=-500;
      for(let i=2;i<points.length-3;i++){
        const p=points[i],q=points[i+1],progress=p.distance/track.length;
        // The road is a ledge between an uphill cutting and a lower valley.
        // Trim every strip against neighbouring switchbacks before caching it.
        if(i%2===0){
          const end=points[i+2];
          for(const side of [-1,1]){
            const a=sideAt(p,side,half+14),b=sideAt(end,side,half+14),naX=p.normalX*side,naY=p.normalY*side,nbX=end.normalX*side,nbY=end.normalY*side;
            const uphill=side===(enna?1:-1),target=(uphill?190:280)+(enna?35:55)*Math.sin(p.distance/530);
            const samples=[0,.125,.25,.375,.5,.625,.75,.875,1];
            if(!samples.every(t=>roadDistance(mix(a.x,b.x,t),mix(a.y,b.y,t))>half+10))continue;
            let depth=0;
            for(let d=12;d<=target;d+=12){
              if(!samples.every(t=>roadDistance(mix(a.x,b.x,t)+mix(naX,nbX,t)*d,mix(a.y,b.y,t)+mix(naY,nbY,t)*d)>half+10))break;
              depth=d;
            }
            if(depth>=12){const relief=remember({type:'roadside-relief',layer:-5,x:(a.x+b.x)/2,y:(a.y+b.y)/2,a,b,naX,naY,nbX,nbY,depth,uphill,enna,radius:depth+100});this._roadsideRelief(ctx,relief);}
          }
        }
        for(const side of [-1,1]){
          const a=sideAt(p,side,half+19),b=sideAt(q,side,half+19),middle={x:(a.x+b.x)/2,y:(a.y+b.y)/2};
          if([a,b,middle].some(v=>roadDistance(v.x,v.y)<half+9))continue;
          const wall=enna&&side===1 || !enna&&side===1&&progress>.3&&progress<.48;
          const depth=enna?42:26,nx=p.normalX*side,ny=p.normalY*side;
          if(wall&&![0,.25,.5,.75,1].every(t=>[0,depth*.5,depth].every(d=>roadDistance(mix(a.x,b.x,t)+nx*d,mix(a.y,b.y,t)+ny*d)>half+9)))continue;
          const prop=remember({type:wall?'roadside-slope':'guardrail',...middle,a,b,nx,ny,depth,enna,layer:-1,radius:95,post:i%2===0,reflector:i%5===0});
          if(wall)this._roadsideSlope(ctx,prop);else this._akinaGuardrail(ctx,prop);
        }
        if(p.distance-lastTree>(enna ? 60 : 76)){lastTree=p.distance;
          for(const side of [-1,1])for(let row=0;row<(enna?3:2);row++){
            const lowland=side!==(enna?1:-1),size=((enna?21:24)+random()*18)*(lowland?.65:1),pos=sideAt(p,side,half+(lowland?210:160)+row*95+random()*35),radius=size*1.5+10;
            if(roadDistance(pos.x,pos.y)<=half+radius+8)continue;
            const tree=remember({type:'roadside-tree',...pos,size,radius,enna,lowland,tone:random()});this._roadsideTree(ctx,tree);
          }
        }
        const before=points[Math.max(0,i-3)],after=points[Math.min(points.length-1,i+3)],turn=Math.atan2(Math.sin(after.angle-before.angle),Math.cos(after.angle-before.angle));
        if(Math.abs(turn)>.3&&p.distance-lastSign>250){const pos=sideAt(p,turn>0?-1:1,half+46);if(roadDistance(pos.x,pos.y)>half+28){const sign=remember({type:'mountain-sign',...pos,radius:25,angle:p.angle,turn});this._akinaSign(ctx,sign);lastSign=p.distance;}}
        if(p.distance-lastFeature>550){const pos=sideAt(p,enna?1:-1,half+70);if(roadDistance(pos.x,pos.y)>half+55){const feature=remember({type:'roadside-feature',...pos,radius:40,angle:p.angle,enna});this._roadsideFeature(ctx,feature);lastFeature=p.distance;}}
      }
    }
    _roadsideTree(ctx,p) {
      const r=p.size,random=rng(p.seed);ctx.save();ctx.translate(p.x,p.y);
      if(p.lowland)ctx.globalAlpha=.48;
      ctx.fillStyle='rgba(0,0,0,.38)';ctx.beginPath();ctx.ellipse(8,10,r*1.2,r*.8,.3,0,TAU);ctx.fill();
      if(p.enna){
        ctx.fillStyle='#102b26';ctx.beginPath();ctx.ellipse(0,0,r,r*.78,0,0,TAU);ctx.fill();
        for(let i=0;i<7;i++){const a=i*TAU/7;ctx.fillStyle=i%2?'#1b4235':'#25503d';ctx.beginPath();ctx.ellipse(Math.cos(a)*r*.44,Math.sin(a)*r*.4,r*.55,r*.3,a,0,TAU);ctx.fill();}
        ctx.fillStyle='#426b4c';ctx.beginPath();ctx.ellipse(-r*.2,-r*.2,r*.35,r*.2,-.5,0,TAU);ctx.fill();
      }else{
        ctx.strokeStyle='#534c3d';ctx.lineWidth=1.6;ctx.beginPath();ctx.moveTo(0,r*.35);ctx.lineTo(0,-r*.15);
        for(let i=0;i<9;i++){const a=i*TAU/9+random()*.22,dist=r*(.55+random()*.4),x=Math.cos(a)*dist,y=Math.sin(a)*dist;ctx.moveTo(0,0);ctx.lineTo(x,y);ctx.moveTo(x*.55,y*.55);ctx.lineTo(x*.75+Math.cos(a+.65)*r*.22,y*.75+Math.sin(a+.65)*r*.22);ctx.moveTo(x*.7,y*.7);ctx.lineTo(x*.85+Math.cos(a-.7)*r*.18,y*.85+Math.sin(a-.7)*r*.18);}ctx.stroke();
        ctx.fillStyle=p.tone<.5?'rgba(111,89,49,.42)':'rgba(115,80,48,.35)';for(let i=0;i<10;i++){const a=random()*TAU,d=random()*r;ctx.beginPath();ctx.ellipse(Math.cos(a)*d,Math.sin(a)*d,r*.19,r*.1,a,0,TAU);ctx.fill();}
      }ctx.restore();
    }
    _roadsideRelief(ctx,p) {
      const at=(v,nx,ny,f)=>({x:v.x+nx*p.depth*f,y:v.y+ny*p.depth*f});
      const band=(from,to,color)=>{trace(ctx,[at(p.a,p.naX,p.naY,from),at(p.b,p.nbX,p.nbY,from),at(p.b,p.nbX,p.nbY,to),at(p.a,p.naX,p.naY,to)],true);ctx.fillStyle=color;ctx.fill();};
      ctx.save();
      if(p.uphill){
        const gradient=ctx.createLinearGradient(p.a.x,p.a.y,p.a.x+p.naX*p.depth,p.a.y+p.naY*p.depth);
        gradient.addColorStop(0,p.enna?'#6f7968':'#81765c');gradient.addColorStop(.3,p.enna?'#405344':'#555540');gradient.addColorStop(1,p.enna?'#152f26':'#293628');
        trace(ctx,[p.a,p.b,at(p.b,p.nbX,p.nbY,1),at(p.a,p.naX,p.naY,1)],true);ctx.fillStyle=gradient;ctx.fill();
        const random=rng(p.seed);ctx.strokeStyle='rgba(10,19,16,.28)';ctx.lineWidth=1.4;
        for(let i=0;i<5;i++){const t=random(),f=.1+random()*.65,a={x:mix(p.a.x,p.b.x,t),y:mix(p.a.y,p.b.y,t)},nx=mix(p.naX,p.nbX,t),ny=mix(p.naY,p.nbY,t);ctx.beginPath();ctx.moveTo(a.x+nx*p.depth*f,a.y+ny*p.depth*f);ctx.lineTo(a.x+nx*p.depth*(f+.09)+5,a.y+ny*p.depth*(f+.09)-3);ctx.lineTo(a.x+nx*p.depth*(f+.18),a.y+ny*p.depth*(f+.18));ctx.stroke();}
      }else{
        band(0,1,'#030b10');band(0,.1,'#787967');band(.1,.24,'#454e46');band(.24,.42,'#293b35');band(.42,.63,'#152c29');band(.63,.82,'#0b2020');
        // Exposed cliff faces descend away from the bright road lip.
        const length=Math.hypot(p.b.x-p.a.x,p.b.y-p.a.y),steps=Math.max(1,Math.ceil(length/21));ctx.strokeStyle='rgba(3,9,12,.5)';ctx.lineWidth=2;
        const random=rng(p.seed);for(let i=0;i<=steps;i++){const t=i/steps,x=mix(p.a.x,p.b.x,t),y=mix(p.a.y,p.b.y,t),nx=mix(p.naX,p.nbX,t),ny=mix(p.naY,p.nbY,t),f=.35+random()*.35;ctx.beginPath();ctx.moveTo(x+nx*p.depth*.12,y+ny*p.depth*.12);ctx.lineTo(x+nx*p.depth*.28+4,y+ny*p.depth*.28-3);ctx.lineTo(x+nx*p.depth*f,y+ny*p.depth*f);ctx.stroke();}
      }
      ctx.strokeStyle=p.uphill?'#7d8271':'#b0aa87';ctx.lineWidth=p.uphill?2:3;ctx.beginPath();ctx.moveTo(p.a.x,p.a.y);ctx.lineTo(p.b.x,p.b.y);ctx.stroke();ctx.restore();
    }
    _roadsideSlope(ctx,p) {
      const {a,b,nx,ny,depth}=p;ctx.save();trace(ctx,[a,b,{x:b.x+nx*depth,y:b.y+ny*depth},{x:a.x+nx*depth,y:a.y+ny*depth}],true);ctx.fillStyle=p.enna?'#38473f':'#554e41';ctx.fill();
      ctx.strokeStyle=p.enna?'#63746a':'#817668';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
      const len=Math.hypot(b.x-a.x,b.y-a.y);ctx.strokeStyle='rgba(180,190,165,.28)';ctx.lineWidth=1;for(let d=0;d<len;d+=15){const t=d/Math.max(1,len),x=mix(a.x,b.x,t),y=mix(a.y,b.y,t);ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+nx*depth,y+ny*depth);ctx.stroke();}
      if(p.enna){ctx.strokeStyle='#8a9691';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(a.x+nx*depth,a.y+ny*depth);ctx.lineTo(b.x+nx*depth,b.y+ny*depth);ctx.stroke();}ctx.restore();
    }
    _roadsideFeature(ctx,p) {
      ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.angle);ctx.fillStyle='#a2aaa0';ctx.fillRect(-2,-7,4,19);ctx.fillStyle=p.enna?'#d7bd61':'#c8d7d2';ctx.fillRect(-7,-10,14,8);ctx.fillStyle='#24342e';ctx.fillRect(-4,-8,8,3);ctx.restore();
    }
    _buildIrohaScenery(ctx,track,roadDistance,random) {
      const half=track.width/2,points=track.points,sideAt=(p,side,offset)=>({x:p.x+p.normalX*side*offset,y:p.y+p.normalY*side*offset});
      const enna=track.id==='enna-skyline',akagi=track.id==='akagi';
      const clear=(p,r)=>roadDistance(p.x,p.y)>half+r+10;
      let lastTree=-100,lastLeaf=-100,lastLamp=-900,lastSign=-400;
      for(let i=2;i<points.length-2;i++){
        const p=points[i],q=points[i+1];
        if(p.distance-lastTree>44){lastTree=p.distance;
          for(const side of [-1,1])for(let row=0;row<4;row++){
            const size=22+random()*22,radius=size*1.42+12,center=sideAt(p,side,half+radius+20+row*85+random()*36);
            if(!clear(center,radius))continue;
            const prop={type:'iroha-tree',...center,size,radius,seed:Math.floor(random()*0x7fffffff),tone:random(),evergreen:random()<(enna ? .7 : .1)};
            this._rememberProp(prop);this._irohaTree(ctx,prop);
          }
        }
        if(!enna&&p.distance-lastLeaf>100){lastLeaf=p.distance;
          for(const side of [-1,1]){const prop={type:'iroha-road',kind:'leaves',x:p.x,y:p.y,angle:p.angle,side,width:track.width,radius:80,seed:Math.floor(random()*0x7fffffff)};this._rememberProp(prop);this._irohaRoadProp(ctx,prop);}
        }
        for(const side of [-1,1]){
          const a=sideAt(p,side,half+22),b=sideAt(q,side,half+22),center={x:(a.x+b.x)/2,y:(a.y+b.y)/2};
          if([a,b,center].some(v=>roadDistance(v.x,v.y)<half+11))continue;
          const wall=side===1&&(!akagi||Math.floor(p.distance/900)%3===1);
          const prop={type:wall?'iroha-wall':'guardrail',...center,a,b,radius:Math.hypot(b.x-a.x,b.y-a.y)/2+22,post:i%2===0,reflector:i%4===0};
          this._rememberProp(prop);if(wall)this._irohaWall(ctx,prop);else this._akinaGuardrail(ctx,prop);
        }
        const before=points[Math.max(0,i-3)],after=points[Math.min(points.length-1,i+3)],turn=Math.atan2(Math.sin(after.angle-before.angle),Math.cos(after.angle-before.angle));
        if(Math.abs(turn)>.3&&p.distance-lastSign>230){
          const center=sideAt(p,turn>0?-1:1,half+47);
          if(clear(center,23)){const prop={type:'mountain-sign',...center,radius:23,angle:p.angle,turn};this._rememberProp(prop);this._akinaSign(ctx,prop);lastSign=p.distance;}
        }
        if(p.distance-lastLamp>1100&&Math.abs(turn)>.08){
          const center=sideAt(p,-1,half+40);
          if(clear(center,12)){const prop={type:'iroha-road',kind:'lamp',...center,angle:p.angle,radius:110};this._rememberProp(prop);this._irohaRoadProp(ctx,prop);lastLamp=p.distance;}
        }
      }
    }

    _irohaTree(ctx,p) {
      const random=rng(p.seed),r=p.size;
      const palette=p.evergreen?['#0b1c1b','#122724','#21362e']:p.tone<.36?['#27121c','#4b2028','#77333b']:p.tone<.73?['#291b1a','#523025','#855035']:['#282317','#4b3d23','#776038'];
      ctx.save();ctx.translate(p.x,p.y);
      ctx.fillStyle='rgba(0,2,8,.65)';ctx.beginPath();ctx.ellipse(8,12,r*1.15,r*.94,.3,0,TAU);ctx.fill();
      ctx.fillStyle='#231e1f';ctx.fillRect(-2,0,4,r*.6);
      ctx.fillStyle=palette[0];ctx.beginPath();
      for(let i=0;i<14;i++){const a=i/14*TAU,size=r*(.86+random()*.17),x=Math.cos(a)*size,y=Math.sin(a)*size;if(i)ctx.lineTo(x,y);else ctx.moveTo(x,y);}ctx.closePath();ctx.fill();
      const lobes=this.quality==='low'?5:8;
      for(let i=0;i<lobes;i++){const a=i/lobes*TAU,rr=r*(.3+random()*.16),x=Math.cos(a)*r*.48,y=Math.sin(a)*r*.48;ctx.fillStyle=palette[1];ctx.beginPath();ctx.ellipse(x,y,rr,rr*.88,a,0,TAU);ctx.fill();ctx.fillStyle=palette[2];ctx.beginPath();ctx.ellipse(x-rr*.18,y-rr*.24,rr*.56,rr*.3,a,0,TAU);ctx.fill();}
      ctx.fillStyle=palette[2];for(let i=0;i<9;i++){const a=random()*TAU,rr=random()*r*.8;ctx.fillRect(Math.cos(a)*rr,Math.sin(a)*rr,1.8,1.2);}ctx.restore();
    }

    _irohaWall(ctx,p) {
      ctx.save();ctx.lineCap='butt';ctx.beginPath();ctx.moveTo(p.a.x+3,p.a.y+5);ctx.lineTo(p.b.x+3,p.b.y+5);ctx.strokeStyle='#02050b';ctx.lineWidth=25;ctx.stroke();
      ctx.beginPath();ctx.moveTo(p.a.x,p.a.y);ctx.lineTo(p.b.x,p.b.y);ctx.strokeStyle='#252a32';ctx.lineWidth=19;ctx.stroke();ctx.strokeStyle='#3e4650';ctx.lineWidth=2;ctx.stroke();
      const angle=Math.atan2(p.b.y-p.a.y,p.b.x-p.a.x),nx=-Math.sin(angle),ny=Math.cos(angle),len=Math.hypot(p.b.x-p.a.x,p.b.y-p.a.y);ctx.strokeStyle='#101821';ctx.lineWidth=1.2;
      for(let offset=-6;offset<=6;offset+=6){ctx.beginPath();ctx.moveTo(p.a.x+nx*offset,p.a.y+ny*offset);ctx.lineTo(p.b.x+nx*offset,p.b.y+ny*offset);ctx.stroke();}
      for(let d=0;d<len;d+=16){const t=d/Math.max(1,len),x=mix(p.a.x,p.b.x,t),y=mix(p.a.y,p.b.y,t);ctx.beginPath();ctx.moveTo(x-nx*8,y-ny*8);ctx.lineTo(x+nx*8,y+ny*8);ctx.stroke();}ctx.restore();
    }

    _irohaRoadProp(ctx,p) {
      ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.angle);
      if(p.kind==='leaves'){
        const random=rng(p.seed),colors=['#674529','#6a3030','#84632d','#443424'];
        for(let i=0;i<12;i++){ctx.fillStyle=colors[Math.floor(random()*colors.length)];const x=(random()-.5)*45,y=p.side*(p.width/2-3-random()*12);ctx.beginPath();ctx.ellipse(x,y,1+random()*1.5,.6+random()*.5,random()*TAU,0,TAU);ctx.fill();}
      }else{
        const glow=ctx.createRadialGradient(0,0,1,0,0,95);glow.addColorStop(0,'rgba(244,192,105,.12)');glow.addColorStop(.4,'rgba(215,155,73,.055)');glow.addColorStop(1,'rgba(215,155,73,0)');ctx.fillStyle=glow;ctx.fillRect(-95,-95,190,190);
        ctx.fillStyle='#414650';ctx.fillRect(-3,-5,6,27);ctx.fillStyle='#d9b374';ctx.fillRect(-7,-7,14,5);ctx.fillStyle='#f1d5a3';ctx.fillRect(-4,-7,8,2);
      }
      ctx.restore();
    }

    _drawIrohaRoadDetail(ctx,camera) {
      const halfW=this.width/camera.zoom/2+110,halfH=this.height/camera.zoom/2+110;
      for(let x=Math.floor((camera.x-halfW)/400);x<=Math.floor((camera.x+halfW)/400);x++)for(let y=Math.floor((camera.y-halfH)/400);y<=Math.floor((camera.y+halfH)/400);y++){
        for(const p of this.sceneryGrid.get(x+':'+y)||[])if(p.type==='iroha-road'&&Math.abs(p.x-camera.x)<halfW&&Math.abs(p.y-camera.y)<halfH)this._irohaRoadProp(ctx,p);
      }
    }

    _akinaRelief(ctx, world, random) {
      // Broad ridgelines and blue ravines remain in the bounded terrain cache.
      for (let y = world.y - 450; y < world.y + world.h; y += 620) {
        for (let x = world.x - 450; x < world.x + world.w; x += 740) {
          const peakX = x + 220 + random() * 260, peakY = y + 100 + random() * 240;
          const outline = [{x:x-90,y:y+420},{x:x+90,y:y+80},{x:peakX,y:peakY-170},{x:x+710,y:y+80},{x:x+850,y:y+510},{x:x+330,y:y+770}];
          trace(ctx, outline);
          const slope = ctx.createLinearGradient(x, y, x + 670, y + 570);
          slope.addColorStop(0, '#20332f'); slope.addColorStop(.42, '#172c29'); slope.addColorStop(1, '#091620');
          ctx.fillStyle = slope; ctx.fill();
          ctx.fillStyle = 'rgba(5,15,24,.4)';
          trace(ctx, [{x:peakX,y:peakY},{x:x+850,y:y+510},{x:x+330,y:y+770}]); ctx.fill();
          for (let level = 1; level <= 4; level++) {
            const inset = level * .14;
            trace(ctx, outline.map(p => ({x:mix(p.x,peakX,inset),y:mix(p.y,peakY,inset)})));
            ctx.strokeStyle = `rgba(97,128,121,${.035 + level * .006})`; ctx.lineWidth = 2; ctx.stroke();
          }
        }
      }
    }

    _buildAkinaScenery(ctx, track, roadDistance, random) {
      const points = pointsOf(track), half = track.width / 2;
      const atSide = (p, side, offset) => ({x:p.x+p.normalX*offset*side,y:p.y+p.normalY*offset*side});
      const clear = (p, radius) => roadDistance(p.x,p.y) > half + radius + 8;
      let lastCliff = -1000, lastRidge = -1000, lastTree = -1000, lastSign = -1000;
      for (let i = 2; i < points.length - 2; i++) {
        const p = points[i];
        if (p.distance < 80 || p.distance > track.length - 80) continue;
        if (p.distance - lastCliff > 155) {
          lastCliff = p.distance;
          for (const side of [-1,1]) {
            const size = 58 + random() * 67, radius = size * 1.42 + 22;
            const center = atSide(p,side,half+radius+18+random()*35);
            if (!clear(center,radius)) continue;
            const prop = {type:'massif',...center,size,radius,angle:p.angle+(side<0?Math.PI:0),seed:Math.floor(random()*0x7fffffff),ridge:false};
            this._rememberProp(prop); this._akinaMassif(ctx,prop,true);
          }
        }
        if (p.distance - lastRidge > 360) {
          lastRidge = p.distance;
          for (const side of [-1,1]) {
            const size = 155 + random() * 115, radius = size * 1.42 + 22;
            const center = atSide(p,side,half+radius+180+random()*130);
            if (!clear(center,radius)) continue;
            const prop = {type:'massif',...center,size,radius,angle:p.angle+(side<0?Math.PI:0),seed:Math.floor(random()*0x7fffffff),ridge:true};
            this._rememberProp(prop); this._akinaMassif(ctx,prop,true);
          }
        }
        if (p.distance - lastTree > 50) {
          lastTree = p.distance;
          for (const side of [-1,1]) for (let row = 0; row < 3; row++) {
            const size = 19 + random() * 25, radius = size * 1.65 + 5;
            const center = atSide(p,side,half+radius+18+row*115+random()*65);
            if (!clear(center,radius)) continue;
            this._tree(ctx,center.x,center.y,size,random,true,true,true);
          }
        }
        const previous = points[Math.max(0,i-3)], next = points[Math.min(points.length-1,i+3)];
        const turn = Math.atan2(Math.sin(next.angle-previous.angle),Math.cos(next.angle-previous.angle));
        if (Math.abs(turn) > .28 && p.distance - lastSign > 230) {
          const center = atSide(p,turn>0?-1:1,half+42);
          if (clear(center,24)) {
            const prop = {type:'mountain-sign',...center,radius:24,angle:p.angle,turn};
            this._rememberProp(prop); this._akinaSign(ctx,prop); lastSign = p.distance;
          }
        }
        // Short road-following sections cannot bridge across a neighbouring hairpin.
        const nextPoint = points[i+1];
        for (const side of [-1,1]) {
          const a = atSide(p,side,half+15), b = atSide(nextPoint,side,half+15);
          const center = {x:(a.x+b.x)/2,y:(a.y+b.y)/2};
          if ([a,b,center].some(q=>roadDistance(q.x,q.y)<half+8)) continue;
          const prop = {type:'guardrail',...center,a,b,radius:Math.hypot(b.x-a.x,b.y-a.y)/2+14,post:i%2===0,reflector:i%4===0};
          this._rememberProp(prop); this._akinaGuardrail(ctx,prop);
        }
      }
    }

    _akinaMassif(ctx, prop, baking) {
      const {x,y,size:r,angle,ridge,seed} = prop, random = rng(seed);
      const vertices = [[-1.18,.12],[-.92,-.48],[-.57,-.72],[-.19,-.96],[.18,-.7],[.72,-.73],[1.16,-.18],[.85,.64],[.22,.93],[-.6,.77]]
        .map(([u,v])=>({x:u*r*(.89+random()*.11),y:v*r*(.88+random()*.12)}));
      const face = vertices.slice(0,7);
      const crest = face.map((v,i)=>i===0||i===6?v:{x:v.x*(.9+random()*.1),y:r*(.02+random()*.3)});
      // Cool, muted faces suggest night ambient light without hiding the relief.
      const palette = ridge ? ['#243e36','#304b3c','#263f37','#1b332d','#23392f','#1c302c']
        : ['#354b49','#435954','#566b61','#39514d','#293f3e','#324a42'];
      ctx.save(); ctx.translate(x,y); ctx.rotate(angle);
      ctx.fillStyle = 'rgba(1,9,16,.5)';
      trace(ctx,vertices.map(p=>({x:p.x+12,y:p.y+16}))); ctx.fill();
      trace(ctx,vertices); ctx.fillStyle = '#192f2b'; ctx.fill();
      const roof = ctx.createLinearGradient(0,0,0,r);
      roof.addColorStop(0,ridge?'#2b4337':'#2e4437'); roof.addColorStop(1,'#132926');
      trace(ctx,[...vertices.slice(6),vertices[0],...crest.slice(1)]); ctx.fillStyle = roof; ctx.fill();
      for (let i = 0; i < face.length-1; i++) {
        trace(ctx,[face[i],face[i+1],crest[i+1],crest[i]]); ctx.fillStyle = palette[i]; ctx.fill();
        const detailed = !baking && this.quality === 'high';
        for (let layer = 1; layer <= (detailed?4:2); layer++) {
          const t = layer/(detailed?5:3), left = {x:mix(face[i].x,crest[i].x,t),y:mix(face[i].y,crest[i].y,t)};
          const right = {x:mix(face[i+1].x,crest[i+1].x,t),y:mix(face[i+1].y,crest[i+1].y,t)};
          ctx.strokeStyle = layer%2?'rgba(8,20,26,.42)':'rgba(135,163,153,.14)'; ctx.lineWidth = .8;
          ctx.beginPath(); ctx.moveTo(left.x,left.y); ctx.lineTo(mix(left.x,right.x,.43),mix(left.y,right.y,.43)+r*.025); ctx.lineTo(right.x,right.y); ctx.stroke();
        }
        const v = face[i+1], top = crest[i+1];
        ctx.strokeStyle = 'rgba(13,31,32,.65)'; ctx.lineWidth = 1.3;
        ctx.beginPath(); ctx.moveTo(v.x,v.y); ctx.lineTo(mix(v.x,top.x,.42)-r*.035,mix(v.y,top.y,.42)); ctx.lineTo(top.x,top.y); ctx.stroke();
      }
      trace(ctx,crest,false); ctx.strokeStyle = ridge?'#526f62':'#798f82'; ctx.lineWidth = 1.6; ctx.stroke();
      trace(ctx,vertices); ctx.strokeStyle = 'rgba(85,119,111,.4)'; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = ridge?'rgba(56,84,62,.2)':'rgba(48,80,62,.26)';
      trace(ctx,[vertices[8],vertices[9],{x:-r*.26,y:r*.3},{x:r*.1,y:r*.57}]); ctx.fill();
      ctx.restore();
    }

    _akinaGuardrail(ctx, prop) {
      const {a,b,post,reflector} = prop, angle = Math.atan2(b.y-a.y,b.x-a.x);
      ctx.save(); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(a.x+3,a.y+5); ctx.lineTo(b.x+3,b.y+5);
      ctx.strokeStyle = 'rgba(0,6,12,.6)'; ctx.lineWidth = 9; ctx.stroke();
      if (post) {
        ctx.save(); ctx.translate(a.x,a.y); ctx.rotate(angle);
        ctx.fillStyle = '#34474a'; ctx.fillRect(-2,-7,4,15);
        ctx.fillStyle = '#8faaa4'; ctx.fillRect(-2,-6,3,6); ctx.restore();
      }
      ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y);
      ctx.strokeStyle = '#52686a'; ctx.lineWidth = 7; ctx.stroke();
      ctx.strokeStyle = '#8fa8a1'; ctx.lineWidth = 3.4; ctx.stroke();
      ctx.strokeStyle = '#bfd1c7'; ctx.lineWidth = .8; ctx.stroke();
      if (reflector) {
        ctx.save(); ctx.translate(a.x,a.y); ctx.rotate(angle);
        ctx.fillStyle = '#152428'; ctx.fillRect(-4,-4,8,8);
        ctx.fillStyle = '#ffbd63'; ctx.fillRect(-2.5,-2,5,3.5); ctx.restore();
      }
      ctx.restore();
    }

    _akinaSign(ctx, prop) {
      ctx.save(); ctx.translate(prop.x,prop.y); ctx.rotate(prop.angle);
      ctx.fillStyle = 'rgba(0,7,12,.6)'; ctx.fillRect(-17,-6,38,19);
      ctx.fillStyle = '#1a292a'; ctx.fillRect(-18,-8,36,16);
      ctx.strokeStyle = '#c4c2a0'; ctx.lineWidth = 1.4; ctx.strokeRect(-18,-8,36,16);
      ctx.strokeStyle = '#ffc76e'; ctx.lineWidth = 2.7;
      const direction = prop.turn > 0 ? 1 : -1;
      for (let x = -10; x <= 10; x += 10) {
        ctx.beginPath(); ctx.moveTo(x-3*direction,-5); ctx.lineTo(x+2*direction,0); ctx.lineTo(x-3*direction,5); ctx.stroke();
      }
      ctx.restore();
    }

    _terrain(ctx, world, random) {
      // Large, low-frequency relief survives the bounded overview cache.
      const step = 520;
      for (let y = world.y; y < world.y + world.h; y += step) {
        for (let x = world.x; x < world.x + world.w; x += step) {
          if (random() > .64) continue;
          const cx = x + random() * step, cy = y + random() * step;
          const radius = 140 + random() * 210;
          ctx.fillStyle = random() > .5 ? 'rgba(76,95,66,.055)' : 'rgba(0,0,0,.07)';
          ctx.beginPath();
          for (let i = 0; i < 8; i++) {
            const a = i / 8 * TAU, r = radius * (.65 + random() * .5);
            const px = cx + Math.cos(a) * r, py = cy + Math.sin(a) * r * .57;
            if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
          }
          ctx.closePath(); ctx.fill();
          ctx.strokeStyle = 'rgba(119,134,93,.035)'; ctx.lineWidth = 3; ctx.stroke();
        }
      }
    }

    _containers(ctx, x, y, width, random) {
      const colors = ['#314755', '#5a394c', '#4b5040', '#344d4b'];
      for (let i = 0; i < 2 + random() * 2; i++) {
        const yy = y + i * 27;
        const w = width * .85;
        ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(x - w / 2 + 6, yy + 6, w, 21);
        ctx.fillStyle = colors[Math.floor(random() * colors.length)]; ctx.fillRect(x - w / 2, yy, w, 21);
        ctx.strokeStyle = 'rgba(171,190,185,.16)'; ctx.lineWidth = 1;
        for (let u = 7; u < w - 3; u += 8) {
          ctx.beginPath(); ctx.moveTo(x - w / 2 + u, yy + 3); ctx.lineTo(x - w / 2 + u, yy + 18); ctx.stroke();
        }
      }
    }

    _water(ctx, world, bounds, random, accent) {
      const shore = bounds.maxY - 260;
      const water = ctx.createLinearGradient(0, shore, 0, world.y + world.h);
      water.addColorStop(0, '#0c2531'); water.addColorStop(1, '#07131e');
      ctx.fillStyle = water; ctx.fillRect(world.x, shore, world.w, world.y + world.h - shore);
      ctx.strokeStyle = '#283e48'; ctx.lineWidth = 14;
      ctx.beginPath(); ctx.moveTo(world.x, shore); ctx.lineTo(world.x + world.w, shore); ctx.stroke();
      ctx.strokeStyle = rgba(accent, .18); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(world.x, shore + 9); ctx.lineTo(world.x + world.w, shore + 9); ctx.stroke();
      for (let i = 0; i < 280; i++) {
        const x = world.x + random() * world.w, y = shore + 20 + random() * (world.y + world.h - shore - 20);
        ctx.fillStyle = `rgba(90,180,184,${.025 + random() * .07})`;
        ctx.fillRect(x, y, 12 + random() * 65, 1.5);
      }
      for (let i = 0; i < 8; i++) {
        const x = world.x + 130 + i * world.w / 8;
        ctx.fillStyle = '#15222c'; ctx.fillRect(x, shore - 32, 55, 190);
        ctx.fillStyle = '#30414b'; ctx.fillRect(x + 4, shore - 28, 47, 3);
        ctx.fillStyle = rgba(accent, .55); ctx.fillRect(x + 7, shore + 147, 4, 4); ctx.fillRect(x + 44, shore + 147, 4, 4);
      }
    }

    _contours(ctx, world, bounds, random) {
      const cx = (bounds.minX + bounds.maxX) / 2, cy = (bounds.minY + bounds.maxY) / 2;
      ctx.lineWidth = 1.5;
      for (let r = 260; r < world.w; r += 115) {
        ctx.beginPath();
        for (let i = 0; i <= 110; i++) {
          const a = i / 110 * TAU;
          const rr = r + Math.sin(a * 5 + r / 170) * 35 + Math.cos(a * 3) * 48;
          const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr * .67;
          if (!i) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = `rgba(134,170,134,${.025 + random() * .025})`; ctx.stroke();
      }
    }

    _road(ctx, track, random, crisp = false) {
      const points = pointsOf(track), width = track.width || 220, accent = accentOf(track);
      const iroha=track.sceneryTheme==='iroha-autumn-night';
      const usui=track.sceneryTheme==='usui-gorge-night';
      const day=track.sceneryTheme==='tsuchisaka-forest-day';
      const roadside=track.sceneryTheme==='akagi-night'||track.sceneryTheme==='enna-night';
      const mountain = track.sceneryTheme === 'akina-rework'||iroha||usui||roadside;
      const coldNight=iroha||usui||roadside;
      ctx.save();
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      const cachedPath = crisp && track === this.cachedTrack ? this.roadPath : null;
      if (!cachedPath) trace(ctx, points, track.closed !== false);
      const strokeRoad = () => cachedPath ? ctx.stroke(cachedPath) : ctx.stroke();
      if (!crisp) {
        ctx.strokeStyle = 'rgba(0,0,0,.45)'; ctx.lineWidth = width + 52; strokeRoad();
        ctx.strokeStyle = day?'#888d70':coldNight?'#12141c':mountain ? '#293b36' : '#28323d'; ctx.lineWidth = width + 26; strokeRoad();
        ctx.strokeStyle = day?'#b4af8f':coldNight?'#252329':mountain ? '#35473e' : rgba(accent, .1); ctx.lineWidth = width + 17; strokeRoad();
      }
      ctx.strokeStyle = day?'#d5d5b9':coldNight?'#4b5561':mountain ? '#71877d' : rgba(accent, .56); ctx.lineWidth = width + 5; strokeRoad();
      const asphalt = ctx.createLinearGradient(0, getBounds(track).minY, 0, getBounds(track).maxY);
      asphalt.addColorStop(0, day?'#677371':coldNight?'#17202b':mountain ? '#202b35' : '#29323d'); asphalt.addColorStop(.5, day?'#576563':coldNight?'#111923':mountain ? '#1c2630' : '#242c37'); asphalt.addColorStop(1, day?'#707b73':coldNight?'#161d27':mountain ? '#202a34' : '#292e3a');
      ctx.strokeStyle = asphalt; ctx.lineWidth = width - 2; strokeRoad();
      ctx.strokeStyle = day?'#e0e0c9':'rgba(172,187,195,.3)'; ctx.lineWidth = width - 20; strokeRoad();
      ctx.strokeStyle = asphalt; ctx.lineWidth = width - 23; strokeRoad();
      if (mountain) {
        if(track.sceneryTheme==='enna-night') { ctx.strokeStyle='#b4c2bd';ctx.lineWidth=2.5;ctx.setLineDash([30,32]);strokeRoad();ctx.setLineDash([]); }
        else { ctx.strokeStyle = coldNight?'#b08b4e':'#c6a35f'; ctx.lineWidth = track.sceneryTheme==='akagi-night'?3:5; strokeRoad();
          if(track.sceneryTheme!=='akagi-night'){ctx.strokeStyle = asphalt; ctx.lineWidth = 1.8; strokeRoad();} }
      } else if(track.family==='wangan') {
        let lanes=lanePaths.get(track);
        if(!lanes){
          lanes=[-1,1].map(side=>{
            const coords=points.map(p=>({x:p.x+p.normalX*width/6*side,y:p.y+p.normalY*width/6*side}));
            let path=null;if(typeof Path2D!=='undefined'){path=new Path2D();path.moveTo(coords[0].x,coords[0].y);for(let i=1;i<coords.length;i++)path.lineTo(coords[i].x,coords[i].y);}
            return {coords,path};
          });lanePaths.set(track,lanes);
        }
        ctx.strokeStyle='#b7bdb6';ctx.lineWidth=2;ctx.setLineDash([32,38]);
        for(const lane of lanes){if(lane.path)ctx.stroke(lane.path);else{trace(ctx,lane.coords,false);ctx.stroke();}}
        ctx.setLineDash([]);
      } else {
        ctx.strokeStyle = day?'#d5d9c7':'rgba(191,204,211,.16)'; ctx.lineWidth = day?2.6:2;
        ctx.setLineDash([26, 35]); strokeRoad(); ctx.setLineDash([]);
      }

      // Grain is road-constrained and baked once for a stable asphalt surface.
      for (let i = 0; i < (crisp ? 0 : this.quality === 'high' ? 3600 : 1300); i++) {
        const p = points[Math.floor(random() * points.length)];
        if (!p) break;
        const a = Number.isFinite(p.angle) ? p.angle : 0;
        const offset = (random() - .5) * (width - 22);
        const x = p.x - Math.sin(a) * offset + (random() - .5) * 20;
        const y = p.y + Math.cos(a) * offset + (random() - .5) * 20;
        const pale = random() > .5, tw = .8 + random() * 2, th = .8 + random() * 2;
        ctx.fillStyle = pale ? 'rgba(220,231,231,.035)' : 'rgba(0,0,0,.08)';
        ctx.fillRect(x, y, tw, th);
        if (this._bakingEnvironment) this.roadTexture.push({ x, y, w: tw, h: th, pale });
      }

      const start = track.start || points[0];
      if (start) this._gate(ctx, start, width, accent, 'S T A R T');
      if (track.closed === false) {
        const finish = track.finish || points[points.length - 1];
        if (finish) this._gate(ctx, finish, width, COLORS.lime, 'F I N I S H');
      }
      ctx.restore();
    }

    _drawRoadTexture(ctx, camera) {
      const halfW = this.width / camera.zoom / 2 + 10, halfH = this.height / camera.zoom / 2 + 10;
      for (const pale of [false, true]) {
        ctx.fillStyle = pale ? 'rgba(211,229,225,.065)' : 'rgba(2,8,14,.16)';
        for (const p of this.roadTexture) {
          if (p.pale !== pale || Math.abs(p.x - camera.x) > halfW || Math.abs(p.y - camera.y) > halfH) continue;
          ctx.fillRect(p.x, p.y, p.w, p.h);
        }
      }
    }

    _gate(ctx, point, width, accent, label) {
      ctx.save(); ctx.translate(point.x, point.y); ctx.rotate(point.angle || 0);
      const check = width < 150 ? 7 : 11, across = Math.floor((width - 18) / check);
      for (let row = 0; row < 3; row++) for (let col = 0; col < across; col++) {
        ctx.fillStyle = (row + col) % 2 ? '#d4e5df' : '#151f28';
        ctx.fillRect(row * check - check * 1.5, -across * check / 2 + col * check, check, check);
      }
      ctx.strokeStyle = accent; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(-20, -width / 2 + 5); ctx.lineTo(-20, width / 2 - 5); ctx.stroke();
      for (const side of [-1, 1]) {
        ctx.fillStyle = '#182731'; roundRect(ctx, -10, side * (width / 2 + 10) - 9, 20, 18, 2); ctx.fill();
        ctx.fillStyle = accent; ctx.fillRect(-7, side * (width / 2 + 10) - 2, 14, 4);
      }
      ctx.fillStyle = 'rgba(205,226,221,.36)'; ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center'; ctx.rotate(-Math.PI / 2); ctx.fillText(label, 0, -36);
      ctx.restore();
    }

    _roadFurniture(ctx, track, random) {
      const p = pointsOf(track), width = track.width || 220, accent = accentOf(track);
      if (p.length < 3) return;
      if (track.sceneryTheme === 'akina-rework'||track.sceneryTheme==='iroha-autumn-night'||track.sceneryTheme==='usui-gorge-night'||track.sceneryTheme==='tsuchisaka-forest-day'||track.family==='wangan') return;
      for (let i = 0; i < p.length - (track.closed === false ? 1 : 0); i += 10) {
        const v = p[i], next = p[(i + 1) % p.length];
        const angle = Math.atan2(next.y - v.y, next.x - v.x);
        const nx = -Math.sin(angle), ny = Math.cos(angle);
        for (const side of [-1, 1]) {
          const x = v.x + nx * (width / 2 + 23) * side;
          const y = v.y + ny * (width / 2 + 23) * side;
          const glow = ctx.createRadialGradient(x, y, 1, x, y, 23);
          glow.addColorStop(0, rgba(accent, .13)); glow.addColorStop(1, rgba(accent, 0));
          ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(x, y, 23, 0, TAU); ctx.fill();
          ctx.fillStyle = '#13212a'; ctx.beginPath(); ctx.arc(x, y, 4, 0, TAU); ctx.fill();
          ctx.fillStyle = rgba(accent, .8); ctx.beginPath(); ctx.arc(x, y, 1.7, 0, TAU); ctx.fill();
        }
      }

      for (let i = 19; i < p.length; i += 37) {
        const v = p[i], next = p[track.closed === false ? Math.min(i + 2, p.length - 1) : (i + 2) % p.length];
        const angle = Math.atan2(next.y - v.y, next.x - v.x);
        const side = i % 2 ? 1 : -1;
        const x = v.x - Math.sin(angle) * (width / 2 + 52) * side;
        const y = v.y + Math.cos(angle) * (width / 2 + 52) * side;
        ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
        ctx.fillStyle = '#111e28'; roundRect(ctx, -33, -9, 66, 18, 3); ctx.fill();
        ctx.strokeStyle = rgba(accent, .65); ctx.lineWidth = 1.5; ctx.stroke();
        ctx.fillStyle = accent;
        for (let k = -1; k <= 1; k++) {
          ctx.beginPath(); ctx.moveTo(k * 17 - 4, -5); ctx.lineTo(k * 17 + 2, 0); ctx.lineTo(k * 17 - 4, 5);
          ctx.lineWidth = 2; ctx.stroke();
        }
        ctx.restore();
      }

      const words = track.id === 'harbor' ? ['AFTER HOURS', 'PORT / 08', 'LOW TIDE', 'NIGHT SHIFT']
        : track.closed === false || track.id === 'ridge' ? ['HIGH GROUND', 'STAY WILD', 'TOUGE / 01', 'NO SIGNAL']
          : ['NIGHTDRIVE', 'NO SLEEP', 'NEON DISTRICT', 'MAKE YOUR LINE'];
      for (let j = 0; j < 4; j++) {
        const i = Math.floor((j + .31) * p.length / 4) % p.length;
        const v = p[i], next = p[track.closed === false ? Math.min(i + 2, p.length - 1) : (i + 2) % p.length];
        const a = Math.atan2(next.y - v.y, next.x - v.x);
        const side = j % 2 ? -1 : 1;
        const x = v.x - Math.sin(a) * (width / 2 + 100) * side;
        const y = v.y + Math.cos(a) * (width / 2 + 100) * side;
        this._billboard(ctx, x, y, words[j], j % 2 ? COLORS.pink : accent, a);
      }

      // Track names are painted into the scene as a quiet map annotation.
      const b = getBounds(track);
      const labelX = b.minX + 30, labelY = b.minY - 165;
      ctx.fillStyle = rgba(accent, .42); ctx.font = '600 13px monospace';
      ctx.textAlign = 'left'; ctx.fillText(track.closed === false ? 'N / D     MOUNTAIN TOUGE' : 'N / D     CITY CIRCUIT', labelX, labelY);
      ctx.fillStyle = 'rgba(193,217,222,.18)'; ctx.font = '700 55px sans-serif';
      ctx.fillText((track.name || 'NIGHTDRIVE').toUpperCase(), labelX - 3, labelY + 60);
    }

    _billboard(ctx, x, y, word, color, angle) {
      ctx.save(); ctx.translate(x, y);
      // Keep signs upright enough to read from the fixed overhead camera.
      let a = angle;
      if (Math.cos(a) < 0) a += Math.PI;
      ctx.rotate(a);
      ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(-86 + 8, -22 + 12, 172, 44);
      ctx.fillStyle = '#111a25'; roundRect(ctx, -86, -22, 172, 44, 3); ctx.fill();
      ctx.strokeStyle = rgba(color, .5); ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = color; ctx.font = '700 12px monospace'; ctx.textAlign = 'center';
      ctx.fillText(word, 0, 4);
      ctx.fillStyle = rgba(color, .8); ctx.fillRect(-76, 15, 35, 1.5); ctx.fillRect(41, 15, 35, 1.5);
      ctx.restore();
    }

    _cameraFor(engine, dt, overview, reducedMotion) {
      const track = engine.track, p = engine.player || (track.start || pointsOf(track)[0]);
      const c = this.camera;
      if (overview || !p) {
        const b = getBounds(track), pad = 230;
        c.x = (b.minX + b.maxX) / 2;
        c.y = (b.minY + b.maxY) / 2;
        c.zoom = Math.min(this.width / (b.maxX - b.minX + pad * 2), this.height / (b.maxY - b.minY + pad * 2));
        c.ready = false;
        return c;
      }
      const speed = Math.abs(p.speed || Math.hypot(p.vx || 0, p.vy || 0));
      const look = clamp(speed * .38, 70, 240);
      const angle = p.angle || 0;
      const tx = p.x + Math.cos(angle) * look, ty = p.y + Math.sin(angle) * look;
      const viewport = clamp(Math.sqrt(this.width * this.height / 850000), .8, 1.13);
      const targetZoom = (1.35 - clamp(speed / 4200, 0, .14)) * viewport;
      if (!c.ready) { c.x = tx; c.y = ty; c.zoom = targetZoom; c.ready = true; }
      const smoothing = reducedMotion ? 1 : 1 - Math.exp(-dt * 5.2);
      c.x = mix(c.x, tx, smoothing); c.y = mix(c.y, ty, smoothing);
      c.zoom = mix(c.zoom, targetZoom, reducedMotion ? 1 : 1 - Math.exp(-dt * 2));
      return c;
    }

    _updateEffects(engine, dt, reducedMotion) {
      const cars = [...(engine.rivals || []), ...(engine.player ? [engine.player] : [])];
      const active = dt > 0 && (engine.state === 'running' || engine.state === 'countdown' || engine.attract || engine.state === 'attract');
      const maxSkids = this.quality === 'high' ? 650 : 250;
      for (let i = 0; i < cars.length; i++) {
        const car = cars[i];
        const key = car === engine.player ? 'player' : car.id || `rival${i}`;
        const prev = this.lastCars.get(key);
        const speed = Math.abs(car.speed || Math.hypot(car.vx || 0, car.vy || 0));
        const drift = car.drifting || (speed > 120 && Math.abs((car.vy || 0) * Math.cos(car.angle) - (car.vx || 0) * Math.sin(car.angle)) > 75);
        const moved = prev ? Math.hypot(car.x - prev.x, car.y - prev.y) : 0;
        const wet = engine.weather === 'rain' && !car.offroad;
        if (wet && active && !reducedMotion && speed > 26 && Math.random() < dt * 26) {
          const dx = Math.cos(car.angle), dy = Math.sin(car.angle);
          for (const side of [-1, 1]) {
            const spread = side * (12 + Math.random() * speed * .24);
            this._spawn(car.x - dx * 16 - dy * side * 9, car.y - dy * 16 + dx * side * 9,
              -car.vx * .22 - dy * spread, -car.vy * .22 + dx * spread,
              .24 + Math.random() * .23, 'spray', '#b7ddf2', 1 + Math.random() * .8);
          }
        }
        if (active && prev && drift && speed > 75 && moved > .05 && moved < 70) {
          for (const side of [-1, 1]) {
            const ax = -Math.cos(car.angle) * 13 - Math.sin(car.angle) * 9 * side;
            const ay = -Math.sin(car.angle) * 13 + Math.cos(car.angle) * 9 * side;
            this.skids.push({ x1: prev.x + ax, y1: prev.y + ay, x2: car.x + ax, y2: car.y + ay, life: 8 });
          }
          if (!wet && !reducedMotion && this.particles.length < (this.quality === 'high' ? 150 : 55) && Math.random() > .4) {
            this._spawn(car.x - Math.cos(car.angle) * 20, car.y - Math.sin(car.angle) * 20,
              -car.vx * .08 + (Math.random() - .5) * 35, -car.vy * .08 + (Math.random() - .5) * 35,
              .35 + Math.random() * .3, 'smoke', '#a9bdc6', 5 + Math.random() * 5);
          }
        }
        this.lastCars.set(key, { x: car.x, y: car.y });
      }
      if (engine.player) {
        const p = engine.player;
        const integrity = p.integrity == null ? 1 : p.integrity;
        if (integrity < this.lastIntegrity - .003 && active && !reducedMotion) {
          this.shake = Math.min(6, (this.lastIntegrity - integrity) * 70 + 2);
          for (let i = 0; i < 15; i++) {
            const a = Math.random() * TAU, velocity = 40 + Math.random() * 135;
            this._spawn(p.x, p.y, Math.cos(a) * velocity, Math.sin(a) * velocity, .2 + Math.random() * .4, 'spark', '#ffd88b', 1.5);
          }
        }
        this.lastIntegrity = integrity;
      }
      if (this.skids.length > maxSkids) this.skids.splice(0, this.skids.length - maxSkids);
      for (let i = this.skids.length - 1; i >= 0; i--) {
        this.skids[i].life -= dt;
        if (this.skids[i].life <= 0) this.skids.splice(i, 1);
      }
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt;
        p.vx *= Math.exp(-dt * 2); p.vy *= Math.exp(-dt * 2);
        if (p.life <= 0) this.particles.splice(i, 1);
      }
      this.shake *= Math.exp(-dt * 13);
    }

    _spawn(x, y, vx, vy, life, type, color, size) {
      if (this.particles.length >= (this.quality === 'high' ? 180 : 65)) return;
      this.particles.push({ x, y, vx: vx || 0, vy: vy || 0, life, maxLife: life, type, color, size });
    }

    _drawSkids(ctx) {
      ctx.lineWidth = 3.4; ctx.lineCap = 'round';
      // Single batched path per opacity group keeps sustained drifting inexpensive.
      for (let group = 0; group < 3; group++) {
        ctx.beginPath();
        for (const skid of this.skids) {
          if (Math.min(2, Math.floor(skid.life / 3)) !== group) continue;
          ctx.moveTo(skid.x1, skid.y1); ctx.lineTo(skid.x2, skid.y2);
        }
        ctx.strokeStyle = `rgba(4,9,16,${.1 + group * .1})`; ctx.stroke();
      }
    }

    _car(ctx, car, player, reducedMotion, overview) {
      if (!Number.isFinite(car.x) || !Number.isFinite(car.y)) return;
      const color = car.color || (player ? COLORS.cyan : COLORS.pink);
      const speed = Math.abs(car.speed || 0), boost = !!car.boosting;
      const sprite = getSprite(car.sprite, car.spriteAngle);
      ctx.save(); ctx.translate(car.x, car.y); ctx.rotate(car.angle || 0);
      if (overview) ctx.scale(1.4, 1.4);
      if (!overview && this.quality === 'high' && this.cachedTrack?.sceneryTheme!=='tsuchisaka-forest-day') {
        const glow = ctx.createRadialGradient(0, 0, 8, 0, 0, player ? 49 : 35);
        glow.addColorStop(0, rgba(color, player ? .16 : .08)); glow.addColorStop(1, rgba(color, 0));
        ctx.fillStyle = glow; ctx.beginPath(); ctx.ellipse(0, 0, 54, 37, 0, 0, TAU); ctx.fill();
        // Two low-opacity headlight cones leave the asphalt legible.
        if (player) {
          const beam = ctx.createLinearGradient(20, 0, 170, 0);
          beam.addColorStop(0, 'rgba(211,246,235,.13)'); beam.addColorStop(1, 'rgba(211,246,235,0)');
          ctx.fillStyle = beam;
          for (const side of [-1, 1]) {
            ctx.beginPath(); ctx.moveTo(23, side * 8 - 3); ctx.lineTo(170, side * 8 - 31);
            ctx.lineTo(170, side * 8 + 31); ctx.lineTo(23, side * 8 + 3); ctx.closePath(); ctx.fill();
          }
        }
      }
      if (boost && !overview) {
        const flicker = reducedMotion ? 1 : .85 + Math.sin(this.elapsed * 61) * .15;
        const flame = ctx.createLinearGradient(-18, 0, -78 * flicker, 0);
        flame.addColorStop(0, '#e8ffe9'); flame.addColorStop(.25, rgba(COLORS.cyan, .85)); flame.addColorStop(1, rgba(COLORS.cyan, 0));
        ctx.fillStyle = flame;
        for (const side of [-1, 1]) {
          ctx.beginPath(); ctx.moveTo(-18, side * 6 - 3.5); ctx.lineTo(-75 * flicker, side * 7);
          ctx.lineTo(-18, side * 6 + 3.5); ctx.closePath(); ctx.fill();
        }
        ctx.strokeStyle = rgba(COLORS.cyan, .18); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(-28, -15); ctx.lineTo(-115, -18); ctx.moveTo(-28, 15); ctx.lineTo(-115, 18); ctx.stroke();
      }

      if (sprite && sprite.status === 'ready') {
        ctx.fillStyle = 'rgba(0,0,0,.36)';
        ctx.beginPath(); ctx.ellipse(2, 3, 22, 12, 0, 0, TAU); ctx.fill();
        const vertical = Math.abs(Math.sin(sprite.angle)) > .5;
        const asset = sprite.canvas;
        const long = vertical ? asset.height : asset.width;
        const short = vertical ? asset.width : asset.height;
        const bodyLength = 46, bodyWidth = Math.min(28, bodyLength * short / long);
        ctx.save(); ctx.rotate(-sprite.angle);
        const sw = vertical ? bodyWidth : bodyLength, sh = vertical ? bodyLength : bodyWidth;
        ctx.drawImage(asset, -sw / 2, -sh / 2, sw, sh);
        ctx.restore();
        ctx.fillStyle = 'rgba(226,255,237,.9)';
        ctx.fillRect(21, -7, 2, 3); ctx.fillRect(21, 4, 2, 3);
        ctx.fillStyle = car.braking ? '#ff697f' : 'rgba(255,83,118,.7)';
        ctx.fillRect(-23, -7, 2, 3); ctx.fillRect(-23, 4, 2, 3);
        if (player && !overview) {
          ctx.fillStyle = rgba(COLORS.lime, .9);
          ctx.beginPath(); ctx.moveTo(1, -25); ctx.lineTo(-3, -31); ctx.lineTo(5, -31); ctx.closePath(); ctx.fill();
        }
        ctx.restore();
        return;
      }

      ctx.fillStyle = 'rgba(0,0,0,.45)'; roundRect(ctx, -21 + 3, -13 + 5, 44, 26, 7); ctx.fill();
      // Four separate tyres make the steering response visible at racing scale.
      ctx.fillStyle = '#080d15';
      for (const side of [-1, 1]) {
        ctx.save(); ctx.translate(12, side * 12); ctx.rotate((car.steer || 0) * .28);
        roundRect(ctx, -6, -3, 12, 6, 2); ctx.fill(); ctx.restore();
        roundRect(ctx, -19, side * 12 - 3, 12, 6, 2); ctx.fill();
      }
      const paint = ctx.createLinearGradient(0, -12, 0, 12);
      paint.addColorStop(0, '#d3e9df'); paint.addColorStop(.08, color);
      paint.addColorStop(.62, color); paint.addColorStop(1, rgba(color, .58));
      ctx.fillStyle = paint;
      ctx.beginPath(); ctx.moveTo(24, -7); ctx.lineTo(19, -11); ctx.lineTo(-17, -11);
      ctx.lineTo(-23, -8); ctx.lineTo(-23, 8); ctx.lineTo(-17, 11); ctx.lineTo(19, 11);
      ctx.lineTo(24, 7); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = rgba('#ddfff0', .55); ctx.lineWidth = .9; ctx.stroke();
      // A dark, tapered cabin with a luminous windshield and rear glass.
      ctx.fillStyle = '#15232b';
      ctx.beginPath(); ctx.moveTo(9, -8); ctx.lineTo(-10, -8); ctx.lineTo(-15, -6);
      ctx.lineTo(-15, 6); ctx.lineTo(-10, 8); ctx.lineTo(9, 8); ctx.lineTo(13, 5); ctx.lineTo(13, -5); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#2e4850';
      ctx.beginPath(); ctx.moveTo(9, -7); ctx.lineTo(13, -5); ctx.lineTo(13, 5); ctx.lineTo(9, 7); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#35535a'; ctx.fillRect(-13, -5, 3, 10);
      ctx.fillStyle = rgba(color, .9); ctx.fillRect(-8, -6, 13, 12);
      ctx.fillStyle = 'rgba(255,255,255,.11)'; ctx.fillRect(-5, -5, 9, 3);
      ctx.strokeStyle = rgba('#0e2830', .3); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(15, -6); ctx.lineTo(22, -5); ctx.moveTo(15, 6); ctx.lineTo(22, 5); ctx.stroke();
      ctx.fillStyle = '#0b1721'; ctx.fillRect(-24, -12, 3, 24);
      ctx.fillStyle = '#e1fff0'; ctx.fillRect(21, -8, 3, 5); ctx.fillRect(21, 3, 3, 5);
      ctx.fillStyle = car.braking ? '#ff637f' : '#fa5a80'; ctx.fillRect(-23, -8, 2.5, 5); ctx.fillRect(-23, 3, 2.5, 5);
      if (car.braking && !overview) {
        ctx.fillStyle = 'rgba(255,64,102,.16)';
        ctx.beginPath(); ctx.ellipse(-25, 0, 15, 16, 0, 0, TAU); ctx.fill();
      }
      if (player && !overview) {
        ctx.fillStyle = rgba(COLORS.lime, .9);
        ctx.beginPath(); ctx.moveTo(1, -28); ctx.lineTo(-4, -35); ctx.lineTo(6, -35); ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    }

    _drawParticles(ctx) {
      for (const p of this.particles) {
        const alpha = clamp(p.life / p.maxLife, 0, 1);
        if (p.type === 'smoke') {
          ctx.fillStyle = rgba(p.color, alpha * .13);
          ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (2 - alpha), 0, TAU); ctx.fill();
        } else {
          ctx.strokeStyle = rgba(p.color, p.type === 'spray' ? alpha * .65 : alpha); ctx.lineWidth = p.size * alpha;
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * .035, p.y - p.vy * .035); ctx.stroke();
        }
      }
    }

    _drawWetRoad(ctx, track, car) {
      if (!this.roadPath || !car) return;
      ctx.save();
      ctx.lineWidth = track.width - 5;
      ctx.lineCap = ctx.lineJoin = 'round';
      ctx.strokeStyle = 'rgba(14,34,58,.4)';
      ctx.stroke(this.roadPath);

      const dx = Math.cos(car.angle), dy = Math.sin(car.angle);
      const shine = ctx.createLinearGradient(car.x + dx * 20, car.y + dy * 20, car.x + dx * 235, car.y + dy * 235);
      shine.addColorStop(0, 'rgba(202,234,255,.61)');
      shine.addColorStop(.26, 'rgba(152,205,244,.43)');
      shine.addColorStop(.54, 'rgba(130,186,229,.23)');
      shine.addColorStop(1, 'rgba(130,186,229,0)');
      ctx.save();
      ctx.translate(car.x, car.y); ctx.rotate(car.angle);
      ctx.beginPath();
      for (const side of [-1, 1]) {
        ctx.moveTo(18, side * 9 - 3);
        ctx.quadraticCurveTo(90, side * 13 - 13, 235, side * 20 - 17);
        ctx.lineTo(235, side * 20 + 17);
        ctx.quadraticCurveTo(105, side * 13 + 13, 18, side * 9 + 3);
        ctx.closePath();
      }
      ctx.restore();
      ctx.clip();
      ctx.strokeStyle = shine;
      ctx.stroke(this.roadPath);
      ctx.restore();
    }

    _drawWeather(ctx, weather, w, h, reducedMotion) {
      if (weather === 'fog') {
        const mist = ctx.createRadialGradient(w * .5, h * .5, 36, w * .5, h * .5, Math.max(w, h) * .57);
        mist.addColorStop(0, 'rgba(147,172,179,.1)');
        mist.addColorStop(.45, 'rgba(139,166,174,.43)');
        mist.addColorStop(1, 'rgba(119,145,154,.86)');
        ctx.fillStyle = mist;
        ctx.fillRect(0, 0, w, h);
      }
      if (weather === 'rain' && !reducedMotion) {
        const count = Math.min(this.quality === 'high' ? 400 : 150, Math.ceil(w * h / 2600));
        ctx.beginPath();
        for (let i = 1; i <= count; i++) {
          const speed = 360 + i % 13 * 29;
          const x = (i * 421.63 + this.elapsed * speed * .26) % (w + 30) - 15;
          const y = (i * 173.51 + this.elapsed * speed) % (h + 36) - 24;
          ctx.moveTo(x, y);
          ctx.lineTo(x + speed * .008, y + speed * .026);
        }
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(180,218,247,.32)';
        ctx.stroke();
      }
    }

    render(engine, dt = .016, options = {}) {
      if (this.destroyed || !engine || !engine.track) return;
      dt = clamp(Number.isFinite(dt) ? dt : .016, 0, .05);
      const { overview = false, reducedMotion = false } = options;
      this.elapsed += dt;
      if (engine.track !== this.cachedTrack) this._buildEnvironment(engine.track);
      const ctx = this.ctx, w = this.width, h = this.height;
      const camera = this._cameraFor(engine, dt, overview, reducedMotion);
      if (!overview) this._updateEffects(engine, dt, reducedMotion);
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      ctx.fillStyle = '#0d1420'; ctx.fillRect(0, 0, w, h);
      ctx.save();
      const jitterX = reducedMotion || overview ? 0 : Math.sin(this.elapsed * 113) * this.shake;
      const jitterY = reducedMotion || overview ? 0 : Math.cos(this.elapsed * 97) * this.shake * .7;
      ctx.translate(w / 2 + jitterX, h / 2 + jitterY);
      ctx.scale(camera.zoom, camera.zoom); ctx.translate(-camera.x, -camera.y);
      const cache = this.cache;
      ctx.drawImage(cache.canvas, cache.world.x, cache.world.y, cache.world.w, cache.world.h);
      const highway=rasterScene(engine.track);
      if (!overview) { if(highway)this._drawHighwayTiles(ctx,camera,engine.player);else this._drawScenery(ctx,camera); }
      // Long source routes are many kilometres wide. Keep their cache bounded,
      // then paint the road as vectors so lane marks remain crisp at racing zoom.
      if (!overview && !highway && cache.scale < .45) this._road(ctx, engine.track, null, true);
      if (!overview && !highway) this._drawRoadTexture(ctx, camera);
      if (!overview && engine.weather === 'rain') this._drawWetRoad(ctx, engine.track, engine.player);

      if (!overview) this._drawSkids(ctx);
      if(!overview)for(const car of engine.traffic||[]){
        if(!car.active||Math.abs(car.x-camera.x)>w/camera.zoom/2+100||Math.abs(car.y-camera.y)>h/camera.zoom/2+100)continue;
        const sprite=getSprite(car.sprite,0);if(!sprite||sprite.status!=='ready')continue;
        ctx.save();ctx.translate(car.x,car.y);ctx.rotate(car.angle);
        ctx.fillStyle='rgba(0,0,0,.5)';ctx.fillRect(-car.halfLength+3,-car.halfWidth+4,car.halfLength*2,car.halfWidth*2);
        ctx.drawImage(sprite.canvas,-car.halfLength,-car.halfWidth,car.halfLength*2,car.halfWidth*2);ctx.restore();
      }
      for (const rival of engine.rivals || []) this._car(ctx, rival, false, reducedMotion, overview);
      if (engine.ghost?.visible) {
        ctx.save();
        ctx.globalAlpha = .38;
        this._car(ctx, engine.ghost, false, true, overview);
        ctx.restore();
      }
      if (engine.player) this._car(ctx, engine.player, true, reducedMotion, overview);
      if (!overview && !reducedMotion) this._drawParticles(ctx);
      if(engine.track.sceneryTheme==='usui-gorge-night')this._drawUsuiOverhead(ctx,camera);
      ctx.restore();

      // A soft optical falloff focuses the road, without obscuring touch controls.
      if(engine.track.sceneryTheme!=='tsuchisaka-forest-day'){ctx.fillStyle = this.vignette; ctx.fillRect(0, 0, w, h);}
      if (!overview) this._drawWeather(ctx, engine.weather, w, h, reducedMotion);
      if (!overview && engine.player && engine.player.boosting && !reducedMotion && this.quality === 'high') {
        this._speedLines(ctx, w, h);
      }
    }

    _speedLines(ctx, w, h) {
      const cx = w / 2, cy = h / 2;
      ctx.lineWidth = 1;
      for (let i = 0; i < 14; i++) {
        const a = i / 14 * TAU + .19;
        const progress = (this.elapsed * .9 + i * .37) % 1;
        const r = Math.max(w, h) * (.45 + progress * .23);
        ctx.strokeStyle = `rgba(160,255,224,${(1 - progress) * .12})`;
        ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
        ctx.lineTo(cx + Math.cos(a) * (r + 35), cy + Math.sin(a) * (r + 35)); ctx.stroke();
      }
    }

    drawMiniMap(canvas, track, player, rivals) { return drawMiniMap(canvas, track, player, rivals); }

    destroy() {
      this.destroyed = true;
      this._clearSceneryTiles(); this.roadPath = null;
      if(this.usuiBridgeArt){this.usuiBridgeArt.width=1;this.usuiBridgeArt.height=1;}this.usuiBridgeArt=null;this.usuiBridge=null;this.usuiBridgePattern=null;
      window.removeEventListener('resize', this._resize);
      if (this.cache) { this.cache.canvas.width = 1; this.cache.canvas.height = 1; }
      this.cache = null; this.cachedTrack = null;
      this.particles.length = 0; this.skids.length = 0; this.lastCars.clear();
      this.sceneryProps.length = 0; this.roadTexture.length = 0; this.sceneryGrid.clear();
    }
  }

  function drawMiniMap(canvas, track, player, rivals = []) {
    if (!canvas || !track) return;
    const rect = canvas.getBoundingClientRect();
    const w = Math.round(rect.width || canvas.clientWidth || 170);
    const h = Math.round(rect.height || canvas.clientHeight || 120);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
    const b = getBounds(track), pad = 16;
    const z = Math.min((w - pad * 2) / (b.maxX - b.minX || 1), (h - pad * 2) / (b.maxY - b.minY || 1));
    const cx = (b.minX + b.maxX) / 2, cy = (b.minY + b.maxY) / 2;
    ctx.save(); ctx.translate(w / 2, h / 2); ctx.scale(z, z); ctx.translate(-cx, -cy);
    const path=getTrackPath(track);
    if(!path) trace(ctx, pointsOf(track), track.closed !== false);
    const strokeTrack=()=>path?ctx.stroke(path):ctx.stroke();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(165,191,197,.12)'; ctx.lineWidth = 10 / z; strokeTrack();
    ctx.strokeStyle = 'rgba(165,191,197,.48)'; ctx.lineWidth = 2 / z; strokeTrack();
    const start = track.start || pointsOf(track)[0];
    if (start) {
      ctx.fillStyle = '#b8cbc9'; ctx.fillRect(start.x - 2 / z, start.y - 2 / z, 4 / z, 4 / z);
    }
    if (track.closed === false) {
      const finish = track.finish || pointsOf(track)[pointsOf(track).length - 1];
      if (finish) {
        ctx.fillStyle = COLORS.lime;
        ctx.beginPath(); ctx.arc(finish.x, finish.y, 3 / z, 0, TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(215,255,99,.35)'; ctx.lineWidth = 1 / z;
        ctx.beginPath(); ctx.arc(finish.x, finish.y, 5 / z, 0, TAU); ctx.stroke();
      }
    }
    for (const rival of rivals) {
      ctx.fillStyle = rgba(rival.color || COLORS.pink, .65);
      ctx.beginPath(); ctx.arc(rival.x, rival.y, 2.3 / z, 0, TAU); ctx.fill();
    }
    if (player) {
      ctx.fillStyle = rgba(COLORS.cyan, .14); ctx.beginPath(); ctx.arc(player.x, player.y, 8 / z, 0, TAU); ctx.fill();
      ctx.save(); ctx.translate(player.x, player.y); ctx.rotate(player.angle || 0);
      ctx.fillStyle = COLORS.lime; ctx.beginPath();
      ctx.moveTo(5.2 / z, 0); ctx.lineTo(-3.5 / z, -3.5 / z); ctx.lineTo(-1.7 / z, 0);
      ctx.lineTo(-3.5 / z, 3.5 / z); ctx.closePath(); ctx.fill(); ctx.restore();
    }
    ctx.restore();
  }

  Renderer.drawMiniMap = drawMiniMap;
  globalThis.NDRenderer = { Renderer, drawMiniMap, preloadSprites };
})();

