import { eveChannel } from "eve/channels/eve";
import { httpBasic, localDev } from "eve/channels/auth";

// No vercelOidc() and no placeholderAuth(): this agent is self-hosted, so the
// production authenticator has to be something this host can verify itself.
// httpBasic is enough for service-to-service access behind a reverse proxy that
// terminates TLS; swap for jwtHmac()/oidc() when real end users are involved.
export default eveChannel({
  auth: [
    httpBasic(
      {
        username: process.env.AGENT_USER ?? "agent",
        password: process.env.AGENT_PASSWORD ?? "",
      },
      { realm: "eu-agent" },
    ),
    localDev(),
  ],
});
