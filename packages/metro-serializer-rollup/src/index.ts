import { info, warn } from "@rnx-kit/console";
import type { MetroPlugin } from "@rnx-kit/metro-serializer";
import type { Dependencies, Graph, Module, SerializerOptions } from "metro";
import type { SerializerConfigT } from "metro-config";
import { rollup } from "rollup";
import type { OutputOptions, Plugin } from "rollup";
import * as semver from "semver";

export * from "./transformerConfig";

type Options = {
  fabric?: boolean;
  target?: OutputOptions["generatedCode"];
};

function assertVersion(requiredVersion: string): void {
  const { version } = require("metro/package.json");
  if (!semver.satisfies(version, requiredVersion)) {
    throw new Error(
      `Metro version ${requiredVersion} is required; got ${version}`
    );
  }
}

function escapePath(path: string): string {
  return path.replace(/\\+/g, "\\\\");
}

export function fixSourceMap(outputPath: string, text: string): string {
  const path = require("path");

  /**
   * All paths in the source map are relative to the directory
   * containing the source map.
   *
   * See https://esbuild.github.io/api/#source-root
   */
  const sourceRoot = path.dirname(outputPath);
  const sourcemap = JSON.parse(text);
  const sources = sourcemap.sources.map((file: string) =>
    path.resolve(sourceRoot, file)
  );

  return JSON.stringify({ ...sourcemap, sources });
}

export function isImporting(
  moduleName: string,
  dependencies: Dependencies
): boolean {
  const iterator = dependencies.keys();
  for (let key = iterator.next(); !key.done; key = iterator.next()) {
    if (key.value.includes(moduleName)) {
      return true;
    }
  }
  return false;
}

function isRedundantPolyfill(modulePath: string): boolean {
  // __prelude__: The content of `__prelude__` is passed to esbuild with `define`
  // polyfills/require.js: `require` is already provided by esbuild
  return /(?:__prelude__|[/\\]polyfills[/\\]require.js)$/.test(modulePath);
}

function outputOf(module: Module | undefined): string | undefined {
  return module?.output?.map(({ data }) => data.code).join("\n");
}

function extractModuleId(moduleId: string): string {
  const [id] = moduleId.split("?");
  return id[0] === "\0" ? id.slice(1) : id;
}

/**
 * esbuild bundler for Metro.
 */
export function MetroSerializer(
  metroPlugins: MetroPlugin[] = [],
  buildOptions?: Options
): SerializerConfigT["customSerializer"] {
  assertVersion(">=0.66.1");

  return (
    entryPoint: string,
    preModules: ReadonlyArray<Module>,
    graph: Graph,
    options: SerializerOptions
  ): ReturnType<Required<SerializerConfigT>["customSerializer"]> => {
    metroPlugins.forEach((plugin) =>
      plugin(entryPoint, preModules, graph, options)
    );

    const { dependencies } = graph;
    const metroPlugin: Plugin = {
      name: require("../package.json").name,
      resolveId: (source, importerProxy) => {
        if (dependencies.has(source)) {
          return source;
        }

        const importer = importerProxy && extractModuleId(importerProxy);
        if (importer) {
          const parent = dependencies.get(importer);
          if (parent) {
            return parent.dependencies.get(source)?.absolutePath;
          }
        }

        if (preModules.find(({ path }) => path === source)) {
          return source;
        }

        throw new Error(`Could not resolve '${source}' from '${importer}'`);
      },
      load: (moduleId) => {
        const id = extractModuleId(moduleId);
        const mod = dependencies.get(id);
        if (mod) {
          return { code: outputOf(mod) ?? "" };
        }

        const polyfill = preModules.find(({ path }) => path === id);
        if (polyfill) {
          return { code: outputOf(polyfill) ?? "" };
        }

        if (id === __filename) {
          return {
            /**
             * Add all the polyfills in this file. See the `inject` option
             * below for more details.
             *
             * We must ensure that the content is ES5-friendly so esbuild
             * doesn't blow up when targeting ES5, e.g. use `var` instead of
             * `let` and `const`.
             */
            code: [
              /**
               * Many React Native modules expect `global` to be passed with
               * Metro's `require` polyfill. We need to re-create it since
               * we're using esbuild's `require`.
               *
               * The `Function` constructor creates functions that execute in
               * the global scope. We use this trait to ensure that `this`
               * references the global object.
               *
               * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function#description
               */
              `export var global = new Function("return this;")();`,

              /** Polyfills */
              ...preModules
                .filter(({ path }) => !isRedundantPolyfill(path))
                .map(({ path }) => `require("${escapePath(path)}");`),

              /**
               * Ensure that `react-native/Libraries/Core/InitializeCore.js`
               * gets executed first. Note that this list may include modules
               * from platforms other than the one we're targeting.
               */
              ...options.runBeforeMainModule
                .filter((value) => dependencies.has(value))
                .map((value) => `require("${escapePath(value)}");`),
            ].join("\n"),
          };
        }

        warn(`No such module: ${id}`);
        return null;
      },
    };

    return rollup({
      input: entryPoint,
      external:
        buildOptions?.fabric !== true
          ? (id) => id.endsWith("ReactFabric-prod.js")
          : undefined,
      onwarn: (warning, defaultHandler) => {
        switch (warning.code) {
          case "CIRCULAR_DEPENDENCY":
            break;
          case "THIS_IS_UNDEFINED":
            // Ignore "The 'this' keyword is equivalent to 'undefined' at the
            // top level of an ES module, and has been rewritten"
            break;
          default:
            defaultHandler(warning);
            break;
        }
      },
      plugins: [metroPlugin],
    })
      .then((bundle) =>
        bundle.generate({
          format: "iife",
          globals: {
            __DEV__: JSON.stringify(Boolean(options.dev)),
            __METRO_GLOBAL_PREFIX__: "''",
            global: "global",
          },
          // To ensure that Hermes is able to consume this bundle, we must target
          // ES5. Hermes is missing a bunch of ES6 features, such as block scoping
          // (see https://github.com/facebook/hermes/issues/575).
          generatedCode: buildOptions?.target ?? "es5",
        })
      )
      .then(({ output }) => {
        const [main] = output;
        info("Rollup bundle size:", main.code.length);
        return { code: main.code, map: "" };
      });
  };
}
