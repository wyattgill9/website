import type { Metadata } from "next";
import ShelfPage from "../shelf";

export const revalidate = 86400;

// Unlinked, and kept out of search results.
export const metadata: Metadata = { title: "Shelf", robots: { index: false } };

export default function SecretShelf() {
    return <ShelfPage secret />;
}
