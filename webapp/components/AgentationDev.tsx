"use client";

import { Agentation } from "agentation";

/**
 * Dev-only annotation overlay (https://agentation.dev).
 *
 * Renders the Agentation widget and syncs annotations to the local
 * `agentation-mcp` server (port 4747) so the coding agent can read them in
 * real time. This is a "use client" boundary because the root layout is a
 * server component and `onSessionCreated` is a function prop (not
 * serializable across the server→client boundary).
 *
 * The caller already gates this on `NODE_ENV === "development"`, so this
 * component never ships to production.
 */
export default function AgentationDev() {
  return (
    <Agentation
      endpoint="http://localhost:4747"
      onSessionCreated={(sessionId) => {
        // Handy when debugging the sync handshake.
        console.info("[agentation] session:", sessionId);
      }}
    />
  );
}
