/* FC8Bit Super Y4M4L - the playfield. */
window.FC8 = window.FC8 || {};

FC8.GameScene = class extends Phaser.Scene {
  constructor() { super('game'); }

  /* ====================================================== create ========== */
  create(data) {
    var ID = FC8.tiles.ID;
    var W = FC8.W, H = FC8.H;

    this.levelIndex = (data && data.level) || 0;
    FC8.levels.rebuild();                       // fresh tiles + block contents
    var def = FC8.levels.all()[this.levelIndex];
    this.def = def;
    var L = def.L;
    this.L = L;

    this.levelWidth = L.w * 16;
    this.levelHeight = L.h * 16;
    this.deathY = this.levelHeight + 48;
    // Phaser reuses the scene instance on every restart, so wipe all
    // per-level state before rebuilding - stale references bite hard.
    this.completed = false;
    this.paused = false;
    this.dying = false;
    this.introTime = 1250;
    this.comboCount = 0;
    this.timeLeft = def.time;
    this.timeAcc = 0;
    this.bossDefeated = false;
    this.boss = null;
    this.bossActive = false;
    this.bossFloorY = 0;
    this.goal = null;
    this.trophy = null;
    this.trophyGlow = null;
    this.flick = null;
    this.tauntLabel = null;
    this.boards = null;
    this.bgBanner = null;
    this.bgFar = null;
    this.bgNear = null;

    this.buildBackdrop(def);

    /* ----------------------------------------------------------- tilemap */
    var map = this.make.tilemap({ data: L.tiles, tileWidth: 16, tileHeight: 16 });
    var tileset = map.addTilesetImage('tiles', 'tiles', 16, 16, 0, 0);
    var layer = map.createLayer(0, tileset, 0, 0);
    layer.setDepth(6);
    layer.setCollisionByExclusion(FC8.tiles.NO_COLLIDE);
    layer.setTileIndexCallback(ID.SPIKES, this.onSpikes, this);
    this.map = map;
    this.layer = layer;

    this.physics.world.setBounds(0, -64, this.levelWidth, this.levelHeight + 200);

    /* ------------------------------------------------------------ groups */
    this.balls = this.physics.add.group({ allowGravity: false, immovable: true });
    this.enemies = this.physics.add.group({ runChildUpdate: true });
    this.items = this.physics.add.group({ runChildUpdate: true });
    this.shots = this.physics.add.group({ runChildUpdate: true });
    this.bottles = this.physics.add.group({ runChildUpdate: true });
    this.buses = this.physics.add.group({ runChildUpdate: true });
    this.movers = this.physics.add.group({ allowGravity: false, immovable: true });

    this.spawnDecor(L);
    this.spawnBalls(L);
    this.spawnMovers(L);
    this.spawnEnemies(L);

    /* ------------------------------------------------------------ player */
    this.player = new FC8.Player(this, L.spawn.x * 16 + 8, L.spawn.y * 16 + 16);
    var carried = this.registry.get('power');
    if (carried && carried !== 'small') this.player.setPower(carried);

    /* -------------------------------------------------------- goal/final */
    if (L.goal) {
      this.goal = this.physics.add.staticImage(L.goal.x * 16, L.goal.y * 16, 'goal')
        .setOrigin(0, 1).setDepth(5);
      this.goal.body.setSize(14, 44, false);
      this.goal.body.setOffset(4, this.goal.height - 44);
      this.goal.refreshBody && this.goal.body.updateFromGameObject && this.goal.body.updateFromGameObject();
    }
    if (L.boss) this.setupFinal(L);

    /* --------------------------------------------------------- colliders */
    this.physics.add.collider(this.player, layer);
    this.physics.add.collider(this.enemies, layer);
    this.physics.add.collider(this.items, layer);
    this.physics.add.collider(this.bottles, layer);
    this.physics.add.collider(this.shots, layer, this.onShotTile, null, this);
    this.physics.add.collider(this.player, this.movers);
    this.physics.add.collider(this.enemies, this.movers);
    this.physics.add.collider(this.items, this.movers);
    this.physics.add.collider(this.player, this.buses, this.onBus, null, this);

    this.physics.add.overlap(this.player, this.balls, this.onBall, null, this);
    this.physics.add.overlap(this.player, this.items, this.onItem, null, this);
    this.physics.add.overlap(this.player, this.enemies, this.onEnemy, null, this);
    this.physics.add.overlap(this.shots, this.enemies, this.onShotEnemy, null, this);
    this.physics.add.overlap(this.player, this.bottles, this.onBottle, null, this);
    if (this.goal) this.physics.add.overlap(this.player, this.goal, this.onGoal, null, this);

    /* ------------------------------------------------------------- camera */
    var cam = this.cameras.main;
    cam.setBounds(0, 0, this.levelWidth, Math.max(this.levelHeight, H));
    if (def.vertical) {
      cam.startFollow(this.player, true, 0.12, 0.14, 0, 46);
    } else {
      cam.startFollow(this.player, true, 0.14, 1, -40, 0);
    }
    cam.setDeadzone(40, 200);

    this.setupInput();
    this.buildHud();
    this.updateHud();          // pips/score/time must reflect state on entry
    this.buildIntroCard(def);

    this.time.delayedCall(1250, function () {
      if (!this.scene.isActive()) return;
      FC8.audio.playMusic(def.music);
    }, [], this);
    FC8.audio.play('whistle');

    this.events.on('shutdown', function () { FC8.audio.stopMusic(); });
  }

  /* ================================================== world construction == */
  buildBackdrop(def) {
    var W = FC8.W, H = FC8.H;
    this.add.image(0, 0, 'sky-' + def.key).setOrigin(0, 0).setDisplaySize(W, H)
      .setScrollFactor(0).setDepth(0);

    if (def.crowd) {
      var night = def.key === 'leg2';
      // The stand: a bright blaugrana bowl that still sits behind the action.
      this.add.rectangle(0, 74, W, 4, night ? 0x0b1020 : 0x2a3350).setOrigin(0, 0)
        .setScrollFactor(0).setDepth(1);
      var far = this.add.tileSprite(0, 78, W, 30, def.crowd).setOrigin(0, 0)
        .setScrollFactor(0).setDepth(1).setAlpha(night ? 0.45 : 0.6)
        .setTint(night ? 0x3f4668 : 0x8f9ac4);
      this.add.rectangle(0, 108, W, 5, night ? 0x090d1c : 0x232c46).setOrigin(0, 0)
        .setScrollFactor(0).setDepth(1);
      var near = this.add.tileSprite(0, 113, W, 58, def.crowd).setOrigin(0, 0)
        .setScrollFactor(0).setDepth(2).setAlpha(night ? 0.6 : 0.82)
        .setTint(night ? 0x5a6188 : 0xc7cde8);
      // club banner across the stand, as in the reference art
      var banner = this.add.tileSprite(0, 150, W, 20, 'banner').setOrigin(0, 0)
        .setScrollFactor(0).setDepth(2).setAlpha(0.9);
      this.add.rectangle(0, 171, W, 4, 0x39424c).setOrigin(0, 0).setScrollFactor(0).setDepth(3);
      this.add.rectangle(0, 175, W, 65, night ? 0x060a16 : 0x14305c, night ? 0.5 : 0.28)
        .setOrigin(0, 0).setScrollFactor(0).setDepth(3);
      this.boards = this.add.tileSprite(0, 198, W, 14, 'boards').setOrigin(0, 0)
        .setScrollFactor(0).setDepth(4).setAlpha(0.92);
      this.bgFar = far;
      this.bgNear = near;
      this.bgBanner = banner;
    }
    if (def.key === 'leg3') {
      // dripping catacomb arches
      for (var i = 0; i < 26; i++) {
        this.add.rectangle(i * 70, 40, 44, 150, 0x181030).setOrigin(0, 0)
          .setScrollFactor(0.35, 1).setDepth(1).setAlpha(0.8);
      }
    }
    if (def.vertical) {
      for (var j = 0; j < 40; j++) {
        this.add.rectangle((j % 5) * 92 + 10, j * 42, 30, 30, 0x2a1150).setOrigin(0, 0)
          .setScrollFactor(0.3, 0.55).setDepth(1).setAlpha(0.55);
      }
    }
  }

  spawnDecor(L) {
    L.decor.forEach(function (d) {
      if (d.kind === 'cloud') {
        var c = this.add.image(d.x * 16, d.y * 16, 'cloud').setDepth(2).setScrollFactor(0.6, 1);
        c.setScale(1 + (d.x % 3) * 0.3).setAlpha(0.92);
        this.tweens.add({ targets: c, x: c.x + 40, duration: 9000 + (d.x % 5) * 2000, yoyo: true, repeat: -1 });

      } else if (d.kind === 'light') {
        this.add.image(d.x * 16, d.y * 16, 'light').setOrigin(0.5, 1).setDepth(4).setScale(1.5);

      } else if (d.kind === 'flag') {
        // Senyera flying over the stand. Parallax keeps it behind the play.
        if (!this.textures.exists('fcb-flag-0')) return;
        var f = this.add.sprite(d.x * 16, d.y * 16, 'fcb-flag-0')
          .setOrigin(0.5, 1).setDepth(3).setScrollFactor(0.45, 1);
        f.play('fcb-flag-wave');
        f.anims.setProgress((d.x % 4) / 4);       // stagger so they do not sync

      } else if (d.kind === 'pennant') {
        if (!this.textures.exists('pennant')) return;
        this.add.image(d.x * 16, d.y * 16, 'pennant')
          .setOrigin(0.5, 0).setDepth(3).setScrollFactor(0.45, 1);

      } else if (d.kind === 'board') {
        if (!this.textures.exists('fcb-board')) return;
        this.add.image(d.x * 16, d.y * 16, 'fcb-board')
          .setOrigin(0.5, 1).setDepth(4).setScrollFactor(0.55, 1);
      }
    }, this);
  }

  spawnBalls(L) {
    L.balls.forEach(function (b) {
      var s = this.balls.create(b.x * 16 + 8, b.y * 16 + 8, 'ball-0');
      s.play('ball-spin');
      s.setDepth(8);
      s.body.setCircle(5, 0, 0);
      this.tweens.add({ targets: s, y: s.y - 2.5, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }, this);
  }

  spawnMovers(L) {
    L.movers.forEach(function (m) {
      var p = this.add.tileSprite(m.x * 16, m.y * 16, m.w * 16, 8, 'tile-girder').setOrigin(0, 0);
      p.setDepth(7);
      this.physics.add.existing(p);
      p.body.setAllowGravity(false);
      p.body.setImmovable(true);
      p.body.setSize(m.w * 16, 8, false);
      p.axis = m.axis;
      p.speed = m.speed;
      p.min = (m.axis === 'x' ? m.x : m.y) * 16;
      p.max = p.min + m.range * 16;
      p.dirn = 1;
      p.px = p.x; p.py = p.y; p.dx = 0; p.dy = 0;
      if (m.axis === 'x') p.body.setVelocityX(m.speed); else p.body.setVelocityY(m.speed);
      this.movers.add(p);
    }, this);
  }

  spawnEnemies(L) {
    L.enemies.forEach(function (e) {
      var x = e.x * 16 + 8, y = e.y * 16 + 16;
      var mob = e.type === 'mb' ? new FC8.Mb(this, x, y) : new FC8.Mush(this, x, y);
      this.enemies.add(mob);
    }, this);
  }

  setupFinal(L) {
    var b = L.boss;
    this.boss = new FC8.Boss(this, b.x * 16 + 8, b.y * 16 + 16);
    this.enemies.add(this.boss);
    this.boss.body.setAllowGravity(true);
    this.bossActive = false;
    this.bossFloorY = (b.y + 1) * 16;

    // the prize, visible from the moment you enter the arena
    var p = L.podium;
    this.flick = this.add.sprite(p.flickX * 16, p.flickY * 16, 'flick-a').setOrigin(0.5, 1).setDepth(9);
    this.flick.play('flick-clap');
    this.trophy = this.physics.add.staticImage(p.trophyX * 16, p.trophyY * 16, 'trophy').setOrigin(0.5, 1).setDepth(9);
    this.tweens.add({ targets: this.trophy, y: this.trophy.y - 3, duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.trophyGlow = this.add.particles(this.trophy.x, this.trophy.y - 20, 'spark', {
      speed: { min: 6, max: 24 }, lifespan: 900, frequency: 260,
      scale: { start: 1, end: 0 }, quantity: 1, alpha: { start: 0.9, end: 0 }
    }).setDepth(8);
    this.physics.add.overlap(this.player, this.trophy, this.onTrophy, null, this);

    FC8.label(this, p.trophyX * 16 - 26, p.trophyY * 16 - 56, 'THE BIG EARS', { scale: 1, color: 0xedbb00 }).setDepth(9);
  }

  /* ============================================================= input === */
  setupInput() {
    var K = Phaser.Input.Keyboard.KeyCodes;
    this.keys = this.input.keyboard.addKeys({
      left: K.LEFT, right: K.RIGHT, up: K.UP, down: K.DOWN,
      a: K.A, d: K.D, w: K.W, s: K.S,
      space: K.SPACE, shift: K.SHIFT, x: K.X, j: K.J,
      p: K.P, esc: K.ESC, m: K.M, enter: K.ENTER
    });
    this.input.addPointer(3);
    this.touch = { left: false, right: false, jump: false, fire: false };
    this.input_ = { left: false, right: false, up: false, down: false, run: false, jump: false, jumpDown: false, jumpPressed: false, firePressed: false };
    this.prevJump = false;
    this.prevFire = false;

    this.input.keyboard.on('keydown-P', this.togglePause, this);
    this.input.keyboard.on('keydown-ESC', this.togglePause, this);
    this.input.keyboard.on('keydown-M', function () {
      var m = FC8.audio.toggleMute();
      this.muteTag.setAlpha(m ? 1 : 0);
    }, this);

    if (this.sys.game.device.input.touch && !this.sys.game.device.os.desktop) this.buildTouchPad();
  }

  buildTouchPad() {
    var W = FC8.W, H = FC8.H;
    var mk = (x, y, w, h, label, prop) => {
      var r = this.add.rectangle(x, y, w, h, 0xffffff, 0.14).setOrigin(0, 0)
        .setScrollFactor(0).setDepth(120).setInteractive({ useHandCursor: true });
      r.setStrokeStyle(1, 0xffffff, 0.35);
      var t = this.add.bitmapText(x + w / 2 - label.length * 3, y + h / 2 - 4, 'pxfont', label)
        .setScrollFactor(0).setDepth(121).setAlpha(0.7);
      r.on('pointerdown', () => { this.touch[prop] = true; r.setFillStyle(0xffffff, 0.3); FC8.audio.unlock(); });
      r.on('pointerup', () => { this.touch[prop] = false; r.setFillStyle(0xffffff, 0.14); });
      r.on('pointerout', () => { this.touch[prop] = false; r.setFillStyle(0xffffff, 0.14); });
      return { r: r, t: t };
    };
    mk(6, H - 50, 40, 40, '<', 'left');
    mk(52, H - 50, 40, 40, '>', 'right');
    mk(W - 52, H - 50, 46, 40, 'JUMP', 'jump');
    mk(W - 104, H - 50, 46, 40, 'KICK', 'fire');
  }

  readInput() {
    var k = this.keys, t = this.touch;
    var i = this.input_;
    var frozen = this.paused || this.completed || this.introTime > 0;
    if (frozen) {
      i.left = i.right = i.up = i.down = i.run = false;
      i.jumpDown = i.jumpPressed = i.firePressed = false;
      return;
    }
    i.left = k.left.isDown || k.a.isDown || t.left;
    i.right = k.right.isDown || k.d.isDown || t.right;
    i.up = k.up.isDown || k.w.isDown;
    i.down = k.down.isDown || k.s.isDown;
    i.run = k.shift.isDown;
    var jd = k.space.isDown || k.up.isDown || k.w.isDown || t.jump;
    i.jumpDown = jd;
    i.jumpPressed = jd && !this.prevJump;
    this.prevJump = jd;
    var fd = k.x.isDown || k.j.isDown || t.fire;
    i.firePressed = fd && !this.prevFire;
    this.prevFire = fd;
  }

  togglePause() {
    if (this.completed || (this.player && this.player.dead)) return;
    this.paused = !this.paused;
    if (this.paused) {
      this.physics.world.pause();
      this.anims.pauseAll();
      this.pauseCard.setAlpha(1);
      FC8.audio.stopMusic();
    } else {
      this.physics.world.resume();
      this.anims.resumeAll();
      this.pauseCard.setAlpha(0);
      FC8.audio.playMusic(this.def.music);
    }
  }

  /* =============================================================== HUD === */
  buildHud() {
    var W = FC8.W;
    var hud = this.add.container(0, 0).setScrollFactor(0).setDepth(100);
    var bar = this.add.rectangle(0, 0, W, 26, 0x000000, 0.42).setOrigin(0, 0).setScrollFactor(0);
    hud.add(bar);

    // portrait, name and score
    this.add.image(6, 5, 'y4-face').setOrigin(0, 0).setScrollFactor(0).setDepth(100);
    this.hudName = FC8.label(this, 24, 3, 'Y4M4L10', { color: 0xedbb00 });
    this.hudScore = FC8.label(this, 24, 14, '000000', { color: 0xffffff });
    hud.add([this.hudName, this.hudScore]);

    // life pips
    this.hearts = [];
    for (var hi = 0; hi < 5; hi++) {
      var hp = this.add.image(78 + hi * 9, 4, 'heart').setOrigin(0, 0)
        .setScrollFactor(0).setDepth(100);
      this.hearts.push(hp);
      hud.add(hp);
    }
    this.hudLivesExtra = FC8.label(this, 78, 14, '', { color: 0xffffff });
    hud.add(this.hudLivesExtra);

    // ball icon centred on the text row (glyphs are 7px tall, the ball is 10)
    var ballIcon = this.add.sprite(78, 12, 'ball-0').setOrigin(0, 0).setScrollFactor(0);
    ballIcon.play('ball-spin');
    this.hudBalls = FC8.label(this, 91, 14, 'X00', { color: 0xffffff });
    hud.add([ballIcon, this.hudBalls]);

    this.hudLevel = FC8.label(this, W / 2, 3, this.def.name + ' - ' + this.def.title, { color: 0xedbb00, origin: 'center' });
    this.hudPower = FC8.label(this, W / 2, 14, '', { color: 0x7ef08a, origin: 'center' });
    hud.add([this.hudLevel, this.hudPower]);

    this.hudTime = FC8.label(this, W - 6, 3, 'TIME 000', { color: 0xffffff, origin: 'right' });
    this.muteTag = FC8.label(this, W - 6, 14, 'MUTED', { color: 0x8e99a6, origin: 'right' });
    this.muteTag.setAlpha(FC8.audio.isMuted() ? 1 : 0);
    hud.add([this.hudTime, this.muteTag]);
    this.hud = hud;

    // boss health bar (hidden until the fight starts)
    this.bossBar = this.add.container(W / 2 - 60, 40).setScrollFactor(0).setDepth(100).setAlpha(0);
    this.bossBar.add(this.add.rectangle(0, 0, 120, 10, 0x000000, 0.65).setOrigin(0, 0));
    this.bossBarFill = this.add.rectangle(2, 2, 116, 6, 0xa50044).setOrigin(0, 0);
    this.bossBar.add(this.bossBarFill);
    this.bossBar.add(FC8.label(this, 60, -11, 'THE SPECIAL ONE', { color: 0xffffff, origin: 'center' }));

    /* pause + banner overlays */
    this.pauseCard = this.add.container(0, 0).setScrollFactor(0).setDepth(130).setAlpha(0);
    this.pauseCard.add(this.add.rectangle(0, 0, FC8.W, FC8.H, 0x07040f, 0.72).setOrigin(0, 0));
    this.pauseCard.add(FC8.label(this, FC8.W / 2, 100, 'HALF TIME', { scale: 2, color: 0xedbb00, origin: 'center' }));
    this.pauseCard.add(FC8.label(this, FC8.W / 2, 126, 'PRESS P TO PLAY ON', { color: 0xffffff, origin: 'center' }));
  }

  buildIntroCard(def) {
    var card = this.add.container(0, 0).setScrollFactor(0).setDepth(125);
    card.add(this.add.rectangle(0, 0, FC8.W, FC8.H, 0x07040f, 0.92).setOrigin(0, 0));
    card.add(FC8.label(this, FC8.W / 2, 86, def.name, { scale: 2, color: 0xedbb00, origin: 'center' }));
    card.add(FC8.label(this, FC8.W / 2, 110, def.title, { scale: 2, color: 0xffffff, origin: 'center' }));
    var hero = this.add.sprite(FC8.W / 2 - 22, 156, 'y4s-idle').setOrigin(0.5, 1)
      .setScale(FC8.usingSheet ? 1 : 1.4);
    card.add(hero);
    card.add(FC8.label(this, FC8.W / 2 + 4, 144, 'X ' + (this.registry.get('lives') || 0), { scale: 2, color: 0xffffff }));
    this.tweens.add({ targets: card, alpha: 0, delay: 950, duration: 300, onComplete: function () { card.destroy(); } });
  }

  /* ========================================================== callbacks == */
  onBall(player, ball) {
    if (player.dead) return;
    var bx = ball.x, by = ball.y;
    ball.destroy();
    this.addBall();
    this.addScore(50, bx, by);
    FC8.audio.play('ball');
  }

  onItem(player, item) {
    if (player.dead || item.emerging > 0) return;
    var kind = item.kind;
    item.destroy();
    if (kind === 'ballon') {
      if (player.powerState === 'small') { player.setPower('super'); this.addScore(1000, player.x, player.y - 20); }
      else { player.starTime = 6000; this.addScore(2000, player.x, player.y - 20); }
      FC8.audio.play('power');
    } else if (kind === 'boot') {
      player.setPower('boot');
      this.addScore(1500, player.x, player.y - 20);
      FC8.audio.play('power');
    } else {
      this.addLife();
      this.floatText(player.x, player.y - 26, '1 UP', 0x7ef08a);
      FC8.audio.play('life');
    }
    this.registry.set('power', player.powerState);
    this.updateHud();
  }

  onEnemy(player, enemy) {
    if (player.dead || enemy.squashed || enemy.dead_) return;
    var fromAbove = player.body.velocity.y > 30 &&
      player.body.bottom - player.body.deltaY() <= enemy.body.top + 6;

    if (player.starTime > 0) {
      if (enemy.kind === 'boss') { enemy.damage(); player.bounce(200); }
      else { enemy.kill(player.facing); this.addScore(enemy.points, enemy.x, enemy.y); FC8.audio.play('stomp'); }
      return;
    }
    if (fromAbove) {
      player.bounce(this.input_.jumpDown ? 300 : 232);
      if (enemy.kind === 'boss') {
        var killed = enemy.damage();
        this.cameras.main.shake(140, 0.006);
        if (!killed) this.addScore(500, enemy.x, enemy.y - 30);
      } else if (enemy.kind === 'mb') {
        var dead = enemy.damage(player.x);
        this.addScore(dead ? enemy.points : 200, enemy.x, enemy.y - 10);
        if (dead) FC8.audio.play('stomp');
      } else {
        enemy.squash();
        FC8.audio.play('stomp');
        this.comboCount++;
        var pts = [100, 200, 400, 800, 1000, 2000][Math.min(5, this.comboCount - 1)];
        this.addScore(pts, enemy.x, enemy.y - 10);
        this.puff(enemy.x, enemy.y - 4);
      }
    } else {
      // a stunned MB4PPE is harmless
      if (enemy.kind === 'mb' && enemy.stunned > 0) return;
      this.hurtPlayer();
    }
  }

  onShotEnemy(shot, enemy) {
    if (enemy.squashed || enemy.dead_) return;
    // grab what we need before the shot goes away
    var dir = shot.body && shot.body.velocity.x > 0 ? 1 : -1;
    var sx = shot.x, sy = shot.y;
    shot.destroy();
    this.puff(sx, sy);
    if (enemy.kind === 'boss') {
      var killed = enemy.damage();
      this.cameras.main.shake(120, 0.005);
      if (!killed) this.addScore(300, enemy.x, enemy.y - 30);
      return;
    }
    if (enemy.kind === 'mb') {
      enemy.kill(dir);                       // a well struck ball finishes him
      this.addScore(enemy.points, enemy.x, enemy.y);
      FC8.audio.play('stomp');
      return;
    }
    enemy.kill(dir);
    this.addScore(enemy.points, enemy.x, enemy.y);
    FC8.audio.play('stomp');
  }

  onShotTile(shot) {
    if (shot.body.blocked.left || shot.body.blocked.right) shot.destroy();
  }

  onBottle(player, bottle) {
    if (player.dead) return;
    var bx = bottle.x, by = bottle.y;
    bottle.destroy();
    this.puff(bx, by);
    if (player.starTime > 0) return;
    this.hurtPlayer();
  }

  onBus(player, bus) {
    if (player.dead) return;
    if (player.body.touching.down || player.body.bottom <= bus.body.top + 6) {
      player.x += bus.dx || 0;                 // ride the bus
      return;
    }
    this.hurtPlayer();
  }

  onSpikes(sprite) {
    if (sprite === this.player && !this.player.dead) this.hurtPlayer();
    return true;
  }

  onGoal(player) {
    if (this.completed || player.dead) return;
    this.levelComplete();
  }

  onTrophy(player) {
    if (this.completed || player.dead || !this.bossDefeated) return;
    this.winGame();
  }

  /* ============================================================ effects == */
  addScore(n, x, y) {
    var s = (this.registry.get('score') || 0) + n;
    this.registry.set('score', s);
    if (x !== undefined) this.floatText(x, y, String(n), 0xffffff);
    this.updateHud();
  }

  addBall() {
    var b = (this.registry.get('balls') || 0) + 1;
    this.registry.set('balls', b);
    if (b % 100 === 0) { this.addLife(); FC8.audio.play('life'); }
    this.updateHud();
  }

  addLife() {
    this.registry.set('lives', (this.registry.get('lives') || 0) + 1);
    this.updateHud();
  }

  floatText(x, y, text, color) {
    var t = this.add.bitmapText(x - text.length * 3, y - 6, 'pxfont', text).setDepth(60).setTint(color || 0xffffff);
    this.tweens.add({ targets: t, y: t.y - 18, alpha: 0, duration: 750, onComplete: function () { t.destroy(); } });
  }

  puff(x, y) {
    var p = this.add.particles(x, y, 'dust', {
      speed: { min: 30, max: 90 }, lifespan: 320, quantity: 6,
      scale: { start: 1.2, end: 0 }, emitting: false
    }).setDepth(30);
    p.explode(6);
    this.time.delayedCall(420, function () { p.destroy(); });
  }

  bossTaunt(text) {
    if (!this.boss || this.boss.dead_ && text.indexOf('ORDINARY') === -1) return;
    if (this.tauntLabel) this.tauntLabel.destroy();
    var lbl = FC8.label(this, this.boss.x, this.boss.y - 46, text, { color: 0xffffff, origin: 'center' });
    lbl.setDepth(70);
    this.tauntLabel = lbl;
    this.tweens.add({ targets: lbl, y: lbl.y - 8, alpha: 0, delay: 700, duration: 500, onComplete: function () { lbl.destroy(); } });
  }

  /* ======================================================= block bumping = */
  tryBlock(wx, wy) {
    var ID = FC8.tiles.ID;
    var tile = this.layer.getTileAtWorldXY(wx, wy);
    if (!tile) return;
    var key = tile.x + ',' + tile.y;
    var content = this.L.items[key];

    if (tile.index === ID.BALLBLOCK || (tile.index === ID.BRICK && content)) {
      delete this.L.items[key];
      this.layer.putTileAt(ID.USED, tile.x, tile.y);
      this.bumpTile(tile.x, tile.y, 'tile-used');
      if (!content || content === 'ball') {
        this.popBall(tile.x * 16 + 8, tile.y * 16);
      } else {
        var pk = new FC8.Pickup(this, tile.x * 16 + 8, tile.y * 16, content);
        this.items.add(pk);
        FC8.audio.play('bump');
      }
      return;
    }
    if (tile.index === ID.BRICK) {
      if (this.player.powerState !== 'small' || this.player.starTime > 0) {
        this.layer.removeTileAt(tile.x, tile.y);
        this.brickDebris(tile.x * 16 + 8, tile.y * 16 + 8);
        this.addScore(50);
        FC8.audio.play('brick');
      } else {
        this.bumpTile(tile.x, tile.y, 'tile-brick');
        FC8.audio.play('bump');
      }
      return;
    }
    if (tile.index === ID.USED || tile.index === ID.METAL) FC8.audio.play('bump');
  }

  bumpTile(tx, ty, texture) {
    var img = this.add.image(tx * 16, ty * 16, texture).setOrigin(0, 0).setDepth(7);
    this.tweens.add({
      targets: img, y: ty * 16 - 6, duration: 90, yoyo: true,
      onComplete: function () { img.destroy(); }
    });
  }

  popBall(x, y) {
    var b = this.add.sprite(x, y - 6, 'ball-0').setDepth(30);
    b.play('ball-spin');
    this.addBall();
    this.addScore(200);
    FC8.audio.play('ball');
    this.tweens.add({
      targets: b, y: y - 30, duration: 260, ease: 'Quad.easeOut',
      onComplete: () => {
        this.tweens.add({ targets: b, y: y - 8, alpha: 0, duration: 220, onComplete: function () { b.destroy(); } });
      }
    });
    this.floatText(x, y - 34, '200', 0xedbb00);
  }

  brickDebris(x, y) {
    for (var i = 0; i < 4; i++) {
      var d = this.add.image(x, y, 'tile-brick').setScale(0.4).setDepth(30);
      var dx = (i % 2 ? 1 : -1) * (26 + Math.random() * 44);
      this.tweens.add({
        targets: d, x: x + dx, y: y + 70, angle: 360 * (i % 2 ? 1 : -1),
        alpha: 0, duration: 700, ease: 'Quad.easeIn',
        onComplete: function () { d.destroy(); }
      });
    }
  }

  /* ============================================== boss support callbacks = */
  spawnBottle(x, y, dir) {
    var b = new FC8.Bottle(this, x, y, dir);
    this.bottles.add(b);
    FC8.audio.play('kick');
  }

  spawnMinion(x, y) {
    var m = new FC8.Mush(this, x, y);
    this.enemies.add(m);
    this.puff(x, y - 8);
  }

  /** The bus always drives in from the far side, straight at Y4M4L10. */
  spawnBus() {
    var p = this.player;
    var side = (p.x < (this.boss ? this.boss.x : p.x)) ? -1 : 1;
    var startX = Phaser.Math.Clamp(p.x + side * 250, 40, this.levelWidth - 40);
    this.buses.add(new FC8.Bus(this, startX, this.bossFloorY, -side));
  }

  onBossHit(boss) {
    this.bossBarFill.width = Math.max(0, 116 * (boss.hp / boss.maxHp));
  }

  onBossDefeated() {
    this.bossDefeated = true;
    this.addScore(5000, this.boss.x, this.boss.y - 40);
    this.cameras.main.shake(500, 0.01);
    this.tweens.add({ targets: this.bossBar, alpha: 0, duration: 600 });

    // the gate to the podium falls away
    var g = this.L.gate;
    if (g) {
      for (var y = g.y1; y <= g.y2; y++) {
        this.layer.removeTileAt(g.x, y);
        this.brickDebris(g.x * 16 + 8, y * 16 + 8);
      }
    }
    this.floatBanner('THE SPECIAL ONE IS SACKED', 0xedbb00);
    this.time.delayedCall(900, function () {
      this.floatBanner('LIFT THE BIG EARS!', 0xffffff);
      FC8.audio.playMusic('leg1');
    }, [], this);
  }

  floatBanner(text, color) {
    var y = 54;
    var lbl = FC8.label(this, FC8.W / 2, y, text, { scale: 1, color: color, origin: 'center' });
    lbl.setScrollFactor(0).setDepth(110);
    this.tweens.add({ targets: lbl, y: y - 10, alpha: 0, delay: 1300, duration: 600, onComplete: function () { lbl.destroy(); } });
  }

  /* ======================================================== player fate == */
  hurtPlayer() {
    var p = this.player;
    if (p.invuln > 0 || p.dead) return;
    var died = p.hurt();
    if (died) this.playerDied();
    else {
      this.registry.set('power', p.powerState);
      this.updateHud();
      this.cameras.main.shake(120, 0.004);
    }
  }

  playerDied() {
    if (this.dying) return;
    this.dying = true;
    FC8.audio.stopMusic();
    this.registry.set('power', 'small');
    var lives = (this.registry.get('lives') || 0) - 1;
    this.registry.set('lives', lives);
    this.updateHud();
    this.cameras.main.stopFollow();
    this.time.delayedCall(2000, function () {
      if (lives > 0) this.scene.start('game', { level: this.levelIndex });
      else this.scene.start('gameover');
    }, [], this);
  }

  levelComplete() {
    this.completed = true;
    var p = this.player;
    p.setAccelerationX(0);
    p.body.setVelocityX(0);
    FC8.audio.stopMusic();
    FC8.audio.play('whistle');
    FC8.audio.play('goal');
    this.floatBanner('FULL TIME - GOAL!', 0xedbb00);

    var bonus = Math.max(0, Math.floor(this.timeLeft) * 10);
    this.time.delayedCall(700, function () {
      this.addScore(bonus);
      this.floatBanner('TIME BONUS ' + bonus, 0xffffff);
    }, [], this);

    this.time.delayedCall(2600, function () {
      var next = this.levelIndex + 1;
      this.registry.set('level', next);
      if (next < FC8.levels.all().length) this.scene.start('game', { level: next });
      else this.scene.start('victory');
    }, [], this);
  }

  winGame() {
    this.completed = true;
    this.player.body.setVelocity(0, 0);
    this.player.setAccelerationX(0);
    FC8.audio.stopMusic();
    FC8.audio.play('goal');
    this.floatBanner('CHAMPIONS OF EUROPE!', 0xedbb00);
    ['conf-b', 'conf-r', 'conf-g', 'conf-w'].forEach(function (k, i) {
      this.add.particles(this.player.x, this.player.y - 120, k, {
        x: { min: -110, max: 110 }, lifespan: 2600, speedY: { min: 40, max: 90 },
        speedX: { min: -30, max: 30 }, rotate: { start: 0, end: 360 },
        frequency: 70 + i * 20, quantity: 1
      }).setDepth(40);
    }, this);
    this.time.delayedCall(2600, function () { this.scene.start('victory'); }, [], this);
  }

  /* ================================================================ HUD == */
  updateHud() {
    this.hudScore.setText(String(this.registry.get('score') || 0).padStart(6, '0'));
    this.hudBalls.setText('X' + String(this.registry.get('balls') || 0).padStart(2, '0'));
    var lives = this.registry.get('lives') || 0;
    for (var i = 0; i < this.hearts.length; i++) {
      this.hearts[i].setVisible(i < Math.min(lives, this.hearts.length));
    }
    this.hudLivesExtra.setText(lives > this.hearts.length ? 'X' + lives : '');
    this.hudTime.setText('TIME ' + String(Math.max(0, Math.ceil(this.timeLeft))).padStart(3, '0'));
    this.hudTime.x = FC8.W - 6 - this.hudTime.text.width;
    var p = this.player;
    var tag = p && p.starTime > 0 ? 'BALLON FEVER!' : (p && p.powerState === 'boot' ? 'GOLDEN BOOT - PRESS X' : (p && p.powerState === 'super' ? 'SUPER' : ''));
    this.hudPower.setText(tag);
    this.hudPower.x = FC8.W / 2 - (this.hudPower.text.width / 2);
  }

  /* ============================================================= update == */
  update(time, delta) {
    this.readInput();
    if (this.paused) return;

    if (this.introTime > 0) this.introTime -= delta;

    var p = this.player;

    // moving platforms
    this.movers.children.iterate(function (m) {
      if (!m || !m.body) return;
      m.dx = m.x - m.px; m.dy = m.y - m.py;
      m.px = m.x; m.py = m.y;
      if (m.axis === 'x') {
        if (m.x <= m.min && m.body.velocity.x < 0) m.body.setVelocityX(m.speed);
        else if (m.x + m.width >= m.max + m.width && m.body.velocity.x > 0) m.body.setVelocityX(-m.speed);
        if (m.x > m.max) m.body.setVelocityX(-m.speed);
      } else {
        if (m.y <= m.min && m.body.velocity.y < 0) m.body.setVelocityY(m.speed);
        else if (m.y >= m.max && m.body.velocity.y > 0) m.body.setVelocityY(-m.speed);
      }
    });

    if (p) {
      p.update(time, delta);

      // ride whatever is under the feet
      p.riding = null;
      this.movers.children.iterate(function (m) {
        if (!m || !m.body) return;
        if (p.body.touching.down && m.body.touching.up) {
          p.x += m.dx;
          if (m.dy > 0) p.y += m.dy;
          p.riding = m;
        }
      });

      if (p.body.blocked.down) this.comboCount = 0;

      // head bumps
      if (!p.dead && p.body.blocked.up && this.introTime <= 0) {
        var by = p.body.top - 4;
        this.tryBlock(p.body.left + 3, by);
        if (p.body.right - 3 > p.body.left + 3 + 8) this.tryBlock(p.body.right - 3, by);
      }

      // shooting
      if (this.input_.firePressed && p.powerState === 'boot' && p.shootCd <= 0 && this.shots.getLength() < 3) {
        var s = new FC8.Shot(this, p.x + p.facing * 7, p.y - (p.powerState === 'small' ? 9 : 12), p.facing);
        this.shots.add(s);
        p.shootCd = 300;
        p.kick();
        FC8.audio.play('kick');
      }

      // out of the world
      if (!p.dead && p.y > this.deathY) { p.die(); this.playerDied(); }
      if (p.dead && !this.dying) this.playerDied();
    }

    // boss wake-up
    if (this.boss && !this.bossActive && !this.boss.dead_ && p && !p.dead) {
      if (Math.abs(p.x - this.boss.x) < 170 && p.y < this.bossFloorY + 24) {
        this.bossActive = true;
        this.boss.state_ = 'wait';
        this.boss.timer = 900;
        this.tweens.add({ targets: this.bossBar, alpha: 1, duration: 400 });
        this.bossTaunt('I AM THE SPECIAL ONE!');
        FC8.audio.playMusic('boss');
        this.cameras.main.shake(300, 0.006);
      } else if (this.boss.body) {
        this.boss.state_ = 'sleep';
        this.boss.body.setVelocityX(0);
      }
    }
    if (this.boss && this.boss.body && this.boss.state_ === 'sleep') this.boss.setTexture('boss-idle');

    // keep the bus riding clean and drop dead bottles
    this.buses.children.iterate(function (b) { if (b && b.body) b.body.setVelocityY(0); });

    // clock
    if (!this.completed && !this.dying && this.introTime <= 0) {
      this.timeAcc += delta;
      if (this.timeAcc >= 1000) {
        this.timeAcc -= 1000;
        this.timeLeft--;
        if (this.timeLeft === 30) this.floatBanner('HURRY UP!', 0xd4246a);
        if (this.timeLeft <= 0) { this.timeLeft = 0; if (p && !p.dead) { p.die(); this.playerDied(); } }
        this.updateHud();
      }
    }

    var sx = this.cameras.main.scrollX;
    if (this.bgFar) this.bgFar.tilePositionX = sx * 0.06;
    if (this.bgNear) this.bgNear.tilePositionX = sx * 0.18;
    if (this.boards) this.boards.tilePositionX = sx * 0.55;
    if (this.bgBanner) this.bgBanner.tilePositionX = sx * 0.3;
    if (this.tauntLabel && this.boss && this.boss.body) this.tauntLabel.x = this.boss.x - this.tauntLabel.widthPx / 2;
  }
};
