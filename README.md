# vocablint

有限の値の集合とオブジェクトの形を、それを既に持っている場所から導かせる検査ツールである。
持ち主は、リポジトリ内で登録した定数か、依存パッケージの型である。
判定は TypeScript の型検査器だけで行い、AI の判定は使わない。

## 使い方

リポジトリのルートで CLI を実行する。
ルール違反を見つけると終了コード 1 で終わる。

```sh
vp exec vocablint
vp exec vocablint --json
```

配下の tsconfig.json をすべて見つけ、それぞれをひとつのプロジェクトとして型検査する。
先頭に `// @ts-nocheck` を書いたファイルは、型検査の対象外なので検査しない。

## 持ち主の登録

モジュールのトップレベルの `const` に `@vocablint` タグと概念の ID を付ける。

```ts
/** @vocablint sort-order */
const SORT_ORDERS = ["asc", "desc"] as const;
type SortOrder = (typeof SORT_ORDERS)[number];
```

## ルール

| ルール                | 落とすもの                                                                 |
| --------------------- | -------------------------------------------------------------------------- |
| `owner-value-set`     | 登録した持ち主の値を書き直した集合                                         |
| `owner-extension`     | 持ち主から導いたうえで値を足した集合                                       |
| `owned-literal`       | 持ち主から導いた型の位置に直接書いたリテラル                               |
| `library-value-set`   | 依存パッケージの型の値を書き直した集合                                     |
| `library-shape`       | 依存パッケージのオブジェクト型を写した interface・型・スキーマ（3 個以上） |
| `duplicate-value-set` | 持ち主のない同じ値の集合が複数の場所にあること                             |
| `owner-annotation`    | `@vocablint` タグの付け方の誤り                                            |

Effect Schema の `Schema.Literals` や `Schema.Struct` も、型の書き換えと同じに扱う。

## oxlint プラグイン

CLI の結果をファイルごとに oxlint へ出す。
判定は CLI が行い、プラグインはその結果を読むだけである。

```ts
export default defineConfig({
  lint: {
    jsPlugins: [{ name: "vocablint", specifier: "@r_masseater/vocablint/oxlint" }],
    rules: { "vocablint/vocabulary": "error" },
  },
});
```

## 開発

## セットアップ

```sh
vp install
cp .env.example .env
vp exec --filter web alchemy profile edit --add Cloudflare
vp run verify
```

Cloudflare の認証情報は環境変数ではなく Alchemy のプロファイル（`~/.alchemy`）で管理する。
デプロイと `.mcp.json` の Cloudflare MCP は、どちらもこのプロファイルの認証情報を使う。

## 環境変数

ルートの `.env` に書く。

| 名前                 | 用途                                            |
| -------------------- | ----------------------------------------------- |
| `OPENROUTER_API_KEY` | `vp check` で走る oxlint-plugin-decision の判定 |

## GitHub の設定

Actions の secrets、Actions による PR 作成の許可、PR を作れる人の制限、既定ブランチのルールセットを gh で設定する。
手順は `setup-github` スキル（[masseater/skills](https://github.com/masseater/skills)）にある。

## 起動とデプロイ

```sh
cd apps/web
vp run dev
vp run deploy
```
