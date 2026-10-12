<!-- intent-skills:start -->
## Skill Loading

Use the repository’s installed Intent. If it is unavailable, report the missing dependency instead of downloading a replacement.
Before editing files for a substantial task:
- Run `pnpm exec intent list` from the workspace root to see available local skills.
- If a listed skill matches the task, run `pnpm exec intent load <package>#<skill>` before changing files.
- Use the loaded `SKILL.md` guidance while making the change.
- Monorepos: when working across packages, run the skill check from the workspace root and prefer the local skill for the package being changed.
- Multiple matches: prefer the most specific local skill for the package or concern you are changing; load additional skills only when the task spans multiple packages or concerns.
<!-- intent-skills:end -->

<!--VITE PLUS START-->

# Using Vite+, the Unified Toolchain for the Web

This project is using Vite+, a unified toolchain built on top of Vite, Rolldown, Vitest, tsdown, Oxlint, Oxfmt, and Vite Task. Vite+ wraps runtime management, package management, and frontend tooling in a single global CLI called `vp`. Vite+ is distinct from Vite, and it invokes Vite through `vp dev` and `vp build`. Run `vp help` to print a list of commands and `vp <command> --help` for information about a specific command.

Docs are local at `node_modules/vite-plus/docs` or online at https://viteplus.dev/guide/.

## Built-in Commands vs Scripts

`vp <name>` runs a built-in command. `vp run <name>` runs a `package.json` script or a `vite.config.ts` task. Scripts cannot overwrite built-ins, so `vp dev` and `vp run dev` may do different things. Check `package.json` and `vite.config.ts` first, and run `vp run <name>` when the project defines a script or task with that name.

## Tool Versions

Run `vp toolchain` to show versions and relationships in the active Vite+
release. Add a tool name to select part of the graph. For example, run
`vp toolchain vite`. Use `--global` to ignore the local `vite-plus` package. Use
`vp why <package>` to show the package-manager dependency graph.

## Review Checklist

- [ ] Run `vp install` after pulling remote changes and before getting started.
- [ ] Run `vp check` and `vp test` to format, lint, type check and test changes.
- [ ] Check if there are `vite.config.ts` tasks or `package.json` scripts necessary for validation, run via `vp run <script>`.
- [ ] If setup, runtime, or package-manager behavior looks wrong, run `vp env doctor` and include its output when asking for help.

<!--VITE PLUS END-->

## 環境変数と認証

- 環境変数は必要最小限にする。環境変数が一つ増えるだけで、どの環境で何を設定するかという考慮事項が爆発的に増えるためである。
- 環境変数にしてよいのは、設定や認証に限らず、本当に環境ごとに変わる値だけである。環境で変わらない値はコードや Alchemy の設定に書き、ツールにフラグがあればフラグを使う。
- Cloudflare などのクラウドの認証は Alchemy のプロファイルで管理する。

## Cloudflare

- Cloudflare は Workers Paid プランを契約している前提でよい。Paid プランでしか使えない機能や上限を前提に設計してよい。

## レビューとCI

- PRのレビューは行わない。PRは作ったらすぐマージする。
- PRのタイトルと本文は基本的に人間が読まないので、人間向けの説明を書かない。後でエージェント自身が検索したときに、自然に思いつく単語で引っかかり、何をしたか分かる程度でよい。
- PR単位のCIは走らせない。`pull_request` トリガーのワークフローは、最新の main を取り込んでいない PR のマージをルールセットで拒むための `up-to-date`（何も検査しない）だけにする。
- CIはmainへのpushで必ず走らせる。ワークフローは `.github/workflows/verify.yml` である。
- デプロイやリリースのジョブは、同じワークフローで `needs: verify` を指定し、mainの必須CIが通ってから実行する。
- マージ前に必ず base ブランチを取り込み、手元の `vp run verify` を通してからマージする。コンフリクトしないからといって、取り込まないままマージしない。マージしてよいかは聞かない。
- PRごとの動作検証やデプロイはしない。動作の確認は、mainにマージしてデプロイされた本番で実測して行う。
- Claude のクラウドセッションではプロキシが GitHub API を拒むため、`actions-lint` タスク（`vite.config.ts`）は `CLAUDE_CODE_REMOTE` が設定されていると zizmor に `--no-online-audits` を付け、オフライン監査だけを行う。フックにも渡る環境変数で切り替えるため、Stop フックの verify でも同じになる。オンライン監査は main の CI（`.github/workflows/verify.yml`）が担う。

## jev-lint

- ルールは `.jev-lint.yaml` に置き、無料の `respan/span-01-lite` で判定できないものだけを有料の decider で判定する。判定できるかは、正解の分かる違反例と、このリポジトリの書き方どおりに書いた違反でない例を `--cache none --retry 3` で判定させて確かめる。無料で判定できるルールにまで課金しないためである。
- span-01-lite は `kind: noul` のルールしか判定できない。

## 計測

- 推測するな、計測しろ。仮説を立てたら、実装や修正の前に計測で事実を確かめ、その結果だけで判断する。
- 機能開発に取り掛かる前に、AIが自分でデバッグできる仕組みを必ず作る。再現手段、ログやスパン、その出力を読む経路の3つである。
- 計測は本番環境で行えるようにする。できないときは、あらゆる手段で本番同等を保証したステージング環境を作って行う。手元やテスト環境だけの計測は判断の根拠にしない。
- 実践の手順は `measure-dont-guess` スキル（`docs/skills/measure-dont-guess/SKILL.md`）にある。不具合の調査は `systematic-debugging`、完了の確認は `verification-before-completion` スキルに従う。

## ベース

- このリポジトリのベースは https://github.com/masseater/typescript-template である。テンプレート由来の構成・方針はテンプレートに従う。
