# vocablint

vocablint makes every finite value set and object shape derive from the place that already owns it.
An owner is either a constant registered in the repository or a type exported by a dependency.
Checks run on the TypeScript type checker alone; no AI is involved.

## Usage

Run the CLI at the repository root.
It exits with code 1 when it finds a violation.

```sh
vp exec vocablint
vp exec vocablint --json
```

vocablint finds every tsconfig.json under the root and type-checks each one as a project.
Files that start with `// @ts-nocheck` are skipped because they are not type-checked.

## Registering an owner

Add the `@vocablint` tag and a concept ID to a top-level `const` in a module.

```ts
/** @vocablint sort-order */
const SORT_ORDERS = ["asc", "desc"] as const;
type SortOrder = (typeof SORT_ORDERS)[number];
```

## Rules

| Rule                  | Reports                                                                                 |
| --------------------- | --------------------------------------------------------------------------------------- |
| `owner-value-set`     | A set that restates a registered owner's values                                         |
| `owner-extension`     | A set derived from an owner with extra values added                                     |
| `owned-literal`       | A literal written directly where a type derived from an owner is expected               |
| `library-value-set`   | A set that restates the values of a dependency's type                                   |
| `library-shape`       | An interface, type or schema that copies a dependency's object type (3 or more members) |
| `duplicate-value-set` | The same unowned value set declared in more than one place                              |
| `owner-annotation`    | A misplaced or malformed `@vocablint` tag                                               |

Effect Schema's `Schema.Literals` and `Schema.Struct` are treated the same as the equivalent types.

## oxlint plugin

The plugin reports the CLI's results to oxlint, file by file.
The CLI does the checking; the plugin only reads its output.

```ts
export default defineConfig({
  lint: {
    jsPlugins: [{ name: "vocablint", specifier: "@r_masseater/vocablint/oxlint" }],
    rules: { "vocablint/vocabulary": "error" },
  },
});
```

## Development

```sh
vp install
cp .env.example .env
vp run verify
```

### Environment variables

Put them in `.env` at the root.

| Name                 | Used for                                                 |
| -------------------- | -------------------------------------------------------- |
| `OPENROUTER_API_KEY` | oxlint-plugin-decision checks that run during `vp check` |

### GitHub settings

Configure the GitHub side with gh.
This covers secrets, pull requests by Actions, who may open pull requests, and the branch ruleset.
The steps are in the `setup-github` skill ([masseater/skills](https://github.com/masseater/skills)).
