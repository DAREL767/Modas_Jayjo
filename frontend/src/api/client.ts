export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly detail: string,
  ) {
    super(detail);
    this.name = "ApiError";
  }
}

function getApiBaseUrl(): URL {
  const configured = import.meta.env.VITE_API_BASE_URL?.trim() || "http://localhost:8000";
  const url = new URL(configured);
  if (!new Set(["http:", "https:"]).has(url.protocol) || url.username || url.password) {
    throw new Error("VITE_API_BASE_URL debe ser un origen HTTP(S) sin credenciales.");
  }
  if (url.pathname !== "/" || url.search || url.hash) {
    throw new Error("VITE_API_BASE_URL debe contener solo el origen del backend.");
  }
  if (import.meta.env.PROD && url.protocol !== "https:") {
    throw new Error("El backend debe usar HTTPS en producción.");
  }
  return url;
}

function safeErrorDetail(payload: unknown, status: number): string {
  if (status < 500 && typeof payload === "object" && payload !== null && "detail" in payload) {
    const detail = payload.detail;
    if (typeof detail === "string") return detail;
  }
  return status >= 500
    ? "El servidor no pudo completar la solicitud. Intenta de nuevo."
    : "No se pudo completar la solicitud.";
}

export async function requestJson<T>(
  path: string,
  options: RequestInit = {},
  accessToken?: string,
): Promise<T> {
  if (!path.startsWith("/") || path.startsWith("//")) {
    throw new Error("La ruta de API debe ser relativa al backend configurado.");
  }

  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");
  if (options.body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);

  const baseUrl = getApiBaseUrl();
  const endpoint = new URL(path.slice(1), baseUrl);
  const response = await fetch(endpoint, {
    ...options,
    headers,
    credentials: "omit",
    redirect: "error",
  });
  const rawBody = await response.text();
  let payload: unknown = undefined;
  if (rawBody) {
    try {
      payload = JSON.parse(rawBody);
    } catch {
      payload = undefined;
    }
  }

  if (!response.ok) {
    throw new ApiError(response.status, safeErrorDetail(payload, response.status));
  }
  if (response.status === 204 || !rawBody) return undefined as T;
  return payload as T;
}
