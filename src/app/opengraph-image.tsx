import { shareCard } from "./share-card";

export const alt = "Wyatt Gill, systems engineer in San Francisco";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
    return shareCard({
        active: "fish",
        title: "Wyatt Gill",
        lines: ["Systems engineer in San Francisco.", "the carp that clears the gate becomes a dragon"],
    });
}
