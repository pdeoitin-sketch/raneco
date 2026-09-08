/**
 * The stopwatch (the Focus page).
 *
 * Elapsed time is always derived from timestamps, never accumulated by adding
 * frame deltas, so it cannot drift — and an optional goal turns the page into
 * a gentle progress bar rather than a judgement.
 */

import { pad } from "./ui.js";

export function formatStopwatch(milliseconds) {
  const centiseconds = Math.floor(milliseconds / 10);
  const minutes = Math.floor(centiseconds / 6000);
  const seconds = Math.floor((centiseconds % 6000) / 100);
  const hundredths = centiseconds % 100;
  return { text: `${pad(minutes)}:${pad(seconds)}.${pad(hundredths)}`, html: `${pad(minutes)}:${pad(seconds)}<span>.${pad(hundredths)}</span>` };
}

export function createStopwatch({ elements = {} } = {}) {
  const state = {
    elapsed: 0,
    startedAt: 0,
    running: false,
    interval: null,
    laps: [],
    lastLapAt: 0,
    target: 0,
  };

  function elapsedNow() {
    return state.running ? state.elapsed + (Date.now() - state.startedAt) : state.elapsed;
  }

  function renderLaps() {
    if (!elements.lapsList) return;
    if (!state.laps.length) {
      elements.lapsList.innerHTML = '<li class="empty-lap">Your laps will show up here.</li>';
      return;
    }
    elements.lapsList.innerHTML = [...state.laps]
      .reverse()
      .map((lap, index) => {
        const number = state.laps.length - index;
        return `
          <li>
            <span>Lap ${pad(number)}</span>
            <span>${formatStopwatch(lap.elapsed).text}</span>
            <span>+${formatStopwatch(lap.split).text}</span>
          </li>`;
      })
      .join("");
  }

  function renderTarget(elapsed) {
    if (!elements.targetProgress || !elements.targetCopy) return;
    if (!state.target) {
      elements.targetProgress.style.width = "0%";
      elements.targetCopy.textContent = "Set an optional goal to watch yourself fill it.";
      return;
    }
    const ratio = Math.min(1, elapsed / (state.target * 1000));
    elements.targetProgress.style.width = `${(ratio * 100).toFixed(1)}%`;
    if (ratio >= 1) elements.targetCopy.textContent = "Goal reached — that's the session done.";
    else {
      const leftSeconds = Math.ceil((state.target * 1000 - elapsed) / 1000);
      const minutes = Math.floor(leftSeconds / 60);
      const seconds = leftSeconds % 60;
      elements.targetCopy.textContent = `${Math.round(ratio * 100)}% of your goal · ${minutes}:${pad(seconds)} to go`;
    }
  }

  function render() {
    const elapsed = elapsedNow();
    if (elements.display) elements.display.innerHTML = formatStopwatch(elapsed).html;
    if (elements.start) {
      elements.start.innerHTML = state.running
        ? '<span class="play-icon">Ⅱ</span> Pause'
        : `<span class="play-icon">▶</span> ${elapsed > 0 ? "Resume" : "Start"}`;
    }
    if (elements.status) {
      elements.status.textContent = state.running ? "RUNNING" : elapsed > 0 ? "PAUSED" : "STOPPED";
      elements.status.classList.toggle("running", state.running);
      elements.status.classList.toggle("neutral", !state.running);
    }
    if (elements.lapButton) elements.lapButton.disabled = !state.running;
    if (elements.lapCount) {
      elements.lapCount.textContent = state.laps.length ? pad(state.laps.length) : "—";
    }
    renderTarget(elapsed);
  }

  function clearTick() {
    if (state.interval) {
      clearInterval(state.interval);
      state.interval = null;
    }
  }

  function toggle() {
    if (state.running) {
      state.elapsed = elapsedNow();
      state.running = false;
      clearTick();
      render();
      return;
    }
    state.startedAt = Date.now();
    state.lastLapAt = state.elapsed;
    state.running = true;
    clearTick();
    state.interval = setInterval(render, 37);
    render();
  }

  function reset() {
    clearTick();
    state.elapsed = 0;
    state.startedAt = 0;
    state.running = false;
    state.laps = [];
    state.lastLapAt = 0;
    render();
    renderLaps();
  }

  function addLap() {
    if (!state.running) return;
    const elapsed = elapsedNow();
    const split = elapsed - state.lastLapAt;
    state.laps.push({ elapsed, split });
    state.lastLapAt = elapsed;
    renderLaps();
    render();
  }

  function setTarget(seconds) {
    state.target = Math.max(0, Number(seconds) || 0);
    if (elements.targetRow) {
      for (const button of elements.targetRow.querySelectorAll("[data-target]")) {
        button.classList.toggle("active", Number(button.dataset.target) === state.target);
      }
    }
    render();
  }

  function bind() {
    if (elements.start) elements.start.addEventListener("click", toggle);
    if (elements.reset) elements.reset.addEventListener("click", reset);
    if (elements.lapButton) elements.lapButton.addEventListener("click", addLap);
    if (elements.targetRow) {
      elements.targetRow.addEventListener("click", (event) => {
        const button = event.target.closest("[data-target]");
        if (button) setTarget(button.dataset.target);
      });
    }
  }

  return {
    init() {
      bind();
      render();
      renderLaps();
      setTarget(0);
    },
    render,
    get running() {
      return state.running;
    },
    get laps() {
      return [...state.laps];
    },
    sync() {
      render();
    },
  };
}
