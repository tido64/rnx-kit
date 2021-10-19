# @rnx-kit/metro-exotic-transformer

[![Build](https://github.com/microsoft/rnx-kit/actions/workflows/build.yml/badge.svg)](https://github.com/microsoft/rnx-kit/actions/workflows/build.yml)
[![npm version](https://img.shields.io/npm/v/@rnx-kit/metro-exotic-transformer)](https://www.npmjs.com/package/@rnx-kit/metro-exotic-transformer)

## Usage

```js
const { makeMetroConfig } = require("@rnx-kit/metro-config");

module.exports = makeMetroConfig({
  projectRoot: __dirname,
  transformer: {
    babelTransformerPath: require.resolve("@rnx-kit/metro-exotic-transformer"),
  },
});
```
