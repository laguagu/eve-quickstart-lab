# Sandbox

Every eve agent has exactly one sandbox: an isolated bash environment rooted at
`/workspace`. The built-in `bash`, `read_file`, and `write_file` tools target it. You
do not have to author anything — a working sandbox exists by default.

## Backends

`defaultBackend()` resolves to the first one available:

| Priority | Backend | Condition | Real binaries | Network policy |
| --- | --- | --- | --- | --- |
| 1 | `vercel()` | `process.env.VERCEL` is set (or Vercel credentials locally) | yes | allow/deny + domain allow-list + credential brokering |
| 2 | `docker()` | a Docker daemon is reachable | yes | `allow-all` / `deny-all` only |
| 3 | `microsandbox()` | macOS Apple Silicon **or** Linux glibc + KVM | yes | domain-level allow-list |
| 4 | `justbash()` | always | **no** | `setNetworkPolicy` is rejected |

## Windows notes

**microsandbox does not support Windows.** In practice the choice is:

- **Docker Desktop running** → `docker()`, a real container with real binaries
  (`python`, `git`, `node`).
- **Docker not running** → `justbash()`, a JS-interpreted shell over a virtual
  filesystem under `.eve/sandbox-cache/`.

eve installs the `just-bash` package automatically during `eve dev`
(`npm install --save-dev just-bash`). A production process does not install it — it
fails with an actionable error instead.

### just-bash pitfalls

Observed in this repo:

1. **`$HOME` is `/`.** Skill support files land at `//.agents/skills/<skill>/`. The
   model had to run an extra `find` before it located
   `references/laskentasaannot.md`. On Docker or Vercel the path is a normal
   `$HOME/.agents/skills/...`.
2. **No real binaries.** `python`, `git`, and `jq` are absent. `find`, `sed`, `awk`,
   and `sort` are simulated and cover the basic cases.
3. **`apt-get` in a `bootstrap` hook does not work.** Any installation has to happen
   through a custom image on the Docker or Vercel backend.

If the sandbox needs to run real code on Windows, **start Docker Desktop**. See
[05-agentic-loop.md](05-agentic-loop.md) for what this costs you in practice.

## Limits of the isolation

Verified in this repo: the sandbox cannot see host drives (`/c` and `/mnt` are absent,
`/etc/hostname` is absent, the user is `user`). The bash the model runs is confined.

**However:** `defineTool` code runs in the **app runtime**, not the sandbox, and has
the full `process.env` — every secret included. The sandbox protects you from a
model-generated command, not from your own tool code. This is eve's documented trust
boundary (`node_modules/eve/docs/concepts/security-model.md`, and
`docs/tools/overview.mdx`: *"Authored tools run in your app runtime with full access to
`process.env`, not in the sandbox."*).

Default egress is `allow-all`. For sensitive data, set `deny-all` or an explicit
allow-list **on the backend factory**, not only in the `onSession` hook:

```ts
export default defineSandbox({
  backend: defaultBackend({
    docker: { networkPolicy: "deny-all" },
    vercel: { networkPolicy: "deny-all", resources: { vcpus: 2 } },
  }),
});
```

The reason: if the backend has to replace a sandbox under the same key, `onSession`
**does not run again**, so a policy that lives only there can silently disappear.

## Seeding

`agent/sandbox/workspace/**` is mirrored into `/workspace` at session start, structure
intact. This requires the folder layout (`agent/sandbox/sandbox.ts`), not the shorthand
(`agent/sandbox.ts`). eve lists the top-level entries to the model in the prompt
automatically.

## Lifecycle

- `bootstrap({ use })` — template-scoped, runs once. Add `revalidationKey` if external
  inputs affect what it produces. It **cannot be set without `bootstrap`** — eve rejects
  that configuration at compile time.
- `onSession({ use, ctx })` — scoped to the durable session.

The Docker backend keeps a long-lived container per durable session and persists
`/workspace` across turns. A Vercel VM times out after 30 minutes of inactivity but the
filesystem is preserved and resumed on the next message.
