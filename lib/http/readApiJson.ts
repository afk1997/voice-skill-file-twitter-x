type ApiError = {
  error?: string;
};

export async function readApiJson<T extends ApiError = ApiError>(response: Response): Promise<T> {
  const text = await response.text();
  if (!text.trim()) {
    return { error: `Request failed with status ${response.status}.` } as T;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    return { error: response.ok ? "Response was not valid JSON." : text } as T;
  }
}
