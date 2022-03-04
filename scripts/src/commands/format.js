// @ts-check

/** @type {import("../process").Command} */
module.exports = () =>
  new Promise((resolve) => {
    process.argv = [
      process.argv0,
      "prettier",
      "--write",
      "--loglevel",
      "error",
      "**/*.{js,json,jsx,md,ts,tsx,yml}",
      "!{CODE_OF_CONDUCT,SECURITY}.md",
      "!**/{__fixtures__,lib}/**",
      "!**/CHANGELOG.*",
    ];
    require("prettier/bin-prettier");
    resolve();
  });
