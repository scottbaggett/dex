# Dex: Git Strategy

This document defines the Git branching model, commit conventions, and workflow for all engineering agents contributing to the Dex codebase.

## 1\. Core Principles

- **Traceability:** Every line of code must be traceable back to a specific task and the agent session that produced it.

- **Atomicity:** Commits should be small, logical, and represent a single, complete unit of work (e.g., implementing a single method and its test).

- **Validation:** No code is integrated without passing all automated checks (linting, type-checking, testing).

- **Human Oversight:** AI is a powerful collaborator, but a human developer is the ultimate gatekeeper of quality and architectural integrity.


## 2\. Branching Model

We will use a simplified feature-branch model based on `main` and `develop`.

- `main`: This branch is the single source of truth. It must **always** be stable, tested, and releasable. Direct commits to `main` are strictly forbidden.

- `develop`: This is the primary integration branch. All feature branches are merged into `develop`.

- `feature/<task-name>`: All new work **must** be done on a feature branch. Branches should be created from the latest `develop`.

    - **Naming Convention:** `feature/<phase>-<short-description>`

    - **Example:** `feature/phase1-document-class`, `feature/phase2-property-pipeline`


## 3\. Commit Message Convention

We will enforce the **Conventional Commits** specification, with a custom footer for agent traceability. This structured format is essential for machine-readability and automated changelog generation.

### Format:

```
<type>(<scope>): <subject>

[optional body]

Agent-ID: <agent-identifier>
Session-ID: <session-or-task-identifier>
```

- **`<type>`:** Must be one of the following:

    - `feat`: A new feature is implemented.

    - `fix`: A bug is fixed.

    - `build`: Changes that affect the build system or dependencies.

    - `ci`: Changes to CI configuration files and scripts.

    - `docs`: Documentation only changes.

    - `style`: Code style changes (formatting, etc.).

    - `refactor`: A code change that neither fixes a bug nor adds a feature.

    - `test`: Adding missing tests or correcting existing tests.

- **`<scope>` (optional):** The part of the codebase this commit affects.

    - **Examples:** `core`, `node`, `pipeline`, `services`, `types`.

- **`<subject>`:** A short, imperative summary of the change (e.g., "implement updateProps method").

- **`Agent-ID` (Mandatory):** An identifier for the agent making the commit.

- **`Session-ID` (Mandatory):** An identifier for the user session or task ID that prompted the work.


### Example Commit:

```
feat(node): implement appendChild and removeChild methods

Adds methods for tree manipulation to the Node class.
Includes invalidation logic to mark the parent's layout as dirty
when children are added or removed.

Agent-ID: dex-builder
Session-ID: 7a3b8f2c-1e9d-4c5a-8b6e-9f2d1c7b4a0e
```

## 4\. The Agent Workflow

This is the step-by-step process for all development work.

1. **Task Assignment:** A human developer assigns a task from the roadmap (e.g., "Implement the `Document` class").

2. **Branch Creation:** The human or lead agent creates a new feature branch from the latest `develop`: `git checkout -b feature/phase1-document-class develop`.

3. **Agent Development:** The engineering agent works exclusively on this branch.

    - The agent generates code for a specific file or a logical unit of work.

    - The agent then creates an atomic commit using the specified message format.

4. **Continuous Integration (CI):** When the feature branch is pushed to the remote repository, a CI pipeline (e.g., GitHub Actions) is automatically triggered. The CI pipeline **must** perform the following checks:
    - **Type Checking:** `bun tsc --noEmit`

    - **Testing:** `bun test`

    - **The build must fail if any of these steps fail.**

5. **Pull Request (PR):** Once the agent's work on the feature is complete and CI is passing, a Pull Request is opened to merge the feature branch into `develop`.

6. **Human Review (Mandatory):**

    - A human developer is assigned as a reviewer.

    - The reviewer checks for architectural alignment, code quality, correctness, and adherence to the P0 Charter.

    - The reviewer can request changes from the agent. The agent will make the changes in new commits on the same feature branch.

7. **Merge:** Once the PR is approved, the feature branch is merged into `develop` using a **squash merge**. This keeps the `develop` history clean, with one commit per feature.

8. **Release:** Periodically, a release branch is created from `develop`, and a PR is opened to merge it into `main`, creating a new tagged release.
