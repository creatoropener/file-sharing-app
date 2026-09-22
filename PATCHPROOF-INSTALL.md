# Install PatchProof v0.6.0-rc.2

Copy the engine files into your target repository, preserving paths.
Append __pycache__/ and *.py[cod] to its existing .gitignore.
Configure NEBIUS_API_KEY, NEBIUS_PROJECT_ID, NEBIUS_MODEL and a compatible CONTREE_IMAGE (or runtime-specific image secret) in GitHub Actions.
For node-typescript, pin tsx and TypeScript in the target baseline and configure CONTREE_IMAGE_NODE_TYPESCRIPT with a v0.6 web-image UUID.
Commit the workflows to the default branch before applying shadow-fix to an issue.

Full setup and the optional file-sharing example:
https://github.com/creatoropener/shadow-patch/blob/main/docs/SETUP.md
