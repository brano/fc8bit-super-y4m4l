/* FC8Bit Super Y4M4L - WebAudio chiptune engine. All sound is synthesised,
   so the game ships with no audio files. */
window.FC8 = window.FC8 || {};

FC8.audio = (function () {
  'use strict';

  var ctx = null, master = null, musicGain = null, sfxGain = null;
  var muted = false, timer = null, track = null, step = 0, nextTime = 0;
  /* Optional recorded track (the 8-bit anthem), handed over by the boot scene
     as a Phaser Sound. Everything else here is synthesised. */
  var anthem = null;

  var NOTES = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

  /** "A#4" / "C5" -> Hz */
  function hz(name) {
    if (!name || name === '.' || name === '-') return 0;
    var m = /^([A-G])([#b]?)(-?\d)$/.exec(name);
    if (!m) return 0;
    var semi = NOTES[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
    var midi = (parseInt(m[3], 10) + 1) * 12 + semi;
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  function ensure() {
    if (!ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination);
      musicGain = ctx.createGain(); musicGain.gain.value = 0.26; musicGain.connect(master);
      sfxGain = ctx.createGain(); sfxGain.gain.value = 0.42; sfxGain.connect(master);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return true;
  }

  /** One synth voice. */
  function voice(o) {
    if (!ensure() || muted) return;
    var t0 = (o.at || ctx.currentTime) + (o.delay || 0);
    var dur = o.dur || 0.12;
    var osc = ctx.createOscillator();
    var g = ctx.createGain();
    osc.type = o.type || 'square';
    osc.frequency.setValueAtTime(o.freq, t0);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t0 + dur);
    var vol = (o.vol == null ? 0.5 : o.vol);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g); g.connect(o.bus || sfxGain);
    osc.start(t0); osc.stop(t0 + dur + 0.02);
  }

  /** White-noise burst (stomps, crowd, explosions). */
  function noise(o) {
    if (!ensure() || muted) return;
    var t0 = (o.at || ctx.currentTime) + (o.delay || 0);
    var dur = o.dur || 0.15;
    var len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    var src = ctx.createBufferSource(); src.buffer = buf;
    var f = ctx.createBiquadFilter();
    f.type = o.filter || 'bandpass';
    f.frequency.value = o.freq || 900;
    var g = ctx.createGain(); g.gain.value = (o.vol == null ? 0.4 : o.vol);
    src.connect(f); f.connect(g); g.connect(o.bus || sfxGain);
    src.start(t0);
  }

  /* ----------------------------------------------------------------- SFX */
  var SFX = {
    jump: function () { voice({ freq: 320, to: 760, dur: 0.16, type: 'square', vol: 0.4 }); },
    bump: function () { voice({ freq: 180, to: 90, dur: 0.09, type: 'square', vol: 0.35 }); },
    ball: function () {
      voice({ freq: hz('B5'), dur: 0.07, vol: 0.35 });
      voice({ freq: hz('E6'), dur: 0.14, vol: 0.35, delay: 0.07 });
    },
    stomp: function () {
      noise({ freq: 700, dur: 0.12, vol: 0.45 });
      voice({ freq: 420, to: 120, dur: 0.14, type: 'triangle', vol: 0.4 });
    },
    kick: function () { voice({ freq: 640, to: 240, dur: 0.11, type: 'sawtooth', vol: 0.3 }); },
    brick: function () { noise({ freq: 1500, dur: 0.16, vol: 0.4, filter: 'highpass' }); },
    power: function () {
      ['C5', 'E5', 'G5', 'C6', 'E6'].forEach(function (n, i) {
        voice({ freq: hz(n), dur: 0.1, delay: i * 0.055, vol: 0.34 });
      });
    },
    life: function () {
      ['E5', 'G5', 'C6', 'E6', 'G6'].forEach(function (n, i) {
        voice({ freq: hz(n), dur: 0.12, delay: i * 0.07, vol: 0.32, type: 'triangle' });
      });
    },
    hurt: function () { voice({ freq: 420, to: 140, dur: 0.3, type: 'sawtooth', vol: 0.35 }); },
    die: function () {
      stopMusic();
      ['A4', 'G4', 'E4', 'C4', 'A3'].forEach(function (n, i) {
        voice({ freq: hz(n), dur: 0.18, delay: i * 0.13, vol: 0.4, type: 'square' });
      });
      voice({ freq: 160, to: 40, dur: 0.7, delay: 0.7, type: 'triangle', vol: 0.4 });
    },
    bosshit: function () {
      noise({ freq: 400, dur: 0.2, vol: 0.5, filter: 'lowpass' });
      voice({ freq: 200, to: 60, dur: 0.25, type: 'sawtooth', vol: 0.4 });
    },
    bossdie: function () {
      stopMusic();
      for (var i = 0; i < 7; i++) {
        noise({ freq: 300 + i * 120, dur: 0.3, vol: 0.4, delay: i * 0.12, filter: 'lowpass' });
      }
    },
    horn: function () {
      voice({ freq: 130, dur: 0.5, type: 'sawtooth', vol: 0.3 });
      voice({ freq: 196, dur: 0.5, type: 'sawtooth', vol: 0.25 });
    },
    whistle: function () {
      voice({ freq: 2100, to: 2400, dur: 0.18, type: 'triangle', vol: 0.25 });
      voice({ freq: 2050, to: 2350, dur: 0.18, type: 'square', vol: 0.12, delay: 0.02 });
    },
    select: function () { voice({ freq: hz('E5'), dur: 0.06, vol: 0.3 }); },
    start: function () {
      ['C5', 'C5', 'C5', 'G5'].forEach(function (n, i) {
        voice({ freq: hz(n), dur: 0.1, delay: i * 0.1, vol: 0.35 });
      });
    },
    crowd: function () { noise({ freq: 600, dur: 1.4, vol: 0.18, filter: 'bandpass' }); },
    goal: function () {
      ['G4', 'C5', 'E5', 'G5', 'C6'].forEach(function (n, i) {
        voice({ freq: hz(n), dur: 0.16, delay: i * 0.1, vol: 0.36 });
      });
      noise({ freq: 700, dur: 1.6, vol: 0.16, filter: 'bandpass', delay: 0.2 });
    }
  };

  function play(name) { if (SFX[name]) SFX[name](); }

  /* --------------------------------------------------------------- MUSIC */
  /* Each track is 32 steps. "." = rest, "-" = hold. */
  var TRACKS = {
    /* Y4M4L10's song - the intro riff and bass roots of "Y QUE FUE", taken
       note-for-note out of the supplied MIDI. Only two figures survived the
       conversion (the 8-step riff and a G# root once a bar, with one F), so
       the 30s intro is those looped rather than invented. */
    y4song: {
      tempo: 0.22, leadType: 'pulse', bassType: 'triangle',
      lead: (
        'G#3 G#3 G#3 B3 G#3 G#3 B3 D#3 G#3 G#3 G#3 B3 G#3 G#3 B3 D#3 ' +
        'G#3 G#3 G#3 B3 G#3 G#3 B3 D#3 G#3 . B3 . G#3 . D#3 . ' +
        'G#3 G#3 G#3 B3 G#3 G#3 B3 D#3 G#3 G#3 G#3 B3 G#3 G#3 B3 D#3 ' +
        'G#3 G#3 G#3 B3 G#3 G#3 B3 D#3 G#3 . B3 . G#3 . D#3 . ' +
        'G#3 G#3 G#3 B3 G#3 G#3 B3 D#3 G#3 G#3 G#3 B3 G#3 G#3 B3 D#3 ' +
        'G#3 G#3 G#3 B3 G#3 G#3 B3 D#3 G#3 . B3 . G#3 . D#3 . ' +
        'G#3 G#3 G#3 B3 G#3 G#3 B3 D#3 G#3 G#3 G#3 B3 G#3 G#3 B3 D#3 ' +
        'G#3 G#3 G#3 B3 G#3 G#3 B3 D#3 G#3 . B3 . G#3 . D#3 . ' +
        'G#3 G#3 G#3 B3 G#3 G#3 B3 D#3').split(/\s+/),
      bass: (
        'G#1 . . . . . . . G#1 . . . . . . . ' +
        'G#1 . . . . . . . G#1 . . . . . . . ' +
        'G#1 . . . . . . . G#1 . . . . . . . ' +
        'G#1 . . . . . . . G#1 . . . . . . . ' +
        'G#1 . . . . . . . G#1 . . . . . . . ' +
        'F1 . G#1 . . . . . G#1 . . . . . . . ' +
        'G#1 . . . . . . . G#1 . . . . . . . ' +
        'G#1 . . . . . . . G#1 . . . . . . . ' +
        'G#1 . . . . . . .').split(/\s+/)
    },
    title: {
      tempo: 0.15,
      lead: ('E5 . G5 . B5 . A5 G5 E5 . D5 . E5 . . . ' +
             'C5 . E5 . G5 . A5 B5 C6 . B5 . G5 . . .').split(/\s+/),
      bass: ('A2 . A2 . E2 . E2 . F2 . F2 . G2 . G2 . ' +
             'A2 . A2 . E2 . E2 . F2 . G2 . A2 . . .').split(/\s+/),
      leadType: 'square', bassType: 'triangle'
    },
    leg1: {
      tempo: 0.125,
      lead: ('A4 C5 E5 A5 G5 E5 C5 E5 F5 A5 C6 A5 G5 E5 D5 C5 ' +
             'A4 C5 E5 A5 G5 E5 C5 E5 D5 F5 A5 F5 E5 C5 B4 A4').split(/\s+/),
      bass: ('A2 . A2 A2 . A2 . . F2 . F2 F2 . F2 . . ' +
             'C3 . C3 C3 . C3 . . G2 . G2 G2 . G2 . .').split(/\s+/),
      leadType: 'square', bassType: 'triangle'
    },
    leg2: {
      tempo: 0.115,
      lead: ('D5 . F5 . A5 . F5 . E5 . G5 . B5 . G5 . ' +
             'C5 . E5 . G5 . E5 . D5 . F5 . A5 . A#5 .').split(/\s+/),
      bass: ('D2 D2 . D2 A2 . D2 . E2 E2 . E2 B2 . E2 . ' +
             'C2 C2 . C2 G2 . C2 . D2 D2 . A2 . D2 . .').split(/\s+/),
      leadType: 'pulse', bassType: 'sawtooth'
    },
    boss: {
      tempo: 0.105,
      lead: ('C4 . C4 D#4 . C4 . F#4 F4 . C4 . C4 D#4 . F4 ' +
             'C4 . C4 D#4 . C4 . A#4 A4 . G#4 . G4 . F#4 .').split(/\s+/),
      bass: ('C2 C2 C2 C2 C2 C2 C2 C2 C2 C2 C2 C2 D#2 D#2 D#2 D#2 ' +
             'C2 C2 C2 C2 C2 C2 C2 C2 F#2 F#2 F#2 F#2 G2 G2 G2 G2').split(/\s+/),
      leadType: 'sawtooth', bassType: 'square'
    },
    victory: {
      tempo: 0.17, once: true,
      lead: ('C5 E5 G5 C6 . G5 C6 E6 . D6 C6 . G5 E5 C5 . ' +
             'F5 A5 C6 F6 . E6 D6 C6 . G5 C6 E6 G6 . . .').split(/\s+/),
      bass: ('C3 . G2 . C3 . E3 . F3 . C3 . G2 . C3 . ' +
             'F3 . C3 . F3 . A2 . G3 . C3 . C3 . . .').split(/\s+/),
      leadType: 'square', bassType: 'triangle'
    }
  };

  function scheduleStep(i, at) {
    var t = track;
    if (!t) return;
    var ln = t.lead[i % t.lead.length], bn = t.bass[i % t.bass.length];
    var lf = hz(ln), bf = hz(bn);
    if (lf) {
      voice({ freq: lf, dur: t.tempo * 0.9, type: t.leadType === 'pulse' ? 'square' : t.leadType, vol: 0.3, at: at, bus: musicGain });
      if (t.leadType === 'pulse') {
        voice({ freq: lf * 1.005, dur: t.tempo * 0.9, type: 'square', vol: 0.16, at: at, bus: musicGain });
      }
    }
    if (bf) {
      voice({ freq: bf, dur: t.tempo * 1.05, type: t.bassType, vol: 0.34, at: at, bus: musicGain });
    }
    // hi-hat pulse on the off-beats keeps the groove moving
    if (i % 2 === 1) noise({ freq: 5200, dur: 0.03, vol: 0.05, filter: 'highpass', at: at, bus: musicGain });
  }

  function tick() {
    if (!ctx || !track) return;
    while (nextTime < ctx.currentTime + 0.2) {
      if (track.once && step >= track.lead.length) { stopMusic(); return; }
      scheduleStep(step, nextTime);
      nextTime += track.tempo;
      step++;
    }
  }

  /** Register a Phaser Sound to use wherever the 'anthem' track is asked for. */
  function attachAnthem(sound) { anthem = sound; return !!sound; }

  function playMusic(name) {
    if (name === 'anthem') {
      if (anthem) {
        stopMusic();
        if (muted) return;                 // stays silent until unmuted
        if (anthem.isPaused) anthem.resume();
        else if (!anthem.isPlaying) anthem.play();
        return;
      }
      name = 'leg1';                  // no recording available - synth instead
    }
    if (!ensure()) return;
    if (track === TRACKS[name] && timer) return;
    stopMusic();
    track = TRACKS[name];
    if (!track) return;
    step = 0;
    nextTime = ctx.currentTime + 0.05;
    timer = setInterval(tick, 40);
    tick();
  }

  function stopMusic() {
    if (timer) { clearInterval(timer); timer = null; }
    track = null;
    if (anthem && anthem.isPlaying) anthem.stop();
  }

  function setMuted(v) {
    muted = v;
    if (master) master.gain.value = v ? 0 : 0.5;
    // NB: this Phaser build ignores per-sound setMute/setVolume on the anthem
    // (both setters exist and silently do nothing), so mute it by pausing.
    if (anthem) {
      if (v && anthem.isPlaying) anthem.pause();
      else if (!v && anthem.isPaused) anthem.resume();
    }
    return muted;
  }
  function toggleMute() { return setMuted(!muted); }
  function isMuted() { return muted; }

  return {
    play: play, playMusic: playMusic, stopMusic: stopMusic,
    attachAnthem: attachAnthem,
    toggleMute: toggleMute, setMuted: setMuted, isMuted: isMuted,
    unlock: ensure
  };
})();
