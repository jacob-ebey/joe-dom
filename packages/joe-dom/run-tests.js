import { spawn } from "node:child_process";

import arg from "arg";
import { glob } from "glob";

const { "--only": only, _: providedTestFiles } = arg({
  "--only": Boolean,
});

const testFiles =
  providedTestFiles.length > 0
    ? providedTestFiles
    : await glob(["tests/*.test.ts", "tests/*.test.tsx"], {
        nodir: true,
      });

const args = [
  "--no-warnings",
  "--loader",
  "tsx",
  "--conditions",
  "source",
  "-r",
  "source-map-support/register",
  only ? "--test-only" : "--test",
  ...testFiles,
];

const childProcess = spawn("node", args, {
  stdio: "inherit",
  env: {
    ...process.env,
    ESBK_TSCONFIG_PATH: "./tsconfig.test.json",
  },
});

childProcess.on("exit", (code) => {
  process.exit(code ?? 1);
});
