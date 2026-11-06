import assert from "node:assert/strict";
import test from "node:test";

import { decodeResponse, parseArguments, run } from "./canvas-cli.mjs";

test("CLI accepts only documented read tools and valid ports", () => {
  assert.deepEqual(parseArguments(["--port", "3200", "call", "list_courses"]), { port: 3200, command: "call", name: "list_courses", raw: undefined });
  assert.throws(() => parseArguments(["call", "chat"]), /只读工具/);
  assert.throws(() => parseArguments(["--port", "0", "health"]), /--port/);
});

test("CLI decodes JSON and streamed MCP responses", () => {
  assert.deepEqual(decodeResponse('{"result":{"ok":true}}', "application/json"), { result: { ok: true } });
  assert.deepEqual(decodeResponse('event: message\ndata: {"result":{"ok":true}}\n\n', "text/event-stream"), { result: { ok: true } });
});

test("CLI initializes a session and returns the tool JSON", async () => {
  const methods = [];
  const request = async (_url, options) => {
    const body = JSON.parse(options.body);
    methods.push(body.method);
    if (body.method === "notifications/initialized") return new Response("", { status: 202 });
    if (body.method === "initialize") return new Response(JSON.stringify({ jsonrpc: "2.0", id: body.id, result: { protocolVersion: "2024-11-05" } }), { headers: { "content-type": "application/json", "Mcp-Session-Id": "one" } });
    assert.equal(options.headers["Mcp-Session-Id"], "one");
    assert.equal(body.params.name, "list_courses");
    return new Response(JSON.stringify({ jsonrpc: "2.0", id: body.id, result: { content: [{ type: "text", text: '[{"id":1}]' }] } }), { headers: { "content-type": "application/json" } });
  };
  assert.deepEqual(await run(["call", "list_courses"], {}, request), [{ id: 1 }]);
  assert.deepEqual(methods, ["initialize", "notifications/initialized", "tools/call"]);
});
