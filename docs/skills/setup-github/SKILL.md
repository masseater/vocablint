---
name: setup-github
description: このテンプレートから作ったリポジトリの GitHub 側を gh で設定する。Actions の secrets、Actions による PR 作成の許可、PR を作れる人の制限、既定ブランチのルールセットを揃える。テンプレートから新しいリポジトリを作ったとき、GitHub の設定を揃え直すときに使う。
---

# GitHub の設定

設定はすべて `gh` で行う。対象リポジトリを `REPO=<owner>/<name>` とする。
どの手順も、同じ値で何度実行しても結果が変わらない。

## 1. アプリ名を変える

`apps/web/app-name.ts` の `APP_NAME` は、テンプレートの名前のままになっている。
`APP_NAME` はスタック名とリソース名の接頭辞になる。
状態は Cloudflare アカウントの中でスタック名ごとに保存されるため、同じアカウントを使う別のリポジトリと名前が重なると、互いのリソースを置き換えてしまう。
リポジトリ名に合わせて変える。

## 2. secrets を登録する

値はユーザーに尋ねる。

```sh
gh secret set OPENROUTER_API_KEY --repo "$REPO"
gh secret set CLAUDE_CODE_OAUTH_TOKEN --repo "$REPO"
gh secret set CLOUDFLARE_ACCOUNT_ID --repo "$REPO"
gh secret set CLOUDFLARE_API_TOKEN --repo "$REPO"
```

| 名前                      | 用途                                        |
| ------------------------- | ------------------------------------------- |
| `OPENROUTER_API_KEY`      | verify ワークフローの jev-lint              |
| `CLAUDE_CODE_OAUTH_TOKEN` | verify 失敗時に Claude Code が自動修正する  |
| `CLOUDFLARE_ACCOUNT_ID`   | デプロイ先と Alchemy の状態を置くアカウント |
| `CLOUDFLARE_API_TOKEN`    | 同じアカウントの API トークン               |

Organization のリポジトリなら、Organization の secrets に一度登録すれば、各リポジトリでの登録は要らない。

## 3. Actions に PR の作成を許可する

release-please と自動修正が PR を作るためである。

```sh
gh api --method PUT "repos/$REPO/actions/permissions/workflow" \
  -f default_workflow_permissions=read -F can_approve_pull_request_reviews=true
```

## 4. PR を作れる人を collaborator に限る

```sh
gh api --method PATCH "repos/$REPO" -f pull_request_creation_policy=collaborators_only
```

## 5. 既定ブランチを保護する

既定ブランチの削除と force push を禁じるルールセットを作る。
同じ名前のルールセットがあれば作らない。

```sh
gh api "repos/$REPO/rulesets" --jq '.[].name' | grep -qx 'protect default branch' ||
  gh api --method POST "repos/$REPO/rulesets" --input - <<'JSON'
{
  "name": "protect default branch",
  "target": "branch",
  "enforcement": "active",
  "conditions": { "ref_name": { "include": ["~DEFAULT_BRANCH"], "exclude": [] } },
  "rules": [{ "type": "deletion" }, { "type": "non_fast_forward" }]
}
JSON
```

## 6. 反映を確かめる

`gh api "repos/$REPO" --jq .pull_request_creation_policy` が `collaborators_only` を返すことを確かめる。
`gh api "repos/$REPO/rulesets" --jq '.[].name'` に `protect default branch` があることも確かめる。
