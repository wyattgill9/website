/*
 * A market-by-order (L3) limit order book for one large-tick stock, driven by the order-flow statistics the
 * microstructure literature measures, and reporting itself the way Nasdaq TotalView-ITCH 5.0 does:
 *
 * - Each price level is a FIFO queue of individual orders; executions take the oldest order first.
 * - Limit orders land Δ ticks behind their side's best quote with P(Δ) ∝ (1 + Δ)^-(1+μ), μ ≈ 0.6 (Bouchaud, Mézard &
 *   Potters 2002). When the spread opens past one tick, liquidity providers refill it fast, so a ~$180 stock with a
 *   1¢ tick shows a one-tick spread almost all the time.
 * - Every order carries a lifetime: fleeting at the touch (HFT quotes that live a few hundred ms), longer the deeper
 *   it rests. Most orders are cancelled, not filled. This is the per-order cancel rate of Cont, Stoikov & Talreja
 *   (2010), with the distance dependence they observed.
 * - Market orders arrive as a Hawkes process (each one raises the rate of the next; branching ratio 0.5), with signs
 *   that persist the way split-up parent orders make them persist. Sizes are mostly odd lots: odd lots are now the
 *   majority of US trades.
 * - Messages are ITCH's: A add, E executed (one per resting order filled), X partial cancel, D delete, U replace
 *   (new reference number, back of the queue), P trade for a non-displayed (midpoint) execution.
 */

export type Side = "B" | "S";
export type Order = { ref: number; side: Side; price: number; shares: number; born: number; dieAt: number };
export type Msg = {
    ns: number; // nanoseconds since midnight, Eastern, as ITCH timestamps are
    type: "A" | "E" | "X" | "D" | "U" | "P";
    ref: number;
    newRef?: number;
    side: Side;
    shares: number;
    price: number; // in ticks; a midpoint print is a half tick
};
/** For the renderer: what just happened where, so it can animate it. offset is shares ahead in the queue. */
export type Fx = { kind: "exec" | "cancel"; side: Side; price: number; offset: number; shares: number };

const TICKS_DEEP = 40; // how far behind the touch new orders are placed, at most
const LIMIT_RATE = 9; // limit orders per second, per side
const REFILL_RATE = 30; // extra limit orders per second while the spread is wider than one tick
const MO_BASE = 1.0; // market orders per second, before self-excitation
const MO_JUMP = 1.4; // how much each market order raises the rate…
const MO_DECAY = 2.8; // …and how fast that fades: branching ratio 1.4 / 2.8 = 0.5
const SIGN_PERSIST = 0.7;
const REPLACE_RATE = 1.6;
const HIDDEN_RATE = 0.25;
const FEED_KEEP = 120;
const BAND = 10; // ticks a single marketable order may walk the book

// Placement distances: P(Δ) ∝ (1 + Δ)^-1.6, as a cumulative table for inverse sampling.
const PLACE = (() => {
    const w = Array.from({ length: TICKS_DEEP + 1 }, (_, d) => Math.pow(1 + d, -1.6));
    const total = w.reduce((a, b) => a + b, 0);
    let acc = 0;
    return w.map((x) => (acc += x / total));
})();

export function createBookEngine(opts: { start?: number; random?: () => number; wallNs?: number } = {}) {
    const rnd = opts.random ?? Math.random;
    const exp = (mean: number) => -Math.log(1 - rnd()) * mean;
    const pick = <T>(xs: T[]) => xs[Math.floor(rnd() * xs.length)];

    const bids = new Map<number, Order[]>();
    const asks = new Map<number, Order[]>();
    const feed: Msg[] = [];
    const fx: Fx[] = [];
    const startNs = opts.wallNs ?? easternNsNow();
    let clock = 0;
    let nextRef = 40_000_000 + Math.floor(rnd() * 9_000_000);
    let excite = 0;
    let lastSign: Side = "B";
    let lastMid = 0;
    const stats = {
        msgs: 0,
        fills: 0,
        oddFills: 0,
        lastTrade: null as null | { price: number; side: Side; at: number },
    };

    const book = (s: Side) => (s === "B" ? bids : asks);
    const best = (s: Side) => {
        let b = s === "B" ? -Infinity : Infinity;
        for (const p of book(s).keys()) b = s === "B" ? Math.max(b, p) : Math.min(b, p);
        return b;
    };
    // Reference numbers climb by more than one: other symbols' orders share the sequence.
    const newRef = () => (nextRef += 1 + Math.floor(rnd() * 24));

    const emit = (m: Omit<Msg, "ns">, at: number) => {
        feed.push({ ...m, ns: startNs + Math.round(at * 1e9) });
        if (feed.length > FEED_KEEP) feed.splice(0, feed.length - FEED_KEEP);
        stats.msgs++;
    };

    const oddLot = () => (rnd() < 0.5 ? pick([1, 2, 5, 10, 10, 20, 25, 50, 50]) : 1 + Math.floor(rnd() * 99));
    const limitSize = () => {
        const r = rnd();
        if (r < 0.28) return oddLot();
        if (r < 0.72) return 100;
        if (r < 0.88) return 100 * (2 + Math.floor(rnd() * 4));
        if (r < 0.97) return pick([500, 1000]);
        return Math.min(10_000, 100 * Math.round(10 * Math.pow(1 - rnd(), -0.6)));
    };
    const marketSize = () => {
        const r = rnd();
        if (r < 0.5) return oddLot();
        if (r < 0.8) return 100;
        if (r < 0.96) return 100 * (2 + Math.floor(rnd() * 4));
        return Math.min(8_000, 100 * Math.round(6 * Math.pow(1 - rnd(), -0.7)));
    };

    /** Lifetime: some touch quotes are fleeting; the rest live longer the deeper they rest. */
    const lifetime = (depth: number) => {
        if (depth > 0) return exp(3 + 1.6 * depth);
        return rnd() < 0.5 ? exp(0.3) : exp(1.8);
    };

    const add = (side: Side, price: number, shares: number, at: number, depth: number) => {
        const o: Order = { ref: newRef(), side, price, shares, born: at, dieAt: at + lifetime(depth) };
        const q = book(side).get(price);
        if (q) q.push(o);
        else book(side).set(price, [o]);
        emit({ type: "A", ref: o.ref, side, shares, price }, at);
        return o;
    };

    const remove = (o: Order) => {
        const q = book(o.side).get(o.price)!;
        q.splice(q.indexOf(o), 1);
        if (!q.length) book(o.side).delete(o.price);
    };

    const offsetOf = (o: Order) => {
        let ahead = 0;
        for (const x of book(o.side).get(o.price)!) {
            if (x === o) break;
            ahead += x.shares;
        }
        return ahead;
    };

    /** The mid, or the last one there was if a side is momentarily empty. */
    const mid = () => {
        const m = (best("B") + best("S")) / 2;
        if (Number.isFinite(m)) lastMid = m;
        return lastMid;
    };

    const limitOrder = (side: Side, at: number) => {
        const own = best(side);
        const u = rnd();
        const depth = PLACE.findIndex((c) => u <= c);
        // An empty side quotes off the mid.
        const anchor = Number.isFinite(own) ? own : side === "B" ? Math.floor(mid()) : Math.ceil(mid());
        add(side, side === "B" ? anchor - depth : anchor + depth, limitSize(), at, depth);
    };

    /** Levels resting within 15 ticks of the touch: when a sweep thins a side, providers step back in. */
    const thin = (side: Side) => {
        const top = best(side);
        if (!Number.isFinite(top)) return true;
        let n = 0;
        for (const p of book(side).keys()) if (Math.abs(p - top) <= 15) n++;
        return n < 6;
    };

    /** Price improvement inside a spread wider than one tick. */
    const refill = (at: number) => {
        const bb = best("B");
        const ba = best("S");
        if (ba - bb <= 1) return;
        const side: Side = rnd() < 0.5 ? "B" : "S";
        const price = side === "B" ? bb + 1 : ba - 1;
        add(side, price, limitSize(), at, 0);
    };

    /**
     * A marketable order of `shares` from `side` (B buys, lifting asks): fills resting orders oldest-first, but no
     * more than BAND ticks through the book, like a marketable limit or an exchange price band would stop it.
     */
    const marketOrder = (side: Side, shares: number, at: number) => {
        const passive: Side = side === "B" ? "S" : "B";
        const first = best(passive);
        const done = { shares: 0, cost: 0, levels: new Set<number>() };
        while (shares > 0 && book(passive).size) {
            const price = best(passive);
            if (Math.abs(price - first) > BAND) break;
            const front = book(passive).get(price)![0];
            const fill = Math.min(front.shares, shares);
            shares -= fill;
            fx.push({ kind: "exec", side: passive, price, offset: 0, shares: fill });
            emit({ type: "E", ref: front.ref, side: passive, shares: fill, price }, at);
            front.shares -= fill;
            if (front.shares === 0) remove(front);
            stats.fills++;
            if (fill < 100) stats.oddFills++;
            stats.lastTrade = { price, side, at };
            done.shares += fill;
            done.cost += fill * price;
            done.levels.add(price);
        }
        return done;
    };

    const cancel = (o: Order, at: number) => {
        // Mostly whole-order deletes; sometimes a partial cancel that leaves the rest resting.
        if (o.shares > 1 && rnd() < 0.2) {
            const cut = Math.max(1, Math.floor(o.shares * (0.2 + 0.6 * rnd())));
            fx.push({
                kind: "cancel",
                side: o.side,
                price: o.price,
                offset: offsetOf(o) + o.shares - cut,
                shares: cut,
            });
            o.shares -= cut;
            o.dieAt = at + lifetime(3);
            emit({ type: "X", ref: o.ref, side: o.side, shares: cut, price: o.price }, at);
            return;
        }
        fx.push({ kind: "cancel", side: o.side, price: o.price, offset: offsetOf(o), shares: o.shares });
        remove(o);
        emit({ type: "D", ref: o.ref, side: o.side, shares: o.shares, price: o.price }, at);
    };

    /** A requote: the order moves a tick or two (never across the spread) under a new reference number. */
    const replace = (at: number) => {
        const side: Side = rnd() < 0.5 ? "B" : "S";
        const top = best(side);
        const near = [...book(side).entries()].filter(([p]) => Math.abs(p - top) <= 6).flatMap(([, q]) => q);
        if (!near.length) return;
        const o = pick(near);
        const other = best(side === "B" ? "S" : "B");
        let price = o.price + (rnd() < 0.5 ? 1 : -1) * (1 + Math.floor(rnd() * 2));
        price = side === "B" ? Math.min(price, other - 1) : Math.max(price, other + 1);
        if (price === o.price) return;
        fx.push({ kind: "cancel", side, price: o.price, offset: offsetOf(o), shares: o.shares });
        remove(o);
        const shares = rnd() < 0.7 ? o.shares : limitSize();
        const n: Order = { ref: newRef(), side, price, shares, born: at, dieAt: at + lifetime(Math.abs(price - top)) };
        const q = book(side).get(price);
        if (q) q.push(n);
        else book(side).set(price, [n]);
        emit({ type: "U", ref: o.ref, newRef: n.ref, side, shares, price }, at);
    };

    /** A non-displayed order executing at the midpoint: ITCH reports it as a P trade, with no book change. */
    const hidden = (at: number) => {
        const side: Side = rnd() < 0.5 ? "B" : "S";
        emit({ type: "P", ref: 0, side, shares: rnd() < 0.7 ? oddLot() : 100, price: mid() }, at);
        stats.fills++;
    };

    const poissonTimes = (rate: number, t0: number, dt: number) => {
        const out: number[] = [];
        for (let t = t0 + exp(1 / rate); t < t0 + dt; t += exp(1 / rate)) out.push(t);
        return out;
    };

    const step = (dt: number) => {
        const t0 = clock;
        type Ev = [number, () => void];
        const evs: Ev[] = [];
        for (const side of ["B", "S"] as const)
            for (const t of poissonTimes(LIMIT_RATE, t0, dt)) evs.push([t, () => limitOrder(side, t)]);
        if (best("S") - best("B") > 1)
            for (const t of poissonTimes(REFILL_RATE, t0, dt)) evs.push([t, () => refill(t)]);
        for (const side of ["B", "S"] as const)
            if (thin(side)) for (const t of poissonTimes(REFILL_RATE, t0, dt)) evs.push([t, () => limitOrder(side, t)]);
        for (const t of poissonTimes(MO_BASE + excite, t0, dt))
            evs.push([
                t,
                () => {
                    lastSign = rnd() < SIGN_PERSIST ? lastSign : lastSign === "B" ? "S" : "B";
                    excite += MO_JUMP;
                    marketOrder(lastSign, marketSize(), t);
                },
            ]);
        for (const t of poissonTimes(REPLACE_RATE, t0, dt)) evs.push([t, () => replace(t)]);
        for (const t of poissonTimes(HIDDEN_RATE, t0, dt)) evs.push([t, () => hidden(t)]);
        for (const q of [...bids.values(), ...asks.values()])
            for (const o of q) {
                if (o.dieAt >= t0 + dt) continue;
                const t = Math.max(t0, o.dieAt);
                // It may have been filled or replaced earlier in this same step.
                evs.push([
                    t,
                    () => {
                        if (isLive(o)) cancel(o, t);
                    },
                ]);
            }
        evs.sort((a, b) => a[0] - b[0]);
        for (const [, run] of evs) run();
        excite *= Math.exp(-MO_DECAY * dt);
        clock = t0 + dt;
        // Keep the book a sensible window around the market.
        const m = Math.round(mid());
        for (const p of bids.keys()) if (p < m - 80) bids.delete(p);
        for (const p of asks.keys()) if (p > m + 80) asks.delete(p);
    };

    const isLive = (o: Order) => book(o.side).get(o.price)?.includes(o) ?? false;

    // Seed one order per side at the touch, then run long enough for the book to reach its steady shape.
    const start = opts.start ?? 18237;
    lastMid = start + 0.5;
    add("B", start, 300, 0, 0);
    add("S", start + 1, 300, 0, 0);
    for (let i = 0; i < 40 * 20; i++) step(0.05);
    feed.length = 0;
    fx.length = 0;
    stats.msgs = stats.fills = stats.oddFills = 0;

    return {
        bids,
        asks,
        feed,
        fx,
        stats,
        best,
        step,
        now: () => clock,
        /** A visitor's order: marketable, sized to sweep a level or two. Returns what it filled. */
        sweep: (side: Side, shares: number) => marketOrder(side, shares, clock),
    };
}

/** Nanoseconds since midnight in New York, ITCH's clock. */
function easternNsNow() {
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/New_York",
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    }).formatToParts(new Date());
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0) % 24;
    const secs = get("hour") * 3600 + get("minute") * 60 + get("second");
    return secs * 1e9 + (Date.now() % 1000) * 1e6;
}
