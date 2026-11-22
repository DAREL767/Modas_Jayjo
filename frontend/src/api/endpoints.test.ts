import { afterEach, expect, it, vi } from "vitest";
import { api } from "./endpoints";

afterEach(() => vi.unstubAllGlobals());

it.each(["inventory", "users"] as const)("loads %s beyond the first page", async (endpoint) => {
  const first = Array.from({ length: 100 }, (_, id) => ({ id: String(id) }));
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(new Response(JSON.stringify(first)))
    .mockResolvedValueOnce(new Response(JSON.stringify([{ id: "last" }])));
  vi.stubGlobal("fetch", fetchMock);
  const items = await api[endpoint]("token");
  expect(items).toHaveLength(101);
  expect(items[100].id).toBe("last");
  expect(String(fetchMock.mock.calls[1][0])).toContain("skip=100&limit=100");
});
