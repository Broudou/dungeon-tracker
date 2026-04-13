/**
 * Thin fetch wrapper — identical to the original client.
 * SSR-safe: uses full URL on the server, relative URL in the browser.
 */

const SERVER_BASE = 'http://localhost:3001';

function base() {
  return typeof window === 'undefined' ? SERVER_BASE : '';
}

async function request(method, path, { data, cookie } = {}) {
  const headers = {};
  if (data)   headers['Content-Type'] = 'application/json';
  if (cookie) headers['Cookie'] = cookie;

  const res = await fetch(`${base()}/api${path}`, {
    method,
    credentials: 'include',
    headers,
    body: data ? JSON.stringify(data) : undefined,
  });

  if (res.status === 204) return null;

  const json = await res.json().catch(() => null);

  if (!res.ok) {
    const msg = json?.message || res.statusText || 'Request failed';
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }

  return json;
}

export const api = {
  get:    (path, opts)       => request('GET',    path, opts),
  post:   (path, data, opts) => request('POST',   path, { data, ...opts }),
  patch:  (path, data, opts) => request('PATCH',  path, { data, ...opts }),
  delete: (path, opts)       => request('DELETE', path, opts),
};
