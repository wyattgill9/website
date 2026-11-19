import type { Sim } from "./sim-canvas";

/*
 * The first order book, kept as it was for comparison at /book-v1: a hand-tuned level-2 book (sizes per price, no
 * individual orders). Limit orders rest near the touch, cancels thin it out, and market orders sweep the best
 * levels and print trades. Drawn as a price ladder (asks above, bids below) with a trade tape beside it.
 * Click the ask side to buy, the bid side to sell.
 */

type Side = "bid" | "ask";
type Trade = { price: number; size: number; side: Side; at: number };

const TICK = 0.01;
const RATE = 45; // book events per second
const LOT = 100;

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const lots = (lo: number, hi: number) => LOT * Math.round(rand(lo, hi));
// Mostly near the touch, occasionally deep.
const depth = () => Math.floor(-Math.log(1 - Math.random()) * 5);

export function createBookV1(): Sim {
    const bids = new Map<number, number>();
    const asks = new Map<number, number>();
    const flash = new Map<string, number>(); // `${side}:${price}` → 1 fading to 0
    const tape: Trade[] = [];
    let trades = 0;
    let clock = 0;
    let carry = 0;
    let view = 0; // the ladder's centre, eased toward the mid
    let ladder = { x: 0, y: 0, w: 0, h: 0, rows: 0, rowH: 17 };
    let tapeBox: { x: number; y: number; w: number; h: number } | null = null;

    const best = (side: Side) => {
        const book = side === "bid" ? bids : asks;
        let b = side === "bid" ? -Infinity : Infinity;
        for (const p of book.keys()) b = side === "bid" ? Math.max(b, p) : Math.min(b, p);
        return b;
    };
    const mid = () => (best("bid") + best("ask")) / 2;

    // Seed a two-sided book around 182.40, one tick wide.
    const start = 18240;
    for (let k = 0; k < 40; k++) {
        bids.set(start - k, lots(1, 6 + k * 0.4));
        asks.set(start + 1 + k, lots(1, 6 + k * 0.4));
    }
    view = mid();

    const add = (side: Side, price: number, size: number) => {
        const book = side === "bid" ? bids : asks;
        book.set(price, (book.get(price) ?? 0) + size);
        flash.set(`${side}:${price}`, 0.5);
    };

    const sweep = (aggressor: Side, size: number) => {
        // A buy takes asks from the best upward; a sell takes bids from the best downward.
        const book = aggressor === "bid" ? asks : bids;
        const passive: Side = aggressor === "bid" ? "ask" : "bid";
        while (size > 0 && book.size) {
            const price = best(passive);
            const avail = book.get(price)!;
            const fill = Math.min(avail, size);
            size -= fill;
            if (fill === avail) book.delete(price);
            else book.set(price, avail - fill);
            flash.set(`${passive}:${price}`, 1);
            tape.unshift({ price, size: fill, side: aggressor, at: clock });
            trades++;
        }
        tape.length = Math.min(tape.length, 40);
    };

    const event = () => {
        const side: Side = Math.random() < 0.5 ? "bid" : "ask";
        const r = Math.random();
        const bb = best("bid");
        const ba = best("ask");
        if (r < 0.56) {
            // Limit order: away from the touch, or into the spread if there's room.
            let price = side === "bid" ? bb - depth() : ba + depth();
            if (ba - bb > 1 && Math.random() < 0.35) price = side === "bid" ? bb + 1 : ba - 1;
            add(side, price, lots(1, 5));
        } else if (r < 0.88) {
            // Cancel part of a resting order near the touch.
            const book = side === "bid" ? bids : asks;
            const price = side === "bid" ? bb - depth() : ba + depth();
            const size = book.get(price);
            if (!size) return;
            const left = size - lots(1, 4);
            if (left > 0) book.set(price, left);
            else book.delete(price);
        } else {
            sweep(side, lots(1, 9));
        }
        // Keep each side deep enough to fill the ladder.
        const m = Math.round(mid());
        for (let k = 1; k <= 40; k++) {
            if (!bids.has(m - k) && best("bid") > m - k && Math.random() < 0.02) bids.set(m - k, lots(2, 12));
            if (!asks.has(m + k) && best("ask") < m + k && Math.random() < 0.02) asks.set(m + k, lots(2, 12));
        }
        for (const p of bids.keys()) if (p < m - 80) bids.delete(p);
        for (const p of asks.keys()) if (p > m + 80) asks.delete(p);
    };

    const fmt = (p: number) => (p * TICK).toFixed(2);

    const rowAt = (y: number) => {
        const { rows, rowH } = ladder;
        const i = Math.floor((y - ladder.y) / rowH);
        if (i < 0 || i >= rows) return null;
        return Math.round(view) + Math.floor(rows / 2) - i;
    };

    return {
        layout({ area }) {
            const rowH = area.h < 420 ? 15 : 17;
            const rows = Math.max(9, Math.floor((area.h - 8) / rowH) | 1);
            const wantTape = area.w >= 540;
            const w = Math.min(wantTape ? area.w * 0.6 : area.w, 380);
            const total = wantTape ? Math.min(area.w, w + 220) : w;
            const x = area.x;
            const h = rows * rowH;
            const y = area.y + (area.h - h) / 2;
            ladder = { x, y, w, h, rows, rowH };
            tapeBox = wantTape ? { x: x + w + 36, y, w: total - w - 36, h } : null;
        },

        step(dt) {
            clock += dt;
            carry += dt * RATE;
            while (carry >= 1) {
                carry--;
                event();
            }
            view += (mid() - view) * Math.min(1, dt * 3);
            for (const [k, v] of flash) {
                const next = v - dt * 1.6;
                if (next <= 0) flash.delete(k);
                else flash.set(k, next);
            }
        },

        draw(ctx, { ink, accent, font, bg }) {
            const { x, y, w, rows, rowH } = ladder;
            const priceW = 64;
            const px = x + (w - priceW) / 2; // price column
            const barMax = (w - priceW) / 2 - 8;
            const top = Math.round(view) + Math.floor(rows / 2);
            const offset = (view - Math.round(view)) * rowH; // sub-row scroll as the mid moves
            const bb = best("bid");
            const ba = best("ask");
            let maxSize = 1;
            for (let i = 0; i < rows; i++) {
                const p = top - i;
                maxSize = Math.max(maxSize, bids.get(p) ?? 0, asks.get(p) ?? 0);
            }

            ctx.save();
            ctx.beginPath();
            ctx.rect(x - 4, y, w + 8, rows * rowH);
            ctx.clip();
            ctx.font = `11px ${font}`;
            ctx.textBaseline = "middle";
            for (let i = -1; i <= rows; i++) {
                const p = top - i;
                const ry = y + i * rowH + offset;
                const cy = ry + rowH / 2;
                const bid = p <= bb ? bids.get(p) : undefined;
                const ask = p >= ba ? asks.get(p) : undefined;

                // The spread: a faint band between the best bid and best ask.
                if (p > bb && p < ba) {
                    ctx.fillStyle = ink(0.035);
                    ctx.fillRect(x, ry, w, rowH);
                }

                for (const [side, size] of [
                    ["bid", bid],
                    ["ask", ask],
                ] as const) {
                    if (!size) continue;
                    const f = flash.get(`${side}:${p}`) ?? 0;
                    const len = (size / maxSize) * barMax;
                    const color = side === "ask" ? accent : null;
                    ctx.globalAlpha = 0.14 + 0.4 * f;
                    ctx.fillStyle = color ?? ink(1);
                    if (side === "bid") ctx.fillRect(px - 6 - len, ry + 2, len, rowH - 4);
                    else ctx.fillRect(px + priceW + 6, ry + 2, len, rowH - 4);
                    ctx.globalAlpha = 1;
                    ctx.fillStyle = color ?? ink(0.75);
                    ctx.textAlign = side === "bid" ? "right" : "left";
                    ctx.fillText(size.toLocaleString("en-US"), side === "bid" ? px - 10 : px + priceW + 10, cy);
                }

                const touch = p === bb || p === ba;
                ctx.textAlign = "center";
                ctx.fillStyle = touch ? ink(0.95) : ink(bid || ask ? 0.45 : 0.18);
                ctx.fillText(fmt(p), px + priceW / 2, cy);
            }
            ctx.restore();

            // Fade the ladder's ends into the page, so it reads as a window onto a deeper book.
            const fadeH = rowH * 3;
            for (const [y0, y1] of [
                [y, y + fadeH],
                [y + rows * rowH, y + rows * rowH - fadeH],
            ]) {
                const g = ctx.createLinearGradient(0, y0, 0, y1);
                g.addColorStop(0, bg);
                g.addColorStop(1, `${bg}00`);
                ctx.fillStyle = g;
                ctx.fillRect(x - 4, Math.min(y0, y1), w + 8, fadeH);
            }

            if (tapeBox) {
                const t = tapeBox;
                ctx.font = `11px ${font}`;
                ctx.textBaseline = "middle";
                ctx.textAlign = "left";
                ctx.fillStyle = ink(0.35);
                ctx.fillText("time      price   size", t.x, t.y + rowH / 2);
                const shown = Math.floor(t.h / rowH) - 2;
                tape.slice(0, shown).forEach((tr, i) => {
                    const age = clock - tr.at;
                    const fresh = Math.max(0, 1 - age * 1.5);
                    const cy = t.y + (i + 2) * rowH + rowH / 2;
                    const alpha = Math.max(0.12, 0.8 - i * (0.7 / shown));
                    const secs = new Date(Date.now() - age * 1000);
                    const time = `${String(secs.getMinutes()).padStart(2, "0")}:${String(secs.getSeconds()).padStart(2, "0")}.${String(secs.getMilliseconds()).padStart(3, "0")}`;
                    ctx.fillStyle = ink(alpha);
                    ctx.fillText(time, t.x, cy);
                    ctx.fillStyle = tr.side === "bid" ? accent : ink(alpha + 0.1);
                    ctx.globalAlpha = tr.side === "bid" ? Math.min(1, alpha + 0.2 + fresh) : 1;
                    ctx.fillText(fmt(tr.price), t.x + 80, cy);
                    ctx.globalAlpha = 1;
                    ctx.fillStyle = ink(alpha);
                    ctx.fillText(String(tr.size).padStart(5, " "), t.x + 136, cy);
                });
            }
        },

        click(x, y) {
            if (x < ladder.x || x > ladder.x + ladder.w) return false;
            const p = rowAt(y);
            if (p === null) return false;
            sweep(p >= mid() ? "bid" : "ask", lots(8, 16));
            return true;
        },
        hit: (x, y) => x >= ladder.x && x <= ladder.x + ladder.w && rowAt(y) !== null,

        status() {
            const spread = best("ask") - best("bid");
            return `book · ${fmt(best("bid"))} × ${fmt(best("ask"))} · spread ${spread}¢ · ${trades.toLocaleString("en-US")} trades`;
        },
    };
}
