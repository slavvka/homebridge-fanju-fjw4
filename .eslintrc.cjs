// eslint-disable-next-line no-undef
module.exports = {
  root: true,
  env: {
    node: true,
    es2022: true,
    jest: true,
  },
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
  },
  plugins: ["@typescript-eslint", "jest"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:jest/recommended",
    "plugin:prettier/recommended",
  ],
  overrides: [
    {
      files: ["test/**/*.{ts,js}"],
      env: { jest: true },
      plugins: ["jest"],
      extends: ["plugin:jest/recommended"],
    },
  ],
  rules: {},
  ignorePatterns: ["dist/", "node_modules/"],
};
