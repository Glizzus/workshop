import { defaultServerConditions } from "vite";
import { defineConfig } from "vitest/config";

// Vitest searches upward from the directory it runs in, so this one file
// configures every workspace member's `vitest run`. The test root stays the
// member's own directory.
export default defineConfig({
  ssr: {
    resolve: {
      // Workspace libraries export their src/ under this condition (see
      // tsconfig.base.json), so a member's tests run against its dependencies'
      // current source instead of a stale dist/. Listed ahead of the defaults
      // because replacing them would drop "node" and "module".
      conditions: ["@glizzus/source", ...defaultServerConditions],
    },
  },
});
