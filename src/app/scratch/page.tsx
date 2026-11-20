import Link from "next/link";
import Container from "../components/container";
import { LINK } from "../components/inline-md";
import TopNav from "../components/top-nav";
import { formatDate, loadPost, POSTS } from "./posts";

export default function Scratch() {
    const posts = POSTS.map((p) => loadPost(p.slug)!);
    return (
        <div className="min-h-screen w-full bg-background text-foreground">
            <TopNav solid />
            <Container as="main" className="pb-24 pt-28 font-geistMono text-[14px] leading-[1.7]">
                <h1 className="text-[15px]">Scratch</h1>
                <p className="mb-12 mt-2 opacity-50">AI-made articles and small web projects I host here.</p>
                <ul className="flex flex-col gap-3">
                    {posts.map(({ slug, date, title }) => (
                        <li key={slug} className="grid grid-cols-[7.5rem_minmax(0,1fr)]">
                            <time dateTime={date} className="tabular-nums opacity-50">
                                {formatDate(date)}
                            </time>
                            <Link href={`/scratch/${slug}`} className={LINK}>
                                {title}
                            </Link>
                        </li>
                    ))}
                </ul>
            </Container>
        </div>
    );
}
