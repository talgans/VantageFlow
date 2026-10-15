# VantageFlow — Firebase Project Binding

- Firebase project ID: **`vantageflow`** (see `.firebaserc`). Every Firebase action from this workspace MUST target it.
- Before any deploy, live query, or data write, apply the global Deploy Target Guard:
  `firebase_get_environment` must show Project Directory = this repo and Active Project = `vantageflow`.
  If updating environment, supply `active_project: "default"` if passing `"vantageflow"` doesn't switch the active project.
- Deploy rules only with: `firebase deploy --only firestore:rules --project vantageflow` or `npm run deploy:rules` (CWD = repo root). Never deploy without `--project`.
- Never deploy rules or functions from another repo (e.g. CommunityCare) while this environment is active.
- For any Firestore / Functions / RBAC work, load the `vantageflow-firebase` skill first.
