import { readFileSync } from "node:fs";
import path from "node:path";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import Container from "../components/container";
import InlineMd, { LINK } from "../components/inline-md";
import SiteNav from "../components/site-nav";
import { GENERATED } from "./sync";

// Re-render (and re-fetch the MyAnimeList and Letterboxd lists) at most once a day.
export const revalidate = 86400;

export const metadata: Metadata = { title: "Shelf" };

/** A section of shelf.md: a `#` heading, then groups of `* ` items split by blank lines. */
type Section = { heading: string; groups: string[][] };

// ponytail: a parser for exactly the markdown shelf.md uses (headings, bullets, **bold**, _italic_, links); swap in a markdown library if the file grows past that
function parse(md: string) {
    const sections: Section[] = [];
    const links: string[] = [];
    let group: string[] | null = null;
    for (const line of md.split("\n")) {
        if (line.startsWith("# ")) {
            sections.push({ heading: line.slice(2).trim(), groups: [] });
            group = null;
        } else if (/^[-*] /.test(line) && sections.length) {
            if (!group) sections.at(-1)!.groups.push((group = []));
            group.push(line.slice(2));
        } else if (!line.trim()) {
            group = null;
        } else if (!line.startsWith("<!--")) {
            links.push(line);
        }
    }
    return { sections, links };
}

/** Fill the generated sections from their sources; a source that fails leaves its section empty. */
async function load() {
    const { sections, links } = parse(readFileSync(path.join(process.cwd(), "src/app/shelf/shelf.md"), "utf8"));
    await Promise.all(
        sections.map(async (section) => {
            const source = GENERATED[section.heading];
            if (!source) return;
            try {
                section.groups = [await source()];
            } catch (err) {
                console.warn(`shelf: ${section.heading} failed to sync`, err);
            }
        })
    );
    return { sections, links };
}

const CURRENTLY: [string, string[]][] = [
    ["Reading", ["Notes from Underground", "The Last Days of Socrates", "Tokyo Ghoul"]],
    ["Watching", ["Monogatari"]],
    ["Playing", ["NieR: Automata"]],
];

const FAVORITES: { label: string; profile?: [string, string]; items: string[]; ranked?: boolean }[] = [
    { label: "Book", items: ["The Wind-Up Bird Chronicle", "Slaughterhouse-Five"], ranked: true },
    { label: "Manga", items: ["Tokyo Ghoul"] },
    {
        label: "Anime",
        profile: ["myanimelist", "https://myanimelist.net/profile/raiinyzen"],
        items: ["Fate series", "86", "Re:Zero", "Violet Evergarden", "Darling in the Franxx"],
        ranked: true,
    },
    {
        label: "Film",
        profile: ["letterboxd", "https://letterboxd.com/Wyatt_G/"],
        items: ["Inception", "Whiplash", "Inglourious Basterds", "Weathering with You"],
        ranked: true,
    },
    { label: "TV", items: ["Chernobyl"] },
    { label: "Game", items: ["NieR: Automata"] },
];

const Label = ({ children }: { children: ReactNode }) => (
    <h2 className="mb-3 text-[12px] lowercase tracking-[0.04em] opacity-50">{children}</h2>
);

export default async function Shelf() {
    const { sections, links } = await load();

    return (
        <div className="min-h-screen w-full bg-background text-foreground">
            <SiteNav />
            <Container as="main" className="pb-24 pt-28 font-geistMono text-[14px] leading-[1.7]">
                <h1 className="mb-12 text-[15px]">Shelf</h1>
                <div className="flex flex-col gap-14 lg:flex-row lg:gap-16">
                    <aside className="flex shrink-0 flex-col gap-10 lg:w-64">
                        <section>
                            <Label>currently</Label>
                            <dl className="flex flex-col gap-3">
                                {CURRENTLY.map(([label, items]) => (
                                    <div key={label}>
                                        <dt className="opacity-50">{label}</dt>
                                        {items.map((title) => (
                                            <dd key={title}>{title}</dd>
                                        ))}
                                    </div>
                                ))}
                            </dl>
                        </section>
                        <section>
                            <Label>favorites</Label>
                            <dl className="flex flex-col gap-3">
                                {FAVORITES.map(({ label, profile, items, ranked }) => (
                                    <div key={label}>
                                        <dt className="opacity-50">
                                            {label}
                                            {profile && (
                                                <a
                                                    href={profile[1]}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className={`${LINK} ml-2 text-[12px]`}
                                                >
                                                    {profile[0]}
                                                </a>
                                            )}
                                        </dt>
                                        {items.map((title, i) => (
                                            <dd key={title}>
                                                {ranked && <span className="mr-2 opacity-40">{i + 1}</span>}
                                                {title}
                                            </dd>
                                        ))}
                                    </div>
                                ))}
                            </dl>
                        </section>
                    </aside>

                    <div className="flex min-w-0 flex-1 flex-col gap-8">
                        {sections.map(({ heading, groups }) => (
                            <details key={heading} open className="group">
                                <summary className="mb-3 cursor-pointer list-none text-[12px] lowercase tracking-[0.04em] opacity-50 transition-opacity hover:opacity-100 [&::-webkit-details-marker]:hidden">
                                    <span className="mr-2 inline-block transition-transform group-open:rotate-90">
                                        ›
                                    </span>
                                    {heading}
                                    <span className="ml-2 tabular-nums opacity-60">{groups.flat().length}</span>
                                </summary>
                                <div className="flex flex-col gap-4">
                                    {groups.map((group, i) => (
                                        <ul key={i}>
                                            {group.map((text) => (
                                                <li key={text}>
                                                    <InlineMd text={text} />
                                                </li>
                                            ))}
                                        </ul>
                                    ))}
                                </div>
                            </details>
                        ))}
                        {links.map((text) => (
                            <p key={text}>
                                <InlineMd text={text} />
                            </p>
                        ))}
                    </div>
                </div>
            </Container>
        </div>
    );
}
