import { readFileSync } from "node:fs";
import path from "node:path";
import type { Metadata } from "next";
import Container from "../components/container";
import InlineMd from "../components/inline-md";
import TopNav from "../components/top-nav";

// Hidden until there are more quotes: no nav link, and kept out of search.
export const metadata: Metadata = { title: "Quotes", robots: { index: false } };

/** quotes.md: blocks split by blank lines, each `> ` line is a line of the quote, except a `— ` line, which says who. */
function load() {
    const md = readFileSync(path.join(process.cwd(), "src/app/quotes/quotes.md"), "utf8");
    return md
        .replace(/<!--[\s\S]*?-->/g, "")
        .split(/\n\s*\n/)
        .map((block) => {
            const lines = block.split("\n").map((line) => line.replace(/^>\s?/, "").trim());
            return {
                text: lines.filter((line) => line && !line.startsWith("— ")),
                by: lines.find((line) => line.startsWith("— "))?.slice(2),
            };
        })
        .filter(({ text }) => text.length);
}

export default function Quotes() {
    const quotes = load();
    return (
        <div className="min-h-screen w-full bg-background text-foreground">
            <TopNav solid />
            <Container as="main" className="pb-32 pt-28 font-geistMono text-[14px] leading-[1.7]">
                <h1 className="text-[15px]">Quotes</h1>
                <p className="mb-20 mt-2 text-[12px] opacity-50">
                    lines that stuck <span className="ml-1.5 tabular-nums opacity-60">{quotes.length}</span>
                </p>
                <ol className="flex max-w-[44rem] flex-col gap-20">
                    {quotes.map(({ text, by }, i) => (
                        <li
                            key={text.join()}
                            style={{ animationDelay: `${i * 90}ms` }}
                            className="grid grid-cols-[2.5rem_minmax(0,1fr)] fill-mode-backwards motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-700 lg:grid-cols-[4rem_minmax(0,1fr)]"
                        >
                            <span className="pt-[0.35em] text-[12px] tabular-nums opacity-40">
                                {String(i + 1).padStart(2, "0")}
                            </span>
                            <div>
                                {/* Same voice as the home page's quote; mono has no italic, so dimmed lines stay upright. */}
                                <blockquote className="text-[17px] lowercase leading-[1.6] tracking-[-0.01em] [text-wrap:pretty] lg:text-[20px] [&_em]:not-italic">
                                    {text.map((line) => (
                                        <p key={line}>
                                            <InlineMd text={line} />
                                        </p>
                                    ))}
                                </blockquote>
                                {by && (
                                    <p className="mt-5 text-[12px] text-[color-mix(in_srgb,var(--foreground-color)_70%,transparent)]">
                                        <span className="opacity-40">— </span>
                                        <InlineMd text={by} />
                                    </p>
                                )}
                            </div>
                        </li>
                    ))}
                </ol>
            </Container>
        </div>
    );
}
