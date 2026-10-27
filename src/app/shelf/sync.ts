/** Fills the generated sections of shelf.md: Anime and Manga / LN from MyAnimeList, Film from Letterboxd. */

const MAL = "https://api.myanimelist.net/v2/users/raiinyzen";
const LETTERBOXD = "https://letterboxd.com";
const ONGOING = new Set(["currently_airing", "currently_publishing", "on_hiatus"]);
/** Matches the page's revalidate: lists refresh at most once a day. */
const DAY = 86400;

type MalNode = {
    title: string;
    alternative_titles?: { en?: string };
    start_date?: string;
    end_date?: string;
    status?: string;
    studios?: { name: string }[];
    authors?: { node: { first_name?: string; last_name?: string } }[];
};

async function get(url: string, headers: Record<string, string> = {}) {
    const res = await fetch(url, { headers, next: { revalidate: DAY } });
    if (!res.ok) throw new Error(`${res.status} ${url}`);
    return res.text();
}

/** One shelf item, in the same markdown shape as the hand-written ones. */
const item = (title: string, by?: string | null, years?: string) =>
    `**${title}**` + (by ? ` — *${by}*` : "") + (years ? ` (${years})` : "");

async function mal(path: string) {
    const id = process.env.MAL_CLIENT_ID;
    if (!id) throw new Error("MAL_CLIENT_ID is not set");
    // ponytail: limit=1000 is MAL's max page size, follow paging.next if a list ever gets bigger
    const { data } = JSON.parse(await get(`${MAL}${path},alternative_titles&limit=1000`, { "X-MAL-CLIENT-ID": id }));
    return (data as { node: MalNode }[]).map(({ node: n }) => {
        const start = n.start_date?.slice(0, 4) ?? "";
        const end = n.end_date?.slice(0, 4) ?? "";
        const years = ONGOING.has(n.status ?? "")
            ? start && `${start}–`
            : start && end && start !== end
              ? `${start}–${end}`
              : start;
        // English title where MAL has one, romaji otherwise.
        return { n, title: n.alternative_titles?.en || n.title, years };
    });
}

async function anime() {
    const list = await mal("/animelist?status=plan_to_watch&fields=studios,start_date,end_date,status");
    return list.map(({ n, title, years }) => item(title, n.studios?.map((s) => s.name).join(" / "), years));
}

async function manga() {
    const list = await mal(
        "/mangalist?status=plan_to_read&fields=authors{first_name,last_name},start_date,end_date,status"
    );
    const author = (a: { node: { first_name?: string; last_name?: string } }) =>
        [a.node.first_name, a.node.last_name].filter(Boolean).join(" ");
    return list.map(({ n, title, years }) => item(title, n.authors?.map(author).join(" & "), years));
}

const unescape = (s: string) =>
    s
        .replace(/&quot;/g, '"')
        .replace(/&#0?39;/g, "'")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&amp;/g, "&");

// Letterboxd has no public API, so scrape the watchlist, then each film's page for its director.
async function film() {
    const page = (path: string) => get(LETTERBOXD + path, { "User-Agent": "Mozilla/5.0" });
    const items: string[] = [];
    for (let n = 1; ; n++) {
        const html = await page(`/wyatt_g/watchlist/page/${n}/`);
        const films = [...html.matchAll(/data-item-name="([^"]*)"[^>]*?data-item-link="([^"]*)"/g)];
        if (!films.length) return items;
        const lines = await Promise.all(
            films.map(async ([, name, link]) => {
                const [, title, year] = unescape(name).match(/^(.*?)(?: \((\d{4})\))?$/)!;
                const director = (await page(link)).match(/name="twitter:data1" content="([^"]*)"/);
                return item(title, director && unescape(director[1]), year);
            })
        );
        items.push(...lines);
    }
}

export const GENERATED: Record<string, () => Promise<string[]>> = { Film: film, Anime: anime, "Manga / LN": manga };
