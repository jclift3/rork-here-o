# Superhero-style variations on candidate C (rising chime). Writes mp3s next to this file.
import numpy as np, subprocess, os, wave
SR = 44100
OUT = os.path.dirname(os.path.abspath(__file__))
G5 = 783.99

def brass(f, dur, bright=1.0, vib=True, swell=0.04):
    t = np.arange(int(SR * dur)) / SR
    env = np.minimum(1, t / swell) * np.minimum(1, (dur - t) / 0.07)
    vibr = 1 + (0.006 * np.sin(2 * np.pi * 5.5 * t) * np.clip((t - 0.15) / 0.2, 0, 1) if vib else 0)
    phase = 2 * np.pi * f * np.cumsum(vibr) / SR
    out = np.zeros_like(t)
    for h in range(1, 16):
        if f * h > 12000: break
        w = (1 / h) * np.exp(-h / (2 + 7 * bright * env))   # brighter as the note swells, like a horn
        out += w * (np.sin(h * phase) + 0.5 * np.sin(h * phase * 1.003))  # slight detune = section of horns
    return out * env

def chord(f, dur, ratios=(1,), **k):
    return sum(brass(f * r, dur, **k) * (1 if r == 1 else 0.6) for r in ratios)

def seq(notes):  # notes: (freq or None, dur, ratios)
    parts = []
    for f, d, *r in notes:
        parts.append(np.zeros(int(SR * d)) if f is None else chord(f, d, *(r or [(1,)])))
    return np.concatenate(parts)

def room(x):  # light hall so it feels cinematic but stays clear
    y = x.copy()
    for d, g in ((0.031, 0.25), (0.047, 0.2), (0.071, 0.15), (0.113, 0.1)):
        n = int(SR * d); y[n:] += g * x[:-n]
    return y

def loop(motif, gap, total=8.0):
    one = np.concatenate([motif, np.zeros(int(SR * gap))])
    return np.tile(one, int(np.ceil(total * SR / len(one))))[: int(total * SR)]

def save(name, x):
    x = room(x); x = np.tanh(2.6 * x / np.max(np.abs(x))); x = 0.97 * x / np.max(np.abs(x))
    wav = os.path.join(OUT, name + '.wav')
    with wave.open(wav, 'w') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((x * 32767).astype('<i2').tobytes())
    subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', wav, '-b:a', '192k', wav[:-4] + '.mp3'], check=True)
    os.remove(wav)

R, M3, P5, O = 1, 5/4, 3/2, 2
OCT = (1, 2)            # doubled at the octave
POW = (1, 1.5, 2)       # power chord: root, fifth, octave
g = 2 * G5              # the original C's register (G6)

variants = {
 # 1: the same four notes as C, voiced as bright horns
 'C1-horns':        (seq([(g, .11), (g*M3, .11), (g*P5, .11), (g*O, .5)]), .3),
 # 2: the classic hero leap, root, fifth, octave with a dotted pickup
 'C2-hero-leap':    (seq([(G5, .14, OCT), (G5*P5, .07, OCT), (G5*O, .6, OCT)]), .35),
 # 3: fanfare, triplet pickup then a jump up to the octave and the third above
 'C3-fanfare':      (seq([(G5*P5, .09, OCT), (None, .02), (G5*P5, .09, OCT), (None, .02), (G5*P5, .09, OCT),
                          (G5*O, .3, OCT), (G5*O*M3, .5, OCT)]), .35),
 # 4: C's climb in power chords, an octave lower so it sounds bigger
 'C4-power-rise':   (seq([(G5, .12, POW), (G5*M3, .12, POW), (G5*P5, .12, POW), (G5*O, .6, POW)]), .3),
 # 5: soaring, C's climb then lifts past the octave and holds with vibrato
 'C5-soar':         (seq([(g/2, .1, OCT), (g/2*M3, .1, OCT), (g/2*P5, .1, OCT), (g, .12, OCT), (g*M3, .75, OCT)]), .3),
 # 6: urgent hero, two fast climbs then the octave, more alarm-like
 'C6-urgent-hero':  (seq([(g, .07), (g*M3, .07), (g*P5, .07), (None, .06), (g, .07), (g*M3, .07), (g*P5, .07),
                          (g*O, .45, (1, .5))]), .18),
}
for name, (motif, gap) in variants.items():
    save(name, loop(motif, gap))
print('done')
