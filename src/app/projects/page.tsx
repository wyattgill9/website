import type { Metadata } from "next";
import Container from "../components/container";
import InlineMd from "../components/inline-md";
import SiteNav from "../components/site-nav";

// The old projects.html was noindex; kept that way until it's ready to be found.
export const metadata: Metadata = { title: "Projects", robots: { index: false } };

/** One entry. Strings are inline markdown; bullets are dimmed so their **bold** numbers and names read first. */
type Project = {
    title: string;
    dates?: string;
    langs?: string[];
    note?: string;
    /** The headline number, shown in the right column like a benchmark result. */
    metric?: string;
    bullets: string[];
};

const SECTIONS: { id: string; label: string; projects: Project[] }[] = [
    {
        id: "work",
        label: "work",
        projects: [
            {
                title: "[Indexable (ix.dev)](https://ix.dev)",
                dates: "May – Jul 2026",
                langs: ["nix", "rust"],
                note: "merged PRs to [indexable-inc/index](https://github.com/indexable-inc/index-bak)",
                metric: "113 PRs",
                bullets: [
                    "**nix-cargo-unit**: every rustc unit is its own Nix derivation, so editing one crate rebuilds only that crate and its dependents. Wrote [RFC 0005](https://github.com/indexable-inc/index-bak/pull/688) to move it to dynamic derivations.",
                    "**blast-radius**: a [PR check](https://github.com/indexable-inc/index-bak/pull/575) that reports how many CI derivations a change would rebuild.",
                    "Retired Cachix and moved the repo’s binary cache to [cache.ix.dev](https://github.com/indexable-inc/index-bak/pull/1578); parallel CI checks with [nix-fast-build](https://github.com/indexable-inc/index-bak/pull/293).",
                    "Cross-compiled [codex-rs Linux → macOS](https://github.com/indexable-inc/index-bak/pull/2690), replacing a **40–80 min** native Mac build.",
                    "Rust Gmail client, CLI and a **25-tool** MCP server with a PyO3 binding ([#765](https://github.com/indexable-inc/index-bak/pull/765)); a document log on Iceberg ([#785](https://github.com/indexable-inc/index-bak/pull/785)); **22** Nix lint rules ([#1391](https://github.com/indexable-inc/index-bak/pull/1391)).",
                    "Work on nox, a Rust implementation of Nix.",
                ],
            },
        ],
    },
    {
        id: "open-source",
        label: "open source",
        projects: [
            {
                title: "[HVM3](https://github.com/HigherOrderCO/HVM3) / [HVM3-Strict](https://github.com/HigherOrderCO-archive/HVM3-Strict)",
                dates: "Jan – Jun 2025",
                langs: ["c", "haskell"],
                note: "HigherOrderCO (Bend / HVM runtime)",
                metric: "~400 MIPS",
                bullets: [
                    "**11** merged PRs to HVM3: macOS and Linux CI, a Linux allocation bug fixed by moving to mmap, the test and benchmark harness, the GHC 9.12 upgrade.",
                    "Top contributor to HVM3-Strict (**59** commits, **9** merged PRs). Took the runtime from **98 → 127 MIPS** in merged PRs.",
                    "Reached **~400 MIPS** single-threaded on x86 in [my fork](https://github.com/wyattgill9/HVM3-Strict) with 52/48-bit location packing, `extern inline` and core pinning.",
                ],
            },
            {
                title: "[walgit forge](https://github.com/wyattgill9/walgit2)",
                dates: "Aug – Oct 2026",
                langs: ["rust", "typescript"],
                note: "built on [tobi/walgit](https://github.com/tobi/walgit)",
                bullets: [
                    "Issues, pull requests, line-comment reviews and merging for a git server whose only durable state is an object-store bucket. All of it is stored as WAL events.",
                    "Branches page and API, and the web UI theme.",
                ],
            },
            {
                title: "Other contributions",
                bullets: [
                    "[verlet-kernel](https://github.com/emotionscientific/verlet-kernel): **13** merged PRs, #2 contributor. [Found 53 of 2,635 tests](https://github.com/emotionscientific/verlet-kernel/pull/176) failing in the devshell while CI was green, and got it to **0**.",
                    "[psyclyx/fix](https://github.com/psyclyx/fix): replaced an insertion sort with an [O(n log n) stable block sort](https://github.com/psyclyx/fix/pull/22).",
                    "[rawgrep](https://github.com/rakivo/rawgrep): nixpkg, CI and a [flake restructure](https://github.com/rakivo/rawgrep/pull/33).",
                    "[Awesome-Ghostty](https://github.com/wyattgill9/Awesome-Ghostty): maintain the fork (**104★**) and merge community PRs.",
                ],
            },
        ],
    },
    {
        id: "tools",
        label: "tools",
        projects: [
            {
                title: "[lean-helix-view](https://github.com/wyattgill9/lean-helix-view)",
                dates: "Jun – Oct 2026",
                langs: ["rust"],
                metric: "6★",
                bullets: [
                    "A Lean 4 goal view for Helix in a terminal pane. No changes to Helix or Lean: a transparent LSP proxy watches cursor positions, asks Lean for goals, and sends them to a TUI over a Unix socket.",
                ],
            },
            {
                title: "[bincache](https://github.com/wyattgill9/bincache) · [selene](https://github.com/wyattgill9/selene)",
                dates: "Jul – Aug 2026",
                langs: ["rust"],
                bullets: [
                    "bincache: a self-hosted Nix binary cache speaking the standard substituter protocol. io_uring, one shard per core.",
                    "selene: a shard-per-core backend framework, a Rust rewrite of the core of [helio](https://github.com/romange/helio) (the C++ framework under DragonflyDB).",
                ],
            },
            {
                title: "Smaller tools",
                bullets: [
                    "[rust-nix-template](https://github.com/wyattgill9/rust-nix-template): Rust + Nix workspace template, adopted by verlet-kernel, rawgrep and walgit.",
                    "[gif it](https://wyattgill.com/discord_gif_website/): image or video to a Discord-sized GIF, entirely in the browser.",
                    "[nix-config](https://github.com/wyattgill9/nix-config): my NixOS setup.",
                ],
            },
        ],
    },
    {
        id: "earlier",
        label: "earlier",
        projects: [
            {
                title: "[Rafka](https://github.com/LYZJU2019/rafka)",
                dates: "Oct – Dec 2024",
                langs: ["rust"],
                bullets: [
                    "A Kafka-style peer-to-peer message broker. Started as my [proof of concept](https://github.com/wyattgill9/rafka_PoC), merged into the shared repo, where I’m the top contributor alongside ~5 others.",
                ],
            },
            {
                title: "Trading systems",
                langs: ["zig", "c++", "rust"],
                metric: "2.7M ins/s",
                bullets: [
                    "[zig-ob](https://github.com/wyattgill9/zig-ob): ITCH-compliant L3 order book in Zig with a comptime protocol parser.",
                    "[cpp-orderbook](https://github.com/wyattgill9/cpp-orderbook): the same in C++.",
                    "[kv_store](https://github.com/wyattgill9/kv_store): SPSC-queue key-value store, **~2.7M inserts/s**.",
                ],
            },
            {
                title: "Small things",
                metric: "92 B",
                bullets: [
                    "[NAND_MACHINE](https://github.com/wyattgill9/NAND_MACHINE): a 64-bit computer from NAND gates that computes Fibonacci.",
                    "[1MFC](https://github.com/wyattgill9/1MFC): a contest I ran for the fastest F(1,000,000) in Rust.",
                    "[rbaduk](https://github.com/wyattgill9/rbaduk): a Go board in **92 bytes**.",
                    "[rust-tsdb](https://github.com/wyattgill9/rust-tsdb): time-series storage with Gorilla compression.",
                    "[liu](https://github.com/wyattgill9/liu): a keyboard-layout analyzer.",
                ],
            },
        ],
    },
];

const Entry = ({ title, dates, langs, note, metric, bullets }: Project) => (
    <article className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-6">
        <h3 className="text-[15px] font-medium">
            <InlineMd text={title} />
        </h3>
        {/* The number sits level with the title, right-aligned, like a result in a benchmark table. */}
        <div className="row-span-2 text-right text-[15px] tabular-nums">{metric}</div>
        {(dates || langs || note) && (
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]">
                {dates && <span className="tabular-nums opacity-50">{dates}</span>}
                {langs?.map((lang) => (
                    <span
                        key={lang}
                        className="rounded bg-[color-mix(in_srgb,var(--foreground-color)_8%,transparent)] px-1.5 opacity-70"
                    >
                        {lang}
                    </span>
                ))}
                {note && (
                    <span className="opacity-50">
                        <InlineMd text={note} />
                    </span>
                )}
            </p>
        )}
        <ul className="col-span-2 mt-3 flex flex-col gap-2">
            {bullets.map((text) => (
                <li key={text} className="flex gap-3">
                    <span aria-hidden="true" className="select-none opacity-30">
                        λ
                    </span>
                    <span className="text-[color-mix(in_srgb,var(--foreground-color)_70%,transparent)]">
                        <InlineMd text={text} />
                    </span>
                </li>
            ))}
        </ul>
    </article>
);

export default function Projects() {
    return (
        <div className="min-h-screen w-full bg-background text-foreground">
            <SiteNav />
            <Container as="main" className="pb-24 pt-28 font-geistMono text-[14px] leading-[1.7]">
                <h1 className="text-[15px]">Projects</h1>
                <nav aria-label="Sections" className="mb-14 mt-2 flex flex-wrap gap-x-4 text-[12px]">
                    {SECTIONS.map(({ id, label, projects }) => (
                        <a key={id} href={`#${id}`} className="opacity-50 transition-opacity hover:opacity-100">
                            {label}
                            <span className="ml-1.5 tabular-nums opacity-60">{projects.length}</span>
                        </a>
                    ))}
                </nav>
                <div className="flex max-w-[54rem] flex-col gap-16">
                    {SECTIONS.map(({ id, label, projects }) => (
                        <section key={id} id={id} className="scroll-mt-28">
                            <h2 className="mb-6 text-[12px] lowercase tracking-[0.04em] opacity-50">{label}</h2>
                            <div className="flex flex-col gap-10">
                                {projects.map((project) => (
                                    <Entry key={project.title} {...project} />
                                ))}
                            </div>
                        </section>
                    ))}
                </div>
            </Container>
        </div>
    );
}
