"""FC8Bit Super Y4M4L - MIDI -> chiptune track.

Converts a .mid into the note arrays that src/audio.js plays, so a song can
ship as source data instead of an audio file. Unlike the anthem (which was only
available as a recording and transcribed badly), a MIDI carries exact pitches
and timings, so the 8-bit rendition is faithful by construction.

Usage:
    python tools/midi_to_track.py <file.mid> [--seconds 30] [--start 0]
"""

import sys
import struct


# ------------------------------------------------------------------ parsing
def read_vlq(data, i):
    """MIDI variable-length quantity."""
    v = 0
    while True:
        b = data[i]
        i += 1
        v = (v << 7) | (b & 0x7F)
        if not (b & 0x80):
            return v, i


def parse(path):
    """Return (notes, ticks_per_beat, tempo_map).

    notes: list of dicts with track, channel, pitch, velocity, start/end ticks.
    """
    data = open(path, 'rb').read()
    assert data[:4] == b'MThd', 'not a MIDI file'
    hdr_len = struct.unpack('>I', data[4:8])[0]
    fmt, ntrk, div = struct.unpack('>HHH', data[8:8 + 6])
    i = 8 + hdr_len

    notes = []
    tempos = []                                  # (tick, microseconds/beat)
    for tno in range(ntrk):
        if data[i:i + 4] != b'MTrk':
            break
        tlen = struct.unpack('>I', data[i + 4:i + 8])[0]
        j = i + 8
        end = j + tlen
        tick = 0
        status = None
        pending = {}                             # (chan,pitch) -> (tick, vel)
        while j < end:
            dt, j = read_vlq(data, j)
            tick += dt
            b = data[j]
            if b & 0x80:
                status = b
                j += 1
            ev = status & 0xF0
            chan = status & 0x0F

            if ev in (0x80, 0x90):
                pitch = data[j]; vel = data[j + 1]; j += 2
                if ev == 0x90 and vel > 0:
                    pending[(chan, pitch)] = (tick, vel)
                else:
                    k = pending.pop((chan, pitch), None)
                    if k:
                        notes.append({'track': tno, 'chan': chan, 'pitch': pitch,
                                      'vel': k[1], 'start': k[0], 'end': tick})
            elif ev in (0xA0, 0xB0, 0xE0):
                j += 2
            elif ev in (0xC0, 0xD0):
                j += 1
            elif status == 0xFF:
                meta = data[j]; j += 1
                ln, j = read_vlq(data, j)
                if meta == 0x51 and ln == 3:
                    tempos.append((tick, (data[j] << 16) | (data[j + 1] << 8) | data[j + 2]))
                j += ln
            elif status in (0xF0, 0xF7):
                ln, j = read_vlq(data, j)
                j += ln
            else:
                j += 1
        i = end

    if not tempos:
        tempos = [(0, 500000)]
    tempos.sort()
    return notes, div, tempos


def tick_to_sec(tick, div, tempos):
    sec = 0.0
    last_tick = 0
    us = tempos[0][1]
    for t, u in tempos:
        if t >= tick:
            break
        sec += (t - last_tick) / div * (us / 1e6)
        last_tick = t
        us = u
    sec += (tick - last_tick) / div * (us / 1e6)
    return sec


# ------------------------------------------------------------------ report
def summarise(path):
    notes, div, tempos = parse(path)
    print('%s: %d notes, %d ticks/beat, %d tempo change(s)' % (path.split('\\')[-1], len(notes), div, len(tempos)))
    print('tempo: %.1f BPM' % (60e6 / tempos[0][1]))
    for n in notes:
        n['t0'] = tick_to_sec(n['start'], div, tempos)
        n['t1'] = tick_to_sec(n['end'], div, tempos)
    dur = max(n['t1'] for n in notes)
    print('duration %.1fs' % dur)
    by = {}
    for n in notes:
        by.setdefault((n['track'], n['chan']), []).append(n)
    print('\n track/chan   notes   pitch range   median   first note')
    for k in sorted(by):
        g = by[k]
        ps = sorted(x['pitch'] for x in g)
        print('   %2d/%-2d     %5d   %3d..%-3d      %3d      %.2fs'
              % (k[0], k[1], len(g), ps[0], ps[-1], ps[len(ps) // 2], min(x['t0'] for x in g)))
    return notes, div, tempos


if __name__ == '__main__':
    summarise(sys.argv[1])
