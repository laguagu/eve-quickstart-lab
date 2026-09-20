import { defineSandbox, defaultBackend } from "eve/sandbox";

export default defineSandbox({
  // defaultBackend resolves: Vercel Sandbox (when deployed) -> Docker -> microsandbox -> just-bash.
  // On Windows without Docker Desktop you land on just-bash: a simulated shell with no real binaries.
  // Start Docker Desktop to get a real container. See docs/01-sandbox.md.
  backend: defaultBackend({
    docker: { networkPolicy: "deny-all" },
    vercel: { networkPolicy: "deny-all", resources: { vcpus: 2 } },
  }),
});
