// Run: node --experimental-strip-types src/app/components/sims/book-engine.test.ts
// Ten simulated minutes, checked against the book's invariants and the stylized facts it's tuned to.
import assert from "node:assert/strict";
import { createBookEngine, type Order } from "./book-engine.ts";

const e = createBookEngine({ wallNs: 34_200e9 }); // 09:30 ET
const DT = 1 / 60;
let oneTick = 0;
let samples = 0;
let mids = 0;
let lastMid = (e.best("B") + e.best("S")) / 2;
const touchDepth: number[] = [];
const depthAt = (side: "B" | "S", k: number) => {
    const p = side === "B" ? e.best("B") - k : e.best("S") + k;
    return (side === "B" ? e.bids : e.asks).get(p)?.reduce((n: number, o: Order) => n + o.shares, 0) ?? 0;
};
const profile = Array(10).fill(0);
let lastNs = 0;
const msgTypes: Record<string, number> = {};
for (let i = 0; i < 60 * 60 * 10; i++) {
    e.step(DT);
    const bb = e.best("B");
    const ba = e.best("S");
    assert.ok(Number.isFinite(bb) && Number.isFinite(ba), `a side of the book emptied at step ${i}`);
    assert.ok(bb < ba, `crossed or locked book at step ${i}: ${bb} ≥ ${ba}`);
    for (const book of [e.bids, e.asks])
        for (const [p, q] of book) {
            assert.ok(q.length > 0, "empty level left in the map");
            for (const o of q) assert.ok(o.shares > 0 && o.price === p, "order on the wrong level or empty");
        }
    for (const m of e.feed.splice(0)) {
        assert.ok(m.ns >= lastNs, "ITCH timestamps went backwards");
        lastNs = m.ns;
        msgTypes[m.type] = (msgTypes[m.type] ?? 0) + 1;
    }
    e.fx.length = 0;
    samples++;
    if (ba - bb === 1) oneTick++;
    const mid = (bb + ba) / 2;
    if (mid !== lastMid) mids++;
    lastMid = mid;
    if (i % 30 === 0) {
        touchDepth.push(depthAt("B", 0));
        for (let k = 0; k < 10; k++) profile[k] += depthAt("B", k) + depthAt("S", k);
    }
}
const minutes = 10;
const rate = e.stats.msgs / (minutes * 60);
const spread1 = oneTick / samples;
const odd = e.stats.oddFills / Math.max(1, e.stats.fills);
const peak = profile.indexOf(Math.max(...profile));
console.log({
    msgsPerSec: rate.toFixed(1),
    oneTickSpread: (spread1 * 100).toFixed(1) + "%",
    midChangesPerMin: (mids / minutes).toFixed(1),
    oddLotFills: (odd * 100).toFixed(1) + "%",
    medianTouchShares: touchDepth.sort((a, b) => a - b)[touchDepth.length >> 1],
    depthProfile: profile.map((x) => Math.round(x / touchDepth.length)),
    msgTypes,
});
assert.ok(spread1 > 0.85, "a 1¢-tick large-cap should show a one-tick spread almost always");
assert.ok(rate > 25 && rate < 150, "message rate out of range");
assert.ok(mids / minutes > 10 && mids / minutes < 200, "the price should move, but not jitter constantly");
assert.ok(odd > 0.4 && odd < 0.8, "odd lots should be a large share of fills");
assert.ok(peak >= 1, "average depth should peak behind the touch (hump-shaped book)");
for (const t of ["A", "E", "X", "D", "U", "P"]) assert.ok(msgTypes[t] > 0, `no ${t} messages`);
assert.ok(msgTypes.D + msgTypes.X > msgTypes.E * 3, "most orders should be cancelled, not filled");
// Stress: a visitor hammering the book with big sweeps, both ways, every half second for five minutes.
const s = createBookEngine({ wallNs: 34_200e9 });
for (let i = 0; i < 60 * 60 * 5; i++) {
    s.step(DT);
    if (i % 30 === 0) s.sweep(i % 60 === 0 ? "B" : "S", 4000);
    assert.ok(Number.isFinite(s.best("B")) && Number.isFinite(s.best("S")), `stress: a side emptied at step ${i}`);
    assert.ok(s.best("B") < s.best("S"), `stress: crossed book at step ${i}`);
    s.feed.length = 0;
    s.fx.length = 0;
}
console.log("book engine ok");
