import { clamp, smoothstep } from "./world";

export const FLAG_BODY = 1;
export const FLAG_HAIR = 2;
export const FLAG_EYE = 3;
export const FLAG_DORSAL = 4;
export const FLAG_WHISKER = 5;
export const FLAG_LEG = 6;
export const FLAG_ANTLER = 7;
export const FLAG_SPIKE = 8;

/** Farthest any part reaches from the spine, as a fraction of length: the whisker tips ahead of the snout. */
export const REACH = 0.12;

/** Where a point landed on the dragon; `du`/`da` give a limb's direction in body space. */
export interface ShapeHit {
    flag: number;
    across: number;
    du: number;
    da: number;
}

// Top-down outline as a fraction of length: a broad head, slim neck, deep chest, then a long taper to the tail.
export function bodyHalfWidth(s: number) {
    if (s < 0.06) return 0.042 * Math.pow(Math.sin(((s / 0.06) * Math.PI) / 2), 0.6);
    if (s < 0.1) return 0.042 - 0.012 * smoothstep(0.06, 0.1, s);
    if (s < 0.3) return 0.03 + 0.01 * smoothstep(0.1, 0.3, s);
    return 0.004 + 0.036 * Math.pow(1 - smoothstep(0.3, 1, s), 0.7);
}

/** Test a point against a limb: a thin ellipse leaning back from a root on the body's edge. `across` runs 0 root to 1 tip. */
function inLimb(
    s: number,
    a: number,
    rootS: number,
    angle: number,
    reach: number,
    width: number,
    flag: number,
    out: ShapeHit
) {
    const rootA = bodyHalfWidth(rootS) * 0.85;
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);
    const du = s - rootS;
    const da = a - rootA;
    const along = du * cosA + da * sinA - reach;
    const perp = -du * sinA + da * cosA;
    if ((along / reach) ** 2 + (perp / width) ** 2 > 1) return false;
    out.flag = flag;
    out.across = (along + reach) / (2 * reach);
    out.du = du;
    out.da = da;
    return true;
}

/**
 * Classify a point given in body coordinates, all as fractions of length:
 * `s` along the spine (0 snout, 1 tail tip), `a` distance from it, and
 * `past` how far it sits beyond the tail tip. `stride` (-1..1) swings this side's legs.
 */
export function classify(s: number, a: number, past: number, stride: number, out: ShapeHit, ahead = 0, lateral = 0) {
    out.flag = 0;
    out.across = 1;
    out.du = 1;
    out.da = 0;

    // Whiskers: long and wavy, sweeping forward and out from the snout.
    if (ahead > 0) {
        if (ahead < 0.06 && Math.abs(lateral - (0.018 + ahead * 0.6 + 0.01 * Math.sin(ahead * 90))) < 0.007) {
            out.flag = FLAG_WHISKER;
            return true;
        }
        return false;
    }

    // Tail tuft: a flame that tapers to a point past the tip.
    if (past > 0) {
        const lat = Math.sqrt(Math.max(0, a * a - past * past));
        if (past < 0.06 && lat <= 0.035 * (1 - past / 0.06)) {
            out.flag = FLAG_HAIR;
            out.across = 1;
            return true;
        }
        return false;
    }

    const w = bodyHalfWidth(s);
    if (a <= w) {
        const across = a / w;
        out.across = across;
        if (s > 0.02 && s < 0.042 && across > 0.45 && across < 0.85) out.flag = FLAG_EYE;
        else if (s > 0.1 && s < 0.9 && across < 0.3) out.flag = FLAG_DORSAL;
        else out.flag = FLAG_BODY;
        return true;
    }

    // Mane: a ruff around the neck, swept back.
    const mane = s > 0.05 && s < 0.13 ? 0.02 * Math.sin(((s - 0.05) / 0.08) * Math.PI) : 0;
    // Tail hair fans out over the last stretch of the body.
    const tuft = s > 0.84 ? 0.035 * smoothstep(0.84, 1, s) : 0;
    const hair = Math.max(mane, tuft);
    if (hair > 0 && a <= w + hair) {
        out.flag = FLAG_HAIR;
        out.across = clamp((a - w) / hair, 0, 1);
        return true;
    }

    // A sawtooth frill down the flanks, each spike leaning back toward the tail.
    if (s > 0.13 && s < 0.84 && a <= w + 0.016 * (1 - ((s * 28) % 1))) {
        out.flag = FLAG_SPIKE;
        out.across = clamp((a - w) / 0.016, 0, 1);
        return true;
    }

    // Diagonal gait: a side's front leg reaches forward as its back leg pushes back.
    return (
        inLimb(s, a, 0.2, 1.15 + 0.45 * stride, 0.032, 0.009, FLAG_LEG, out) ||
        inLimb(s, a, 0.58, 1.15 - 0.45 * stride, 0.03, 0.009, FLAG_LEG, out) ||
        inLimb(s, a, 0.035, 0.4, 0.055, 0.007, FLAG_ANTLER, out) ||
        inLimb(s, a, 0.06, 0.95, 0.025, 0.006, FLAG_ANTLER, out)
    );
}
