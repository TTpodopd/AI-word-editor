import { AppSettings } from "../types";
import { loadSettings } from "./storageService";

export type ApiSettingsOverride = Pick<AppSettings, "proxyAccessToken">;

function headersToRecord(headers?: HeadersInit): Record<string, string> {
  if (!headers) return {};
  if (Array.isArray(headers)) {
    return Object.fromEntries(headers);
  }
  if (headers instanceof Headers) {
    const record: Record<string, string> = {};
    headers.forEach((value, key) => {
      record[key] = value;
    });
    return record;
  }
  return { ...headers };
}

export async function buildApiHeaders(
  extra: Record<string, string> = {},
  settingsOverride?: ApiSettingsOverride
): Promise<Headers> {
  const headers = new Headers();
  Object.entries(extra).forEach(([key, value]) => headers.set(key, value));
  const settings = settingsOverride ?? (await loadSettings());
  const token = settings.proxyAccessToken?.trim();

  if (token) {
    headers.set("X-Proxy-Access-Token", token);
  }

  return headers;
}

export async function apiFetch(
  input: string,
  init: RequestInit = {},
  settingsOverride?: ApiSettingsOverride
): Promise<Response> {
  const headers = await buildApiHeaders(headersToRecord(init.headers), settingsOverride);

  return fetch(input, {
    ...init,
    headers,
  });
}
