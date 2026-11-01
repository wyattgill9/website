import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import { LINKS } from "./components/links";

/*
 * The link-preview image shared by every page's opengraph-image: the nav's tmux status line on top, the
 * page's name and a line or two under it, a band of the sky's ASCII cloud along the bottom.
 * ImageResponse can't read woff2, so the mono face is the site's own woff2 converted to ttf.
 */

const BG = "#1a1917";
const FG = "#fff7f0";
const dim = (alpha: number) => `rgba(255, 247, 240, ${alpha})`;

const CLOUD = [
    "  . : ~ ~ = = ~ ~ - - : .      . : - ~ ~ = = = ~ ~ - : .",
    ": - ~ = = + + = = ~ ~ ~ - - : : - ~ = = + + + = = ~ ~ - - :",
    "  - ~ ~ = = = ~ ~ - - : .   . : - - ~ ~ = = ~ ~ - : .",
];

export async function shareCard({ active, title, lines }: { active: string; title: string; lines: string[] }) {
    const mono = await readFile(path.join(process.cwd(), "src/app/fonts/geist-mono-latin-400-normal.ttf"));
    return new ImageResponse(
        <div
            style={{
                width: "100%",
                height: "100%",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                padding: "64px 88px",
                background: BG,
                color: FG,
                fontFamily: "Geist Mono",
            }}
        >
            <div style={{ display: "flex", gap: 32, fontSize: 26 }}>
                <span style={{ color: dim(0.5) }}>[wyatt]</span>
                {LINKS.map(({ label, href }, i) => (
                    <span key={href} style={{ display: "flex", color: label === active ? FG : dim(0.5) }}>
                        <span style={{ color: dim(0.35) }}>{i}:</span>
                        {label}
                        {label === active ? "*" : ""}
                    </span>
                ))}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                <div style={{ fontSize: 68 }}>{title}</div>
                {lines.map((line) => (
                    <div key={line} style={{ fontSize: 28, color: dim(0.55) }}>
                        {line}
                    </div>
                ))}
            </div>
            <div style={{ display: "flex", flexDirection: "column", fontSize: 20, color: dim(0.14) }}>
                {CLOUD.map((row) => (
                    <span key={row} style={{ whiteSpace: "pre" }}>
                        {row}
                    </span>
                ))}
            </div>
        </div>,
        { width: 1200, height: 630, fonts: [{ name: "Geist Mono", data: mono, style: "normal", weight: 400 }] }
    );
}
