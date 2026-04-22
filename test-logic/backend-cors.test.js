const test = require("node:test");
const assert = require("node:assert/strict");

const {
  isAllowedSocketOrigin,
  resolveCorsOrigin
} = require("../backend/cors");

test("HTTP CORS reflects same-host split frontend origins instead of forcing localhost APP_URL", () => {
  assert.equal(
    resolveCorsOrigin("http://192.168.4.11:3100", "192.168.4.11:3101", {
      frontendOrigin: "http://127.0.0.1:3100",
      frontendPort: 3100
    }),
    "http://192.168.4.11:3100"
  );

  assert.equal(
    resolveCorsOrigin("http://127.0.0.1:3100", "127.0.0.1:3101", {
      frontendOrigin: "http://127.0.0.1:3100",
      frontendPort: 3100
    }),
    "http://127.0.0.1:3100"
  );
});

test("HTTP CORS falls back to configured APP_URL for unrelated origins", () => {
  assert.equal(
    resolveCorsOrigin("https://evil.example:3100", "192.168.4.11:3101", {
      frontendOrigin: "http://127.0.0.1:3100",
      frontendPort: 3100
    }),
    "http://127.0.0.1:3100"
  );
});

test("Socket origin allowlist accepts split frontend port origins and rejects unrelated ports", () => {
  assert.equal(
    isAllowedSocketOrigin("http://192.168.4.11:3100", {
      frontendOrigin: "http://127.0.0.1:3100",
      frontendPort: 3100
    }),
    true
  );

  assert.equal(
    isAllowedSocketOrigin("http://192.168.4.11:3200", {
      frontendOrigin: "http://127.0.0.1:3100",
      frontendPort: 3100
    }),
    false
  );
});
