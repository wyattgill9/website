import { readFileSync } from "node:fs";
import path from "node:path";

/** Newest first. Each slug is a file in ./posts/<slug>.md. `ai` marks a post written by AI, which the post says up front. */
export const POSTS: { slug: string; date: string; ai?: boolean }[] = [
    { slug: "making-sense-of-the-chinese-state", date: "2026-11-19", ai: true },
    { slug: "markets-inside-the-machine", date: "2026-11-15", ai: true },
];

/** embed: an interactive page from /public, written in markdown as ![title](src); text is the title */
export type Block = { type: "h2" | "h3" | "p" | "hr" | "embed"; text: string; src?: string };

// ponytail: a parser for exactly what posts use (#/##/### headings, paragraphs, ---, an *italic* dek under the title, ![title](src) embeds); swap in a markdown library if posts grow past that
export function loadPost(slug: string) {
    const post = POSTS.find((p) => p.slug === slug);
    if (!post) return null;
    const md = readFileSync(path.join(process.cwd(), "src/app/blog/posts", `${slug}.md`), "utf8");
    let title = "";
    let dek = "";
    const blocks: Block[] = [];
    for (const raw of md.split(/\n\s*\n/)) {
        const b = raw.trim();
        if (!b) continue;
        const h = b.match(/^(#{1,3}) (.+)/);
        const embed = b.match(/^!\[(.+?)\]\((\S+)\)$/);
        if (h?.[1] === "#") title = h[2];
        else if (embed) blocks.push({ type: "embed", text: embed[1], src: embed[2] });
        else if (h) blocks.push({ type: h[1] === "##" ? "h2" : "h3", text: h[2] });
        else if (b === "---") blocks.push({ type: "hr", text: "" });
        else if (!dek && !blocks.length && /^([*_])(?![*_])[^]*\1$/.test(b)) dek = b.slice(1, -1);
        else blocks.push({ type: "p", text: b.replace(/\n/g, " ") });
    }
    // The first rule only separates the dek from the body, which the layout already does.
    if (blocks[0]?.type === "hr") blocks.shift();
    return { ...post, title, dek, blocks };
}

export const formatDate = (iso: string) =>
    new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        timeZone: "UTC",
    });
