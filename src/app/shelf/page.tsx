import type { Metadata } from "next";
import ShelfPage from "./shelf";

// Re-render (and re-fetch the MyAnimeList and Letterboxd lists) at most once a day.
export const revalidate = 86400;

export const metadata: Metadata = { title: "Shelf" };

export default function Shelf() {
    return <ShelfPage />;
}
