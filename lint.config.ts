import decisionPlugin from "./decision-rules.ts";

const REACT_STATE_HOOKS: readonly string[] = [
  "useState",
  "useReducer",
  "createContext",
  "useContext",
];
const HAND_WRITTEN_SQL = "SQL を手書きせず Drizzle のクエリビルダーを使う";
const UI_STATE = "UI 状態は effect-atom だけで扱う";

const requiredStack: Readonly<Record<string, readonly string[]>> = {
  [UI_STATE]: [
    "zustand",
    "jotai",
    "valtio",
    "recoil",
    "mobx",
    "mobx-*",
    "redux",
    "@reduxjs/*",
    "react-redux",
    "xstate",
    "@xstate/*",
    "nanostores",
    "@nanostores/*",
    "@preact/signals*",
  ],
  "サーバー状態は TanStack Query と Eden だけで扱う": [
    "swr",
    "react-query",
    "@apollo/*",
    "urql",
    "@urql/*",
    "axios",
    "ky",
    "ofetch",
    "got",
    "node-fetch",
    "graphql-request",
    "@trpc/*",
  ],
  "ルーティングとサーバーは TanStack Start と Elysia だけで扱う": [
    "react-router",
    "react-router-dom",
    "next",
    "@remix-run/*",
    "wouter",
    "express",
    "hono",
    "fastify",
    "koa",
    "@nestjs/*",
  ],
  "データベースは Drizzle だけで扱い、スキーマはマイグレーションで生成する": [
    "prisma",
    "@prisma/*",
    "typeorm",
    "sequelize",
    "kysely",
    "knex",
    "@mikro-orm/*",
    "better-sqlite3",
    "pg",
    "mysql2",
  ],
  "認証は better-auth だけで扱う": [
    "next-auth",
    "@auth/*",
    "lucia",
    "passport",
    "passport-*",
    "@clerk/*",
    "firebase/auth",
    "@supabase/*",
  ],
  "UI は shadcn/ui と Tailwind CSS だけで組む": [
    "@mui/*",
    "antd",
    "@chakra-ui/*",
    "@mantine/*",
    "styled-components",
    "@emotion/*",
    "bootstrap",
    "react-bootstrap",
  ],
  "検証、日時、ログ、関数型ユーティリティは Effect だけで扱う": [
    "zod",
    "yup",
    "joi",
    "valibot",
    "arktype",
    "io-ts",
    "superstruct",
    "moment",
    "dayjs",
    "date-fns",
    "luxon",
    "winston",
    "pino",
    "bunyan",
    "loglevel",
    "lodash",
    "lodash-es",
    "ramda",
    "rxjs",
    "fp-ts",
    "neverthrow",
    "ts-results",
    "purify-ts",
  ],
  "フィーチャーフラグは OpenFeature だけで扱う": [
    "launchdarkly-*",
    "@launchdarkly/*",
    "@growthbook/*",
    "unleash-client",
    "flagsmith",
    "@vercel/flags",
  ],
  "計装は Effect のトレーシングだけで扱う": ["@opentelemetry/*", "dd-trace", "newrelic"],
  "インフラは Alchemy の IaC と Cloudflare だけで扱い、wrangler は使わない": [
    "wrangler",
    "miniflare",
    "@cloudflare/vite-plugin",
    "@vercel/*",
    "@netlify/*",
    "aws-cdk",
    "aws-cdk-lib",
    "@pulumi/*",
    "cdktf",
  ],
};

const requiredStackEntries = Object.entries(requiredStack).flatMap(([message, modules]) =>
  modules.map((module) => ({ message, module })),
);

const requiredStackPaths: readonly Readonly<{ name: string; message: string }>[] =
  requiredStackEntries
    .filter(({ module }) => !module.includes("*"))
    .map(({ message, module }) => ({ name: module, message }));

const requiredStackPatterns: readonly Readonly<{ group: readonly string[]; message: string }>[] =
  requiredStackEntries.map(({ message, module }) => {
    if (module.includes("*")) {
      return { group: [module, `${module}/**`], message };
    }
    return { group: [`${module}/**`], message };
  });

const restrictedImports = {
  paths: [
    {
      name: "react",
      importNames: [...REACT_STATE_HOOKS],
      message: UI_STATE,
    },
    { name: "drizzle-orm", importNames: ["sql"], message: HAND_WRITTEN_SQL },
    { name: "drizzle-orm/sql", message: HAND_WRITTEN_SQL },
    ...requiredStackPaths,
  ],
  patterns: [...requiredStackPatterns],
};

const generated = [
  "**/routeTree.gen.ts",
  "**/generated/**",
  "**/drizzle/**/snapshot.json",
  ".claude/skills/**",
  ".claude/hooks/fallow-gate.sh",
  ".intent/**",
  "AGENTS.md",
  "skills-lock.json",
  "CHANGELOG.md",
];

const decisionPluginName = decisionPlugin.meta.name;

const decisionRuleNames = Object.keys(decisionPlugin.rules).map(
  (id) => `${decisionPluginName}/${id}`,
);

export { decisionPluginName, decisionRuleNames, generated, requiredStack, restrictedImports };
