/* FC8Bit Super Y4M4L - title, victory and game-over scenes. */
window.FC8 = window.FC8 || {};

FC8.W = 416;
FC8.H = 240;

/** Shared helper: pixel text with a hard 8-bit drop shadow. */
FC8.label = function (scene, x, y, text, opts) {
  opts = opts || {};
  var s = opts.scale || 1;
  var g = scene.add.container(x, y);
  if (opts.shadow !== false) {
    var sh = scene.add.bitmapText(1 * s, 1 * s, 'pxfont', text).setScale(s).setTint(opts.shadowColor || 0x100a18);
    g.add(sh);
  }
  var t = scene.add.bitmapText(0, 0, 'pxfont', text).setScale(s);
  if (opts.color !== undefined) t.setTint(opts.color);
  g.add(t);
  g.text = t;
  g.setText = function (v) { t.setText(v); if (g.list[0] !== t) g.list[0].setText(v); return g; };
  // NOTE: bitmapText.width already accounts for the scale.
  if (opts.origin === 'center') {
    g.x = Math.round(x - t.width / 2);
  } else if (opts.origin === 'right') {
    g.x = Math.round(x - t.width);
  }
  g.widthPx = t.width;
  return g;
};


/** After a run: ask for a name, post the score, report the rank.
    Silently does nothing if the scoreboard API is unreachable. */
FC8.submitRun = function (scene, opts) {
  if (!FC8.scores) return;
  var label = FC8.label(scene, FC8.W / 2, opts.y, 'SAVING TO THE BOARD...', { color: 0x8e99a6, origin: 'center' });
  label.setDepth(60).setAlpha(0);

  FC8.scores.askName(FC8.scores.lastName()).then(function (name) {
    if (!name) { label.destroy(); return; }
    FC8.scores.remember(name);
    label.setAlpha(1);
    return FC8.scores.submit({
      name: name, score: opts.score, balls: opts.balls, level: opts.level
    }).then(function (res) {
      if (!scene.scene.isActive()) return;
      label.destroy();
      // use the name the server normalised: the pixel font is uppercase-only,
      // so echoing the raw input would render as blanks
      var shown = (res.name || name).toUpperCase();
      var text = res.ok ? (shown + ' IS #' + res.rank + ' ON THE BOARD')
                        : 'BOARD OFFLINE - SCORE KEPT LOCALLY';
      FC8.label(scene, FC8.W / 2, opts.y, text,
                { color: res.ok ? 0x7ef08a : 0x8e99a6, origin: 'center' }).setDepth(60);
    });
  });
};

/* ============================================================== TITLE ===== */
FC8.TitleScene = class extends Phaser.Scene {
  constructor() { super('title'); }

  create() {
    var W = FC8.W, H = FC8.H;

    this.add.image(0, 0, 'sky-leg1').setOrigin(0, 0).setDisplaySize(W, H);
    this.add.tileSprite(0, 86, W, 50, 'crowd-home').setOrigin(0, 0).setAlpha(0.8).setTint(0x8a90b8);
    this.add.rectangle(0, 136, W, 4, 0x39424c).setOrigin(0, 0);
    // dark panel so the logo reads over the stand
    this.add.rectangle(0, 0, W, 86, 0x07040f, 0.55).setOrigin(0, 0);

    // pitch
    this.add.rectangle(0, 140, W, H - 140, 0x2c8b3c).setOrigin(0, 0);
    this.add.rectangle(0, 140, W, 3, 0x3cae4b).setOrigin(0, 0);
    for (var i = 0; i < W; i += 52) {
      this.add.rectangle(i, 143, 26, H - 143, 0x000000, 0.06).setOrigin(0, 0);
    }
    this.add.rectangle(0, 172, W, 2, 0xffffff, 0.35).setOrigin(0, 0);

    if (this.textures.exists('fcb-flag-0')) {
      [70, 348].forEach(function (fx) {
        this.add.sprite(fx, 96, 'fcb-flag-0').setOrigin(0.5, 1).play('fcb-flag-wave');
      }, this);
    }
    if (this.textures.exists('pennant')) {
      this.add.image(196, 92, 'pennant').setOrigin(0.5, 0).setAlpha(0.95);
    }
    this.add.image(40, 26, 'cloud').setScale(1.5).setAlpha(0.9);
    this.add.image(330, 20, 'cloud').setScale(1.2).setAlpha(0.8);
    this.add.image(28, 140, 'light').setOrigin(0.5, 1).setScale(1.6);
    this.add.image(388, 140, 'light').setOrigin(0.5, 1).setScale(1.6);

    /* ---- logo: blaugrana FC8BIT over a gold SUPER Y4M4L, as in the navbar */
    var logoY = 22;
    var fc = FC8.label(this, 0, logoY, 'FC8', { scale: 2, color: 0x1673d2 });
    var bit = FC8.label(this, 0, logoY, 'BIT', { scale: 2, color: 0xa50044 });
    var lw = fc.widthPx + bit.widthPx;
    fc.x = Math.round(W / 2 - lw / 2 + 12);
    bit.x = Math.round(fc.x + fc.widthPx);

    var big = FC8.label(this, W / 2 + 12, 40, 'SUPER Y4M4L', { scale: 3, color: 0xedbb00, origin: 'center' });
    this.tweens.add({ targets: big, y: 43, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    // Y4M4L10 looking out from the left of the title
    var portrait = this.add.image(W / 2 - 140, 26, 'y4-face')
      .setOrigin(0, 0).setScale(2);
    this.tweens.add({ targets: portrait, y: 27, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    FC8.label(this, W / 2, 78, 'THE ROAD TO THE BIG EARS', { scale: 1, color: 0xffffff, origin: 'center' });

    /* ---- cast on the pitch */
    var trophy = this.add.image(346, 196, 'trophy').setOrigin(0.5, 1).setScale(1);
    this.tweens.add({ targets: trophy, y: 192, duration: 1300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    var flick = this.add.sprite(318, 196, 'flick-a').setOrigin(0.5, 1);
    flick.play('flick-clap');

    var hero = this.add.sprite(70, 196, 'y4s-idle').setOrigin(0.5, 1).setScale(FC8.usingSheet ? 1 : 1.6);
    hero.play('y4s-run');
    this.tweens.add({
      targets: hero, x: 250, duration: 4200, repeat: -1, ease: 'Linear',
      onRepeat: function () { hero.x = 60; }
    });

    var mush = this.add.sprite(210, 196, 'mush-a').setOrigin(0.5, 1);
    mush.play('mush-walk');
    this.tweens.add({ targets: mush, x: 150, duration: 3000, yoyo: true, repeat: -1 });

    var boss = this.add.sprite(262, 196, 'boss-idle').setOrigin(0.5, 1);
    this.tweens.add({ targets: boss, y: 194, duration: 700, yoyo: true, repeat: -1 });

    var ball = this.add.sprite(96, 168, 'ball-0');
    ball.play('ball-spin');
    this.tweens.add({ targets: ball, y: 156, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.easeOut' });

    /* ---- prompt + info */
    var prompt = FC8.label(this, W / 2, 152, 'PRESS ENTER OR TAP TO KICK OFF', { scale: 1, color: 0xffffff, origin: 'center' });
    this.tweens.add({ targets: prompt, alpha: 0.15, duration: 480, yoyo: true, repeat: -1 });

    var hi = parseInt(window.localStorage.getItem('fc8-hiscore') || '0', 10);

    /* live board, if the scoreboard API is up */
    if (FC8.scores) {
      FC8.scores.top(5).then(function (rows) {
        if (!this.scene.isActive() || !rows.length) return;
        // panel so the board stays readable over the stand and the floodlight
        this.add.rectangle(W - 4, 88, 150, 18 + rows.length * 10, 0x07040f, 0.72)
          .setOrigin(1, 0).setDepth(29);
        FC8.label(this, W - 10, 92, 'TOP OF THE LEAGUE', { color: 0xedbb00, origin: 'right' }).setDepth(30);
        rows.forEach(function (r, i) {
          var nm = String(r.name).slice(0, 9);
          FC8.label(this, W - 10, 104 + i * 10,
            (i + 1) + '. ' + nm + ' ' + String(r.score).padStart(6, '0'),
            { color: i === 0 ? 0xffffff : 0xc3ccd6, origin: 'right' }).setDepth(30);
        }, this);
      }.bind(this));
    }

    FC8.label(this, 8, 206, 'MOVE:ARROWS/WASD  JUMP:SPACE  SPRINT:SHIFT', { scale: 1, color: 0xc3ccd6 });
    FC8.label(this, 8, 216, 'SHOOT:X  PAUSE:P  MUTE:M', { scale: 1, color: 0xc3ccd6 });
    FC8.label(this, W - 8, 206, 'TOP ' + String(hi).padStart(6, '0'), { scale: 1, color: 0xedbb00, origin: 'right' });
    FC8.label(this, W / 2, 228, 'A PARODY - NO CLUBS WERE HARMED', { scale: 1, color: 0x8e99a6, origin: 'center' });

    /* ---- input */
    var go = () => {
      FC8.audio.unlock();
      FC8.audio.play('start');
      this.registry.set('score', 0);
      this.registry.set('lives', 3);
      this.registry.set('balls', 0);
      this.registry.set('level', 0);
      this.cameras.main.fade(420, 0, 0, 0);
      this.time.delayedCall(440, () => this.scene.start('game', { level: 0 }));
    };
    this.input.keyboard.once('keydown-ENTER', go);
    this.input.keyboard.once('keydown-SPACE', go);
    this.input.once('pointerdown', go);
    this.events.once('shutdown', FC8.touch.onceConfirm(go));
    this.input.keyboard.on('keydown-M', function () { FC8.audio.toggleMute(); });

    this.time.delayedCall(260, function () { FC8.audio.playMusic('y4song'); });
  }
};

/* ============================================================ VICTORY ===== */
FC8.VictoryScene = class extends Phaser.Scene {
  constructor() { super('victory'); }

  create() {
    var W = FC8.W, H = FC8.H;
    this.add.image(0, 0, 'sky-final').setOrigin(0, 0).setDisplaySize(W, H);
    this.add.tileSprite(0, 96, W, 54, 'crowd-home').setOrigin(0, 0).setAlpha(0.55).setTint(0x7d85b4);
    this.add.rectangle(0, 150, W, 4, 0x39424c).setOrigin(0, 0);

    // pitch
    this.add.rectangle(0, 154, W, H - 154, 0x2c8b3c).setOrigin(0, 0);
    this.add.rectangle(0, 154, W, 3, 0x3cae4b).setOrigin(0, 0);
    this.add.rectangle(0, 182, W, 2, 0xffffff, 0.3).setOrigin(0, 0);

    // podium
    this.add.rectangle(W / 2 - 52, 198, 104, 14, 0x4b5563).setOrigin(0, 0);
    this.add.rectangle(W / 2 - 52, 198, 104, 2, 0xc3ccd6).setOrigin(0, 0);
    this.add.rectangle(W / 2 - 22, 190, 44, 8, 0x6d7885).setOrigin(0, 0);
    this.add.rectangle(W / 2 - 22, 190, 44, 2, 0xc3ccd6).setOrigin(0, 0);

    // the lift
    var hero = this.add.sprite(W / 2, 190, 'y4g-jump').setOrigin(0.5, 1).setScale(FC8.usingSheet ? 1.1 : 1.4);
    this.tweens.add({ targets: hero, y: 185, duration: 420, yoyo: true, repeat: -1, ease: 'Sine.easeOut' });
    var trophy = this.add.image(W / 2, 156, 'trophy').setOrigin(0.5, 1).setScale(1.2);
    this.tweens.add({ targets: trophy, y: 150, duration: 420, yoyo: true, repeat: -1, ease: 'Sine.easeOut' });
    this.add.particles(W / 2, 130, 'spark', {
      speed: { min: 8, max: 34 }, lifespan: 1100, frequency: 120,
      scale: { start: 1.4, end: 0 }, alpha: { start: 1, end: 0 }, quantity: 1
    });

    if (this.textures.exists('fcb-flag-0')) {
      [W / 2 - 120, W / 2 + 120].forEach(function (fx) {
        this.add.sprite(fx, 196, 'fcb-flag-0').setOrigin(0.5, 1).play('fcb-flag-wave');
      }, this);
    }
    var flick = this.add.sprite(W / 2 - 64, 198, 'flick-b').setOrigin(0.5, 1);
    flick.play('flick-clap');
    FC8.label(this, W / 2 - 64, 202, 'H4NSI', { scale: 1, color: 0xedbb00, origin: 'center' });

    var mate = this.add.sprite(W / 2 + 64, 198, 'y4s-idle').setOrigin(0.5, 1)
      .setScale(FC8.usingSheet ? 0.85 : 1);
    mate.play('y4s-run');
    FC8.label(this, W / 2 + 64, 202, 'THE LADS', { scale: 1, color: 0xffffff, origin: 'center' });

    // confetti
    ['conf-b', 'conf-r', 'conf-g', 'conf-w'].forEach(function (k, i) {
      this.add.particles(0, -10, k, {
        x: { min: 0, max: W },
        lifespan: 4200,
        speedY: { min: 30, max: 80 },
        speedX: { min: -24, max: 24 },
        rotate: { start: 0, end: 360 },
        frequency: 90 + i * 30,
        quantity: 1,
        scale: { min: 0.8, max: 1.4 }
      }).setDepth(30);
    }, this);

    // headline + tally on a dark panel so they stay readable
    this.add.rectangle(0, 0, W, 96, 0x07040f, 0.72).setOrigin(0, 0).setDepth(20);
    var score = this.registry.get('score') || 0;
    var balls = this.registry.get('balls') || 0;
    var bonus = balls * 50 + 10000;
    var total = score + bonus;
    var ui = [
      FC8.label(this, W / 2, 8, 'CHAMPIONS OF EUROPE', { scale: 2, color: 0xedbb00, origin: 'center' }),
      FC8.label(this, W / 2, 30, 'Y4M4L10 LIFTS THE BIG EARS', { scale: 1, color: 0xffffff, origin: 'center' }),
      FC8.label(this, W / 2, 42, 'THE SPECIAL ONE HAS LEFT THE STADIUM', { scale: 1, color: 0xd4246a, origin: 'center' }),
      FC8.label(this, W / 2, 58, 'SCORE ' + String(score).padStart(6, '0') + '   BALLS ' + balls + '   BONUS ' + bonus, { scale: 1, color: 0xc3ccd6, origin: 'center' }),
      FC8.label(this, W / 2, 72, 'FINAL ' + String(total).padStart(6, '0'), { scale: 2, color: 0xffffff, origin: 'center' })
    ];
    ui.forEach(function (o) { o.setDepth(21); });

    var hi = parseInt(window.localStorage.getItem('fc8-hiscore') || '0', 10);
    if (total > hi) { window.localStorage.setItem('fc8-hiscore', String(total)); }

    var prompt = FC8.label(this, W / 2, 224, 'PRESS ENTER FOR ANOTHER SEASON', { scale: 1, color: 0xffffff, origin: 'center' }).setDepth(21);
    this.tweens.add({ targets: prompt, alpha: 0.2, duration: 520, yoyo: true, repeat: -1 });

    FC8.audio.playMusic('anthem');
    FC8.audio.play('crowd');

    this.time.delayedCall(1400, function () {
      FC8.submitRun(this, { y: 88, score: total, balls: balls, level: 4 });
    }, [], this);

    var back = () => { this.scene.start('title'); };
    this.time.delayedCall(1200, () => {
      this.input.keyboard.once('keydown-ENTER', back);
      this.input.once('pointerdown', back);
      this.events.once('shutdown', FC8.touch.onceConfirm(back));
    });
  }
};

/* ========================================================== GAME OVER ===== */
FC8.GameOverScene = class extends Phaser.Scene {
  constructor() { super('gameover'); }

  create() {
    var W = FC8.W, H = FC8.H;
    this.add.rectangle(0, 0, W, H, 0x07040f).setOrigin(0, 0);
    this.add.tileSprite(0, 20, W, 62, 'crowd-away').setOrigin(0, 0).setAlpha(0.3).setTint(0x5a5f7d);

    FC8.label(this, W / 2, 70, 'FULL TIME', { scale: 3, color: 0xa50044, origin: 'center' });
    FC8.label(this, W / 2, 104, 'THE SPECIAL ONE IS SMILING', { scale: 1, color: 0xffffff, origin: 'center' });

    var score = this.registry.get('score') || 0;
    FC8.label(this, W / 2, 128, 'SCORE ' + String(score).padStart(6, '0'), { scale: 1, color: 0xedbb00, origin: 'center' });
    var hi = parseInt(window.localStorage.getItem('fc8-hiscore') || '0', 10);
    if (score > hi) { window.localStorage.setItem('fc8-hiscore', String(score)); hi = score; }
    FC8.label(this, W / 2, 142, 'TOP ' + String(hi).padStart(6, '0'), { scale: 1, color: 0xc3ccd6, origin: 'center' });

    var boss = this.add.sprite(W / 2, 200, 'boss-idle').setOrigin(0.5, 1).setScale(1.6);
    this.tweens.add({ targets: boss, y: 196, duration: 800, yoyo: true, repeat: -1 });

    var prompt = FC8.label(this, W / 2, 218, 'PRESS ENTER TO TRY AGAIN', { scale: 1, color: 0xffffff, origin: 'center' });
    this.tweens.add({ targets: prompt, alpha: 0.2, duration: 500, yoyo: true, repeat: -1 });

    FC8.audio.stopMusic();

    this.time.delayedCall(900, function () {
      FC8.submitRun(this, {
        y: 158, score: score,
        balls: this.registry.get('balls') || 0,
        level: (this.registry.get('level') || 0) + 1
      });
    }, [], this);

    var back = () => { this.scene.start('title'); };
    this.time.delayedCall(900, () => {
      this.input.keyboard.once('keydown-ENTER', back);
      this.input.once('pointerdown', back);
      this.events.once('shutdown', FC8.touch.onceConfirm(back));
    });
  }
};
