import { eveChannel } from "eve/channels/eve";
import { httpBasic } from "eve/channels/auth";

export default eveChannel({
  auth: [httpBasic({ username: "test", password: process.env.CRASH_TEST_PASSWORD ?? "" })],
});
