import { shareCard } from "../share-card";

export const alt = "Wyatt Gill's shelf: what I'm reading, watching and playing";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
    return shareCard({
        active: "shelf",
        title: "Shelf",
        lines: ["What I'm reading, watching and playing,", "my favorites, and everything up next."],
    });
}
