import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "./app.js";

describe("createApp", () => {
  const app = createApp();

  it("responds to GET /health with ok status", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(typeof res.body.timestamp).toBe("string");
  });

  it("returns 404 JSON for unknown routes", async () => {
    const res = await request(app).get("/does-not-exist");
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Not found");
  });
});
