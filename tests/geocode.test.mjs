import assert from "node:assert/strict";
import test from "node:test";

import {
  FINE_ACCURACY_M,
  IP_ACCURACY_THRESHOLD_M,
  buildReverseGeocodeUrl,
  describeAccuracy,
  isProbablyIpFix,
  parseReverseGeocode,
  reverseGeocode,
} from "../src/geocode.js";

const ok = (body) => async () => ({ ok: true, status: 200, json: async () => body });

/** A real-shaped BigDataCloud answer: Bhaktapur, not "near Kathmandu". */
const bhaktapur = {
  latitude: 27.671,
  longitude: 85.4298,
  lookupSource: "coordinates",
  continent: "Asia",
  countryName: "Nepal",
  countryCode: "NP",
  principalSubdivision: "Bagmati Province",
  city: "Bhaktapur",
  locality: "Madhyapur Thimi",
  postcode: "44800",
  localityInfo: {
    administrative: [
      { adminLevel: 2, name: "Nepal" },
      { adminLevel: 4, name: "Bagmati Province" },
      { adminLevel: 6, name: "Bhaktapur" },
      { adminLevel: 8, name: "Madhyapur Thimi" },
    ],
  },
};

test("the request asks the free client endpoint for the right point", () => {
  const url = new URL(buildReverseGeocodeUrl({ lat: 27.6710123, lon: 85.4298456 }));
  assert.equal(url.origin, "https://api.bigdatacloud.net");
  assert.equal(url.pathname, "/data/reverse-geocode-client");
  // Five decimals is about a metre — finer than any fix, and it keeps the
  // URL stable enough to be cached.
  assert.equal(url.searchParams.get("latitude"), "27.67101");
  assert.equal(url.searchParams.get("longitude"), "85.42985");
  assert.equal(url.searchParams.get("localityLanguage"), "en");
});

test("a fix is named by its real administrative hierarchy", () => {
  const parsed = parseReverseGeocode(bhaktapur);
  assert.equal(parsed.ok, true);
  // This is the whole point: standing in Bhaktapur no longer says Kathmandu.
  assert.equal(parsed.city, "Bhaktapur");
  assert.equal(parsed.region, "Bagmati Province");
  assert.equal(parsed.country, "Nepal");
  assert.equal(parsed.countryCode, "NP");
  assert.equal(parsed.locality, "Madhyapur Thimi");
  assert.equal(parsed.detail, "Madhyapur Thimi, Bhaktapur, Bagmati Province");
  assert.equal(parsed.fromIp, false);
  assert.equal(parsed.postcode, "44800");
});

test("a name is never repeated in the detail line", () => {
  // When the locality and the city are the same place, saying it twice reads
  // like a bug — "Delhi, Delhi, Delhi".
  const parsed = parseReverseGeocode({
    countryName: "India",
    countryCode: "IN",
    principalSubdivision: "Delhi",
    city: "Delhi",
    locality: "Delhi",
    localityInfo: { administrative: [{ adminLevel: 4, name: "Delhi" }, { adminLevel: 8, name: "Delhi" }] },
  });
  assert.equal(parsed.city, "Delhi");
  assert.equal(parsed.detail, "Delhi");
  assert.equal(parsed.locality, "");
});

test("an IP fallback admits what it is", () => {
  const parsed = parseReverseGeocode({ ...bhaktapur, lookupSource: "ipGeolocation" });
  assert.equal(parsed.fromIp, true, "so the UI can warn instead of pretending");
});

test("an empty or broken payload is null, not a half-named place", () => {
  assert.equal(parseReverseGeocode(null), null);
  assert.equal(parseReverseGeocode({}), null);
  assert.equal(parseReverseGeocode("nope"), null);
  // A payload with only a country still names something useful.
  assert.equal(parseReverseGeocode({ countryName: "Nepal", countryCode: "NP" }).city, "Nepal");
});

test("reverse geocoding never throws — every failure is a value", async () => {
  const found = await reverseGeocode({ lat: 27.671, lon: 85.4298, fetchImpl: ok(bhaktapur) });
  assert.equal(found.ok, true);
  assert.equal(found.city, "Bhaktapur");

  assert.deepEqual(await reverseGeocode({ lat: NaN, lon: 1 }), { ok: false, reason: "no-coords" });
  assert.deepEqual(await reverseGeocode({ lat: 1, lon: 1, fetchImpl: "nope" }), { ok: false, reason: "unsupported" });

  const http = await reverseGeocode({ lat: 1, lon: 1, fetchImpl: async () => ({ ok: false, status: 503 }) });
  assert.equal(http.reason, "http");

  // 402 is how the service reports a fair-use ban; it deserves its own name
  // so the UI can stop asking rather than retrying into a wall.
  const banned = await reverseGeocode({ lat: 1, lon: 1, fetchImpl: async () => ({ ok: false, status: 402 }) });
  assert.equal(banned.reason, "rate-limited");

  const thrown = await reverseGeocode({
    lat: 1,
    lon: 1,
    fetchImpl: async () => {
      throw new Error("offline");
    },
  });
  assert.equal(thrown.reason, "network");
});

/* ---------------------------------------------------------------- accuracy */

test("accuracy is reported honestly, in words a person can act on", () => {
  assert.equal(describeAccuracy(18).level, "gps");
  assert.match(describeAccuracy(18).label, /±18 m — GPS/);

  assert.equal(describeAccuracy(180).level, "fine");
  assert.equal(describeAccuracy(900).level, "coarse");
  assert.match(describeAccuracy(900).label, /wifi/);
  assert.equal(describeAccuracy(9000).level, "coarse");
  assert.match(describeAccuracy(9000).label, /9\.0 km/);

  // The one that matters: a 40 km radius is an IP lookup wearing a GPS hat,
  // and it is what made "use my location" feel random.
  assert.equal(describeAccuracy(40000).level, "ip");
  assert.match(describeAccuracy(40000).label, /network estimate/);
  assert.equal(isProbablyIpFix(40000), true);
  assert.equal(isProbablyIpFix(120), false);
  assert.equal(isProbablyIpFix(IP_ACCURACY_THRESHOLD_M - 1), false);
  assert.equal(isProbablyIpFix(IP_ACCURACY_THRESHOLD_M), true);

  assert.equal(describeAccuracy(null).level, "unknown");
  assert.equal(describeAccuracy(0).level, "unknown");
  assert.equal(describeAccuracy("abc").level, "unknown");
  assert.ok(FINE_ACCURACY_M > 0);
});
