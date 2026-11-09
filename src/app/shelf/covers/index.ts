import type { StaticImageData } from "next/image";
import eightySix from "./86.jpg";
import chernobyl from "./chernobyl.jpg";
import darlingInTheFranxx from "./darling-in-the-franxx.jpg";
import fate from "./fate.jpg";
import monogatari from "./monogatari.jpg";
import nierAutomata from "./nier-automata.jpg";
import noCountryForOldMen from "./no-country-for-old-men.jpg";
import notesFromUnderground from "./notes-from-underground.jpg";
import parasite from "./parasite.jpg";
import reZero from "./re-zero.jpg";
import se7en from "./se7en.jpg";
import slaughterhouseFive from "./slaughterhouse-five.jpg";
import theLastDaysOfSocrates from "./the-last-days-of-socrates.jpg";
import theWindUpBirdChronicle from "./the-wind-up-bird-chronicle.jpg";
import tokyoGhoul from "./tokyo-ghoul.jpg";
import violetEvergarden from "./violet-evergarden.jpg";

/**
 * Covers for the currently and favorites titles, keyed by the title exactly as the shelf writes it.
 * Socrates is a crop of David's The Death of Socrates, the painting on the Penguin edition's cover.
 */
export const COVERS: Record<string, StaticImageData> = {
    "86": eightySix,
    Chernobyl: chernobyl,
    "Darling in the Franxx": darlingInTheFranxx,
    "Fate series": fate,
    Monogatari: monogatari,
    "NieR: Automata": nierAutomata,
    "No Country for Old Men": noCountryForOldMen,
    "Notes from Underground": notesFromUnderground,
    Parasite: parasite,
    "Re:Zero": reZero,
    Se7en: se7en,
    "Slaughterhouse-Five": slaughterhouseFive,
    "The Last Days of Socrates": theLastDaysOfSocrates,
    "The Wind-Up Bird Chronicle": theWindUpBirdChronicle,
    "Tokyo Ghoul": tokyoGhoul,
    "Violet Evergarden": violetEvergarden,
};
