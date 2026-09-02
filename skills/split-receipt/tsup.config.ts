import { defineConfig } from "tsup";

export default defineConfig({
  // One entry per script SKILL.md can run; each becomes dist/<name>.js and a
  // `bin` entry in package.json.
  entry: {
    "scripts/list-categories": "src/list-categories.ts",
    "scripts/update-transaction": "src/update-transaction.ts",
    "scripts/find-transactions-by-total": "src/find-transactions-by-total.ts",
  },
  format: ["esm"],
  platform: "node",
  target: "node24",
  // Every dependency is bundled in, so dist/ runs anywhere the skill is copied
  // to, with no node_modules beside it. Code shared between scripts lands in
  // dist/chunks/ and is imported relatively, which is why dist/ must be copied
  // whole. tsup externalizes package.json dependencies by default; this regex
  // overrides that for all of them. Node built-ins stay external regardless.
  noExternal: [/.*/],
  splitting: true,
  esbuildOptions(options) {
    options.chunkNames = "chunks/[name]-[hash]";
  },
  clean: true,
  // Everything the skill ships besides code -- SKILL.md, reference docs -- is
  // copied from skill/ into dist/ as-is, so dist/ is the complete installable
  // skill directory.
  publicDir: "skill",
});
