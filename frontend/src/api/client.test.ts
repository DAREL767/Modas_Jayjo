import { afterEach, describe, expect, it, vi } from "vitest";
import { requestJson } from "./client";

afterEach(() => vi.unstubAllGlobals());

describe("requestJson", () => {
  it("sends bearer auth to the configured API without cookies or redirects", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(requestJson<{ ok: boolean }>("/api/test", {
      method: "POST",
      headers: { "Idempotency-Key": "stable-key" },
      body: JSON.stringify({ value: 1 }),
    }, "session-token")).resolves.toEqual({ ok: true });

    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(String(url)).toBe("http://localhost:8000/api/test");
    expect(new Headers(init.headers).get("Authorization")).toBe("Bearer session-token");
    expect(new Headers(init.headers).get("Idempotency-Key")).toBe("stable-key");
    expect(init.credentials).toBe("omit");
    expect(init.redirect).toBe("error");
  });

  it("rejects absolute or protocol-relative paths before making a request", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(requestJson("//attacker.example/collect")).rejects.toThrow("relativa");
    await expect(requestJson("https://attacker.example/collect")).rejects.toThrow("relativa");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns sanitized messages for server errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ detail: "mongodb password leaked" }), { status: 500 })));
    await expect(requestJson("/api/test")).rejects.toMatchObject({
      status: 500,
      detail: "El servidor no pudo completar la solicitud. Intenta de nuevo.",
    });
  });
});
