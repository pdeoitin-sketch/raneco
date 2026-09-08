/**
 * A clock with hands.
 *
 * Used twice: small, inside the "Right now" card, and large on the Old clock
 * page. It is built from DOM nodes (not canvas) so the palette, the fonts and
 * the page's own CSS all apply to it, and so a screen reader can skip it as
 * decoration while the digital time stays authoritative.
 *
 * `update(date)` is cheap enough to call every frame, which is what makes the
 * "sweep" second hand possible.
 */

export const NUMERAL_STYLES = ["roman", "arabic", "none"];
const ROMAN = ["XII", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI"];

/**
 * @param {HTMLElement} root element to fill with a face
 * @param {object} options
 *   @param {"roman"|"arabic"|"none"} numerals
 *   @param {boolean} seconds  draw (and move) a second hand
 *   @param {boolean} smooth   move the second hand continuously
 */
export function createClockFace(root, { numerals = "arabic", seconds = true, smooth = false, showTicks = true } = {}) {
  if (!root) return { update() {}, setNumerals() {}, setSeconds() {}, setSmooth() {} };

  root.classList.add("clock-face");
  root.dataset.numerals = numerals;
  root.innerHTML = "";

  if (showTicks) {
    const ticks = document.createElement("span");
    ticks.className = "face-ticks";
    ticks.setAttribute("aria-hidden", "true");
    for (let index = 0; index < 60; index += 1) {
      const tick = document.createElement("i");
      tick.className = index % 5 === 0 ? "face-tick major" : "face-tick";
      tick.style.setProperty("--angle", `${index * 6}deg`);
      ticks.appendChild(tick);
    }
    root.appendChild(ticks);
  }

  const numbers = document.createElement("span");
  numbers.className = "face-numbers";
  numbers.setAttribute("aria-hidden", "true");
  const numberNodes = [];
  for (let hour = 1; hour <= 12; hour += 1) {
    const node = document.createElement("span");
    node.className = "face-number";
    node.style.setProperty("--angle", `${hour * 30}deg`);
    const glyph = document.createElement("em");
    glyph.textContent = numerals === "roman" ? ROMAN[hour % 12] : String(hour);
    node.appendChild(glyph);
    numbers.appendChild(node);
    numberNodes.push({ node, hour });
  }
  root.appendChild(numbers);

  const hourHand = document.createElement("span");
  hourHand.className = "clock-hand hand-hour";
  const minuteHand = document.createElement("span");
  minuteHand.className = "clock-hand hand-minute";
  const secondHand = document.createElement("span");
  secondHand.className = "clock-hand hand-second";
  const pin = document.createElement("span");
  pin.className = "clock-pin";

  root.append(hourHand, minuteHand, secondHand, pin);

  const state = { seconds, smooth, numerals, lastSecond: null };

  function setNumerals(style) {
    state.numerals = NUMERAL_STYLES.includes(style) ? style : "arabic";
    root.dataset.numerals = state.numerals;
    numberNodes.forEach(({ node, hour }) => {
      const glyph = node.querySelector("em");
      if (glyph) glyph.textContent = state.numerals === "roman" ? ROMAN[hour % 12] : String(hour);
    });
  }

  function setSeconds(visible) {
    state.seconds = Boolean(visible);
    root.dataset.seconds = String(state.seconds);
  }

  function setSmooth(value) {
    state.smooth = Boolean(value);
    root.dataset.smooth = String(state.smooth);
  }

  setSeconds(seconds);
  setSmooth(smooth);

  /**
   * @param {Date} date
   * @param {{hour?: number, minute?: number, second?: number, ms?: number}} [parts]
   *        pre-computed wall-clock parts, when the caller already has them
   *        (the home clock renders dozens of faces a minute otherwise).
   */
  function update(date, parts) {
    const hour = parts && Number.isFinite(parts.hour) ? parts.hour : date.getHours();
    const minute = parts && Number.isFinite(parts.minute) ? parts.minute : date.getMinutes();
    const second = parts && Number.isFinite(parts.second) ? parts.second : date.getSeconds();
    const ms = parts && Number.isFinite(parts.ms) ? parts.ms : date.getMilliseconds();

    const minuteFloat = minute + second / 60;
    const hourAngle = ((hour % 12) + minuteFloat / 60) * 30;
    const minuteAngle = minuteFloat * 6;
    const secondAngle = state.smooth ? (second + ms / 1000) * 6 : second * 6;

    hourHand.style.transform = `rotate(${hourAngle.toFixed(3)}deg)`;
    minuteHand.style.transform = `rotate(${minuteAngle.toFixed(3)}deg)`;
    if (state.seconds) secondHand.style.transform = `rotate(${secondAngle.toFixed(3)}deg)`;
    if (state.seconds && !state.smooth && second !== state.lastSecond) {
      // A mechanical "tick" is a tiny overshoot, not a jump: CSS animates it.
      secondHand.classList.remove("tick");
      void secondHand.offsetWidth;
      secondHand.classList.add("tick");
      state.lastSecond = second;
    }
  }

  return { update, setNumerals, setSeconds, setSmooth, root, hourHand, minuteHand, secondHand };
}

/** Wall-clock parts of `date` in a zone, for `update()`'s fast path. */
const partFormatters = new Map();
export function clockParts(date, zone) {
  if (!partFormatters.has(zone)) {
    partFormatters.set(
      zone,
      new Intl.DateTimeFormat("en-CA", {
        timeZone: zone,
        hourCycle: "h23",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    );
  }
  const parts = {};
  for (const item of partFormatters.get(zone).formatToParts(date)) {
    if (item.type !== "literal") parts[item.type] = item.value;
  }
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}
