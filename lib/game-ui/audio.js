function createNoiseBuffer(context, durationSeconds) {
  const buffer = context.createBuffer(
    1,
    Math.max(1, Math.floor(context.sampleRate * durationSeconds)),
    context.sampleRate
  );
  const channel = buffer.getChannelData(0);
  for (let index = 0; index < channel.length; index += 1) {
    channel[index] = Math.random() * 2 - 1;
  }
  return buffer;
}

function makeTone(context, {
  frequency = 440,
  type = "triangle",
  gain = 0.05,
  duration = 0.18,
  attack = 0.01,
  release = 0.12,
  slideTo = null,
  when = context.currentTime
}) {
  const oscillator = context.createOscillator();
  const gainNode = context.createGain();

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, when);
  if (slideTo) {
    oscillator.frequency.exponentialRampToValueAtTime(slideTo, when + duration);
  }

  gainNode.gain.setValueAtTime(0.0001, when);
  gainNode.gain.exponentialRampToValueAtTime(gain, when + attack);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, when + release + duration);

  oscillator.connect(gainNode);
  gainNode.connect(context.destination);
  oscillator.start(when);
  oscillator.stop(when + duration + release + 0.04);
}

function makeNoise(context, {
  duration = 0.12,
  gain = 0.025,
  highpass = 900,
  lowpass = 3000,
  when = context.currentTime
}) {
  const source = context.createBufferSource();
  const gainNode = context.createGain();
  const highFilter = context.createBiquadFilter();
  const lowFilter = context.createBiquadFilter();

  source.buffer = createNoiseBuffer(context, duration);
  highFilter.type = "highpass";
  highFilter.frequency.value = highpass;
  lowFilter.type = "lowpass";
  lowFilter.frequency.value = lowpass;

  gainNode.gain.setValueAtTime(gain, when);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, when + duration);

  source.connect(highFilter);
  highFilter.connect(lowFilter);
  lowFilter.connect(gainNode);
  gainNode.connect(context.destination);
  source.start(when);
  source.stop(when + duration + 0.02);
}

export function createGameAudio() {
  let context = null;

  function ensureContext() {
    if (typeof window === "undefined") {
      return null;
    }

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      return null;
    }

    if (!context) {
      context = new AudioContextClass();
    }

    if (context.state === "suspended") {
      context.resume().catch(() => null);
    }

    return context;
  }

  return {
    unlock() {
      ensureContext();
    },
    select() {
      const ctx = ensureContext();
      if (!ctx) {
        return;
      }
      makeTone(ctx, {
        frequency: 520,
        type: "triangle",
        gain: 0.024,
        duration: 0.08,
        release: 0.06,
        slideTo: 650
      });
    },
    deal() {
      const ctx = ensureContext();
      if (!ctx) {
        return;
      }
      makeNoise(ctx, { gain: 0.018, duration: 0.08, highpass: 1200, lowpass: 4200 });
      makeTone(ctx, {
        frequency: 220,
        type: "sine",
        gain: 0.015,
        duration: 0.1,
        release: 0.08,
        slideTo: 180
      });
    },
    play() {
      const ctx = ensureContext();
      if (!ctx) {
        return;
      }
      makeNoise(ctx, { gain: 0.03, duration: 0.14, highpass: 500, lowpass: 2400 });
      makeTone(ctx, {
        frequency: 300,
        type: "square",
        gain: 0.03,
        duration: 0.12,
        slideTo: 510
      });
      makeTone(ctx, {
        frequency: 610,
        type: "triangle",
        gain: 0.022,
        duration: 0.09,
        when: ctx.currentTime + 0.05,
        slideTo: 710
      });
    },
    pass() {
      const ctx = ensureContext();
      if (!ctx) {
        return;
      }
      makeTone(ctx, {
        frequency: 250,
        type: "sine",
        gain: 0.02,
        duration: 0.08,
        slideTo: 190
      });
    },
    bid(value) {
      const ctx = ensureContext();
      if (!ctx) {
        return;
      }
      const base = 300 + value * 120;
      makeTone(ctx, {
        frequency: base,
        type: "triangle",
        gain: 0.03,
        duration: 0.1,
        slideTo: base + 80
      });
      makeTone(ctx, {
        frequency: base + 90,
        type: "sine",
        gain: 0.018,
        duration: 0.12,
        when: ctx.currentTime + 0.05,
        slideTo: base + 130
      });
    },
    turn() {
      const ctx = ensureContext();
      if (!ctx) {
        return;
      }
      makeTone(ctx, {
        frequency: 420,
        type: "triangle",
        gain: 0.025,
        duration: 0.12,
        slideTo: 560
      });
      makeTone(ctx, {
        frequency: 660,
        type: "triangle",
        gain: 0.016,
        duration: 0.09,
        when: ctx.currentTime + 0.08,
        slideTo: 720
      });
    },
    win() {
      const ctx = ensureContext();
      if (!ctx) {
        return;
      }
      const notes = [440, 554, 660, 880];
      notes.forEach((note, index) => {
        makeTone(ctx, {
          frequency: note,
          type: "triangle",
          gain: 0.03,
          duration: 0.18,
          when: ctx.currentTime + index * 0.09,
          slideTo: note * 1.02
        });
      });
    },
    lose() {
      const ctx = ensureContext();
      if (!ctx) {
        return;
      }
      [392, 294, 196].forEach((note, index) => {
        makeTone(ctx, {
          frequency: note,
          type: "sawtooth",
          gain: 0.022,
          duration: 0.16,
          when: ctx.currentTime + index * 0.08,
          slideTo: note * 0.92
        });
      });
    }
  };
}
