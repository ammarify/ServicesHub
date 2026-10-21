# Contributing to ServiHub

Thanks for taking an interest. This page covers how to run the project and
what a good change looks like.

## Setup

Follow [Getting started](README.md#getting-started) to run the API and the
web app locally with demo data. Use the Node.js version in `.nvmrc`
(`nvm use`), or any version from 20.19 up.

## Making a change

1. Branch from `main`, for example `fix/refund-rounding` or
   `feat/provider-ratings`.
2. Keep the change focused. Business rules and permission checks belong in
   the API; the web app reads each user's permissions from the API instead of
   hard-coding roles.
3. Add or update tests with the code:
   - API: `servihub-api/tests/unit` for pure logic and
     `servihub-api/tests/integration` for HTTP and socket behaviour.
   - Web app: a `*.test.js` or `*.test.jsx` file next to the module.
4. Run the checks for each app you touched:

   ```bash
   cd servihub-api && npm run lint && npm test
   cd Servicehub-admin && npm run lint && npm test && npm run build
   ```

5. If you add an environment variable, document it in that app's
   `.env.example`.

## Commit messages

Write the subject in the imperative mood and keep it under 72 characters,
for example `Cap refunds at the remaining balance`. Use the body to explain
why, when it isn't obvious from the diff.

## Pull requests

Say what changed and how to test it; the template has a short checklist.
Add screenshots for UI changes. CI has to pass before a merge.

## Bugs and ideas

Open an issue with one of the templates. For anything security-related,
follow [SECURITY.md](SECURITY.md) instead of opening a public issue.
