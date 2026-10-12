import { presets as effectPresets } from "@effect/tsgo/oxlint-presets";
import eslintReact from "@eslint-react/eslint-plugin";
import htmlReact from "@html-eslint/eslint-plugin-react";
import { plugin as shadcn } from "@shadcn/lint";
import tanstackQuery from "@tanstack/eslint-plugin-query";
import tanstackRouter from "@tanstack/eslint-plugin-router";
import baselineJs from "eslint-plugin-baseline-js";
import reactHooks from "eslint-plugin-react-hooks";
import { defineConfig } from "vite-plus";

import {
  decisionPluginName,
  decisionRuleNames,
  generated,
  restrictedImports,
} from "./lint.config.ts";

type Rules = Readonly<Record<string, "error">>;

const asErrors = (names: readonly string[]): Rules =>
  Object.fromEntries(names.map((name) => [name, "error"] as const));

const allRulesOf = (prefix: string, plugin: Readonly<{ rules: object }>): Rules =>
  asErrors(Object.keys(plugin.rules).map((rule) => `${prefix}/${rule}`));

const reactHooksRules = asErrors(
  Object.keys(reactHooks.configs["recommended-latest"].rules).map((name) =>
    name.replace("react-hooks/", "react-hooks-js/"),
  ),
);

const eslintReactRules = asErrors(
  Object.keys(eslintReact.configs["strict-typescript"].rules ?? {}).filter(
    (name) => !(name.replace("@eslint-react/", "react-hooks-js/") in reactHooksRules),
  ),
);

const decisionRules = asErrors(decisionRuleNames);

const effectRules = asErrors(
  Object.values(effectPresets).flatMap((preset) => Object.keys(preset.rules ?? {})),
);

export default defineConfig({
  staged: {
    "*": "vp check --fix",
  },
  fmt: {
    ignorePatterns: generated,
    sortImports: true,
    sortTailwindcss: true,
    sortPackageJson: true,
  },
  lint: {
    ignorePatterns: generated,
    plugins: [
      "eslint",
      "typescript",
      "unicorn",
      "oxc",
      "import",
      "react",
      "react-perf",
      "jsx-a11y",
      "jsdoc",
      "promise",
      "node",
      "effecttsgo",
    ],
    categories: {
      correctness: "error",
      suspicious: "error",
      pedantic: "error",
      perf: "error",
      style: "error",
      restriction: "error",
      nursery: "error",
    },
    jsPlugins: [
      { name: "vite-plus", specifier: "vite-plus/oxlint-plugin" },
      { name: "tanstack-query", specifier: "@tanstack/eslint-plugin-query" },
      { name: "tanstack-router", specifier: "@tanstack/eslint-plugin-router" },
      { name: "drizzle", specifier: "eslint-plugin-drizzle" },
      { name: "react-hooks-js", specifier: "eslint-plugin-react-hooks" },
      { name: "@eslint-react", specifier: "@eslint-react/eslint-plugin" },
      { name: "shadcn", specifier: "@shadcn/lint" },
      { name: "no-comments", specifier: "eslint-plugin-no-comments" },
      { name: "baseline-js", specifier: "eslint-plugin-baseline-js" },
      { name: "@html-eslint/react", specifier: "@html-eslint/eslint-plugin-react" },
      { name: decisionPluginName, specifier: "./decision-rules.ts" },
    ],
    rules: {
      "vite-plus/prefer-vite-plus-imports": "error",
      "no-comments/disallowComments": ["error", { allow: ["oxlint-disable", "eslint-disable"] }],
      ...allRulesOf("tanstack-query", tanstackQuery),
      ...allRulesOf("tanstack-router", tanstackRouter),
      "drizzle/enforce-delete-with-where": "error",
      "drizzle/enforce-update-with-where": "error",
      ...allRulesOf("shadcn", shadcn),
      ...allRulesOf("baseline-js", baselineJs),
      ...baselineJs.configs.recommended().rules,
      ...asErrors(Object.keys(htmlReact.configs.all.rules ?? {})),
      ...reactHooksRules,
      ...eslintReactRules,
      ...effectRules,
      "eslint/sort-imports": "off",
      "eslint/sort-keys": "off",
      "import/no-named-export": "off",
      "import/prefer-default-export": "off",
      "react/react-in-jsx-scope": "off",
      "eslint/no-undef": "off",
      "typescript/promise-function-async": "off",
      "react/forbid-component-props": "off",
      "oxc/no-rest-spread-properties": "off",
      "node/no-top-level-await": "off",
      "eslint/one-var": ["error", "never"],
      "eslint/no-restricted-imports": ["error", restrictedImports],
      "typescript/prefer-readonly-parameter-types": [
        "error",
        {
          ignoreInferredTypes: true,
          allow: [
            { from: "lib", name: "Request" },
            { from: "package", package: "@tanstack/query-core", name: "QueryClient" },
            {
              from: "package",
              package: "react",
              name: ["ReactNode", "ButtonHTMLAttributes", "ClassAttributes"],
            },
            { from: "package", package: "clsx", name: "ClassValue" },
            {
              from: "package",
              package: "effect",
              name: ["Cause", "Context", "Effect", "Exit", "Layer", "Option"],
            },
            {
              from: "package",
              package: "typescript",
              name: [
                "Declaration",
                "Expression",
                "Node",
                "NumericLiteral",
                "ParsedCommandLine",
                "Program",
                "Signature",
                "SourceFile",
                "StringLiteral",
                "Symbol",
                "Type",
                "TypeChecker",
                "TypeNode",
                "UnionTypeNode",
                "VariableDeclaration",
                "VariableDeclarationList",
              ],
            },
          ],
        },
      ],
      "eslint/no-duplicate-imports": ["error", { allowSeparateTypeImports: true }],
      "react/function-component-definition": [
        "error",
        { namedComponents: "arrow-function", unnamedComponents: "arrow-function" },
      ],
      "eslint/new-cap": [
        "error",
        {
          capIsNewExceptions: ["CloudflareApiLive", "Stack"],
          capIsNewExceptionPattern: "^(Config|Context|Data|Schema|D1|Website|Workers)\\.",
        },
      ],
      "typescript/no-empty-interface": ["error", { allowSingleExtends: true }],
      "typescript/no-empty-object-type": ["error", { allowInterfaces: "with-single-extends" }],
      "react/jsx-filename-extension": ["error", { extensions: [".tsx"] }],
      "react/only-export-components": ["error", { allowExportNames: ["Route"] }],
    },
    overrides: [
      {
        files: ["**/*.config.ts", "**/alchemy.run.ts", "**/*.worker.ts", "decision-rules.ts"],
        rules: { "import/no-default-export": "off" },
      },
      {
        files: ["tools/vocablint/src/oxlint.ts"],
        rules: {
          "import/no-default-export": "off",
          "import/no-nodejs-modules": "off",
          "node/no-sync": "off",
          "effecttsgo/node-builtin-import": "off",
          "effecttsgo/schema-sync": "off",
        },
      },
      {
        files: ["**/shared/ui/**"],
        rules: { "shadcn/no-restyle": "off", "react/jsx-props-no-spreading": "off" },
      },
      {
        files: ["apps/web/src/**/*.{ts,tsx}"],
        rules: decisionRules,
      },
      {
        files: ["**/*.test.ts"],
        rules: Object.fromEntries(Object.keys(decisionRules).map((name) => [name, "off"] as const)),
      },
    ],
    settings: {
      [decisionPluginName]: { model: "openrouter/perplexity/pplx-decider-v1.1-27b" },
    },
    options: {
      typeAware: true,
      typeCheck: true,
      denyWarnings: true,
      reportUnusedDisableDirectives: "error",
    },
  },
  run: {
    cache: true,
    tasks: {
      "actions-lint": {
        command:
          'uvx --from actionlint-py@1.7.12.25 actionlint && uvx zizmor@1.30.1 $(test -n "$CLAUDE_CODE_REMOTE" && echo --no-online-audits) .github && ast-grep scan --rule .github/rules/no-full-history-checkout.yml .github/workflows',
        cache: {
          env: ["CLAUDE_CODE_REMOTE"],
          untrackedEnv: [
            "GH_TOKEN",
            "HTTPS_PROXY",
            "https_proxy",
            "NO_PROXY",
            "no_proxy",
            "SSL_CERT_FILE",
          ],
        },
      },
      verify: {
        command: "vp check",
        cache: {
          env: ["OPENROUTER_API_KEY"],
          untrackedEnv: [
            "CLAUDECODE",
            "CLAUDE_CODE_REMOTE",
            "HTTPS_PROXY",
            "https_proxy",
            "NO_PROXY",
            "no_proxy",
            "SSL_CERT_FILE",
            "NODE_EXTRA_CA_CERTS",
          ],
        },
        dependsOn: [
          "test-all",
          "eslint",
          "syncpack",
          "markdown-lint",
          "renovate",
          "actions-lint",
          "fallow-all",
          "gitleaks",
        ],
      },
      "test-all": "vp run -r test",
      eslint: "NODE_OPTIONS=--max-old-space-size=4096 eslint --max-warnings 0 .",
      syncpack: "syncpack lint",
      "fallow-all": "vp run -r fallow",
      gitleaks: {
        command: "go run github.com/zricethezav/gitleaks/v8@v8.30.1 git --redact --no-banner",
        cache: false,
      },
    },
  },
});
