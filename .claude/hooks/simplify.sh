#!/bin/bash
set -euo pipefail

case "$CLAUDE_PROJECT_DIR" in
  */.claude/worktrees/*) exit 0 ;;
esac

node -e 'process.exit(/\bgit\s+commit\b/.test(JSON.parse(require("fs").readFileSync(0, "utf8")).tool_input.command) ? 0 : 1)' || exit 0

cd "$CLAUDE_PROJECT_DIR"
sha="$(git rev-parse --short HEAD)"
name="simplify-$sha"
dir=".claude/worktrees/$name"
log="$dir.log"

git worktree add --quiet -b "$name" "$dir" HEAD
cd "$dir"
{
  "$CLAUDE_PROJECT_DIR/node_modules/.bin/vp" install --frozen-lockfile
  echo "/simplify 対象はコミット $sha の変更である。簡潔にできたら vp run verify を通してこのブランチにコミットする。" |
    claude -p --permission-mode acceptEdits --allowedTools "Bash(git *)" "Bash(vp *)"
} >"$CLAUDE_PROJECT_DIR/$log" 2>&1 || true
cd "$CLAUDE_PROJECT_DIR"
git worktree remove --force "$dir"

if [ "$(git rev-list --count "$sha..$name")" -eq 0 ]; then
  git branch --quiet -D "$name"
  exit 0
fi

echo "コミット $sha を /simplify した結果がブランチ $name にある。差分を確認し、取り込むか判断すること。ログは $log にある。" >&2
exit 2
