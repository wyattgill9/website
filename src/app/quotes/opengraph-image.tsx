import { shareCard } from "../share-card";

export const alt = "Quotes Wyatt Gill keeps";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
    return shareCard({
        active: "quotes",
        title: "Quotes",
        lines: ["Lines that stuck."],
    });
}
