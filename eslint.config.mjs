import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

export default defineConfig([
    ...nextVitals,
    ...nextTs,
    prettier,
    // public/chinese-state is a built copy of the party-state diagram (npm run export:site in that repo)
    globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "public/chinese-state/**"]),
]);
