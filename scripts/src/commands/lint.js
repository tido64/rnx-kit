// @ts-check

/** @type {import("../process").Command} */
module.exports = (_args, rawArgs = []) =>
  new Promise((resolve) => {
    const path = require("path");
    const eslintPath = require.resolve("eslint/package.json");
    const cli = path.join(path.dirname(eslintPath), "bin", "eslint.js");
    process.argv = [
      process.argv0,
      "eslint",
      "--config",
      "package.json",
      "src/*",
      ...rawArgs,
    ];
    require(cli);
    resolve();
  });
