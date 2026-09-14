/**
 * Weather scenes behind the Old clock — chosen from the live sky, never from
 * a menu.
 *
 * The Old clock is the one part of Tempo whose whole point is *looking*, so
 * the space behind it is allowed to say something. It says what the sky is
 * actually doing: a thunderstorm with lightning, drifting clouds, falling
 * snow, a starry night with the moon in its real phase — eleven scenes, each
 * one picked by `sceneFor()` from the same weather snapshot the rest of the
 * page already loaded. No extra request, and no "pick a backdrop" menu,
 * because a sky you choose is a screensaver while a sky you are *told about*
 * is weather.
 *
 * Everything is drawn with CSS and positioned particles: the module hands the
 * DOM a list of inert `<i>` elements carrying custom properties (`--x`,
 * `--delay`, `--drift`…), and keyframes in styles.css do the moving. No
 * images, no canvas — and every animation stops under
 * `prefers-reduced-motion`.
 *
 * The moon is real, or as real as a mean-synodic calculation gets: the phase
 * is computed from the 29.53-day synodic month anchored to the new moon of
 * 6 January 2000, which is the standard low-precision ephemeris and is right
 * to within a day or so — plenty for deciding whether tonight's scene has a
 * moon in it.
 */

/** Mean synodic month, in days (29 d 12 h 44 m 2.9 s). */
export const SYNODIC_MONTH_DAYS = 29.530588861;

/** A reference new moon: 2000-01-06 18:14 UTC. */
export const NEW_MOON_EPOCH_MS = Date.UTC(2000, 0, 6, 18, 14);

/** A night counts as moonless when less than this fraction of the disc is lit. */
export const MOONLESS_ILLUMINATION = 0.05;

/** Every scene the stage can show. */
export const SCENES = [
  "thunderstorm",
  "windstorm",
  "rain",
  "rainbow",
  "snowfall",
  "fog",
  "dark-cloud-noon",
  "cloudy",
  "breeze",
  "starry-night",
  "moonless-night",
];

/**
 * The moon's phase, 0–1: 0 and 1 are new, 0.25 first quarter, 0.5 full.
 * Mean-synodic — see the header note for how precise that is (and is not).
 */
export function moonPhase(date = new Date()) {
  const at = date instanceof Date ? date.getTime() : Number(date);
  const days = (at - NEW_MOON_EPOCH_MS) / 86400000;
  const phase = (days / SYNODIC_MONTH_DAYS) % 1;
  return phase < 0 ? phase + 1 : phase;
}

/** Fraction of the disc that is lit: 0 at new, 1 at full, ½ at quarters. */
export function moonIllumination(phase) {
  return (1 - Math.cos(2 * Math.PI * Number(phase))) / 2;
}

/* ------------------------------------------------------------ code sets */

const STORM_CODES = new Set([95, 96, 99]);
const SNOW_CODES = new Set([71, 73, 75, 77, 85, 86]);
const FOG_CODES = new Set([45, 48]);
const RAIN_CODES = new Set([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82]);
const CLEAR_CODES = new Set([0, 1]);
const SHOWER_CODES = new Set([80, 81]);
const CLOUD_CODES = new Set([2, 3]);
const OVERCAST_CODES = new Set([3]);

/** Wind that turns a fair day into a windstorm scene (km/h). */
const WINDSTORM_KPH = 45;
const WINDSTORM_GUST_KPH = 70;

function speedInKph(snapshot) {
  const value = Number(snapshot.windSpeed);
  if (!Number.isFinite(value)) return null;
  return snapshot.windUnit === "mph" ? value * 1.60934 : value;
}

function gustInKph(snapshot) {
  const value = Number(snapshot.windGust);
  if (!Number.isFinite(value)) return null;
  return snapshot.windUnit === "mph" ? value * 1.60934 : value;
}

/**
 * Pick the scene for a weather snapshot.
 *
 * Priority is the sky's own drama: storms outrank everything, then snow, fog
 * and rain; a fair sky is where the wind gets a say, and at night the moon
 * decides between a starry sky and a moonless one. "Dark cloud at noon" is
 * exactly that — an overcast sky in the middle of the day, when the gloom is
 * the weather.
 *
 * @param {object|null} snapshot a parsed weather snapshot (see
 *        `parseForecast` in weather.js) — `null` or a failed one means no
 *        scene at all, and the clock stands on its own dial.
 * @param {object} [options]
 *   @param {Date} [options.now] the moment to judge "noon" by
 *   @param {number|null} [options.phase] override the computed moon phase
 *        (tests pass a fixed one; the default is the real sky)
 * @returns {string|null} a scene id from SCENES, or null
 */
export function sceneFor(snapshot, { now = new Date(), phase = null } = {}) {
  if (!snapshot || !snapshot.ok) return null;

  const code = Number(snapshot.code);
  const isDay = snapshot.isDay !== false;
  const night = !isDay;

  if (STORM_CODES.has(code)) return "thunderstorm";
  if (SNOW_CODES.has(code)) return "snowfall";
  if (FOG_CODES.has(code)) return "fog";
  if (RAIN_CODES.has(code)) {
    // A sunlit light shower is the one sky that earns a rainbow.
    return isDay && SHOWER_CODES.has(code) ? "rainbow" : "rain";
  }

  if (night) {
    if (!CLEAR_CODES.has(code)) return "cloudy";
    const lit = moonIllumination(phase === null ? moonPhase(now) : Number(phase));
    return lit < MOONLESS_ILLUMINATION ? "moonless-night" : "starry-night";
  }

  if (CLOUD_CODES.has(code)) {
    // "Dark cloud at noon" is an overcast sky in the middle of the day, when
    // the gloom is the weather; local hour comes from the offset Open-Meteo
    // reported for the weather's own place.
    if (OVERCAST_CODES.has(code)) {
      const offset = Number(snapshot.utcOffsetSeconds) || 0;
      const hour = new Date(now.getTime() + offset * 1000).getUTCHours();
      if (hour >= 11 && hour <= 14) return "dark-cloud-noon";
    }
    return "cloudy";
  }

  // A fair day: how hard is the wind blowing?
  const speed = speedInKph(snapshot);
  const gust = gustInKph(snapshot);
  const stormy = (speed !== null && speed >= WINDSTORM_KPH) || (gust !== null && gust >= WINDSTORM_GUST_KPH);
  return stormy ? "windstorm" : "breeze";
}

/* ------------------------------------------------------------- particles */

/**
 * The particles a scene is made of.
 *
 * Positions are deterministic — spread by the golden-angle step so the same
 * scene never rearranges itself between renders — and every value the
 * keyframes need arrives as a CSS custom property on the element. The stage
 * (old-clock.js) only has to turn these into `<i>` nodes.
 *
 * @returns {Array<{className: string, style: Record<string, string>}>}
 */
export function sceneParticles(scene) {
  const spread = (index) => ((index * 61.803) % 100).toFixed(2);
  const make = (count, className, extra = () => ({})) =>
    Array.from({ length: count }, (_, index) => ({
      className,
      style: {
        "--x": `${spread(index)}%`,
        "--delay": `${(-(index * 0.83) % 9).toFixed(2)}s`,
        ...extra(index),
      },
    }));

  switch (scene) {
    case "thunderstorm":
      return [
        ...make(22, "p-rain", (i) => ({ "--speed": `${(0.7 + (i % 4) * 0.09).toFixed(2)}s`, "--drift": `${(i % 3) - 1}px` })),
        ...make(3, "p-cloud-dark", (i) => ({ "--y": `${18 + i * 16}%`, "--scale": `${(0.9 + i * 0.22).toFixed(2)}` })),
        { className: "p-lightning", style: { "--x": "58%", "--delay": "2.8s" } },
        { className: "p-lightning p-lightning-b", style: { "--x": "34%", "--delay": "6.4s" } },
      ];
    case "windstorm":
      return [
        ...make(12, "p-gust", (i) => ({ "--y": `${12 + ((i * 29) % 76)}%`, "--speed": `${(1.1 + (i % 3) * 0.16).toFixed(2)}s` })),
        ...make(6, "p-leaf", (i) => ({ "--y": `${20 + ((i * 37) % 66)}%`, "--spin": `${i % 2 ? -540 : 720}deg` })),
      ];
    case "rain":
      return make(28, "p-rain", (i) => ({ "--speed": `${(0.65 + (i % 5) * 0.11).toFixed(2)}s`, "--drift": `${(i % 4) - 2}px` }));
    case "rainbow":
      return [{ className: "p-rainbow", style: { "--x": "50%" } }];
    case "snowfall":
      return make(30, "p-snow", (i) => ({
        "--speed": `${(4.5 + (i % 6) * 0.85).toFixed(2)}s`,
        "--drift": `${(((i * 37) % 160) - 80).toFixed(0)}px`,
        "--size": `${2 + (i % 3)}px`,
      }));
    case "fog":
      return make(4, "p-fog", (i) => ({ "--y": `${24 + i * 15}%`, "--speed": `${14 + i * 3}s`, "--scale": `${(1 + i * 0.28).toFixed(2)}` }));
    case "dark-cloud-noon":
      return make(5, "p-cloud-dark", (i) => ({ "--y": `${10 + i * 13}%`, "--scale": `${(0.95 + i * 0.19).toFixed(2)}` }));
    case "cloudy":
      return make(4, "p-cloud", (i) => ({ "--y": `${12 + i * 17}%`, "--speed": `${26 + i * 6}s`, "--scale": `${(1 + i * 0.3).toFixed(2)}` }));
    case "breeze":
      return [
        ...make(4, "p-cloud", (i) => ({ "--y": `${14 + i * 15}%`, "--speed": `${34 + i * 7}s`, "--scale": `${(0.8 + i * 0.24).toFixed(2)}` })),
        ...make(3, "p-leaf", (i) => ({ "--y": `${34 + i * 18}%`, "--spin": `${i % 2 ? -420 : 480}deg` })),
      ];
    case "starry-night":
      return [
        ...make(34, "p-star", (i) => ({
          "--y": `${((i * 23.6) % 92).toFixed(1)}%`,
          "--size": `${(1 + (i % 3) * 0.8).toFixed(1)}px`,
          "--twinkle": `${(2.2 + (i % 5) * 0.7).toFixed(1)}s`,
        })),
        { className: "p-moon", style: { "--x": "72%", "--y": "20%" } },
      ];
    case "moonless-night":
      return make(16, "p-star", (i) => ({
        "--y": `${((i * 41.3) % 94).toFixed(1)}%`,
        "--size": `${(1 + (i % 2) * 0.7).toFixed(1)}px`,
        "--twinkle": `${(3 + (i % 4) * 0.9).toFixed(1)}s`,
      }));
    default:
      return [];
  }
}

/**
 * How far the moon's shadow is shifted, as a percentage of the disc.
 *
 * The scene's moon is two circles — the disc and a shadow — and the shadow's
 * horizontal offset encodes the phase: 0 at full (hidden behind the disc), a
 * full disc-width at new (covering it), half at the quarters. It is a
 * cartoon terminator, not an astronomer's one, and it knows that about
 * itself.
 */
export function moonShadowShift(phase) {
  return ((0.5 - Number(phase)) * 2 * 100).toFixed(1);
}
