// Thin client for the Supabein Framework REST API.
// The project id and personal access token are never hardcoded here — the
// user enters them once in the Settings panel and they are kept only in
// this browser's localStorage, sent only to supabein.dxinnovationhub.com.

const Supabein = (() => {
  const STORAGE_KEY = "hagah_supabein_config";
  const DEFAULT_BASE = "https://supabein.dxinnovationhub.com/api/v1";

  function getConfig() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    } catch {
      return {};
    }
  }

  function setConfig({ projectId, token }) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ projectId, token }));
  }

  function clearConfig() {
    localStorage.removeItem(STORAGE_KEY);
  }

  function isConfigured() {
    const { projectId, token } = getConfig();
    return Boolean(projectId && token);
  }

  async function request(path, { method = "GET", body, headers = {} } = {}) {
    const { token } = getConfig();
    if (!token) throw new Error("Supabein is not connected. Add your project token in Settings.");
    const isForm = body instanceof FormData;
    const res = await fetch(`${DEFAULT_BASE}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(isForm ? {} : { "Content-Type": "application/json" }),
        ...headers,
      },
      body: isForm ? body : body !== undefined ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    const data = text ? JSON.parse(text) : {};
    if (!res.ok) throw new Error(data.error || data.message || `Supabein error ${res.status}`);
    return data;
  }

  async function whoAmI() {
    return request("/auth/me");
  }

  async function listRecordings() {
    const { projectId } = getConfig();
    return request(`/data/${projectId}/recordings?order=created_at.desc&limit=100`);
  }

  async function insertRecording(row) {
    const { projectId } = getConfig();
    return request(`/data/${projectId}/recordings`, { method: "POST", body: row });
  }

  async function deleteRecording(id) {
    const { projectId } = getConfig();
    return request(`/data/${projectId}/recordings/${id}`, { method: "DELETE" });
  }

  async function uploadAudio(blob, filename) {
    const { projectId } = getConfig();
    const form = new FormData();
    form.append("file", blob, filename);
    const data = await request(`/projects/${projectId}/storage/hagah-audio`, {
      method: "POST",
      body: form,
    });
    return publicUrl(data.url);
  }

  async function deleteAudio(filename) {
    const { projectId } = getConfig();
    return request(`/projects/${projectId}/storage/hagah-audio/${encodeURIComponent(filename)}`, {
      method: "DELETE",
    });
  }

  function publicUrl(relativeOrFullUrl) {
    if (/^https?:\/\//.test(relativeOrFullUrl)) return relativeOrFullUrl;
    return `https://supabein.dxinnovationhub.com${relativeOrFullUrl}`;
  }

  return {
    getConfig,
    setConfig,
    clearConfig,
    isConfigured,
    whoAmI,
    listRecordings,
    insertRecording,
    deleteRecording,
    uploadAudio,
    deleteAudio,
  };
})();
