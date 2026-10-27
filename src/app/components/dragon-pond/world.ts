export const TAU = Math.PI * 2;
export const DRAGON_NODES = 40;

export const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
const rand = (lo: number, hi: number) => lo + Math.random() * (hi - lo);

export function smoothstep(e0: number, e1: number, x: number) {
    const t = clamp((x - e0) / (e1 - e0), 0, 1);
    return t * t * (3 - 2 * t);
}

export function angleDiff(a: number, b: number) {
    let d = (b - a) % TAU;
    if (d > Math.PI) d -= TAU;
    if (d < -Math.PI) d += TAU;
    return d;
}

// Deterministic integer hash to [0, 1), so textures stay pinned to the body.
export function hash3(x: number, y: number, z: number) {
    let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 1442695041);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
}

export type Box = { left: number; top: number; right: number; bottom: number };

export type Variety = "crimson" | "jade" | "gold";

/** One dragon of each colour; the last is the young one. */
const VARIETIES: Variety[] = ["crimson", "jade", "gold"];

export interface Dragon {
    id: number;
    variety: Variety;
    length: number;
    /** Spine positions, snout first: [x0, y0, x1, y1, ...]. */
    nodes: Float32Array;
    heading: number;
    speed: number;
    phase: number;
    /** Smoothed angular velocity, used to splay the fins into turns. */
    turn: number;
    wander: number;
    /** How strongly this dragon swims over to the cursor. */
    curiosity: number;
    /** 0.5 far off and hazy to 1 up close. */
    depth: number;
    depthTarget: number;
    depthMax: number;
    nextDive: number;
    /** 1 just after a pearl appears nearby, fading: the dragon sprints and turns harder while it lasts. */
    rush: number;
    /** The pellet this dragon is going for. It sticks with it so a burst of clicks doesn't yank it around. */
    food: Pellet | null;
    /** Tail-beat intensity: dragons swim in bursts of beats, then coast with the tail still. */
    beat: number;
    burstUntil: number;
    nextBurst: number;
    /** Phase of the pectoral fins, which scull gently while the dragon coasts or hovers. */
    finPhase: number;
    /** 1 right after a fright, fading as the dragon calms down. */
    startle: number;
    fleeX: number;
    fleeY: number;
    /** How far the mouth is open, as the dragon closes in on food. */
    gulp: number;
}

export interface Pellet {
    x: number;
    y: number;
    born: number;
    /** Seconds after `born` that it takes to glow in; until then dragons can't eat it. */
    landAt: number;
    landed: boolean;
    /** Slow drift once it's hanging in the air. */
    vx: number;
    vy: number;
}

/** The moment a dragon takes a pellet, drawn as a brief flash where it happened. */
export interface Bite {
    x: number;
    y: number;
    born: number;
}

const push = { x: 0, y: 0 };

/** Sum of pushes away from every box within `margin` of (x, y), each scaled 0..1 by closeness. */
function repel(boxes: Box[], x: number, y: number, margin: number, out: { x: number; y: number }) {
    out.x = 0;
    out.y = 0;
    for (const b of boxes) {
        let ox = x - clamp(x, b.left, b.right);
        let oy = y - clamp(y, b.top, b.bottom);
        let d = Math.hypot(ox, oy);
        if (d > margin) continue;
        if (d < 1e-3) {
            // Inside the box: head for the nearest edge.
            const edges = [b.left - x, x - b.right, b.top - y, y - b.bottom];
            const nearest = edges.indexOf(Math.max(...edges));
            ox = nearest === 0 ? -1 : nearest === 1 ? 1 : 0;
            oy = nearest === 2 ? -1 : nearest === 3 ? 1 : 0;
            d = 0;
        }
        const len = Math.hypot(ox, oy) || 1;
        out.x += (ox / len) * (1 - d / margin);
        out.y += (oy / len) * (1 - d / margin);
    }
    return out;
}

export const BITE_LIFE = 0.45;
const RUSH_RANGE = 650;
const FEED_CALM = 2;
const STARTLE_SPEED = 1100;
const MAX_PELLETS = 6;

export class World {
    width = 0;
    height = 0;
    time = 0;
    dragons: Dragon[] = [];
    pellets: Pellet[] = [];
    bites: Bite[] = [];
    /** Moving the mouse to throw food isn't a threat, so swipes don't startle dragons for a moment after a throw. */
    private lastFeed = -Infinity;
    pointer = { x: 0, y: 0, speed: 0, active: false };
    /** Page content the dragons steer around, in canvas space. */
    avoid: Box[] = [];

    resize(width: number, height: number) {
        const first = this.width === 0;
        this.width = width;
        this.height = height;
        if (first) this.seed();
    }

    private seed() {
        const { width: W, height: H } = this;
        const minSide = Math.min(W, H);
        const baseLength = clamp(minSide * 1.2, 380, 950);
        this.dragons = [];
        // Two grown dragons and a young one that keeps farther off, for a sense of depth.
        for (let i = 0; i < VARIETIES.length; i++) {
            const isYoung = i === VARIETIES.length - 1;
            const length = baseLength * (isYoung ? rand(0.4, 0.5) : rand(0.75, 1));
            const depthMax = isYoung ? 0.72 : 1;
            const heading = rand(0, TAU);
            const x = rand(W * 0.1, W * 0.9);
            const y = rand(H * 0.1, H * 0.9);
            const nodes = new Float32Array(DRAGON_NODES * 2);
            const seg = length / (DRAGON_NODES - 1);
            // Laid out in a loose S rather than a straight rod, so the first frame already looks like a dragon.
            nodes[0] = x;
            nodes[1] = y;
            for (let n = 1; n < DRAGON_NODES; n++) {
                const a = heading + 0.6 * Math.sin((n / DRAGON_NODES) * TAU);
                nodes[n * 2] = nodes[(n - 1) * 2] - Math.cos(a) * seg;
                nodes[n * 2 + 1] = nodes[(n - 1) * 2 + 1] - Math.sin(a) * seg;
            }
            this.dragons.push({
                id: i + 1,
                variety: VARIETIES[i],
                length,
                nodes,
                heading,
                speed: 20,
                phase: rand(0, TAU),
                turn: 0,
                wander: 0,
                curiosity: rand(0.35, 1),
                depth: rand(0.5, depthMax),
                depthTarget: rand(0.5, depthMax),
                depthMax,
                nextDive: rand(6, 18),
                beat: 0,
                rush: 0,
                food: null,
                burstUntil: 0,
                nextBurst: rand(0, 3),
                finPhase: rand(0, TAU),
                startle: 0,
                fleeX: 0,
                fleeY: 0,
                gulp: 0,
            });
        }
    }

    /** A single pearl conjured at (x, y): it glows in, then drifts until a dragon takes it. */
    feed(x: number, y: number) {
        this.lastFeed = this.time;
        // A full sky takes no more pearls, rather than dropping old ones out from under dragons already going for them.
        if (this.pellets.length >= MAX_PELLETS) return;
        const a = rand(0, TAU);
        const drift = rand(2, 6);
        this.pellets.push({
            x,
            y,
            born: this.time,
            landAt: 0.3,
            landed: false,
            vx: Math.cos(a) * drift,
            vy: Math.sin(a) * drift,
        });
    }

    step(dt: number) {
        this.time += dt;
        this.pointer.speed *= Math.exp(-dt * 8);
        for (const k of this.dragons) this.stepDragon(k, dt);
        const t = this.time;
        for (const p of this.pellets) {
            if (!p.landed) {
                if (t - p.born < p.landAt) continue;
                p.landed = true;
                // Its arrival is what dragons react to: every dragon in range turns and bolts for it at once.
                for (const k of this.dragons) {
                    if (Math.hypot(k.nodes[0] - p.x, k.nodes[1] - p.y) < RUSH_RANGE) k.rush = 1;
                }
                continue;
            }
            const damp = Math.exp(-dt * 0.2);
            p.vx *= damp;
            p.vy *= damp;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
        }
        this.bites = this.bites.filter((b) => t - b.born < BITE_LIFE);
    }

    private stepDragon(k: Dragon, dt: number) {
        const { width: W, height: H, pointer, time } = this;
        const L = k.length;
        const nodes = k.nodes;
        const hx = nodes[0];
        const hy = nodes[1];

        let dx = Math.cos(k.heading);
        let dy = Math.sin(k.heading);

        k.wander = clamp(k.wander + (Math.random() - 0.5) * dt * 2.4, -0.9, 0.9);
        dx += Math.cos(k.heading + k.wander) * 0.6;
        dy += Math.sin(k.heading + k.wander) * 0.6;

        const food = this.pickFood(k, hx, hy, Math.max(L * 1.6 + 220, k.rush > 0 ? RUSH_RANGE : 0));

        // A fast swipe close by spooks a dragon: it bolts away, then calms down over a couple of seconds.
        // A dragon already going for food ignores it; feeding beats fear, and clicking to feed moves the mouse fast.
        const pointerD = Math.hypot(pointer.x - hx, pointer.y - hy);
        const feeding = time - this.lastFeed < FEED_CALM;
        if (!food && !feeding && pointer.active && pointer.speed > STARTLE_SPEED && pointerD < L * 0.9) {
            k.startle = 1;
            k.fleeX = pointer.x;
            k.fleeY = pointer.y;
        }
        k.startle = Math.max(0, k.startle - dt * 0.6);
        const fleeing = k.startle > 0.3 && !food;

        let chasing = false;
        let curious = false;
        let closing = 0;
        if (fleeing) {
            const ox = hx - k.fleeX;
            const oy = hy - k.fleeY;
            const d = Math.hypot(ox, oy) || 1;
            dx += (ox / d) * 4 * k.startle;
            dy += (oy / d) * 4 * k.startle;
        } else if (food) {
            const tx = food.x - hx;
            const ty = food.y - hy;
            const d = Math.hypot(tx, ty) || 1;
            dx += (tx / d) * 3;
            dy += (ty / d) * 3;
            chasing = true;
            closing = clamp(1 - d / (L * 1.2), 0, 1);
        } else if (pointer.active) {
            const tx = pointer.x - hx;
            const ty = pointer.y - hy;
            const d = Math.hypot(tx, ty) || 1;
            const range = 300;
            if (d < range) {
                // Swim up to the cursor, then circle under it rather than parking.
                const w = k.curiosity * (1 - d / range) * 2.2;
                const near = clamp(d / (L * 0.6), 0, 1);
                dx += ((tx / d) * near - (ty / d) * (1 - near)) * w;
                dy += ((ty / d) * near + (tx / d) * (1 - near)) * w;
                curious = true;
            }
        }

        for (const other of this.dragons) {
            if (other === k) continue;
            const ohx = other.nodes[0];
            const ohy = other.nodes[1];
            if (Math.abs(ohx - hx) > L * 2 || Math.abs(ohy - hy) > L * 2) continue;
            for (let n = 0; n < DRAGON_NODES; n += 3) {
                const ox = hx - other.nodes[n * 2];
                const oy = hy - other.nodes[n * 2 + 1];
                const d = Math.hypot(ox, oy);
                // Dragons going for food jostle in close, so personal space shrinks and never outweighs the pull.
                const range = (L + other.length) * (food ? 0.04 : 0.1);
                if (d < range && d > 1e-3) {
                    const w = (1 - d / range) * 2.4;
                    dx += (ox / d) * w;
                    dy += (oy / d) * w;
                }
            }
            // Loose shoaling: nearby dragons drift the same way.
            if (!chasing && Math.hypot(ohx - hx, ohy - hy) < L * 1.6) {
                dx += Math.cos(other.heading) * 0.18;
                dy += Math.sin(other.heading) * 0.18;
            }
        }

        // Drift around page content rather than under it; food and the cursor can still lure them across.
        repel(this.avoid, hx, hy, Math.min(L * 0.4, 200), push);
        dx += push.x * (chasing || curious ? 0.5 : 1.8);
        dy += push.y * (chasing || curious ? 0.5 : 1.8);

        // Let the body slip off-screen now and then, but always turn back.
        const over = Math.max(-hx, hx - W, -hy, hy - H);
        if (over > -L * 0.25) {
            const w = clamp((over + L * 0.25) / (L * 0.5), 0, 1) * 3.5;
            const toX = W / 2 - hx;
            const toY = H / 2 - hy;
            const d = Math.hypot(toX, toY) || 1;
            dx += (toX / d) * w;
            dy += (toY / d) * w;
        }

        const desired = Math.atan2(dy, dx);
        // Long bodies can't pivot on the spot: the turning circle grows with length.
        const agility =
            (1 + k.rush * 0.6) *
            Math.min(fleeing ? 3 : chasing ? 1.9 + closing : curious ? 1.2 : 0.7, (k.speed / L) * 4);
        const maxTurn = agility * dt;
        const turned = clamp(angleDiff(k.heading, desired), -maxTurn, maxTurn);
        k.heading += turned;
        k.turn += (turned / dt - k.turn) * Math.min(1, dt * 3);

        // Burst and coast: a few strong tail beats, then a long glide that bleeds off speed.
        // Chasing or fleeing dragons beat without pause.
        if (time > k.nextBurst && time > k.burstUntil) {
            k.burstUntil = time + rand(0.7, 1.6);
            k.nextBurst = k.burstUntil + rand(1.2, 4);
        }
        const bursting = fleeing || chasing || time < k.burstUntil;
        k.beat += ((bursting ? 1 : 0) - k.beat) * Math.min(1, dt * 3);
        k.rush = Math.max(0, k.rush - dt * 0.7);
        const cruise = 14 + L * 0.04;
        const target =
            (1 + k.rush * 0.8) *
            (fleeing
                ? cruise * 3.2
                : chasing
                  ? cruise * (1.9 + closing)
                  : bursting
                    ? cruise * (curious ? 1.6 : 1.35)
                    : cruise * 0.7);
        k.speed += (target - k.speed) * Math.min(1, dt * (bursting ? 1.6 + k.rush * 3 : 0.35));
        k.phase += dt * (0.8 + k.beat * (1.2 + k.speed / 30));
        // Legs paddle faster the faster the dragon swims.
        k.finPhase += dt * (1.6 + k.speed / 20);
        k.gulp += ((chasing && closing > 0.55 ? 1 : 0) - k.gulp) * Math.min(1, dt * 6);

        // Dragons drift nearer and farther, and come close for food.
        if (time > k.nextDive) {
            k.depthTarget = rand(0.5, k.depthMax);
            k.nextDive = time + rand(8, 20);
        }
        k.depth += ((chasing ? 1 : k.depthTarget) - k.depth) * Math.min(1, dt * (chasing ? 0.8 : 0.15));

        nodes[0] += Math.cos(k.heading) * k.speed * dt;
        nodes[1] += Math.sin(k.heading) * k.speed * dt;

        const seg = L / (DRAGON_NODES - 1);
        const maxBend = 0.16;
        let prevAngle = k.heading + Math.PI;
        for (let n = 1; n < DRAGON_NODES; n++) {
            const px = nodes[(n - 1) * 2];
            const py = nodes[(n - 1) * 2 + 1];
            let angle = Math.atan2(nodes[n * 2 + 1] - py, nodes[n * 2] - px);
            angle = prevAngle + clamp(angleDiff(prevAngle, angle), -maxBend, maxBend);
            nodes[n * 2] = px + Math.cos(angle) * seg;
            nodes[n * 2 + 1] = py + Math.sin(angle) * seg;
            prevAngle = angle;
        }

        const mouthR = L * 0.04 + 8;
        const before = this.pellets.length;
        this.pellets = this.pellets.filter(
            (p) => !p.landed || (p.x - nodes[0]) ** 2 + (p.y - nodes[1]) ** 2 > mouthR * mouthR
        );
        if (this.pellets.length < before) this.bites.push({ x: nodes[0], y: nodes[1], born: time });
    }

    /** Keep the current target while it lasts; only switch for a pellet less than half as far away. */
    private pickFood(k: Dragon, x: number, y: number, range: number) {
        if (k.food && !this.pellets.includes(k.food)) k.food = null;
        const nearest = this.nearestPellet(x, y, range);
        if (!k.food) return (k.food = nearest);
        const current = Math.hypot(k.food.x - x, k.food.y - y);
        if (current > range * 1.3) k.food = nearest;
        else if (nearest && Math.hypot(nearest.x - x, nearest.y - y) < current * 0.5) k.food = nearest;
        return k.food;
    }

    private nearestPellet(x: number, y: number, range: number) {
        let best: Pellet | null = null;
        let bestD = range * range;
        for (const p of this.pellets) {
            if (!p.landed) continue;
            const d = (p.x - x) ** 2 + (p.y - y) ** 2;
            if (d < bestD) {
                bestD = d;
                best = p;
            }
        }
        return best;
    }
}
