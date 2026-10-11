import { defineConfig } from "tsup";

export default defineConfig({
  // One entry per script SKILL.md can run; each becomes dist/<name>.js and a
  // `bin` entry in package.json.
  entry: {
    "scripts/d2check": "src/d2check.ts",
  },
  format: ["esm"],
  platform: "node",
  // Copilot CLI's Node floor. Consumers run these scripts with whatever Node
  // they have, so the bundles must not use syntax newer than this.
  target: "node22",
  // Every dependency is bundled in, so dist/ runs anywhere the skill is copied
  // to, with no node_modules beside it. tsup externalizes package.json
  // dependencies by default; this regex overrides that for all of them. Node
  // built-ins stay external regardless.
  noExternal: [/.*/],
  // Bundle workspace libraries from their src/ (see tsconfig.base.json), so a
  // skill never ships a stale dist/ of one.
  esbuildOptions(options) {
    options.conditions = ["@glizzus/source"];
  },
  clean: true,
  // SKILL.md and the reference docs are copied from skill/ into dist/ as-is,
  // so dist/ is the complete installable skill directory.
  publicDir: "skill",
});
