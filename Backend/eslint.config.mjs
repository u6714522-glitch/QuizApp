import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import eslintConfigPrettier from "eslint-config-prettier";
import globals from "globals";

// Division of labour:
//   Prettier  -> formatting (see .prettierrc, run via `npm run format`)
//   ESLint    -> correctness and the few style rules Prettier does not cover
// eslintConfigPrettier near the bottom switches off every ESLint rule that
// would argue with Prettier, so no formatting rules are declared here.

const eslintConfig = defineConfig([
  ...nextVitals,

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

  // Main config
  {
    files: ["**/*.{js,jsx,mjs}"],

    languageOptions: {
      ecmaVersion: 2026,
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
      "no-duplicate-imports": "error",
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

  // Test file overrides
  {
    files: ["test/**/*.{js,jsx,mjs}", "**/*.{test,spec}.{js,jsx,mjs}"],

    languageOptions: {
      globals: {
        ...globals.mocha,
        ...globals.jest,
      },
    },

    rules: {
      "no-unused-vars": "off",
      "no-unused-expressions": "off",
    },
  },

  // Deliberately re-enabled AFTER eslint-config-prettier.
  // It classes this as a "special rule" and disables it, but it catches real
  // ASI bugs (`const a = b\n[1, 2].forEach(...)`). Safe as long as ESLint
  // runs BEFORE Prettier, which `npm run check` does.
  {
    files: ["**/*.{js,jsx,mjs}"],
    rules: {
      "no-unexpected-multiline": "error",
    },
  },

  // Prettier compat (must be last of the shared configs).
  // Turns off every ESLint rule that overlaps with Prettier's formatting.
  eslintConfigPrettier,
]);

export default eslintConfig;
