import { test } from "node:test";
import assert from "node:assert/strict";
import { identity, sameOrigin } from "../functions/_lib/security.js";
import { onRequest } from "../functions/api/_middleware.js";
test("no identity without configured Access and D1", async () => {
  await assert.rejects(
    () => identity(new Request("https://app.test/api/session"), {}),
    (e) => e.status === 503,
  );
});
test("no identity by spoofing email header alone", async () => {
  await assert.rejects(
    () =>
      identity(
        new Request("https://app.test/api/session", {
          headers: {
            "Cf-Access-Authenticated-User-Email": "owner@example.com",
          },
        }),
        {
          DB: {},
          ACCESS_TEAM_DOMAIN: "team.cloudflareaccess.com",
          ACCESS_AUD: "test",
        },
      ),
    (e) => e.status === 401,
  );
});
test("middleware rejects cross-origin writes before auth", async () => {
  let called = false;
  const r = await onRequest({
    request: new Request("https://app.test/api/projects", {
      method: "POST",
      headers: { Origin: "https://other.test" },
    }),
    env: {},
    data: {},
    next: () => {
      called = true;
    },
  });
  assert.equal(r.status, 403);
  assert.equal(called, false);
});
