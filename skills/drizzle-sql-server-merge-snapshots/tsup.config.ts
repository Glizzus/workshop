import { defineConfig } from "tsup";

export default defineConfig({
  // One entry per script SKILL.md can run; each becomes dist/<name>.js and a
  // `bin` entry in package.json.
  entry: {
    "scripts/merge-snapshots": "src/merge-snapshots.ts",
  },
  format: ["esm"],
  platform: "node",
  // Copilot CLI's Node floor. Consumers run these scripts with whatever Node
  // they have, so the bundles must not use syntax newer than this.
  target: "node22",
  clean: true,
  // SKILL.md is copied from skill/ into dist/ as-is, so dist/ is the complete
  // installable skill directory.
  publicDir: "skill",
});
