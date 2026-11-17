# Issue tracker: GitHub

Issues live in GitHub Issues for `trousyt/hsa-tracker`. Use the `gh` CLI.
Supporting PRDs and implementation plans remain in `docs/plans/`; link
them from relevant issues.

## Operations

- Verify the target with `gh repo view --json nameWithOwner`.
- Create: `gh issue create --repo trousyt/hsa-tracker --title "..." --body-file <file>`.
- Read: `gh issue view <number> --json number,title,body,labels,comments`.
- List: `gh issue list --state open --json number,title,labels`.
- Comment: `gh issue comment <number> --body-file <file>`.
- Label: `gh issue edit <number> --add-label <label>` or `--remove-label <label>`.
- Close: post the explanation as a comment, then run `gh issue close <number>`.

Use native GitHub sub-issues and blocking dependencies when supported by
the installed CLI/API. Otherwise record `Part of #<parent>` and
`Blocked by: #<number>` in the issue body, with a child task list in
the parent. An issue is unblocked when all its blockers are closed.

When a skill says “publish to the issue tracker,” create a GitHub issue.
When it says “fetch the relevant ticket,” read the issue and its comments.

## Pull requests as a triage surface

PRs as a request surface: no.
