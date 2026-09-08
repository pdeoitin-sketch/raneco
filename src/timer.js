/**
 * The countdown timer.
 *
 * It owns its own interval so it survives page changes — start it on the Timer
 * page, wander off to the world clocks, and it is still counting when you come
 * back. `remaining` is derived from a wall-clock `endAt`, so a backgrounded
 * tab that throttles timers still lands on the right number.
 */

import { beep, pad } from "./ui.js";

export function createTimer({ elements = {}, notify } = {}) {
  const state = {
    original: 5 * 60 * 1000,
    remaining: 5 * 60 * 1000,
    running: false,
    endAt: 0,
    interval: null,
  };

  function formatMilliseconds(milliseconds) {
    const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
    return `${pad(Math.floor(totalSeconds / 60))}:${pad(totalSeconds % 60)}`;
  }

  function readInputs() {
    if (!elements.minutes || !elements.seconds) return state.original;
    const minutes = Math.max(0, Math.min(999, Number.parseInt(elements.minutes.value, 10) || 0));
    const seconds = Math.max(0, Math.min(59, Number.parseInt(elements.seconds.value, 10) || 0));
    elements.minutes.value = String(minutes);
    elements.seconds.value = String(seconds);
    return (minutes * 60 + seconds) * 1000;
  }

  function lockInputs(disabled) {
    if (elements.minutes) elements.minutes.disabled = disabled;
    if (elements.seconds) elements.seconds.disabled = disabled;
    if (elements.presets) for (const button of elements.presets) button.disabled = disabled;
  }

  function render() {
    const { original, remaining, running } = state;
    const percentage = original > 0 ? Math.max(0, Math.min(1, remaining / original)) : 0;
    const degrees = percentage * 360;
    const foreground = remaining === 0 && original > 0 ? "var(--coral)" : "var(--violet)";

    if (elements.display) elements.display.textContent = formatMilliseconds(remaining);
    if (elements.ring) {
      elements.ring.style.background = `conic-gradient(${foreground} 0deg ${degrees}deg, var(--canvas-soft) ${degrees}deg 360deg)`;
    }
    if (elements.start) {
      elements.start.innerHTML = running
        ? '<span class="play-icon">Ⅱ</span> Pause timer'
        : `<span class="play-icon">▶</span> ${remaining > 0 && remaining !== original ? "Resume timer" : "Start timer"}`;
    }

    let status = "READY";
    if (running) status = "RUNNING";
    else if (remaining > 0 && remaining !== original) status = "PAUSED";
    else if (remaining === 0 && original > 0) status = "DONE";
    if (elements.status) {
      elements.status.textContent = status;
      elements.status.classList.toggle("running", running);
    }
    lockInputs(running);
  }

  function clearIntervalTimer() {
    if (state.interval) {
      clearInterval(state.interval);
      state.interval = null;
    }
  }

  function finish() {
    state.running = false;
    clearIntervalTimer();
    render();
    beep({ frequency: 880, duration: 0.4 });
    if (notify) notify("Time's up — nice work.", "✦");
  }

  function tick() {
    state.remaining = Math.max(0, state.endAt - Date.now());
    if (state.remaining <= 0) {
      finish();
      return;
    }
    render();
  }

  function setFromInputs() {
    if (state.running) return;
    const duration = readInputs();
    state.original = duration;
    state.remaining = duration;
    if (elements.presets) {
      for (const button of elements.presets) {
        button.classList.toggle("active", Number(button.dataset.seconds) * 1000 === duration);
      }
    }
    render();
  }

  function toggle() {
    if (state.running) {
      state.remaining = Math.max(0, state.endAt - Date.now());
      state.running = false;
      clearIntervalTimer();
      render();
      return;
    }
    if (state.remaining <= 0) setFromInputs();
    if (state.remaining <= 0) {
      if (notify) notify("Set a timer longer than zero first.", "!");
      return;
    }
    state.running = true;
    state.endAt = Date.now() + state.remaining;
    clearIntervalTimer();
    state.interval = setInterval(tick, 100);
    render();
  }

  function reset() {
    clearIntervalTimer();
    state.running = false;
    state.remaining = readInputs();
    state.original = state.remaining;
    render();
  }

  function bind() {
    if (elements.minutes) elements.minutes.addEventListener("input", setFromInputs);
    if (elements.seconds) elements.seconds.addEventListener("input", setFromInputs);
    if (elements.presets) {
      for (const button of elements.presets) {
        button.addEventListener("click", () => {
          if (state.running) return;
          const totalSeconds = Number(button.dataset.seconds);
          if (elements.minutes) elements.minutes.value = String(Math.floor(totalSeconds / 60));
          if (elements.seconds) elements.seconds.value = String(totalSeconds % 60);
          setFromInputs();
        });
      }
    }
    if (elements.start) elements.start.addEventListener("click", toggle);
    if (elements.reset) elements.reset.addEventListener("click", reset);
  }

  return {
    init() {
      bind();
      setFromInputs();
    },
    render,
    toggle,
    reset,
    get running() {
      return state.running;
    },
    get remaining() {
      return state.remaining;
    },
    /** Called when the timer page is shown again: repaint the true state. */
    sync() {
      if (state.running) tick();
      else render();
    },
  };
}
