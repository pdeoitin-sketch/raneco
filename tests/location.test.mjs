import assert from "node:assert/strict";
import test from "node:test";

import {
  buildZoneLookupUrl,
  currentLocation,
  locationErrorMessage,
  lookupZoneByCoords,
  placeFromCoords,
} from "../src/location.js";

const ok = (body) => async () => ({ ok: true, status: 200, json: async () => body });
const failure = () => async () => ({ ok: false, status: 503, json: async () => ({}) });

/** Open-Meteo answers a coordinate with the zone that legally covers it. */
const zonePayload = {
  latitude: 28.57,
  longitude: 77.18,
  utc_offset_seconds: 19800,
  timezone: "Asia/Kolkata",
  timezone_abbreviation: "GMT+5:30",
  current: { temperature_2m: 31.2 },
};

function withGeolocation(position, error) {
  const geolocation = {
    getCurrentPosition(onSuccess, onError) {
      if (error) onError(error);
      else onSuccess({ coords: position });
    },
  };
  Object.defineProperty(globalThis, "navigator", {
    value: { geolocation },
    configurable: true,
    writable: true,
  });
}

test("the zone lookup asks Open-Meteo, and reads its answer", async () => {
  const url = new URL(buildZoneLookupUrl({ lat: 28.6139, lon: 77.209 }));
  assert.equal(url.origin, "https://api.open-meteo.com");
  assert.equal(url.searchParams.get("timezone"), "auto");
  assert.equal(url.searchParams.get("latitude"), "28.6139");

  const found = await lookupZoneByCoords({ lat: 28.6139, lon: 77.209, fetchImpl: ok(zonePayload) });
  assert.equal(found.ok, true);
  assert.equal(found.zone, "Asia/Kolkata");
  assert.equal(found.utcOffsetSeconds, 19800);
  assert.equal(found.source, "open-meteo");
});

test("a zone lookup that fails says so instead of throwing", async () => {
  assert.deepEqual(await lookupZoneByCoords({ lat: 1, lon: 1, fetchImpl: failure() }), { ok: false, reason: "http" });
  assert.deepEqual(await lookupZoneByCoords({ lat: NaN, lon: 1 }), { ok: false, reason: "no-coords" });
  assert.deepEqual(await lookupZoneByCoords({ lat: 1, lon: 1, fetchImpl: "not-a-function" }), {
    ok: false,
    reason: "unsupported",
  });
  const broken = await lookupZoneByCoords({ lat: 1, lon: 1, fetchImpl: async () => ({ ok: true, json: async () => ({}) }) });
  assert.equal(broken.ok, false, "a payload with no timezone is not an answer");
});

test("coordinates become a place, with or without the network", async () => {
  const withNetwork = await placeFromCoords({ lat: 28.6139, lon: 77.209, fetchImpl: ok(zonePayload) });
  assert.equal(withNetwork.ok, true);
  assert.equal(withNetwork.zoneConfirmed, true);
  assert.equal(withNetwork.place.zone, "Asia/Kolkata");
  assert.equal(withNetwork.place.city, "Delhi", "the nearest city still names it");
  assert.ok(Math.abs(withNetwork.place.lat - 28.6139) < 0.001);

  // Offline: the gazetteer's nearest city implies the zone.
  const offline = await placeFromCoords({ lat: 19.076, lon: 72.8777, lookup: false });
  assert.equal(offline.ok, true);
  assert.equal(offline.zoneConfirmed, false);
  assert.equal(offline.place.city, "Mumbai");
  assert.equal(offline.place.zone, "Asia/Kolkata");

  assert.equal((await placeFromCoords({ lat: "x", lon: 1 })).ok, false);
});

test("'use my location' resolves a place end to end", async () => {
  withGeolocation({ latitude: 28.6139, longitude: 77.209, accuracy: 24 });
  const result = await currentLocation({ fetchImpl: ok(zonePayload) });
  assert.equal(result.ok, true);
  assert.equal(result.place.city, "Delhi");
  assert.equal(result.place.zone, "Asia/Kolkata");
  assert.equal(result.accuracy, 24);
  assert.equal(result.place.id.startsWith("geo:"), true);
});

test("a refused permission is a message, not an exception", async () => {
  withGeolocation(null, { code: 1 });
  const denied = await currentLocation({ fetchImpl: ok(zonePayload) });
  assert.equal(denied.ok, false);
  assert.equal(denied.reason, "denied");
  assert.match(locationErrorMessage(denied), /declined/);

  withGeolocation(null, { code: 2 });
  assert.equal((await currentLocation({ fetchImpl: ok(zonePayload) })).reason, "denied");

  withGeolocation(null, { code: 3 });
  const unavailable = await currentLocation({ fetchImpl: ok(zonePayload) });
  assert.equal(unavailable.reason, "unavailable");
  assert.match(locationErrorMessage(unavailable), /No position fix/);

  assert.equal(locationErrorMessage({ ok: true }), "");
  assert.equal(locationErrorMessage(null), "");
  assert.match(locationErrorMessage({ ok: false, reason: "unsupported" }), /no location support/);
});
