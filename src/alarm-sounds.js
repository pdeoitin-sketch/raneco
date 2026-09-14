/**
 * Alarm sounds — sixteen of them, and none is a single "ting".
 *
 * The old timer played one 0.4-second sine wave and stopped. If you had
 * stepped away from the desk, which is the entire reason you set a timer, you
 * missed it. So this module replaces that with:
 *
 *   • a catalogue of **16 sounds** across the whole range of moods — soft and
 *     sweet, melodious, modular, meticulous, simple, sharp, hard, loud, rock
 *     band, guitar, ringtone and a full fanfare,
 *   • a player that **keeps going** (a chosen number of seconds, or until you
 *     dismiss it) instead of firing once,
 *   • **your own music**: a file from the device, a direct audio URL, or a
 *     YouTube / YouTube Music / Spotify link.
 *
 * Everything here is synthesised with the Web Audio API at play time. That is
 * a deliberate choice for a static site: there are no audio files to download,
 * nothing to license, the whole catalogue costs zero bytes of bandwidth, it
 * works offline, and every sound can loop for as long as it needs to.
 *
 * Nothing in here throws. A browser with no audio (or a blocked AudioContext)
 * simply gets silence, and the timer still shows its toast and notification.
 */

/* ------------------------------------------------------------------ notes */

const SEMITONES = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/**
 * "A4" -> 440, "C#5" -> 554.37, "Eb3" -> 155.56.
 * Scientific pitch notation, because a chord written as
 * `["E4", "G#4", "B4"]` can be read by a human reviewer and `[329.63, …]`
 * cannot.
 */
export function noteFreq(note) {
  const match = /^([A-Ga-g])([#b]?)(-?\d)$/.exec(String(note).trim());
  if (!match) return Number(note) || 0;
  const [, letter, accidental, octave] = match;
  const base = SEMITONES[letter.toUpperCase()];
  const shift = accidental === "#" ? 1 : accidental === "b" ? -1 : 0;
  // MIDI note 69 is A4 = 440 Hz.
  const midi = (Number(octave) + 1) * 12 + base + shift;
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/* ------------------------------------------------------------- primitives */

/** One second of white noise, made once per context and reused. */
const noiseCache = new WeakMap();
function noiseBuffer(ctx) {
  if (noiseCache.has(ctx)) return noiseCache.get(ctx);
  const rate = ctx.sampleRate || 44100;
  const buffer = ctx.createBuffer(1, Math.floor(rate), rate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
  noiseCache.set(ctx, buffer);
  return buffer;
}

/**
 * A single shaped note.
 *
 * `peak` is relative (the master gain owns the real volume), and the envelope
 * is always attack → hold → exponential release, because an abrupt stop on a
 * raw oscillator is the click everyone hears and nobody can name.
 */
function tone(ctx, out, options = {}) {
  const {
    at = 0,
    freq = 440,
    dur = 0.3,
    type = "sine",
    peak = 0.3,
    attack = 0.006,
    hold = 0,
    detune = 0,
    glideTo = null,
    filter = null,
    filterFreq = 2000,
    filterQ = 1,
  } = options;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(Math.max(1, freq), at);
  if (detune && osc.detune) osc.detune.setValueAtTime(detune, at);
  if (glideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, glideTo), at + dur);

  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), at + attack);
  if (hold > 0) gain.gain.setValueAtTime(Math.max(0.0002, peak), at + attack + hold);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + attack + hold + dur);

  let node = gain;
  if (filter) {
    const biquad = ctx.createBiquadFilter();
    biquad.type = filter;
    biquad.frequency.setValueAtTime(filterFreq, at);
    if (biquad.Q) biquad.Q.setValueAtTime(filterQ, at);
    gain.connect(biquad);
    node = biquad;
  }
  osc.connect(gain);
  node.connect(out);
  osc.start(at);
  osc.stop(at + attack + hold + dur + 0.05);
  return at + attack + hold + dur;
}

/** A burst of filtered noise: drum skins, cymbals, plucked-string attacks. */
function noise(ctx, out, options = {}) {
  const { at = 0, dur = 0.2, peak = 0.3, filter = "highpass", freq = 1200, q = 1 } = options;
  const source = ctx.createBufferSource();
  source.buffer = noiseBuffer(ctx);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(Math.max(0.0002, peak), at);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);

  const biquad = ctx.createBiquadFilter();
  biquad.type = filter;
  biquad.frequency.setValueAtTime(freq, at);
  if (biquad.Q) biquad.Q.setValueAtTime(q, at);

  source.connect(biquad).connect(gain).connect(out);
  source.start(at);
  source.stop(at + dur + 0.05);
  return at + dur;
}

/** Several detuned copies of one note — how a thin saw becomes a big one. */
function stack(ctx, out, options = {}) {
  const { voices = 3, spread = 7, peak = 0.2, ...rest } = options;
  for (let i = 0; i < voices; i += 1) {
    const offset = voices === 1 ? 0 : (i / (voices - 1) - 0.5) * 2 * spread;
    tone(ctx, out, { ...rest, detune: offset, peak: peak / Math.sqrt(voices) });
  }
}

/** A plucked string: noise transient, then a decaying filtered saw. */
function pluck(ctx, out, { at = 0, freq = 220, dur = 0.9, peak = 0.24 } = {}) {
  noise(ctx, out, { at, dur: 0.02, peak: peak * 0.5, filter: "bandpass", freq: freq * 4, q: 2 });
  tone(ctx, out, {
    at,
    freq,
    dur,
    type: "sawtooth",
    peak,
    attack: 0.004,
    filter: "lowpass",
    filterFreq: Math.min(6000, freq * 9),
    filterQ: 0.8,
  });
  tone(ctx, out, { at, freq: freq * 2, dur: dur * 0.45, type: "sine", peak: peak * 0.3, attack: 0.004 });
  return at + dur;
}

/** A kick drum: a pitch drop into the floor. */
function kick(ctx, out, { at = 0, peak = 0.5 } = {}) {
  tone(ctx, out, { at, freq: 150, glideTo: 45, dur: 0.32, type: "sine", peak, attack: 0.002 });
  noise(ctx, out, { at, dur: 0.03, peak: peak * 0.35, filter: "lowpass", freq: 800 });
  return at + 0.32;
}

/** A snare: a tuned thud with a spray of noise on top. */
function snare(ctx, out, { at = 0, peak = 0.4 } = {}) {
  noise(ctx, out, { at, dur: 0.18, peak, filter: "highpass", freq: 1400 });
  tone(ctx, out, { at, freq: 190, dur: 0.12, type: "triangle", peak: peak * 0.5, attack: 0.002 });
  return at + 0.18;
}

/** Hi-hat: a short, bright tick. */
function hat(ctx, out, { at = 0, peak = 0.16, dur = 0.05 } = {}) {
  return noise(ctx, out, { at, dur, peak, filter: "highpass", freq: 7000 });
}

/** A chord — every note struck together. */
function chord(ctx, out, notes, options = {}) {
  for (const note of notes) tone(ctx, out, { ...options, freq: noteFreq(note) });
}

/** A melody: notes played in sequence at a fixed step. */
function melody(ctx, out, notes, { at = 0, step = 0.16, render } = {}) {
  notes.forEach((note, index) => {
    if (note === null) return;
    render(at + index * step, noteFreq(note), index);
  });
  return at + notes.length * step;
}

/* -------------------------------------------------------------- catalogue */

/**
 * The moods, in the order the picker shows them. Every sound belongs to one,
 * so "I want something soft" and "I want something that will wake the street"
 * are both one click away.
 */
export const SOUND_MOODS = [
  { id: "simple", label: "Simple" },
  { id: "soft", label: "Soft & sweet" },
  { id: "melodious", label: "Melodious" },
  { id: "modular", label: "Modular" },
  { id: "meticulous", label: "Meticulous" },
  { id: "ringtone", label: "Ringtone" },
  { id: "sharp", label: "Sharp & hard" },
  { id: "strong", label: "Loud & strong" },
  { id: "band", label: "Rock & band" },
  { id: "grand", label: "Perfection" },
];

/**
 * Every sound is `{ id, name, mood, note, loop, render }`.
 *
 * `render(ctx, out, at)` schedules exactly **one cycle** starting at `at`
 * (an AudioContext timestamp, in seconds) and `loop` is how long that cycle
 * lasts before the next one begins. The player repeats a cycle until the
 * alarm is dismissed or its duration runs out — that is what makes these
 * alarms rather than notification blips.
 */
export const ALARM_SOUNDS = [
  {
    id: "ting",
    name: "Classic ting",
    mood: "simple",
    note: "The original single chime, kept for anyone who liked it.",
    loop: 1.4,
    render(ctx, out, at) {
      tone(ctx, out, { at, freq: noteFreq("A5"), dur: 0.42, type: "sine", peak: 0.34 });
      tone(ctx, out, { at, freq: noteFreq("A6"), dur: 0.22, type: "sine", peak: 0.1 });
    },
  },
  {
    id: "soft-chime",
    name: "Soft chime",
    mood: "soft",
    note: "Three warm bells, one after another. Quiet enough for a shared room.",
    loop: 3.6,
    render(ctx, out, at) {
      ["F5", "A5", "C6"].forEach((note, index) => {
        tone(ctx, out, {
          at: at + index * 0.34,
          freq: noteFreq(note),
          dur: 1.6,
          type: "sine",
          peak: 0.22,
          attack: 0.04,
        });
      });
    },
  },
  {
    id: "zen-bowl",
    name: "Zen bowl",
    mood: "soft",
    note: "A singing bowl with a six-second tail. Ends a meditation without startling you.",
    loop: 7.5,
    render(ctx, out, at) {
      tone(ctx, out, { at, freq: 210, dur: 5.5, type: "sine", peak: 0.26, attack: 0.05 });
      tone(ctx, out, { at, freq: 211.7, dur: 5.2, type: "sine", peak: 0.2, attack: 0.06 });
      tone(ctx, out, { at, freq: 525, dur: 3.4, type: "sine", peak: 0.1, attack: 0.03 });
      tone(ctx, out, { at, freq: 842, dur: 1.9, type: "sine", peak: 0.05, attack: 0.02 });
    },
  },
  {
    id: "music-box",
    name: "Music box",
    mood: "melodious",
    note: "A wound-up lullaby. Sweet, and it keeps turning.",
    loop: 4.2,
    render(ctx, out, at) {
      const notes = ["E6", "G6", "B6", "G6", "E6", "B5", "E6", null];
      melody(ctx, out, notes, {
        at,
        step: 0.24,
        render: (time, freq) => {
          tone(ctx, out, { at: time, freq, dur: 0.9, type: "triangle", peak: 0.2, attack: 0.004 });
          tone(ctx, out, { at: time, freq: freq * 2.01, dur: 0.3, type: "sine", peak: 0.06 });
        },
      });
    },
  },
  {
    id: "harp-rise",
    name: "Harp rise",
    mood: "melodious",
    note: "An arpeggio that climbs and resolves. Melodious without being a song.",
    loop: 3.6,
    render(ctx, out, at) {
      const notes = ["C4", "E4", "G4", "C5", "E5", "G5", "C6"];
      melody(ctx, out, notes, {
        at,
        step: 0.13,
        render: (time, freq) =>
          tone(ctx, out, { at: time, freq, dur: 1.5, type: "triangle", peak: 0.17, attack: 0.012 }),
      });
      chord(ctx, out, ["C5", "E5", "G5"], { at: at + 1.15, dur: 1.6, type: "sine", peak: 0.1, attack: 0.05 });
    },
  },
  {
    id: "marimba",
    name: "Marimba run",
    mood: "modular",
    note: "A repeating wooden pattern that builds — modular, and impossible to ignore politely.",
    loop: 2.6,
    render(ctx, out, at) {
      const notes = ["D5", "A5", "F5", "D6", "A5", "F5", "D5", "A4"];
      melody(ctx, out, notes, {
        at,
        step: 0.15,
        render: (time, freq, index) =>
          tone(ctx, out, {
            at: time,
            freq,
            dur: 0.45,
            type: "triangle",
            peak: 0.16 + index * 0.012,
            filter: "lowpass",
            filterFreq: 3200,
          }),
      });
      tone(ctx, out, { at: at + 1.24, freq: noteFreq("D4"), dur: 0.8, type: "sine", peak: 0.14 });
    },
  },
  {
    id: "digital-pulse",
    name: "Digital pulse",
    mood: "meticulous",
    note: "Four precise blips on a grid. The sound of something that measures things.",
    loop: 1.9,
    render(ctx, out, at) {
      for (let i = 0; i < 4; i += 1) {
        tone(ctx, out, {
          at: at + i * 0.17,
          freq: noteFreq(i === 3 ? "E6" : "B5"),
          dur: 0.07,
          hold: 0.03,
          type: "square",
          peak: 0.16,
          attack: 0.002,
          filter: "lowpass",
          filterFreq: 4200,
        });
      }
    },
  },
  {
    id: "sonar",
    name: "Sonar ping",
    mood: "meticulous",
    note: "One clean ping into a long, cold room. Patient and exact.",
    loop: 3.2,
    render(ctx, out, at) {
      tone(ctx, out, { at, freq: 1320, glideTo: 1180, dur: 1.5, type: "sine", peak: 0.24, attack: 0.004 });
      tone(ctx, out, { at: at + 0.42, freq: 1320, dur: 1.1, type: "sine", peak: 0.09, attack: 0.004 });
      tone(ctx, out, { at: at + 0.82, freq: 1320, dur: 0.9, type: "sine", peak: 0.04, attack: 0.004 });
    },
  },
  {
    id: "classic-ring",
    name: "Classic ringtone",
    mood: "ringtone",
    note: "The two-tone warble every phone had before phones had screens.",
    loop: 4,
    render(ctx, out, at) {
      for (let burst = 0; burst < 2; burst += 1) {
        const start = at + burst * 1.1;
        for (let i = 0; i < 10; i += 1) {
          tone(ctx, out, {
            at: start + i * 0.085,
            freq: i % 2 === 0 ? 1000 : 800,
            dur: 0.05,
            hold: 0.028,
            type: "square",
            peak: 0.14,
            attack: 0.003,
            filter: "lowpass",
            filterFreq: 3000,
          });
        }
      }
    },
  },
  {
    id: "telephone-bell",
    name: "Old telephone bell",
    mood: "ringtone",
    note: "Two brass gongs hammered at twenty beats a second. Nineteen-fifties loud.",
    loop: 4,
    render(ctx, out, at) {
      for (let burst = 0; burst < 2; burst += 1) {
        const start = at + burst * 1.2;
        for (let i = 0; i < 22; i += 1) {
          const hit = start + i * 0.032;
          tone(ctx, out, { at: hit, freq: 1055, dur: 0.03, type: "triangle", peak: 0.15, attack: 0.002 });
          tone(ctx, out, { at: hit, freq: 1290, dur: 0.03, type: "triangle", peak: 0.12, attack: 0.002 });
        }
      }
    },
  },
  {
    id: "buzzer",
    name: "Alarm buzzer",
    mood: "sharp",
    note: "A hard, flat rasp in three bursts. Sharp on purpose.",
    loop: 2.2,
    render(ctx, out, at) {
      for (let burst = 0; burst < 3; burst += 1) {
        const start = at + burst * 0.52;
        stack(ctx, out, {
          at: start,
          freq: 233,
          dur: 0.06,
          hold: 0.3,
          type: "sawtooth",
          peak: 0.3,
          attack: 0.004,
          voices: 2,
          spread: 14,
          filter: "lowpass",
          filterFreq: 2600,
        });
      }
    },
  },
  {
    id: "siren",
    name: "Siren sweep",
    mood: "strong",
    note: "Rises and falls, twice. Loud and clear from the next room.",
    loop: 2.8,
    render(ctx, out, at) {
      for (let sweep = 0; sweep < 2; sweep += 1) {
        const start = at + sweep * 1.2;
        tone(ctx, out, {
          at: start,
          freq: 440,
          glideTo: 1180,
          dur: 0.55,
          type: "sawtooth",
          peak: 0.2,
          attack: 0.02,
          filter: "lowpass",
          filterFreq: 3400,
        });
        tone(ctx, out, {
          at: start + 0.56,
          freq: 1180,
          glideTo: 440,
          dur: 0.55,
          type: "sawtooth",
          peak: 0.2,
          attack: 0.02,
          filter: "lowpass",
          filterFreq: 3400,
        });
      }
    },
  },
  {
    id: "air-horn",
    name: "Air horn",
    mood: "strong",
    note: "A stadium blast. Use this one when the timer absolutely must win.",
    loop: 3.2,
    render(ctx, out, at) {
      for (let blast = 0; blast < 2; blast += 1) {
        const start = at + blast * 1.3;
        [1, 1.5, 2.02, 2.5].forEach((ratio, index) => {
          stack(ctx, out, {
            at: start,
            freq: 196 * ratio,
            dur: 0.22,
            hold: 0.6,
            type: "sawtooth",
            peak: 0.2 / (index + 1),
            attack: 0.03,
            voices: 3,
            spread: 9,
            filter: "lowpass",
            filterFreq: 3600,
          });
        });
      }
    },
  },
  {
    id: "rock-band",
    name: "Rock band",
    mood: "band",
    note: "Kick, snare, hats and a power chord. A full bar, on repeat.",
    loop: 2,
    render(ctx, out, at) {
      const beat = 0.5;
      kick(ctx, out, { at, peak: 0.5 });
      kick(ctx, out, { at: at + beat * 2, peak: 0.45 });
      snare(ctx, out, { at: at + beat, peak: 0.34 });
      snare(ctx, out, { at: at + beat * 3, peak: 0.34 });
      for (let i = 0; i < 8; i += 1) hat(ctx, out, { at: at + i * (beat / 2), peak: 0.1 });
      ["E2", "B2", "E3"].forEach((note) => {
        stack(ctx, out, {
          at,
          freq: noteFreq(note),
          dur: 0.3,
          hold: 1.35,
          type: "sawtooth",
          peak: 0.12,
          attack: 0.01,
          voices: 2,
          spread: 11,
          filter: "lowpass",
          filterFreq: 1700,
        });
      });
    },
  },
  {
    id: "guitar-arp",
    name: "Guitar arpeggio",
    mood: "band",
    note: "Six strings picked in turn, with the low string ringing underneath.",
    loop: 3,
    render(ctx, out, at) {
      const strings = ["E3", "A3", "D4", "G4", "B4", "E5"];
      strings.forEach((note, index) => {
        pluck(ctx, out, { at: at + index * 0.14, freq: noteFreq(note), dur: 1.4 - index * 0.1, peak: 0.2 });
      });
      pluck(ctx, out, { at: at + 1.25, freq: noteFreq("E2"), dur: 1.5, peak: 0.22 });
      strings.slice(0, 4).forEach((note, index) => {
        pluck(ctx, out, { at: at + 1.45 + index * 0.11, freq: noteFreq(note), dur: 1, peak: 0.15 });
      });
    },
  },
  {
    id: "fanfare",
    name: "Grand fanfare",
    mood: "grand",
    note: "Brass, rising, landing on a major chord. For when you finished the hard thing.",
    loop: 4.4,
    render(ctx, out, at) {
      const brass = (time, note, dur, peak) =>
        stack(ctx, out, {
          at: time,
          freq: noteFreq(note),
          dur,
          hold: dur * 0.4,
          type: "sawtooth",
          peak,
          attack: 0.035,
          voices: 3,
          spread: 8,
          filter: "lowpass",
          filterFreq: 2900,
        });
      brass(at, "C4", 0.26, 0.17);
      brass(at + 0.3, "E4", 0.26, 0.17);
      brass(at + 0.6, "G4", 0.26, 0.18);
      brass(at + 0.9, "C5", 0.5, 0.2);
      ["C4", "E4", "G4", "C5", "E5"].forEach((note) => brass(at + 1.6, note, 1.5, 0.12));
      noise(ctx, out, { at: at + 1.6, dur: 1.1, peak: 0.1, filter: "highpass", freq: 6000 });
      kick(ctx, out, { at: at + 1.6, peak: 0.4 });
    },
  },
];

export const DEFAULT_SOUND_ID = "soft-chime";

/** Look a sound up by id; unknown ids fall back to the default, never null. */
export function findSound(id) {
  return ALARM_SOUNDS.find((sound) => sound.id === id) || ALARM_SOUNDS.find((s) => s.id === DEFAULT_SOUND_ID);
}

/** The catalogue grouped by mood, in `SOUND_MOODS` order, for the picker. */
export function soundsByMood() {
  return SOUND_MOODS.map((mood) => ({
    ...mood,
    sounds: ALARM_SOUNDS.filter((sound) => sound.mood === mood.id),
  })).filter((group) => group.sounds.length > 0);
}

/* ----------------------------------------------------------- media links */

const YOUTUBE_ID = /^[\w-]{11}$/;

/**
 * Work out what a pasted link actually is.
 *
 * A static page cannot stream Spotify or YouTube itself — that needs an API
 * key, an OAuth round trip and, for Spotify, a Premium account per listener.
 * What it *can* do is hand the link to the platform's own embed player, which
 * needs no key and no account, and that is what this returns.
 *
 * @returns {{kind: string, id?: string, embedUrl?: string, openUrl?: string, url?: string, label: string}
 *           | {kind: "none", error: string}}
 */
export function parseMediaLink(input) {
  const raw = String(input || "").trim();
  if (!raw) return { kind: "none", error: "Paste a link, or choose a file." };

  // Bare YouTube id, pasted out of a URL bar.
  if (YOUTUBE_ID.test(raw)) return youtubeSource(raw);

  // spotify:track:4cOdK2wGLETKBW3PvgPWqT
  const uri = /^spotify:(track|album|playlist|episode):([A-Za-z0-9]+)$/.exec(raw);
  if (uri) return spotifySource(uri[1], uri[2]);

  let url = null;
  try {
    url = new URL(raw);
  } catch (_) {
    return { kind: "none", error: "That does not look like a link we can play." };
  }

  const host = url.hostname.replace(/^www\./, "").toLowerCase();

  if (host === "youtu.be") {
    const id = url.pathname.slice(1).split("/")[0];
    if (YOUTUBE_ID.test(id)) return youtubeSource(id, url.searchParams.get("t"));
  }
  if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com") {
    const id = url.searchParams.get("v") || (/^\/(shorts|embed|live)\/([\w-]{11})/.exec(url.pathname) || [])[2];
    if (id && YOUTUBE_ID.test(id)) {
      const source = youtubeSource(id, url.searchParams.get("t"));
      if (host === "music.youtube.com") source.label = "YouTube Music";
      return source;
    }
    const list = url.searchParams.get("list");
    if (list) {
      return {
        kind: "youtube",
        id: list,
        embedUrl: `https://www.youtube-nocookie.com/embed/videoseries?list=${encodeURIComponent(list)}&autoplay=1`,
        openUrl: raw,
        label: host === "music.youtube.com" ? "YouTube Music playlist" : "YouTube playlist",
      };
    }
  }
  if (host === "open.spotify.com") {
    const parts = url.pathname.split("/").filter(Boolean);
    // /intl-de/track/<id> — Spotify localises the path for some regions.
    const typeIndex = parts.findIndex((part) => ["track", "album", "playlist", "episode"].includes(part));
    if (typeIndex >= 0 && parts[typeIndex + 1]) return spotifySource(parts[typeIndex], parts[typeIndex + 1]);
  }

  // Protocol first: an `ftp://…/song.mp3` looks like audio but no browser
  // will fetch it, and `javascript:` must never reach an <audio> src.
  const playableProtocol = ["http:", "https:", "blob:", "data:"].includes(url.protocol);
  if (!playableProtocol) {
    return { kind: "none", error: "Only http(s) links, YouTube and Spotify can be played." };
  }
  if (url.protocol === "blob:" || url.protocol === "data:") {
    return { kind: "audio", url: raw, label: "Audio file" };
  }
  if (/\.(mp3|wav|ogg|oga|opus|m4a|aac|flac|weba|webm)(\?|#|$)/i.test(url.pathname)) {
    return { kind: "audio", url: raw, label: "Audio file" };
  }
  // Not a name we recognise — try it as audio anyway; the <audio> element is
  // the only thing that can really tell us, and it fails loudly.
  return { kind: "audio", url: raw, label: "Audio link", uncertain: true };
}

function youtubeSource(id, start) {
  const seconds = Number(String(start || "").replace(/[^\d]/g, "")) || 0;
  const params = new URLSearchParams({ autoplay: "1", loop: "1", playlist: id });
  if (seconds > 0) params.set("start", String(seconds));
  return {
    kind: "youtube",
    id,
    // youtube-nocookie keeps the alarm from dropping tracking cookies on a
    // page that otherwise sets none.
    embedUrl: `https://www.youtube-nocookie.com/embed/${id}?${params.toString()}`,
    openUrl: `https://www.youtube.com/watch?v=${id}`,
    label: "YouTube",
  };
}

function spotifySource(type, id) {
  return {
    kind: "spotify",
    id,
    mediaType: type,
    embedUrl: `https://open.spotify.com/embed/${type}/${id}?utm_source=tempo`,
    openUrl: `https://open.spotify.com/${type}/${id}`,
    label: `Spotify ${type}`,
  };
}

/* ------------------------------------------------------------------ player */

export const MAX_ALARM_MS = 5 * 60 * 1000;
/** How far ahead of the clock we schedule audio, in seconds. */
const LOOKAHEAD = 1.5;
const TICK_MS = 250;

/**
 * The thing that actually makes noise.
 *
 * Cycles are scheduled in a rolling 1.5-second window rather than all at once,
 * so a five-minute alarm does not build five minutes of audio graph up front
 * and `stop()` is instant.
 *
 * @param {object} options
 *   @param {() => AudioContext} [options.createContext] injectable for tests
 *   @param {Document} [options.doc] where stream iframes are mounted
 */
export function createAlarmPlayer({ createContext, doc } = {}) {
  const documentRef = doc || (typeof document !== "undefined" ? document : null);
  let ctx = null;
  let master = null;
  let ticker = 0;
  let nextCycleAt = 0;
  let endsAt = 0;
  let active = null;
  let streamFrame = null;
  let element = null;

  function makeContext() {
    if (typeof createContext === "function") return createContext();
    const Ctor =
      typeof window !== "undefined" ? window.AudioContext || window.webkitAudioContext : null;
    return Ctor ? new Ctor() : null;
  }

  function ensureContext() {
    if (ctx) return ctx;
    try {
      ctx = makeContext();
    } catch (_) {
      ctx = null;
    }
    return ctx;
  }

  /** Browsers suspend audio until a gesture; starting a timer is one. */
  function resume() {
    try {
      if (ctx && ctx.state === "suspended" && typeof ctx.resume === "function") ctx.resume();
    } catch (_) {
      /* a suspended context just means silence */
    }
  }

  function schedule() {
    if (!ctx || !active || !master) return;
    const now = ctx.currentTime;
    if (endsAt && Date.now() >= endsAt) {
      stop();
      return;
    }
    let guard = 0;
    while (nextCycleAt < now + LOOKAHEAD && guard < 16) {
      try {
        active.render(ctx, master, Math.max(nextCycleAt, now + 0.01));
      } catch (_) {
        /* one bad cycle must not kill the alarm */
      }
      nextCycleAt += Math.max(0.2, active.loop);
      guard += 1;
      if (!active.repeat) {
        stopTicker();
        // A one-shot preview still needs the context torn down afterwards.
        if (typeof window !== "undefined") {
          window.setTimeout(() => {
            if (active && !active.repeat) stop();
          }, Math.ceil(active.loop * 1000) + 400);
        }
        return;
      }
    }
  }

  function stopTicker() {
    if (ticker && typeof window !== "undefined") window.clearInterval(ticker);
    ticker = 0;
  }

  /* ----------------------------------------------------------- streams */

  function mountStream(source, { volume = 0.8 } = {}) {
    clearStream();
    if (!documentRef) return false;

    if (source.kind === "audio") {
      try {
        element = new (typeof Audio !== "undefined" ? Audio : documentRef.defaultView.Audio)(source.url);
        element.loop = true;
        element.volume = Math.max(0, Math.min(1, volume));
        const played = element.play();
        if (played && typeof played.catch === "function") played.catch(() => {});
        return true;
      } catch (_) {
        return false;
      }
    }

    // YouTube and Spotify both publish a key-less embed player. It is the only
    // way a static page can play a whole track without an API key, an OAuth
    // redirect and (for Spotify) a Premium account for every listener.
    const frame = documentRef.createElement("iframe");
    frame.className = "alarm-stream-frame";
    frame.setAttribute("title", `${source.label} alarm`);
    frame.setAttribute("allow", "autoplay; encrypted-media");
    frame.setAttribute("frameborder", "0");
    frame.src = source.embedUrl;
    const host = documentRef.getElementById("alarm-stream") || documentRef.body;
    if (!host) return false;
    host.appendChild(frame);
    streamFrame = frame;
    return true;
  }

  function clearStream() {
    if (streamFrame && streamFrame.parentNode) streamFrame.parentNode.removeChild(streamFrame);
    streamFrame = null;
    if (element) {
      try {
        element.pause();
        element.src = "";
      } catch (_) {
        /* already gone */
      }
      element = null;
    }
  }

  /* -------------------------------------------------------------- api */

  /**
   * @param {string|object} sound  a catalogue id, or a parsed media source
   * @param {object} options
   *   @param {number} [options.volume]     0–1
   *   @param {number} [options.durationMs] how long to keep going
   *   @param {boolean} [options.repeat]    false for a one-shot preview
   */
  function play(sound, { volume = 0.7, durationMs = 30000, repeat = true } = {}) {
    stop();
    const level = Math.max(0, Math.min(1, Number(volume)));

    if (sound && typeof sound === "object" && sound.kind && sound.kind !== "none") {
      const started = mountStream(sound, { volume: level });
      if (started) {
        endsAt = repeat ? Date.now() + Math.min(durationMs, MAX_ALARM_MS) : 0;
        if (endsAt && typeof window !== "undefined") {
          ticker = window.setTimeout(stop, Math.min(durationMs, MAX_ALARM_MS));
        }
        return { ok: true, kind: sound.kind };
      }
      return { ok: false, reason: "stream" };
    }

    const entry = findSound(typeof sound === "string" ? sound : DEFAULT_SOUND_ID);
    if (!entry) return { ok: false, reason: "unknown" };
    if (!ensureContext()) return { ok: false, reason: "no-audio" };
    resume();

    try {
      master = ctx.createGain();
      master.gain.setValueAtTime(level, ctx.currentTime);
      master.connect(ctx.destination);
    } catch (_) {
      return { ok: false, reason: "no-audio" };
    }

    active = { render: entry.render, loop: entry.loop, repeat, id: entry.id };
    nextCycleAt = ctx.currentTime + 0.05;
    endsAt = repeat ? Date.now() + Math.min(durationMs, MAX_ALARM_MS) : 0;
    schedule();
    if (repeat && typeof window !== "undefined") ticker = window.setInterval(schedule, TICK_MS);
    return { ok: true, kind: "synth", id: entry.id };
  }

  /** Play one cycle only — what the ▶ button next to each sound does. */
  function preview(soundId, { volume = 0.7 } = {}) {
    return play(soundId, { volume, repeat: false });
  }

  function stop() {
    stopTicker();
    if (ticker && typeof window !== "undefined") window.clearTimeout(ticker);
    ticker = 0;
    active = null;
    endsAt = 0;
    clearStream();
    if (master) {
      try {
        // A 60 ms fade, because cutting a gain node dead is an audible click.
        const now = ctx ? ctx.currentTime : 0;
        master.gain.cancelScheduledValues(now);
        master.gain.setValueAtTime(master.gain.value || 0.0001, now);
        master.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);
        const dying = master;
        if (typeof window !== "undefined") window.setTimeout(() => dying.disconnect(), 140);
        else dying.disconnect();
      } catch (_) {
        /* the node is already gone */
      }
      master = null;
    }
  }

  return {
    play,
    preview,
    stop,
    get playing() {
      return Boolean(active || streamFrame || element);
    },
    get soundId() {
      return active ? active.id : null;
    },
  };
}
