//import babelParser from "@babel/eslint-parser";
//import babelPluginSyntaxImportAssertions from "@babel/plugin-syntax-import-assertions";
import globals from "globals";

export default {
  languageOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
    globals: {
      ...globals.node,
    },/*
    parser: babelParser,
    parserOptions: {
      requireConfigFile: false,
      babelOptions: {
        plugins: [babelPluginSyntaxImportAssertions],
      },
    },*/
  },
  ignores: [
    "node_modules/*",
    "**/wiki/*",
    "**/check-wiki-event",
    "**/import/*",
  ],
  //plugins: { babelPluginSyntaxImportAssertions },
};
