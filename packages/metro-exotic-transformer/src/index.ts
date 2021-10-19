import { createExoticTransformer } from "@expo/metro-config/transformer";
import { findPackageDir } from "@rnx-kit/tools-node/package";
import * as path from "path";
import { getAllPackageJsonFiles, getWorkspaceRoot } from "workspace-tools";

function postfixNodeModules(p: string): string {
  return path.join(p, "node_modules");
}

function getAllNodeModulesPaths(): string[] | undefined {
  const packageDir = findPackageDir();
  if (!packageDir) {
    return undefined;
  }

  try {
    const workspaceRoot = getWorkspaceRoot(packageDir);
    if (workspaceRoot) {
      const nodeModulesPaths = getAllPackageJsonFiles(packageDir)?.map((p) =>
        postfixNodeModules(path.dirname(p))
      );
      nodeModulesPaths?.push(postfixNodeModules(workspaceRoot));
      return nodeModulesPaths;
    }
  } catch (_) {
    // We're probably not in a monorepo/workspace
  }

  return undefined;
}

module.exports = createExoticTransformer({
  nodeModulesPaths: getAllNodeModulesPaths() ?? ["node_modules"],
});
