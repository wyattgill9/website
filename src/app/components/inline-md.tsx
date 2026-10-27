import type { ReactNode } from "react";

export const LINK =
    "underline decoration-[color-mix(in_srgb,var(--foreground-color)_35%,transparent)] decoration-1 underline-offset-[5px] hover:decoration-foreground";

// Prettier writes italics in markdown files as _x_, sync.ts writes *x*; an underscore inside a word (kv_store) isn't one.
const INLINE = /\*\*(.+?)\*\*|\*(.+?)\*|(?<!\w)_(.+?)_(?!\w)|`(.+?)`|\[(.+?)\]\((.+?)\)/g;

/** Inline markdown: **bold**, *italic* or _italic_, `code`, and [links](url). Nothing nests. */
export default function InlineMd({ text }: { text: string }) {
    const out: ReactNode[] = [];
    let last = 0;
    for (const m of text.matchAll(INLINE)) {
        out.push(text.slice(last, m.index));
        const [, bold, star, under, code, label, href] = m;
        const italic = star ?? under;
        if (bold)
            out.push(
                <strong key={m.index} className="font-medium text-foreground">
                    {bold}
                </strong>
            );
        else if (italic)
            out.push(
                <em key={m.index} className="opacity-60">
                    {italic}
                </em>
            );
        else if (code)
            out.push(
                <code
                    key={m.index}
                    className="rounded bg-[color-mix(in_srgb,var(--foreground-color)_8%,transparent)] px-1"
                >
                    {code}
                </code>
            );
        else
            out.push(
                <a key={m.index} href={href} target="_blank" rel="noopener noreferrer" className={LINK}>
                    {label}
                </a>
            );
        last = m.index + m[0].length;
    }
    out.push(text.slice(last));
    return <>{out}</>;
}
