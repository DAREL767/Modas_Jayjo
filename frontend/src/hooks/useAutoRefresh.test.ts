import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useAutoRefresh } from "./useAutoRefresh";

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers(); });

it("does not overlap requests and aborts the active request when disabled", async () => {
  vi.useFakeTimers();
  let finish!: () => void;
  const refresh = vi.fn((_signal: AbortSignal) => new Promise<void>((resolve) => { finish = resolve; }));
  const view = renderHook(({ enabled }) => useAutoRefresh(refresh, enabled), { initialProps: { enabled: true } });
  await act(async () => { await vi.advanceTimersByTimeAsync(20000); });
  expect(refresh).toHaveBeenCalledOnce();
  await act(async () => { finish(); });
  await act(async () => { await vi.advanceTimersByTimeAsync(10000); });
  expect(refresh).toHaveBeenCalledTimes(2);
  const signal = refresh.mock.calls[1][0] as AbortSignal;
  view.rerender({ enabled: false });
  expect(signal.aborted).toBe(true);
  await act(async () => { finish(); await vi.advanceTimersByTimeAsync(10000); });
  expect(refresh).toHaveBeenCalledTimes(2);
});

it("pauses in hidden tabs and refreshes when the tab becomes visible", async () => {
  vi.useFakeTimers();
  const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
  const refresh = vi.fn(async () => undefined);
  renderHook(() => useAutoRefresh(refresh));
  await act(async () => { await vi.advanceTimersByTimeAsync(10000); });
  expect(refresh).not.toHaveBeenCalled();
  visibility.mockReturnValue("visible");
  await act(async () => { document.dispatchEvent(new Event("visibilitychange")); });
  expect(refresh).toHaveBeenCalledOnce();
});
