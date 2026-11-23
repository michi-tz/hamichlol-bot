import globals from "globals";

export default {
  languageOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
    globals: {
      ...globals.node,
    },
  },
  ignores: [
    "node_modules/*",
    "**/wiki/*",
    "**/check-wiki-event",
    "**/import/*",
  ],
};
