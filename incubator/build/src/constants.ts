import envPaths from "env-paths";
import * as path from "node:path";

export const MAX_ATTEMPTS = 8;
export const MAX_DOWNLOAD_ATTEMPTS = 5;

export const BUILD_ID = "rnx-build";
export const CONFIG_DIR = envPaths(BUILD_ID).config;
export const USER_CONFIG_FILE = path.join(CONFIG_DIR, "config.json");
export const WORKFLOW_ID = BUILD_ID + ".yml";

export const DEPLOYMENT = ["remote-first", "local-only"] as const;

export const DEVICE_TYPES = [
  "device", // Physical devices such as an Android phone or iPhone
  "emulator", // An environment that emulates a physical device; same as `simulator`
  "native", // If supported, run the app as-is on the local machine (e.g. iOS app on Apple silicon Macs)
  "simulator", // An environment that simulates a physical device; same as `emulator`
] as const;

export const PLATFORMS = ["android", "ios", "macos", "windows"] as const;
