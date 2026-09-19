const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') || '';

export async function api(path, options) {
  const response = await fetch(`${API_BASE_URL}${path}`, options);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}
