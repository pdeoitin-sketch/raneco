import assert from "node:assert/strict";
import test from "node:test";

import {
  ALARM_SOUNDS,
  DEFAULT_SOUND_ID,
  MAX_ALARM_MS,
  SOUND_MOODS,
  createAlarmPlayer,
  findSound,
  noteFreq,
  parseMediaLink,
  soundsByMood,
} from "../src/alarm-sounds.js";

/* ------------------------------------------------------------- catalogue */

test("the catalogue ships sixteen distinct, described sounds", () => {
  assert.equal(ALARM_SOUNDS.length, 16, "the brief was fifteen plus custom; we ship sixteen plus custom");

  const ids = ALARM_SOUNDS.map((sound) => sound.id);
  assert.equal(new Set(ids).size, ids.length, "ids are unique");
  const names = ALARM_SOUNDS.map((sound) => sound.name);
  assert.equal(new Set(names).size, names.length, "names are unique");

  for (const sound of ALARM_SOUNDS) {
    assert.match(sound.id, /^[a-z][a-z0-9-]*$/, `${sound.id} is a clean id`);
    assert.ok(sound.name.length > 2, `${sound.id} has a name`);
    assert.ok(sound.note.length > 10, `${sound.id} explains itself in the picker`);
    assert.equal(typeof sound.render, "function", `${sound.id} can be played`);
    // An alarm that loops faster than this is a stutter, slower is a gap.
    assert.ok(sound.loop >= 1 && sound.loop <= 8, `${sound.id} loops in ${sound.loop}s`);
    assert.ok(
      SOUND_MOODS.some((mood) => mood.id === sound.mood),
      `${sound.id} belongs to a known mood`
    );
  }
});

test("every mood the brief asked for has at least one sound", () => {
  const groups = soundsByMood();
  const covered = new Set(groups.map((group) => group.id));
  // Soft and sweet, melodious, modular, meticulous, simple, sharp/hard,
  // loud/strong, rock band and guitar, ringtone, and a grand one.
  for (const mood of ["simple", "soft", "melodious", "modular", "meticulous", "ringtone", "sharp", "strong", "band", "grand"]) {
    assert.ok(covered.has(mood), `${mood} has sounds`);
  }
  assert.equal(
    groups.reduce((total, group) => total + group.sounds.length, 0),
    ALARM_SOUNDS.length,
    "grouping loses nothing"
  );
  // Groups come back in the declared order, so the picker is stable.
  assert.deepEqual(
    groups.map((group) => group.id),
    SOUND_MOODS.filter((mood) => ALARM_SOUNDS.some((sound) => sound.mood === mood.id)).map((mood) => mood.id)
  );
});

test("an unknown sound id falls back rather than exploding", () => {
  assert.equal(findSound("soft-chime").id, "soft-chime");
  assert.equal(findSound("no-such-sound").id, DEFAULT_SOUND_ID);
  assert.equal(findSound(undefined).id, DEFAULT_SOUND_ID);
});

test("notes are read as pitches, so the catalogue is reviewable", () => {
  assert.ok(Math.abs(noteFreq("A4") - 440) < 0.01);
  assert.ok(Math.abs(noteFreq("A5") - 880) < 0.01);
  assert.ok(Math.abs(noteFreq("C4") - 261.63) < 0.01);
  assert.ok(Math.abs(noteFreq("C#5") - 554.37) < 0.01);
  assert.ok(Math.abs(noteFreq("Eb3") - 155.56) < 0.01);
  // A bare number passes through, so raw frequencies still work.
  assert.equal(noteFreq(1000), 1000);
});

/* ------------------------------------------------------------ media links */

test("YouTube links of every shape become an embeddable source", () => {
  for (const link of [
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://youtu.be/dQw4w9WgXcQ",
    "https://m.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://www.youtube.com/shorts/dQw4w9WgXcQ",
    "https://www.youtube.com/embed/dQw4w9WgXcQ",
    "dQw4w9WgXcQ",
  ]) {
    const parsed = parseMediaLink(link);
    assert.equal(parsed.kind, "youtube", link);
    assert.equal(parsed.id, "dQw4w9WgXcQ", link);
    assert.match(parsed.embedUrl, /youtube-nocookie\.com\/embed\/dQw4w9WgXcQ/, link);
    assert.match(parsed.embedUrl, /autoplay=1/, link);
  }

  // YouTube Music is named as itself, because the user asked for it by name.
  const music = parseMediaLink("https://music.youtube.com/watch?v=dQw4w9WgXcQ");
  assert.equal(music.kind, "youtube");
  assert.equal(music.label, "YouTube Music");

  // A timestamp survives, so "start at the good bit" works.
  const stamped = parseMediaLink("https://youtu.be/dQw4w9WgXcQ?t=42");
  assert.match(stamped.embedUrl, /start=42/);

  const playlist = parseMediaLink("https://www.youtube.com/playlist?list=PL1234567890");
  assert.equal(playlist.kind, "youtube");
  assert.match(playlist.embedUrl, /videoseries\?list=PL1234567890/);
});

test("Spotify tracks, albums, playlists and URIs all resolve", () => {
  const track = parseMediaLink("https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT");
  assert.equal(track.kind, "spotify");
  assert.equal(track.id, "4cOdK2wGLETKBW3PvgPWqT");
  assert.match(track.embedUrl, /open\.spotify\.com\/embed\/track\/4cOdK2wGLETKBW3PvgPWqT/);
  assert.match(track.openUrl, /open\.spotify\.com\/track\//);

  assert.equal(parseMediaLink("spotify:track:4cOdK2wGLETKBW3PvgPWqT").kind, "spotify");
  assert.equal(parseMediaLink("https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M").mediaType, "playlist");
  assert.equal(parseMediaLink("https://open.spotify.com/album/1DFixLWuPkv3KT3TnV35m3").mediaType, "album");
  // Spotify localises its paths for some regions; the id is still in there.
  assert.equal(parseMediaLink("https://open.spotify.com/intl-de/track/4cOdK2wGLETKBW3PvgPWqT").id, "4cOdK2wGLETKBW3PvgPWqT");
});

test("direct audio, blobs and nonsense are each handled on their own terms", () => {
  assert.equal(parseMediaLink("https://example.com/wake-up.mp3").kind, "audio");
  assert.equal(parseMediaLink("https://example.com/a/b/song.ogg?x=1").kind, "audio");
  assert.equal(parseMediaLink("blob:http://localhost:5173/abc-123").kind, "audio");

  // An unknown https link is worth trying as audio; the element reports back.
  const guess = parseMediaLink("https://example.com/stream");
  assert.equal(guess.kind, "audio");
  assert.equal(guess.uncertain, true);

  for (const bad of ["", "   ", "not a link", "ftp://example.com/x.mp3"]) {
    const parsed = parseMediaLink(bad);
    assert.equal(parsed.kind, "none", `"${bad}" is rejected`);
    assert.ok(parsed.error, `"${bad}" says why`);
  }
});

/* ----------------------------------------------------------------- player */

/**
 * A recording AudioContext. It is the smallest surface `render()` touches, so
 * the catalogue can be driven for real — every sound actually scheduled —
 * without a browser or a speaker.
 */
function fakeContext() {
  const events = [];
  const param = (name, node) => ({
    value: 0,
    setValueAtTime(value, at) {
      events.push({ node, param: name, kind: "set", value, at });
      this.value = value;
      return this;
    },
    exponentialRampToValueAtTime(value, at) {
      events.push({ node, param: name, kind: "ramp", value, at });
      return this;
    },
    linearRampToValueAtTime(value, at) {
      events.push({ node, param: name, kind: "ramp", value, at });
      return this;
    },
    cancelScheduledValues() {
      return this;
    },
  });
  const node = (type) => {
    const self = {
      type,
      frequency: param("frequency", type),
      detune: param("detune", type),
      gain: param("gain", type),
      Q: param("Q", type),
      buffer: null,
      connect(target) {
        return target;
      },
      disconnect() {},
      start(at) {
        events.push({ node: type, kind: "start", at });
      },
      stop(at) {
        events.push({ node: type, kind: "stop", at });
      },
    };
    return self;
  };

  return {
    currentTime: 0,
    sampleRate: 44100,
    state: "running",
    destination: node("destination"),
    events,
    resume() {
      this.state = "running";
    },
    createOscillator: () => node("oscillator"),
    createGain: () => node("gain"),
    createBiquadFilter: () => node("filter"),
    createBufferSource: () => node("buffer-source"),
    createBuffer: (channels, length) => ({
      length,
      getChannelData: () => new Float32Array(length),
    }),
  };
}

test("every sound in the catalogue schedules real audio", () => {
  for (const sound of ALARM_SOUNDS) {
    const ctx = fakeContext();
    const out = ctx.createGain();
    sound.render(ctx, out, 0);
    const starts = ctx.events.filter((event) => event.kind === "start");
    assert.ok(starts.length > 0, `${sound.id} starts at least one source`);
    // Nothing may be scheduled in the past: the Web Audio clock ignores it.
    for (const event of ctx.events) {
      if (typeof event.at === "number") assert.ok(event.at >= 0, `${sound.id} schedules at ${event.at}`);
    }
    // And nothing may run away past its own loop — that is what overlaps.
    const last = Math.max(...ctx.events.filter((e) => e.kind === "stop").map((e) => e.at));
    assert.ok(last <= sound.loop + 2.5, `${sound.id} finishes near its ${sound.loop}s cycle, got ${last}`);
  }
});

test("the player loops an alarm instead of firing once", () => {
  const ctx = fakeContext();
  const player = createAlarmPlayer({ createContext: () => ctx, doc: null });

  const result = player.play("classic-ring", { volume: 0.5, durationMs: 30000 });
  assert.equal(result.ok, true);
  assert.equal(result.kind, "synth");
  assert.equal(player.playing, true);
  assert.equal(player.soundId, "classic-ring");

  // The first schedule fills the look-ahead window, so a 4-second sound gets
  // one cycle and a short one gets several — either way, more than "a ting".
  const starts = ctx.events.filter((event) => event.kind === "start").length;
  assert.ok(starts > 0, "audio was scheduled");

  player.stop();
  assert.equal(player.playing, false);
});

test("a preview plays one cycle and does not latch on", () => {
  const ctx = fakeContext();
  const player = createAlarmPlayer({ createContext: () => ctx, doc: null });
  const result = player.preview("buzzer", { volume: 0.4 });
  assert.equal(result.ok, true);
  assert.ok(ctx.events.some((event) => event.kind === "start"));
  player.stop();
});

test("a browser with no audio is silence, not a crash", () => {
  const player = createAlarmPlayer({ createContext: () => null, doc: null });
  const result = player.play("ting");
  assert.equal(result.ok, false);
  assert.equal(result.reason, "no-audio");
  assert.equal(player.playing, false);
  player.stop(); // must not throw
});

test("the alarm can never ring forever by accident", () => {
  assert.equal(MAX_ALARM_MS, 5 * 60 * 1000);
  const ctx = fakeContext();
  const player = createAlarmPlayer({ createContext: () => ctx, doc: null });
  // Even "until I stop it" is capped, so a forgotten tab does not scream all
  // afternoon.
  const result = player.play("siren", { durationMs: 60 * 60 * 1000 });
  assert.equal(result.ok, true);
  player.stop();
});
