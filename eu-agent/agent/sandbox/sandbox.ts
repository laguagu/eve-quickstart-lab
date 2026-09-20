import { defineSandbox } from "eve/sandbox";
import { docker } from "eve/sandbox/docker";

export default defineSandbox({
  // Pinned to Docker: never silently falls back to just-bash (no real binaries)
  // or to vercel() (which would create sandboxes outside your own infrastructure).
  //
  // deny-all is safe here because the MODEL CALL DOES NOT HAPPEN IN THE SANDBOX.
  // Authored tools and the model client run in the app runtime; the sandbox only
  // ever executes the agent's own shell commands. So customer data in /workspace
  // has no route out of the container.
  backend: docker({ networkPolicy: "deny-all" }),
});
