import { readFileSync } from "node:fs";
import path from "node:path";
import Image from "next/image";
import { Fragment, type ReactNode } from "react";
import Container from "../components/container";
import InlineMd from "../components/inline-md";
import SiteNav from "../components/site-nav";
import CoverHover from "./cover-hover";
import { COVERS } from "./covers";
import { GENERATED } from "./sync";

/*
 * The shelf, shared by /shelf and /shelf/secret. The secret one adds a top 5 of covers above the lists.
 */

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

const FAVORITES: { label: string; profile?: [string, string]; items: string[] }[] = [
    { label: "Book", items: ["The Wind-Up Bird Chronicle", "Slaughterhouse-Five"] },
    { label: "Manga", items: ["Tokyo Ghoul"] },
    {
        label: "Anime",
        profile: ["myanimelist", "https://myanimelist.net/profile/raiinyzen"],
        items: ["Fate series", "86", "Re:Zero", "Violet Evergarden", "Darling in the Franxx"],
    },
    {
        label: "Film",
        profile: ["letterboxd", "https://letterboxd.com/Wyatt_G/"],
        items: ["Whiplash", "Inception", "Se7en", "Apocalypse Now"],
    },
    { label: "TV", items: ["Chernobyl"] },
    { label: "Game", items: ["NieR: Automata"] },
];

/** Best first; display title, then its key in COVERS. */
const TOP: [string, string][] = [
    ["Fate/stay night", "Fate series"],
    ["86", "86"],
    ["Re:Zero", "Re:Zero"],
    ["Tokyo Ghoul", "Tokyo Ghoul"],
    ["Violet Evergarden", "Violet Evergarden"],
];

/** Where the generated lists sync from, linked so a reader can tell they're watchlists. */
const SOURCES: Record<string, [string, string]> = {
    Film: ["letterboxd", "https://letterboxd.com/Wyatt_G/watchlist/"],
    Anime: ["myanimelist", "https://myanimelist.net/animelist/raiinyzen?status=6"],
    "Manga / LN": ["myanimelist", "https://myanimelist.net/mangalist/raiinyzen?status=6"],
};

// A fixed label column shared by both sections, so their values line up.
const ROWS = "grid grid-cols-[5.5rem_minmax(0,1fr)] gap-y-2";

const Label = ({ children }: { children: ReactNode }) => (
    <h2 className="mb-3 text-[12px] lowercase tracking-[0.04em] opacity-50">{children}</h2>
);

/** A currently or favorites title; hovering it shows its cover. */
const Title = ({ title }: { title: string }) => (
    <span className="whitespace-nowrap">
        {COVERS[title] ? <CoverHover cover={COVERS[title]}>{title}</CoverHover> : title}
    </span>
);

export default async function ShelfPage({ secret = false }: { secret?: boolean }) {
    const { sections, links } = await load();

    return (
        <div className="min-h-screen w-full bg-background text-foreground">
            <SiteNav />
            <Container as="main" className="pb-24 pt-28 font-geistMono text-[14px] leading-[1.7]">
                <h1 className="mb-12 text-[15px]">Shelf</h1>
                {secret && (
                    <section className="mb-16">
                        <Label>top 5</Label>
                        {/* Hovering one cover steps the rest back, the same move the home page makes for citations. */}
                        <ol className="group grid grid-cols-5 gap-4">
                            {TOP.map(([title, key], i) => (
                                <li
                                    key={title}
                                    className="transition-opacity duration-150 hover:!opacity-100 group-hover:opacity-[.35]"
                                >
                                    <div className="relative aspect-[2/3] overflow-hidden rounded-[3px]">
                                        <Image
                                            src={COVERS[key]}
                                            alt={title}
                                            placeholder="blur"
                                            sizes="(min-width: 1024px) 12vw, 20vw"
                                            className="h-full w-full object-cover"
                                        />
                                        {/* A faint hairline so dark covers don't melt into the background. */}
                                        <div className="pointer-events-none absolute inset-0 rounded-[3px] ring-1 ring-inset ring-[color-mix(in_srgb,var(--foreground-color)_10%,transparent)]" />
                                    </div>
                                    <div className="mt-3 text-[12px] leading-[1.5]">
                                        <span className="mr-2 tabular-nums opacity-40">
                                            {String(i + 1).padStart(2, "0")}
                                        </span>
                                        {title}
                                    </div>
                                </li>
                            ))}
                        </ol>
                    </section>
                )}
                <div className="flex flex-col gap-14 lg:flex-row lg:gap-16">
                    {/* Pinned while the lists scroll; scrolls itself only if the window is too short to hold it. */}
                    <aside className="flex shrink-0 flex-col gap-10 lg:sticky lg:top-28 lg:max-h-[calc(100vh-8rem)] lg:w-80 lg:self-start lg:overflow-y-auto">
                        <section>
                            <Label>currently</Label>
                            <dl className={ROWS}>
                                {CURRENTLY.map(([label, items]) => (
                                    <Fragment key={label}>
                                        <dt className="opacity-50">{label}</dt>
                                        <dd>
                                            {items.map((title) => (
                                                <div key={title}>
                                                    <Title title={title} />
                                                </div>
                                            ))}
                                        </dd>
                                    </Fragment>
                                ))}
                            </dl>
                        </section>
                        <section>
                            <Label>favorites</Label>
                            {/* Best first; a label with a profile links to it. */}
                            <dl className={ROWS}>
                                {FAVORITES.map(({ label, profile, items }) => (
                                    <Fragment key={label}>
                                        <dt className="opacity-50">
                                            {profile ? (
                                                <a
                                                    href={profile[1]}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    title={profile[0]}
                                                    className="underline-offset-[5px] hover:underline"
                                                >
                                                    {label}
                                                </a>
                                            ) : (
                                                label
                                            )}
                                        </dt>
                                        <dd>
                                            {/* Each dot stays with the title before it, so a wrapped line never starts with one. */}
                                            {items.map((title, i) => (
                                                <Fragment key={title}>
                                                    {i > 0 && " "}
                                                    <span className="whitespace-nowrap">
                                                        <Title title={title} />
                                                        {i < items.length - 1 && <span className="opacity-40"> ·</span>}
                                                    </span>
                                                </Fragment>
                                            ))}
                                        </dd>
                                    </Fragment>
                                ))}
                            </dl>
                        </section>
                    </aside>

                    {/* Headed like "currently", so the two columns read as now and next. */}
                    <section className="min-w-0 flex-1">
                        <Label>up next</Label>
                        <div className="flex flex-col gap-8">
                            {sections.map(({ heading, groups }) => (
                                <details key={heading} open className="group">
                                    <summary className="mb-3 cursor-pointer list-none text-[12px] lowercase tracking-[0.04em] opacity-50 transition-opacity hover:opacity-100 [&::-webkit-details-marker]:hidden">
                                        <span className="mr-2 inline-block transition-transform group-open:rotate-90">
                                            ›
                                        </span>
                                        {heading}
                                        <span className="ml-2 tabular-nums opacity-60">{groups.flat().length}</span>
                                        {SOURCES[heading] && (
                                            <a
                                                href={SOURCES[heading][1]}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="ml-3 opacity-60 underline-offset-[5px] hover:underline"
                                            >
                                                via {SOURCES[heading][0]} ↗
                                            </a>
                                        )}
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
                    </section>
                </div>
            </Container>
        </div>
    );
}
