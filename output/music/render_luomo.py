"""Render the original Wenxinqi composition using only Python's standard library.

This is a synthesized arrangement sketch, not a recording of acoustic instruments.
Usage: python output/music/render_luomo.py
"""
import array
import json
import math
from pathlib import Path
import wave

OUT = Path(__file__).resolve().parent
SR = 22050
BPM = 66
BEAT = 60 / BPM
BARS = 32
FRAMES = round(BARS * 4 * BEAT * SR)
TAU = math.tau

# Pitch name and duration in quarter-note beats; '-' is a composed breath.
PHRASE = [
    [('E4', 1), ('G4', .5), ('A4', .5), ('G4', 1), ('-', 1)],
    [('D4', 1), ('E4', 1), ('C4', 1.5), ('-', .5)],
    [('E4', 1.5), ('G4', .5), ('D4', 1), ('-', 1)],
    [('A3', 1), ('C4', 1), ('D4', 1), ('-', 1)],
    [('G4', 1), ('A4', 1), ('C5', 1), ('-', 1)],
    [('A4', 1.5), ('G4', .5), ('E4', 1), ('-', 1)],
    [('D4', 1), ('E4', .5), ('G4', .5), ('D4', 1), ('-', 1)],
    [('E4', 1), ('D4', 1), ('C4', 1), ('-', 1)],
]
ROOTS = ['C3', 'C3', 'G2', 'A2', 'C3', 'A2', 'G2', 'C3']
SEMITONES = {'C': 0, 'D': 2, 'E': 4, 'G': 7, 'A': 9}


def frequency(note):
    midi = (int(note[-1]) + 1) * 12 + SEMITONES[note[0]]
    return 440 * 2 ** ((midi - 69) / 12)


def build_score():
    events = []

    def add(voice, note, beat, duration, level, pan):
        if note != '-':
            events.append(dict(voice=voice, note=note, beat=beat,
                               duration=duration, level=level, pan=pan))

    for bar in range(BARS):
        # Opening 4 bars, theme 8, breath 4, development 8, return 8.
        section = ('opening' if bar < 4 else 'theme' if bar < 12 else
                   'breath' if bar < 16 else 'development' if bar < 24 else 'return')
        root = ROOTS[bar % 8]
        add('qin', root, bar * 4, 3.6, .18, -.25)
        if bar % 2 == 0:
            add('qin', root[0] + str(int(root[-1]) + 1), bar * 4 + 2.5, 2, .09, .25)
        if section == 'development':
            add('qin', ['E4', 'D4', 'G3', 'C4'][bar % 4], bar * 4 + 1.5, 1.8, .07, -.15)
        if section in ('theme', 'development', 'return'):
            idx = (bar - 4) % 8 if section == 'theme' else bar % 8
            beat = bar * 4
            for note, duration in PHRASE[idx]:
                # Return: replace two answers with qin to reduce repeated flute exposure.
                voice = 'qin' if section == 'return' and idx in (1, 3) else 'xiao'
                add(voice, note, beat, duration * .86, .13 if voice == 'xiao' else .12, .12)
                beat += duration
        elif bar in (2, 14):
            add('qin', 'E4', bar * 4 + 1, 2, .1, -.15)
            add('qin', 'G4', bar * 4 + 2.5, 1.5, .07, .15)
        if bar in (0, 16):
            add('bell', 'C5', bar * 4, 3, .035, .35)
    return events


def render(events):
    left = array.array('f', [0]) * FRAMES
    right = array.array('f', [0]) * FRAMES
    for event in events:
        freq = frequency(event['note'])
        duration = event['duration'] * BEAT
        start = round(event['beat'] * BEAT * SR)
        pan = event['pan']
        lg, rg = math.sqrt((1 - pan) / 2), math.sqrt((1 + pan) / 2)
        voice = event['voice']
        length = duration + (1.2 if voice == 'qin' else .3)
        for i in range(round(length * SR)):
            t = i / SR
            if voice == 'qin':
                # Bright attack, quickly softening partials, long wooden body.
                env = (1 - math.exp(-t / .006)) * math.exp(-t / .75)
                s = sum(a * math.exp(-t * k * .38) * math.sin(TAU * freq * k * t)
                        for k, a in ((1, 1), (2, .38), (3, .17), (4, .08)))
            elif voice == 'xiao':
                env = min(1, t / .12) * min(1, max(0, (length - t) / .28))
                env *= .88 + .12 * math.sin(math.pi * min(1, t / length))
                phase = TAU * freq * t + .10 * min(1, t / .35) * math.sin(TAU * 4.6 * t)
                s = math.sin(phase) + .12 * math.sin(2 * phase) + .035 * math.sin(3 * phase)
            else:
                env = min(1, t / .007) * math.exp(-t / .85)
                s = math.sin(TAU * freq * t) + .15 * math.sin(TAU * freq * 2.76 * t) * math.exp(-t * 3)
            # Gentle end taper prevents hard truncation in every voice.
            env *= min(1, max(0, (length - t) / .06))
            value = s * env * event['level']
            pos = (start + i) % FRAMES
            left[pos] += value * lg
            right[pos] += value * rg
    # Circular short reflections preserve loop tails without a silent gap.
    dry_l, dry_r = left[:], right[:]
    for delay, gain in ((.079, .12), (.149, .08), (.263, .045)):
        shift = round(delay * SR)
        for i in range(FRAMES):
            j = (i - shift) % FRAMES
            left[i] += dry_r[j] * gain
            right[i] += dry_l[j] * gain
    peak = max(max(map(abs, left)), max(map(abs, right)))
    scale = .70 / peak
    pcm = array.array('h')
    sum_sq = 0
    for l, r in zip(left, right):
        for v in (l * scale, r * scale):
            sum_sq += v * v
            pcm.append(round(v * 32767))
    import sys
    if sys.byteorder != 'little':
        pcm.byteswap()
    target = OUT / '落墨听花-背景音乐小样.wav'
    with wave.open(str(target), 'wb') as wav:
        wav.setnchannels(2)
        wav.setsampwidth(2)
        wav.setframerate(SR)
        wav.writeframes(pcm.tobytes())
    report = dict(file=target.name, bpm=BPM, bars=BARS, seconds=FRAMES / SR,
                  sample_rate=SR, channels=2, peak_dbfs=20 * math.log10(.70),
                  rms_dbfs=20 * math.log10(math.sqrt(sum_sq / (FRAMES * 2))),
                  boundary_jump=max(abs(left[0] - left[-1]), abs(right[0] - right[-1])) * scale,
                  events=len(events), clipping_samples=sum(abs(v) >= 32767 for v in pcm))
    (OUT / 'validation.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    assert all(sum(n[1] for n in bar) == 4 for bar in PHRASE)
    score = build_score()
    (OUT / 'score.json').write_text(json.dumps(dict(title='落墨听花', bpm=BPM, bars=BARS,
        meter='4/4', scale='C D E G A', events=score), ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    render(score)
