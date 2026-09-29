/* FC8Bit Super Y4M4L - game entities. */
window.FC8 = window.FC8 || {};

(function () {
  'use strict';

  var A = Phaser.Physics.Arcade;

  /* ======================================================== Y4M4L10 ======== */
  /* Power states:
       small -> one hit and you are out
       super -> taller, takes a hit
       boot  -> GOLDEN BOOT: shoots footballs                                  */
  var Player = class extends A.Sprite {
    constructor(scene, x, y) {
      super(scene, x, y, 'y4s-idle');
      scene.add.existing(this);
      scene.physics.add.existing(this);
      this.setOrigin(0.5, 1);
      this.powerState = 'small';
      this.pfx = 'y4s';
      this.facing = 1;
      this.invuln = 0;
      this.dead = false;
      this.starTime = 0;
      this.shootCd = 0;
      this.coyote = 0;
      this.jumpBuffer = 0;
      this.holdJump = false;
      this.kickTime = 0;
      this.setDepth(20);
      this.setMaxVelocity(230, 620);
      this.setDragX(1250);
      this.body.setGravityY(0);
      this.applyBody();
    }

    applyBody() {
      var big = this.powerState !== 'small';
      this.setTexture(this.pfx + '-idle');
      // The hand-drawn sheet is one size for every power state (the states
      // read through the gold aura and boots instead), so the body is fixed.
      var w = FC8.usingSheet ? 10 : 8;
      var h = FC8.usingSheet ? 22 : (big ? 19 : 14);
      this.body.setSize(w, h, false);
      // origin is bottom-centre, so offset the body to sit on the feet
      this.body.setOffset((this.width - w) / 2, this.height - h);
    }

    setPower(state) {
      if (this.powerState === state) return;
      this.powerState = state;
      this.pfx = state === 'small' ? 'y4s' : (state === 'boot' ? 'y4b' : 'y4g');
      this.applyBody();
    }

    hurt() {
      if (this.invuln > 0 || this.dead) return false;
      if (this.powerState === 'boot') { this.setPower('super'); this.invuln = 1600; FC8.audio.play('hurt'); return false; }
      if (this.powerState === 'super') { this.setPower('small'); this.invuln = 1600; FC8.audio.play('hurt'); return false; }
      this.die();
      return true;
    }

    die() {
      if (this.dead) return;
      this.dead = true;
      this.body.setVelocity(0, -320);
      this.body.setAcceleration(0, 0);
      this.body.checkCollision.none = true;
      this.setTexture(this.pfx + '-hurt');
      this.anims.stop();
      FC8.audio.play('die');
    }

    bounce(v) { this.body.velocity.y = -(v || 250); }

    kick() { this.kickTime = 140; }

    update(time, delta) {
      var d = delta;
      if (this.invuln > 0) {
        this.invuln -= d;
        this.setAlpha(Math.floor(time / 60) % 2 ? 0.35 : 1);
        if (this.invuln <= 0) this.setAlpha(1);
      }
      if (this.starTime > 0) {
        this.starTime -= d;
        this.setTint([0xffffff, 0xffe066, 0xff6699, 0x66ccff][Math.floor(time / 80) % 4]);
        if (this.starTime <= 0) this.clearTint();
      }
      if (this.shootCd > 0) this.shootCd -= d;
      if (this.kickTime > 0) this.kickTime -= d;
      if (this.dead) return;

      var b = this.body;
      var onGround = b.blocked.down || b.touching.down || this.riding;
      if (onGround) this.coyote = 110; else if (this.coyote > 0) this.coyote -= d;

      var inp = this.scene.input_;
      var dir = (inp.left ? -1 : 0) + (inp.right ? 1 : 0);
      var running = inp.run;
      var maxSpd = running ? 168 : 112;

      this.setMaxVelocity(maxSpd, 620);
      if (dir !== 0) {
        this.facing = dir;
        this.setFlipX(dir < 0);
        var accel = (dir * b.velocity.x < 0) ? 2000 : 1150; // quick turnaround
        this.setAccelerationX(dir * accel);
      } else {
        this.setAccelerationX(0);
      }

      // jump: buffered input + coyote time
      if (inp.jumpPressed) this.jumpBuffer = 120;
      else if (this.jumpBuffer > 0) this.jumpBuffer -= d;

      if (this.jumpBuffer > 0 && this.coyote > 0) {
        var boost = Math.min(30, Math.abs(b.velocity.x) * 0.16);
        b.velocity.y = -(336 + boost);
        this.jumpBuffer = 0;
        this.coyote = 0;
        this.holdJump = true;
        this.riding = null;
        FC8.audio.play('jump');
      }
      // variable jump height
      if (this.holdJump && !inp.jumpDown && b.velocity.y < -90) { b.velocity.y = -90; this.holdJump = false; }
      if (b.velocity.y >= 0) this.holdJump = false;

      // animation
      if (this.kickTime > 0) {
        this.setTexture(this.pfx + '-kick');
        this.anims.stop();
      } else if (!onGround) {
        this.setTexture(this.pfx + '-jump');
        this.anims.stop();
      } else if (Math.abs(b.velocity.x) > 12) {
        this.anims.play(this.pfx + '-run', true);
        this.anims.msPerFrame = running ? 55 : 85;
      } else {
        this.anims.stop();
        this.setTexture(this.pfx + '-idle');
      }
    }
  };

  /* ================================================= MERENGUE MUSHROOM ===== */
  var Mush = class extends A.Sprite {
    constructor(scene, x, y) {
      super(scene, x, y, 'mush-a');
      scene.add.existing(this);
      scene.physics.add.existing(this);
      this.setOrigin(0.5, 1);
      this.kind = 'mush';
      this.hp = 1;
      this.points = 100;
      this.dir = -1;
      this.squashed = false;
      this.setDepth(15);
      // centred on the frame, feet on the floor - works for both the
      // procedural sprite and the wider reference one
      this.body.setSize(16, 16, false);
      this.body.setOffset((this.width - 16) / 2, this.height - 16);
      this.body.setVelocityX(-32);
      this.anims.play('mush-walk', true);
    }

    squash() {
      if (this.squashed) return;
      this.squashed = true;
      this.setTexture('mush-flat');
      this.anims.stop();
      this.body.setVelocity(0, 0);
      this.body.checkCollision.none = true;
      this.scene.time.delayedCall(420, () => this.destroy());
    }

    kill(dirX) {
      this.squashed = true;
      this.body.checkCollision.none = true;
      this.body.setVelocity(60 * (dirX || 1), -220);
      this.setFlipY(true);
      this.anims.stop();
      this.scene.time.delayedCall(1200, () => this.destroy());
    }

    update() {
      if (this.squashed || !this.body) return;
      if (this.body.blocked.left) this.dir = 1;
      else if (this.body.blocked.right) this.dir = -1;
      this.body.setVelocityX(32 * this.dir);
      this.setFlipX(this.dir > 0);
      if (this.y > this.scene.deathY) this.destroy();
    }
  };

  /* ============================================================= MB4PPE ===== */
  /* Patrols, then sprints at Y4M4L10. Two stomps to finish.                   */
  var Mb = class extends A.Sprite {
    constructor(scene, x, y) {
      super(scene, x, y, 'mb-a');
      scene.add.existing(this);
      scene.physics.add.existing(this);
      this.setOrigin(0.5, 1);
      this.kind = 'mb';
      this.hp = 2;
      this.points = 400;
      this.dir = -1;
      this.stunned = 0;
      this.squashed = false;
      this.dashCd = 0;
      this.setDepth(15);
      this.body.setSize(14, 18, false);
      this.body.setOffset((this.width - 14) / 2, this.height - 18);
      this.anims.play('mb-walk', true);
    }

    damage(fromX) {
      if (this.squashed) return false;
      this.hp--;
      if (this.hp <= 0) { this.squash(); return true; }
      this.stunned = 2600;
      this.setTexture('mb-flat');
      this.anims.stop();
      this.body.setVelocityX(0);
      FC8.audio.play('stomp');
      return false;
    }

    squash() {
      this.squashed = true;
      this.setTexture('mb-flat');
      this.anims.stop();
      this.body.checkCollision.none = true;
      this.body.setVelocity(0, -180);
      this.setFlipY(true);
      this.scene.time.delayedCall(900, () => this.destroy());
    }

    kill(dirX) {
      this.hp = 0;
      this.squashed = true;
      this.body.checkCollision.none = true;
      this.body.setVelocity(70 * (dirX || 1), -230);
      this.setFlipY(true);
      this.anims.stop();
      this.scene.time.delayedCall(1200, () => this.destroy());
    }

    update(time, delta) {
      if (this.squashed || !this.body) return;
      if (this.stunned > 0) {
        this.stunned -= delta;
        if (this.stunned <= 0) { this.anims.play('mb-walk', true); }
        return;
      }
      var p = this.scene.player;
      if (this.body.blocked.left) this.dir = 1;
      else if (this.body.blocked.right) this.dir = -1;

      var speed = 46;
      if (p && !p.dead) {
        var dx = p.x - this.x, dy = Math.abs(p.y - this.y);
        if (Math.abs(dx) < 130 && dy < 28) {
          this.dir = dx > 0 ? 1 : -1;
          speed = 138;                          // the sprint
          if (this.body.blocked.down && this.dashCd <= 0 && Math.abs(dx) < 46) {
            this.body.velocity.y = -250;        // leap at the player
            this.dashCd = 1400;
          }
        }
      }
      if (this.dashCd > 0) this.dashCd -= delta;
      this.body.setVelocityX(speed * this.dir);
      this.setFlipX(this.dir > 0);
      this.anims.msPerFrame = speed > 90 ? 55 : 110;
      if (this.y > this.scene.deathY) this.destroy();
    }
  };

  /* ==================================================== THE SPECIAL ONE ==== */
  var Boss = class extends A.Sprite {
    constructor(scene, x, y) {
      super(scene, x, y, 'boss-idle');
      scene.add.existing(this);
      scene.physics.add.existing(this);
      this.setOrigin(0.5, 1);
      this.kind = 'boss';
      this.maxHp = 8;
      this.hp = 8;
      this.points = 5000;
      this.dir = -1;
      this.state_ = 'wait';
      this.timer = 1400;
      this.invuln = 0;
      this.dead_ = false;
      this.setDepth(16);
      // the reference sprite stands a head taller than Y4M4L10
      var bw = 18, bh = 30;
      this.body.setSize(bw, bh, false);
      this.body.setOffset((this.width - bw) / 2, this.height - bh);
      this.body.setDragX(400);
    }

    taunt(text) { if (this.scene.bossTaunt) this.scene.bossTaunt(text); }

    damage() {
      if (this.invuln > 0 || this.state_ === 'shield' || this.dead_) return false;
      this.hp--;
      this.invuln = 900;
      this.setTexture('boss-hurt');
      this.body.setVelocityX(this.dir * -90);
      FC8.audio.play('bosshit');
      if (this.scene.onBossHit) this.scene.onBossHit(this);
      if (this.hp <= 0) { this.kill(); return true; }
      this.state_ = 'stagger';
      this.timer = 700;
      var lines = ['UNBELIEVABLE!', 'RESPECT ME!', 'NOT MY FAULT!', 'THE REFEREE!'];
      this.taunt(lines[(this.maxHp - this.hp - 1) % lines.length]);
      return false;
    }

    kill() {
      this.dead_ = true;
      this.state_ = 'dead';
      this.body.checkCollision.none = true;
      this.body.setVelocity(0, -260);
      this.setTexture('boss-hurt');
      this.taunt('I AM... ORDINARY.');
      FC8.audio.play('bossdie');
      if (this.scene.onBossDefeated) this.scene.onBossDefeated(this);
      this.scene.tweens.add({ targets: this, angle: 200, alpha: 0, duration: 1600, onComplete: () => this.destroy() });
    }

    pick() {
      var p = this.scene.player;
      var far = p ? Math.abs(p.x - this.x) > 90 : false;
      var roll = Math.random();
      if (this.hp <= 3 && roll < 0.3) return 'bus';
      if (far && roll < 0.45) return 'throw';
      if (roll < 0.3) return 'summon';
      if (roll < 0.6) return 'throw';
      if (roll < 0.8) return 'bus';
      return 'shield';
    }

    update(time, delta) {
      if (!this.body || this.dead_) return;
      if (this.invuln > 0) {
        this.invuln -= delta;
        this.setAlpha(Math.floor(time / 70) % 2 ? 0.5 : 1);
        if (this.invuln <= 0) this.setAlpha(1);
      }
      var p = this.scene.player;
      if (p && !p.dead) { this.dir = p.x < this.x ? -1 : 1; this.setFlipX(this.dir > 0); }
      this.timer -= delta;

      switch (this.state_) {
        case 'wait':
          this.setTexture('boss-idle');
          this.body.setVelocityX(this.dir * 34);
          if (this.timer <= 0) { this.state_ = this.pick(); this.timer = 0; }
          break;

        case 'stagger':
          this.body.setVelocityX(0);
          if (this.timer <= 0) { this.state_ = 'wait'; this.timer = 900; this.setTexture('boss-idle'); }
          break;

        case 'shield':
          if (this.timer <= 0) {
            this.setTexture('boss-shield');
            this.body.setVelocityX(this.dir * 60);
            this.timer = 1500;
            this.state_ = 'shielding';
            this.taunt('PARK THE BUS!');
          }
          break;

        case 'shielding':
          this.body.setVelocityX(this.dir * 60);
          if (this.timer <= 0) { this.state_ = 'wait'; this.timer = 700; }
          break;

        case 'throw':
          this.setTexture('boss-throw');
          this.body.setVelocityX(0);
          this.taunt(['WATER BREAK!', 'EGGS IN THE BASKET!', 'ZERO TITLES!'][Math.floor(Math.random() * 3)]);
          for (var i = 0; i < 3; i++) {
            this.scene.time.delayedCall(180 + i * 240, () => {
              if (this.dead_ || !this.scene.spawnBottle) return;
              this.scene.spawnBottle(this.x + this.dir * 10, this.y - 26, this.dir);
            });
          }
          this.state_ = 'recover';
          this.timer = 1100;
          break;

        case 'summon':
          this.setTexture('boss-shield');
          this.body.setVelocityX(0);
          this.taunt('SUBSTITUTIONS!');
          this.scene.time.delayedCall(240, () => {
            if (this.dead_ || !this.scene.spawnMinion) return;
            this.scene.spawnMinion(this.x - 26, this.y - 40);
            this.scene.spawnMinion(this.x + 26, this.y - 40);
          });
          this.state_ = 'recover';
          this.timer = 1200;
          break;

        case 'bus':
          this.setTexture('boss-shield');
          this.body.setVelocityX(0);
          this.taunt('PARK THE BUS!');
          FC8.audio.play('horn');
          this.scene.time.delayedCall(420, () => {
            if (this.dead_ || !this.scene.spawnBus) return;
            this.scene.spawnBus(this.dir);
          });
          this.state_ = 'recover';
          this.timer = 1500;
          break;

        case 'recover':
          this.setTexture('boss-idle');
          this.body.setVelocityX(this.dir * 20);
          if (this.timer <= 0) { this.state_ = 'wait'; this.timer = 600 + Math.random() * 700; }
          break;
      }
    }
  };

  /* ======================================================== projectiles ==== */
  var Shot = class extends A.Image {
    constructor(scene, x, y, dir) {
      super(scene, x, y, 'ball-0');
      scene.add.existing(this);
      scene.physics.add.existing(this);
      this.setDepth(18);
      this.body.setCircle(5);
      this.body.setBounce(1, 0.72);
      this.body.setVelocity(dir * 240, -60);
      this.life = 2400;
      this.spin = dir * 0.4;
    }
    update(time, delta) {
      this.life -= delta;
      this.rotation += this.spin;
      if (this.life <= 0 || this.y > this.scene.deathY) this.destroy();
    }
  };

  var Bottle = class extends A.Image {
    constructor(scene, x, y, dir) {
      super(scene, x, y, 'bottle');
      scene.add.existing(this);
      scene.physics.add.existing(this);
      this.setDepth(18);
      this.body.setSize(6, 8);
      this.body.setBounce(0.55, 0.5);
      this.body.setVelocity(dir * (120 + Math.random() * 70), -190);
      this.life = 4000;
    }
    update(time, delta) {
      this.life -= delta;
      this.rotation += 0.25;
      if (this.life <= 0 || this.y > this.scene.deathY) this.destroy();
    }
  };

  /* Parked bus: drives across the arena. */
  var Bus = class extends A.Image {
    constructor(scene, x, y, dir) {
      super(scene, x, y, 'bus');
      scene.add.existing(this);
      scene.physics.add.existing(this);
      this.setOrigin(0.5, 1);
      this.setDepth(14);
      this.body.setSize(44, 20, false);
      this.body.setOffset(1, this.height - 20);
      this.body.setAllowGravity(false);
      this.body.setImmovable(true);
      this.setFlipX(dir < 0);
      this.body.setVelocityX(dir * 105);
      this.prevX = this.x;
      this.life = 9000;
    }
    update(time, delta) {
      this.life -= delta;
      this.dx = this.x - this.prevX;
      this.prevX = this.x;
      if (this.life <= 0 || this.x < -80 || this.x > this.scene.levelWidth + 80) this.destroy();
    }
  };

  /* =========================================================== pickups ===== */
  /* Items pop out of a block, then roll along the floor. */
  var Pickup = class extends A.Image {
    constructor(scene, x, y, kind) {
      super(scene, x, y, kind === 'ballon' ? 'item-ballon' : kind === 'boot' ? 'item-boot' : 'item-spray');
      scene.add.existing(this);
      scene.physics.add.existing(this);
      this.kind = kind;
      this.setOrigin(0.5, 1);
      this.setDepth(17);
      this.body.setBounce(0.2, 0.2);
      this.dir = 1;
      this.emerging = 460;
      this.body.setAllowGravity(false);
      this.body.setVelocityY(-34);
      this.setDepth(9);
      scene.tweens.add({ targets: this, y: y - 17, duration: 460, ease: 'Sine.easeOut' });
    }
    update(time, delta) {
      if (this.emerging > 0) {
        this.emerging -= delta;
        if (this.emerging <= 0) {
          this.setDepth(17);
          this.body.setAllowGravity(true);
          this.body.setVelocity(this.dir * 58, 0);
        }
        return;
      }
      if (this.body.blocked.left) this.dir = 1;
      else if (this.body.blocked.right) this.dir = -1;
      this.body.setVelocityX(this.dir * 58);
      if (this.kind !== 'spray') this.rotation += this.dir * 0.08;
      if (this.y > this.scene.deathY) this.destroy();
    }
  };

  FC8.Player = Player;
  FC8.Mush = Mush;
  FC8.Mb = Mb;
  FC8.Boss = Boss;
  FC8.Shot = Shot;
  FC8.Bottle = Bottle;
  FC8.Bus = Bus;
  FC8.Pickup = Pickup;
})();
