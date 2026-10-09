import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import eslintConfigPrettierRecommended from "eslint-config-prettier";
import globals from "globals";

// Division of labour:
//   Prettier -> formatting (see .prettierrc, run via `npm run format`)
//   ESLint -> correctness and the few style rules Prettier does not cover
//   TypeScript -> types, undefined names, const reassignment (`tsc` / `next build`)
// eslintConfigPrettier near the bottom switches off every ESLint rule that
// would argue with Prettier, so no formatting rules are declared here.

const ALL_FILES = ["**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}"];
const TS_FILES = ["**/*.{ts,tsx,mts,cts}"];

const eslintConfig = defineConfig([
  ...nextVitals,
  // Registers the @typescript-eslint parser + plugin and its recommended rules.
  ...nextTs,

  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Extra ignores:
    "node_modules/**",
    "coverage/**",
    "dist/**",
    ".husky/**",
    "*.min.js",
  ]),

  // Shared rules: JS and TS
  {
    files: ALL_FILES,

    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.node,
        ...globals.browser,
      },
    },

    rules: {
      // Correctness
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "no-undef": "error",
      "no-dupe-keys": "error",
      "no-duplicate-case": "error",
      "no-const-assign": "error",
      "no-unreachable": "error",

      // Blank line rules.
      // Prettier does not manage blank lines between statements, so
      // eslint-config-prettier leaves this rule alone and it really runs.
      //
      // Entries are grouped by PRECEDENCE, not by topic: the last matching
      // entry wins, so broad defaults come first, single-line exceptions
      // next, and the multi-line re-assertions last.
      "padding-line-between-statements": [
        "error",

        // --- 1. Broad defaults -------------------------------------------
        { blankLine: "always", prev: "import", next: "*" },
        { blankLine: "always", prev: "*", next: "return" },
        { blankLine: "always", prev: "return", next: "*" },
        { blankLine: "always", prev: ["const", "let"], next: "*" },
        { blankLine: "always", prev: "*", next: ["function", "export"] },

        // --- 2. Single-line exceptions -----------------------------------
        { blankLine: "any", prev: "import", next: "import" },

        // A single-line declaration may sit directly above a guard clause
        // or another single-line declaration:
        //   const parsed = schema.safeParse(body);
        //   if (!parsed.success) return errorResponse("...", 400);
        {
          blankLine: "any",
          prev: ["singleline-const", "singleline-let"],
          next: ["singleline-const", "singleline-let", "if", "for", "while", "switch", "try"],
        },

        // Guard clauses stack with each other.
        {
          blankLine: "any",
          prev: "if",
          next: ["if", "for", "while", "switch", "try"],
        },

        // --- 3. Multi-line re-assertions ---------------------------------
        // These run last so a wrapped block or a wrapped declaration still
        // gets its blank line even where the exceptions above would have
        // allowed it to stack.
        { blankLine: "always", prev: "*", next: "multiline-block-like" },
        { blankLine: "always", prev: "multiline-block-like", next: "*" },
        {
          blankLine: "always",
          prev: "*",
          next: ["multiline-const", "multiline-let"],
        },
        {
          blankLine: "always",
          prev: ["multiline-const", "multiline-let"],
          next: "*",
        },
      ],

      // Imports
      // allowSeparateTypeImports: `import type { X }` next to
      // `import { y }` from the same module is not a duplicate.
      "no-duplicate-imports": ["error", { allowSeparateTypeImports: true }],
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["/media/*", "/home/*", "/tmp/*"],
              message: "Use relative paths.",
            },
          ],
        },
      ],

      // Warnings
      "no-debugger": "warn",
      "no-var": "warn",
      "prefer-const": "warn",
      "prefer-template": "warn",
      "prefer-arrow-callback": "warn",

      // Disables
      "no-console": "off",
    },
  },

  // TypeScript-only rules
  {
    files: TS_FILES,

    rules: {
      // The compiler already checks these, and the core versions misfire on
      // TS syntax (types, interfaces, overloads, `declare` globals).
      "no-undef": "off",
      "no-dupe-keys": "off",
      "no-const-assign": "off",
      "no-unreachable": "off",

      // Core no-unused-vars does not understand types; use the TS-aware one.
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],

      // Matches the style already used in the codebase:
      //   import { api, message, type User } from "../_lib/api";
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],

      // `any` turns type checking off for that value; flag it, don't block.
      "@typescript-eslint/no-explicit-any": "warn",

      // Prefer `type X = {...}`, which is what _lib/api.ts already uses.
      "@typescript-eslint/consistent-type-definitions": ["warn", "type"],

      // Allow `// @ts-expect-error: reason`, never a bare `// @ts-ignore`.
      "@typescript-eslint/ban-ts-comment": [
        "error",
        { "ts-expect-error": "allow-with-description", "ts-ignore": true },
      ],
    },
  },

  // Test file overrides
  {
    files: ["test/**/*.{js,jsx,mjs,ts,tsx}", "**/*.{test,spec}.{js,jsx,mjs,ts,tsx}"],

    languageOptions: {
      globals: {
        ...globals.mocha,
        ...globals.jest,
      },
    },

    rules: {
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "no-unused-expressions": "off",
      "@typescript-eslint/no-unused-expressions": "off",
      "@typescript-eslint/no-explicit-any": "off",
    },
  },

  // Deliberately re-enabled AFTER eslint-config-prettier.
  // It classes this as a "special rule" and disables it, but it catches real
  // ASI bugs (`const a = b\n[1, 2].forEach(...)`). Safe as long as ESLint
  // runs BEFORE Prettier, which `npm run check` does.
  {
    files: ALL_FILES,
    rules: {
      "no-unexpected-multiline": "error",
    },
  },

  // Prettier compat (must be last of the shared configs).
  // Turns off every ESLint rule that overlaps with Prettier's formatting.
  eslintConfigPrettierRecommended,
]);

export default eslintConfig;
