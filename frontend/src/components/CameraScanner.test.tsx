import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CameraScanButton } from "./CameraScanner";

const reader = vi.hoisted(() => ({ decode: vi.fn(), stop: vi.fn(), trackStop: vi.fn() }));
vi.mock("@zxing/browser", () => ({ BrowserMultiFormatReader: class { decodeFromStream = reader.decode; } }));
beforeEach(() => {
  vi.stubGlobal("isSecureContext", true);
  Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop: reader.trackStop }] }) } });
  reader.decode.mockResolvedValue({ stop: reader.stop });
});
afterEach(() => { cleanup(); vi.clearAllMocks(); vi.unstubAllGlobals(); });

it("starts only after opening and returns one normalized code while stopping the camera", async () => {
  const detected = vi.fn();
  render(<CameraScanButton onDetected={detected} />);
  expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Escanear código" }));
  await waitFor(() => expect(reader.decode).toHaveBeenCalled());
  const callback = reader.decode.mock.calls[0][2];
  act(() => { callback({ getText: () => " abc-123 " }, null, { stop: reader.stop }); callback({ getText: () => "abc-123" }, null, { stop: reader.stop }); });
  expect(detected).toHaveBeenCalledExactlyOnceWith("ABC-123");
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(reader.trackStop).toHaveBeenCalled();
});

it("releases a stream whose permission resolves after closing", async () => {
  let resolve!: (stream: MediaStream) => void;
  vi.mocked(navigator.mediaDevices.getUserMedia).mockReturnValue(new Promise((done) => { resolve = done; }) as Promise<MediaStream>);
  render(<CameraScanButton onDetected={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "Escanear código" }));
  await waitFor(() => expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalled());
  fireEvent.click(screen.getByRole("button", { name: "Cerrar escáner" }));
  await act(async () => resolve({ getTracks: () => [{ stop: reader.trackStop }] } as unknown as MediaStream));
  expect(reader.trackStop).toHaveBeenCalled();
  expect(reader.decode).not.toHaveBeenCalled();
});

it("shows permission failure and lets the user return to manual input", async () => {
  vi.mocked(navigator.mediaDevices.getUserMedia).mockRejectedValue(new DOMException("Denied", "NotAllowedError"));
  render(<CameraScanButton onDetected={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "Escanear código" }));
  expect(await screen.findByText(/No se permitió el acceso/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Cerrar escáner" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

it("releases the camera on unmount and rejects invalid SKU content", async () => {
  const detected = vi.fn();
  const view = render(<CameraScanButton onDetected={detected} />);
  fireEvent.click(screen.getByRole("button", { name: "Escanear código" }));
  await waitFor(() => expect(reader.decode).toHaveBeenCalled());
  act(() => reader.decode.mock.calls[0][2]({ getText: () => "https://example.com" }, null, { stop: reader.stop }));
  expect(detected).not.toHaveBeenCalled();
  expect(screen.getByText(/no es un SKU válido/)).toBeInTheDocument();
  view.unmount();
  expect(reader.trackStop).toHaveBeenCalled();
});
