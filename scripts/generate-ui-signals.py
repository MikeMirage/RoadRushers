"""Original, deterministic interface and race-start signals. No third-party recordings."""
import math
from pathlib import Path
import struct
import wave

RATE = 44100
ROOT = Path(__file__).resolve().parents[1] / 'public/audio/magnific-v2'

def tone(hz, duration, horn=False):
    result = []
    for i in range(round(RATE * duration)):
        t = i / RATE
        attack = min(1, t / .004)
        release = min(1, (duration - t) / (.025 if horn else .035))
        envelope = attack * release
        phase = 2 * math.pi * hz * t
        if horn:
            signal = (math.sin(phase) + .28 * math.sin(3 * phase) + .10 * math.sin(5 * phase)) / 1.38
        else:
            signal = math.sin(phase) * math.exp(-t * 15)
        result.append(.6 * envelope * signal)
    return result

def write(name, samples):
    with wave.open(str(ROOT / f'{name}.wav'), 'wb') as audio:
        audio.setparams((1, 2, RATE, 0, 'NONE', 'not compressed'))
        audio.writeframes(b''.join(struct.pack('<h', round(v * 32767)) for v in samples))

ROOT.mkdir(parents=True, exist_ok=True)
write('ui-confirm-r3', tone(1320, .10))
write('ui-back-r3', tone(660, .10))
tick = tone(440, .22, True)
go = tone(880, .42, True)
write('race-countdown-tick', tick)
write('race-start', go)
preview = [0.] * (RATE * 4)
for second, sound in [(0, tick), (1, tick), (2, tick), (3, go)]:
    preview[second * RATE:second * RATE + len(sound)] = sound
write('race-countdown-preview', preview)
