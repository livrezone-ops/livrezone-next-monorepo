import type { AxiosError } from "axios";

export interface ApiErrorData {
  message?: string;
  error?: string;
  errors?: Record<string, string[]>;
}

export function asApiError(err: unknown): AxiosError<ApiErrorData> {
  return err as AxiosError<ApiErrorData>;
}

export function getApiErrorMessage(err: unknown, fallback: string): string {
  const data = asApiError(err).response?.data;
  return data?.message || data?.error || fallback;
}

export function getApiErrorStatus(err: unknown): number | undefined {
  return asApiError(err).response?.status;
}

export function getApiFieldErrors(err: unknown): Record<string, string[]> {
  return asApiError(err).response?.data?.errors ?? {};
}
