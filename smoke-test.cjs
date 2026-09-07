/* Runtime smoke test: loads the real built app into jsdom and exercises features. */
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const root = "/home/user/raneco";
let html = fs.readFileSync(path.join(root, "index.html"), "utf8");
html = html.replace(/<script type="module" src="\/app.js"><\/script>/, "");

const assetsDir = path.join(root, "dist", "assets");
const jsFile = fs.readdirSync(assetsDir).find((f) => f.endsWith(".js"));
const bundle = fs.readFileSync(path.join(assetsDir, jsFile), "utf8");

const errors = [];
const dom = new JSDOM(html, { runScripts: "outside-only", url: "http://localhost/", pretendToBeVisual: true });
const { window } = dom;
window.addEventListener("error", (e) => errors.push(e.message));

try {
  window.eval(bundle);
} catch (err) {
  console.error("EVAL FAILED:", err.message);
  process.exit(1);
}

const doc = window.document;
const $ = (s) => doc.querySelector(s);
const results = [];
const check = (name, cond) => {
  results.push([name, !!cond]);
  if (!cond) console.error("FAIL:", name);
};

setTimeout(() => {
  try {
    // 1. Live clock populated
    check("digital hours rendered", /(\d{1,2})/.test($("#local-hours").textContent) && $("#local-hours").textContent !== "--");
    check("digital minutes rendered", /^\d{2}$/.test($("#local-minutes").textContent));
    check("date rendered", !/Loading/.test($("#local-date").textContent));
    check("zone name rendered", !/Finding/.test($("#local-zone-name").textContent));
    check("world grid populated", doc.querySelectorAll(".world-card").length >= 4);
    check("midnight countdown rendered", /^\d{1,2}:\d{2}(:\d{2})?$/.test($("#midnight-countdown").textContent) && !$("#midnight-countdown").textContent.includes("--"));

    // 2. 12/24h toggle
    const was24 = $("#format-24").classList.contains("active");
    $("#format-12").click();
    check("12h toggle active", $("#format-12").classList.contains("active") && !$("#format-24").classList.contains("active"));
    check("AM/PM period visible in 12h", !$("#local-period").hidden && /^(AM|PM)$/.test($("#local-period").textContent));
    check("12h hours in 1..12 range", Number($("#local-hours").textContent) >= 1 && Number($("#local-hours").textContent) <= 12);
    $("#format-24").click();
    check("24h restores period hidden", $("#local-period").hidden);
    check("24h hours zero-padded", /^\d{2}$/.test($("#local-hours").textContent));
    check("format persisted", window.localStorage.getItem("tempo-hour-format") === "24");

    // 3. Converter (5 days example from the user)
    $("#convert-value").value = "5";
    $("#convert-unit").value = "days";
    $("#convert-unit").dispatchEvent(new window.Event("change", { bubbles: true }));
    const conv = Array.from(doc.querySelectorAll(".conversion-result strong")).map((n) => n.textContent);
    check("5 days = 120 hours", conv[0] === "120");
    check("5 days = 7,200 minutes", conv[1] === "7,200");
    check("5 days = 432,000 seconds", conv[2] === "432,000");

    // 4. Duration calculator: now -> in 15 days at 02:00 (user's example)
    const now = new Date();
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: new Intl.DateTimeFormat().resolvedOptions().timeZone,
      year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
    }).formatToParts(now).reduce((a, p) => (p.type !== "literal" && (a[p.type] = p.value), a), {});
    const target = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + 15, 2, 0, 0));
    const pad = (v) => String(v).padStart(2, "0");
    const startVal = `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
    const endVal = `${target.getUTCFullYear()}-${pad(target.getUTCMonth() + 1)}-${pad(target.getUTCDate())}T02:00`;
    $("#start-datetime").value = startVal;
    $("#end-datetime").value = endVal;
    $("#start-datetime").dispatchEvent(new window.Event("change", { bubbles: true }));
    $("#end-datetime").dispatchEvent(new window.Event("change", { bubbles: true }));
    const hoursText = $("#total-hours").textContent;
    const approxHours = Math.round((target - now) / 3600000);
    check("duration ~15 days in hours", Math.abs(Number(hoursText.replace(/,/g, "")) - approxHours) <= 1);
    check("duration words show days", /days?/.test($("#duration-words").textContent));
    check("live countdown visible", !$("#live-remaining").hidden);
    check("live countdown has h/m/s", /\d+h \d+m \d+s left until/.test($("#live-remaining-text").textContent));

    // 5. Alarm: arm at next minute, then disarm
    const nextMin = new Date(now.getTime() + 60000);
    const nmParts = new Intl.DateTimeFormat("en-CA", {
      timeZone: new Intl.DateTimeFormat().resolvedOptions().timeZone,
      hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }).formatToParts(nextMin).reduce((a, p) => (p.type !== "literal" && (a[p.type] = p.value), a), {});
    $("#alarm-time").value = `${nmParts.hour}:${nmParts.minute}`;
    $("#alarm-time").dispatchEvent(new window.Event("input", { bubbles: true }));
    $("#alarm-toggle").click();
    check("alarm armed status", $("#alarm-status").textContent === "ARMED");
    check("alarm eta text", /Fires (today|tomorrow) at/.test($("#alarm-remaining").textContent));
    check("alarm button shows Disarm", /Disarm/.test($("#alarm-toggle").textContent));
    $("#alarm-toggle").click();
    check("alarm disarmed", $("#alarm-status").textContent === "OFF");

    // 6. Stopwatch: start, lap, stop
    $("#stopwatch-start").click();
    check("stopwatch running", $("#stopwatch-status").textContent === "RUNNING");
    check("lap button enabled", !$("#lap-button").disabled);
    $("#lap-button").click();
    check("lap recorded", doc.querySelectorAll("#laps-list li:not(.empty-lap)").length === 1);
    $("#stopwatch-start").click();
    check("stopwatch paused", $("#stopwatch-status").textContent === "PAUSED");

    // 7. Timer presets
    doc.querySelector('.preset-button[data-seconds="300"]').click();
    check("timer set to 5:00", $("#timer-display").textContent === "05:00");

    // 8. Theme toggle
    $("#theme-button").click();
    check("dark theme on", doc.body.classList.contains("dark"));
    $("#theme-button").click();
    check("dark theme off", !doc.body.classList.contains("dark"));

    // 9. No runtime errors
    check("no page errors", errors.length === 0);
    if (errors.length) console.error("Page errors:", errors);

    const failed = results.filter(([, ok]) => !ok);
    console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
    process.exit(failed.length ? 1 : 0);
  } catch (err) {
    console.error("SMOKE TEST CRASH:", err);
    process.exit(1);
  }
}, 120);
