# file-sharing-app-1: switch from the rc.12 copy to the rc.39 Action

Why: this repository has `proof.py` with `APP_VERSION = "0.6.0-rc.12"` and a workflow that runs `python proof.py`.
Labeling an issue today would run rc.12, not the Action.

1. Delete from the repository: `proof.py`, `runtimes.py`, `patchproof_runtime/`, `requirements-patchproof.txt`,
   `PATCHPROOF-INSTALL.md`.
2. Add or replace with the files in this folder: `.github/workflows/shadow-fix.yml`, `.github/workflows/prepare-image.yml`,
   `patchproof.json` (scope: only `lib/utils/format.ts`; `formatEta` protected). Commit to the default branch.
3. Publish the tag `v0.6.0-rc.39` in shadow-patch first (the workflow pins it).
4. Repository settings: secrets `NEBIUS_API_KEY`, `NEBIUS_PROJECT_ID`, `CONTREE_IMAGE_NODE_TYPESCRIPT` (secrets are not shared
   between repositories); variable or secret `NEBIUS_MODEL`; Settings, Actions, General: allow Actions to create pull requests.
   If the image secret is older than the v0.7 web image, run **Prepare Sandbox Image** (profile `web`) and save the new UUID.
5. Create the issue from `DEMO-ISSUE.md` (title on the first line), then add the exact label `shadow-fix`.

Expect: the issue gets a comment, then a PR on `shadow-fix/issue-<n>` that changes only `lib/utils/format.ts` and adds
`tests/test_patchproof_issue_<n>.test.ts`. `formatEta` is also broken in this base (its template strings are garbled
the same way) but is out of scope and protected, so it will remain broken; the issue says so.
This is a development case (the same bug as the v0.5.5 and benchmark runs): a demo, not new evidence.
