/* FC8Bit Super Y4M4L - level data. Levels are composed with a small builder
   so the geometry stays readable and easy to tune. */
window.FC8 = window.FC8 || {};

FC8.levels = (function () {
  'use strict';

  var ID = FC8.tiles.ID;

  var CHAR = {
    'X': ID.DIRT, 'T': ID.TURF, 'B': ID.BRICK, '?': ID.BALLBLOCK, 'U': ID.USED,
    'M': ID.METAL, 'S': ID.STAND, 'G': ID.GIRDER, '^': ID.SPIKES, 'N': ID.NET,
    'D': ID.STONE, 'd': ID.STONE_TOP
  };

  function Builder(w, h) {
    this.w = w; this.h = h;
    this.tiles = [];
    for (var y = 0; y < h; y++) {
      var row = [];
      for (var x = 0; x < w; x++) row.push(0);
      this.tiles.push(row);
    }
    this.items = {};      // "x,y" -> content of a ball block
    this.enemies = [];    // {type,x,y}
    this.balls = [];      // {x,y}
    this.movers = [];     // moving platforms
    this.decor = [];      // {kind,x,y}
    this.spawn = { x: 3, y: h - 4 };
    this.goal = null;
    this.boss = null;
    this.podium = null;
    this.gate = null;
  }

  Builder.prototype.set = function (x, y, t) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return this;
    this.tiles[y][x] = t;
    return this;
  };

  Builder.prototype.rect = function (x, y, w, h, t) {
    for (var j = 0; j < h; j++) for (var i = 0; i < w; i++) this.set(x + i, y + j, t);
    return this;
  };

  /** Paint a row from a character string (see CHAR). "." and " " skip. */
  Builder.prototype.row = function (x, y, str) {
    for (var i = 0; i < str.length; i++) {
      var c = str[i];
      if (c === '.' || c === ' ') continue;
      this.set(x + i, y, CHAR[c] !== undefined ? CHAR[c] : 0);
    }
    return this;
  };

  /** Solid pitch from topY down to the floor. */
  Builder.prototype.ground = function (x, w, topY, topT, fillT) {
    topY = topY === undefined ? this.h - 2 : topY;
    topT = topT || ID.TURF; fillT = fillT || ID.DIRT;
    for (var i = 0; i < w; i++) {
      this.set(x + i, topY, topT);
      for (var y = topY + 1; y < this.h; y++) this.set(x + i, y, fillT);
    }
    return this;
  };

  /** Raised plateau sitting on the pitch. */
  Builder.prototype.hill = function (x, w, h, topY, topT, fillT) {
    topY = (topY === undefined ? this.h - 2 : topY) - h;
    return this.ground(x, w, topY, topT, fillT);
  };

  Builder.prototype.stairs = function (x, baseY, h, dir) {
    for (var i = 0; i < h; i++) {
      var col = dir > 0 ? x + i : x + (h - 1 - i);
      for (var y = baseY - i; y <= baseY; y++) this.set(col, y, ID.METAL);
    }
    return this;
  };

  /** Players' tunnel, 2 tiles wide, sitting with its base on baseY. */
  Builder.prototype.tunnel = function (x, baseY, h) {
    for (var i = 0; i < h; i++) {
      var y = baseY - i;
      var top = (i === h - 1);
      this.set(x, y, top ? ID.TUNNEL_TL : ID.TUNNEL_BL);
      this.set(x + 1, y, top ? ID.TUNNEL_TR : ID.TUNNEL_BR);
    }
    return this;
  };

  /** Ball block with contents: ball | ballon | boot | spray | multi */
  Builder.prototype.q = function (x, y, content) {
    this.set(x, y, ID.BALLBLOCK);
    this.items[x + ',' + y] = content || 'ball';
    return this;
  };

  Builder.prototype.brickItem = function (x, y, content) {
    this.set(x, y, ID.BRICK);
    this.items[x + ',' + y] = content || 'ball';
    return this;
  };

  Builder.prototype.ballRow = function (x, y, n, stepX) {
    stepX = stepX || 1;
    for (var i = 0; i < n; i++) this.balls.push({ x: x + i * stepX, y: y });
    return this;
  };

  Builder.prototype.ballArc = function (x, y, n) {
    for (var i = 0; i < n; i++) {
      this.balls.push({ x: x + i, y: y - Math.round(Math.sin((i + 1) / (n + 1) * Math.PI) * 2.2) });
    }
    return this;
  };

  Builder.prototype.enemy = function (type, x, y, opts) {
    var e = { type: type, x: x, y: y };
    if (opts) for (var k in opts) e[k] = opts[k];
    this.enemies.push(e);
    return this;
  };

  Builder.prototype.mover = function (o) { this.movers.push(o); return this; };

  /** Senyera flags, pennants and a stadium board scattered along the stand.
      Decor is drawn with parallax, so the spacing here is world distance, not
      what the camera sees. */
  Builder.prototype.clubDressing = function (opts) {
    opts = opts || {};
    // Flags fly above the stand roof so they read against the sky; the
    // pennant and the board hang on the stand itself.
    var flagY = opts.flagY === undefined ? 5 : opts.flagY;
    var step = opts.step || 34;
    var x = opts.from === undefined ? 10 : opts.from;
    for (var i = 0; x < this.w; i++, x += step) {
      this.deco('flag', x, flagY);
      if (i % 2 === 1) this.deco('pennant', x + Math.floor(step / 2), flagY + 3);
      if (i % 3 === 2) this.deco('board', x + Math.floor(step / 3), flagY + 5);
    }
    return this;
  };
  Builder.prototype.deco = function (kind, x, y) { this.decor.push({ kind: kind, x: x, y: y }); return this; };

  /* ==================================================================== legs */

  function leg1() {
    var L = new Builder(212, 15);
    var G = 13; // pitch surface row

    L.ground(0, 30, G);
    L.ground(33, 26, G);
    L.ground(61, 35, G);
    L.ground(99, 42, G);
    L.ground(143, 69, G);

    L.spawn = { x: 3, y: G - 2 };

    // warm-up: a lone ball block and a first mushroom
    L.q(9, 9, 'ball');
    L.ballRow(6, 10, 3, 1);
    L.enemy('mush', 15, G - 1);

    // brick run with the Ballon d'Or hidden inside
    L.row(16, 9, 'B?BBB');
    L.items['17,9'] = 'ball';
    L.q(18, 5, 'ballon');
    L.ballRow(16, 8, 5, 1);
    L.enemy('mush', 24, G - 1);

    // first pit, guarded by a tunnel
    L.tunnel(26, G - 1, 2);
    L.ballArc(30, 10, 3);

    L.tunnel(38, G - 1, 3);
    L.enemy('mush', 42, G - 1);
    L.enemy('mush', 46, G - 1);
    L.row(44, 8, 'GGGG');
    L.ballRow(45, 7, 2, 1);
    L.q(51, 9, 'ball');
    L.q(52, 5, 'boot');
    L.row(54, 9, 'BB?B');
    L.items['56,9'] = 'ball';

    L.ballArc(59, 10, 2);

    // stepped stands + a skirmish
    L.hill(63, 6, 2, G);
    L.enemy('mush', 66, G - 3);
    L.hill(72, 4, 4, G);
    L.row(70, 7, 'GGG');
    L.ballRow(70, 6, 3, 1);
    L.enemy('mush', 74, G - 5);
    L.q(79, 9, 'ball');
    L.q(80, 9, 'spray');
    L.q(81, 9, 'ball');
    L.enemy('mush', 84, G - 1);
    L.enemy('mush', 86, G - 1);
    L.row(88, 6, 'BBBB');
    L.row(88, 9, 'B?BB');
    L.items['89,9'] = 'ball';
    L.ballRow(88, 5, 4, 1);

    L.ballArc(96, 10, 3);

    // floating gantries over the second half
    L.row(102, 9, 'GGGG');
    L.row(108, 7, 'GGGG');
    L.row(114, 5, 'GGGG');
    L.ballRow(114, 4, 4, 1);
    L.enemy('mush', 104, 8);
    L.enemy('mush', 116, 4);
    L.enemy('mush', 120, G - 1);
    L.q(122, 9, 'ball');
    L.row(124, 9, 'BB?BB');
    L.items['126,9'] = 'ball';
    L.enemy('mb', 130, G - 2);
    L.tunnel(134, G - 1, 4);
    L.ballRow(136, 7, 4, 1);

    L.ballArc(141, 10, 2);

    // run-in to the goal
    L.enemy('mush', 148, G - 1);
    L.enemy('mush', 150, G - 1);
    L.row(152, 9, 'BBBBBB');
    L.items['154,9'] = 'ball';
    L.items['156,9'] = 'ballon';
    L.ballRow(152, 8, 6, 1);
    L.hill(162, 8, 3, G);
    L.enemy('mb', 166, G - 4);
    L.q(172, 8, 'ball');
    L.q(173, 8, 'ball');
    L.q(174, 8, 'ball');
    L.enemy('mush', 178, G - 1);
    L.enemy('mush', 180, G - 1);
    L.mover({ x: 184, y: 9, w: 3, axis: 'y', range: 3, speed: 24 });
    L.ballRow(188, 6, 5, 1);
    L.enemy('mush', 192, G - 1);
    L.stairs(194, G - 1, 5, 1);
    L.goal = { x: 204, y: G };

    // scenery
    L.deco('cloud', 12, 2); L.deco('cloud', 40, 3); L.deco('cloud', 78, 2);
    L.deco('cloud', 120, 3); L.deco('cloud', 160, 2); L.deco('cloud', 196, 3);
    L.deco('light', 20, G); L.deco('light', 70, G); L.deco('light', 130, G); L.deco('light', 186, G);
    L.clubDressing({ from: 12, step: 30, flagY: 5 });

    return {
      key: 'leg1',
      name: 'LEG 1',
      title: 'CAMP 8-BIT',
      music: 'y4song',
      time: 320,
      crowd: 'crowd-home',
      sky: [[0, '#2a7fd4'], [0.5, '#5c9ff0'], [1, '#9ccffb']],
      L: L
    };
  }

  function leg2() {
    var L = new Builder(236, 15);
    var G = 13;

    L.ground(0, 26, G);
    L.ground(30, 18, G);
    L.ground(52, 30, G);
    L.ground(86, 22, G);
    L.ground(112, 40, G);
    L.ground(156, 26, G);
    L.ground(186, 50, G);

    L.spawn = { x: 3, y: G - 2 };

    L.q(7, 9, 'ballon');
    L.enemy('mush', 12, G - 1);
    L.enemy('mb', 18, G - 2);
    L.row(14, 8, 'GGG');
    L.ballRow(14, 7, 3, 1);
    L.row(20, 9, 'MM');
    L.row(22, 6, 'BB?B');
    L.items['24,6'] = 'ball';

    L.ballArc(26, 10, 4);

    // spike alley
    L.row(33, G, '^^^');
    L.row(30, 9, 'GGGGG');
    L.ballRow(31, 8, 4, 1);
    L.enemy('mush', 40, G - 1);
    L.enemy('mush', 44, G - 1);
    L.q(42, 9, 'ball');
    L.q(43, 9, 'boot');

    L.ballArc(48, 10, 4);

    L.mover({ x: 54, y: 8, w: 3, axis: 'x', range: 6, speed: 34 });
    L.enemy('mb', 62, G - 2);
    L.hill(66, 6, 3, G);
    L.row(64, 6, 'GGGG');
    L.ballRow(64, 5, 4, 1);
    L.enemy('mush', 69, G - 4);
    L.row(74, 9, 'BBBB');
    L.items['75,9'] = 'ball';
    L.items['76,9'] = 'spray';
    L.enemy('mush', 78, G - 1);
    L.row(79, G, '^^');

    L.ballArc(82, 10, 4);

    L.tunnel(88, G - 1, 3);
    L.enemy('mb', 94, G - 2);
    L.row(92, 5, 'GGGGGG');
    L.ballRow(92, 4, 6, 1);
    L.q(100, 9, 'ball');
    L.row(102, 9, 'B?B');
    L.items['103,9'] = 'ball';
    L.enemy('mush', 104, G - 1);

    L.ballArc(108, 10, 4);

    // stacked stands, mushroom cluster
    L.hill(112, 4, 2, G);
    L.hill(116, 4, 4, G);
    L.hill(120, 4, 6, G);
    L.enemy('mush', 118, G - 5);
    L.enemy('mush', 122, G - 7);
    L.ballRow(116, 5, 8, 1);
    L.row(126, 4, 'GGGG');
    L.enemy('mb', 132, G - 2);
    L.row(130, 8, 'MM');
    L.row(134, 9, 'BBB?BBB');
    L.items['137,9'] = 'ballon';
    L.mover({ x: 142, y: 7, w: 3, axis: 'y', range: 4, speed: 28 });
    L.enemy('mush', 146, G - 1);
    L.row(148, G, '^^');

    L.ballArc(152, 10, 4);

    L.mover({ x: 158, y: 9, w: 3, axis: 'x', range: 8, speed: 40 });
    L.enemy('mb', 168, G - 2);
    L.row(164, 6, 'GGGGG');
    L.ballRow(164, 5, 5, 1);
    L.q(172, 9, 'ball');
    L.q(173, 9, 'boot');
    L.q(174, 9, 'ball');
    L.enemy('mush', 176, G - 1);
    L.enemy('mush', 178, G - 1);

    L.ballArc(182, 10, 4);

    L.enemy('mb', 192, G - 2);
    L.row(188, 9, 'BBBBBB');
    L.ballRow(188, 8, 6, 1);
    L.row(196, G, '^^^');
    L.row(194, 9, 'GGGGGGG');
    L.enemy('mush', 204, G - 1);
    L.enemy('mush', 206, G - 1);
    L.enemy('mb', 210, G - 2);
    L.row(212, 7, 'GGGG');
    L.ballRow(212, 6, 4, 1);
    L.stairs(218, G - 1, 6, 1);
    L.goal = { x: 228, y: G };

    L.deco('light', 10, G); L.deco('light', 56, G); L.deco('light', 104, G);
    L.deco('light', 150, G); L.deco('light', 200, G);
    L.clubDressing({ from: 18, step: 36, flagY: 5 });

    return {
      key: 'leg2',
      name: 'LEG 2',
      title: 'THE WHITE NIGHT',
      music: 'leg2',
      time: 340,
      crowd: 'crowd-away',
      sky: [[0, '#070a1c'], [0.5, '#141a3c'], [1, '#2b2350']],
      L: L
    };
  }

  function leg3() {
    var L = new Builder(206, 15);
    var G = 13;
    var S = FC8.tiles.ID.STONE, ST = FC8.tiles.ID.STONE_TOP;

    // catacombs: solid ceiling, stone floor
    L.ground(0, 206, G, ST, S);
    L.rect(0, 0, 206, 2, S);

    L.spawn = { x: 3, y: G - 2 };

    function pit(x, w) { L.rect(x, G, w, 2, 0); }

    L.row(0, 2, 'dddddddd');
    L.q(8, 9, 'ballon');
    L.enemy('mush', 14, G - 1);
    L.row(12, 8, 'DDDD');
    L.ballRow(12, 7, 4, 1);
    L.row(18, 5, 'ddddd');
    L.enemy('mush', 20, 4);
    pit(24, 3);
    L.ballArc(24, 10, 3);
    L.row(22, 9, 'DD');
    L.enemy('mb', 30, G - 2);
    L.row(32, G, '^^');
    L.row(30, 9, 'GGGGG');
    L.ballRow(31, 8, 3, 1);
    L.q(38, 9, 'boot');
    L.row(40, 6, 'dddddd');
    L.enemy('mush', 43, 5);
    pit(46, 4);
    L.mover({ x: 46, y: 10, w: 3, axis: 'x', range: 5, speed: 38 });
    L.ballRow(46, 8, 4, 1);
    L.enemy('mush', 54, G - 1);
    L.enemy('mush', 56, G - 1);
    L.row(52, 8, 'BBB?BBB');
    L.items['55,8'] = 'ball';
    L.row(60, 4, 'dddd');
    L.ballRow(60, 3, 4, 1);
    L.enemy('mb', 64, G - 2);
    pit(68, 4);
    L.row(66, 9, 'GG');
    L.row(72, 9, 'GG');
    L.ballArc(68, 11, 4);
    L.row(76, G, '^^^');
    L.row(74, 8, 'DDDDDDD');
    L.enemy('mush', 78, 7);
    L.q(84, 9, 'spray');
    L.row(86, 5, 'ddddddd');
    L.ballRow(86, 4, 7, 1);
    L.enemy('mush', 90, 4);
    L.enemy('mb', 96, G - 2);
    pit(100, 4);
    L.mover({ x: 100, y: 9, w: 3, axis: 'y', range: 3, speed: 30 });
    L.row(106, 8, 'BB?BB');
    L.items['108,8'] = 'ball';
    L.enemy('mush', 110, G - 1);
    L.row(112, 4, 'dddd');
    L.row(116, 9, 'DDDD');
    L.ballRow(116, 8, 4, 1);
    L.enemy('mush', 120, 8);
    pit(124, 3);
    L.ballArc(124, 10, 3);
    L.row(128, G, '^^^^');
    L.row(126, 9, 'GGGGGGGG');
    L.enemy('mb', 136, G - 2);
    L.q(138, 9, 'ball');
    L.q(139, 9, 'boot');
    L.row(142, 6, 'dddddd');
    L.enemy('mush', 145, 5);
    L.ballRow(142, 5, 6, 1);
    pit(150, 4);
    L.mover({ x: 150, y: 10, w: 3, axis: 'x', range: 5, speed: 42 });
    L.enemy('mush', 158, G - 1);
    L.enemy('mush', 160, G - 1);
    L.enemy('mb', 164, G - 2);
    L.row(156, 8, 'BBBBBBB');
    L.ballRow(156, 7, 7, 1);
    L.row(168, 4, 'dddddd');
    L.enemy('mush', 172, 3);
    pit(176, 4);
    L.ballArc(176, 11, 4);
    L.row(174, 9, 'GG');
    L.row(180, 9, 'GG');
    L.enemy('mb', 186, G - 2);
    L.row(184, 8, 'BB?BB');
    L.items['186,8'] = 'ballon';
    L.stairs(190, G - 1, 6, 1);
    L.goal = { x: 199, y: G };

    return {
      key: 'leg3',
      name: 'LEG 3',
      title: 'THE CATACOMBS',
      music: 'leg2',
      time: 320,
      crowd: null,
      sky: [[0, '#06030f'], [1, '#1a1030']],
      L: L
    };
  }

  /* ------------------------------------------------- FINAL: THE HOLY TOWER */
  /* The climb is generated so every hop is at most 3 rows up and a short
     stride across - well inside Y4M4L10's jump arc. */
  function final() {
    var H = 72, W = 44;
    var L = new Builder(W, H);
    var S = ID.STONE, ST = ID.STONE_TOP;
    var AY = 11;                         // summit arena floor row
    var ARENA_X = 10;                    // arena starts here; x 2..9 is the climb channel

    L.rect(0, 0, 2, H, S);
    L.rect(W - 2, 0, 2, H, S);
    L.ground(2, W - 4, H - 2, ST, S);
    L.spawn = { x: 5, y: H - 4 };

    // --- the climb: a zig-zag of ledges, one every three rows
    var pattern = [4, 12, 20, 27, 33, 27, 20, 12];
    var ledges = [];
    var row = H - 5, i = 0;
    while (row >= 22) { ledges.push([pattern[i % pattern.length], row, 6]); row -= 3; i++; }
    // Final approach up the channel beside the arena. These MUST alternate
    // sides: stacking them vertically leaves only two tiles of headroom, and
    // a ledge you cannot jump off is a dead end, not a hard jump.
    ledges.push([6, 19, 4]);             // channel, right half
    ledges.push([2, 16, 4]);             // channel, left half
    ledges.push([6, 13, 4]);             // level with the arena's left edge

    ledges.forEach(function (p, n) {
      L.row(p[0], p[1], new Array(p[2] + 1).join(n % 3 === 2 ? 'G' : 'd'));
      if (n % 2 === 0) L.ballRow(p[0] + 1, p[1] - 1, Math.min(3, p[2] - 1), 1);
      if (n % 3 === 1 && n > 2) L.enemy('mush', p[0] + Math.floor(p[2] / 2), p[1] - 1);
      if (n % 7 === 4) L.enemy('mb', p[0] + 1, p[1] - 1);
    });

    // hazards, helpers and side routes
    L.row(12, H - 2, '^^^');
    L.row(24, H - 2, '^^');
    L.q(9, H - 8, 'ballon');
    L.q(30, 54, 'spray');
    L.q(7, 44, 'boot');
    L.q(28, 34, 'ballon');
    L.q(16, 26, 'boot');
    L.q(30, 20, 'spray');
    L.mover({ x: 16, y: 61, w: 3, axis: 'x', range: 5, speed: 34 });
    L.mover({ x: 8, y: 47, w: 3, axis: 'y', range: 3, speed: 30 });
    L.mover({ x: 26, y: 37, w: 3, axis: 'x', range: 5, speed: 40 });
    L.mover({ x: 30, y: 24, w: 3, axis: 'y', range: 3, speed: 34 });
    L.enemy('mush', 30, H - 3);
    L.enemy('mb', 14, H - 3);

    // --- the summit arena (open sky above, so nothing blocks the last hop)
    L.row(ARENA_X, AY, new Array(W - ARENA_X - 1).join('d'));
    L.rect(ARENA_X, AY + 1, W - ARENA_X - 2, 2, S);

    L.boss = { x: 22, y: AY - 1 };

    // gate that only opens when THE SPECIAL ONE is beaten
    L.gate = { x: 30, y1: AY - 8, y2: AY - 1 };
    for (var gy = AY - 8; gy <= AY - 1; gy++) L.set(30, gy, ID.METAL);

    // podium with the trophy and the coach
    L.row(33, AY - 1, 'MMMMMM');
    L.row(34, AY - 2, 'MMMM');
    L.podium = { trophyX: 38.5, trophyY: AY - 2, flickX: 34.5, flickY: AY - 2 };

    L.ballRow(24, AY - 2, 5, 1);
    // breadcrumbs up the final channel
    L.ballRow(7, 18, 2, 1); L.ballRow(3, 15, 2, 1); L.ballRow(7, 12, 2, 1);
    L.deco('light', 4, 22);
    L.deco('light', 10, AY); L.deco('light', 20, AY); L.deco('light', 28, AY);
    // the summit is dressed for a final
    L.deco('flag', 32, AY - 3); L.deco('flag', 41, AY - 3);
    L.deco('pennant', 8, AY - 6); L.deco('pennant', 24, AY - 6);
    for (var py = 20; py < H - 6; py += 14) L.deco('pennant', (py % 28 < 14) ? 6 : 36, py);

    return {
      key: 'final',
      name: 'FINAL',
      title: 'THE HOLY TOWER',
      music: 'boss',
      time: 480,
      crowd: null,
      vertical: true,
      sky: [[0, '#1a0b33'], [0.45, '#2b1150'], [1, '#07040f']],
      stars: true,
      L: L
    };
  }

  var cache = null;
  function all() {
    if (!cache) cache = [leg1(), leg2(), leg3(), final()];
    return cache;
  }
  function rebuild() { cache = null; return all(); }

  return { all: all, rebuild: rebuild, CHAR: CHAR, Builder: Builder };
})();
