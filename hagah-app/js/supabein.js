// Thin client for the Supabein Framework REST API.
// The project id and token come from js/config.js (not committed to git —
// see js/config.example.js), so the app connects automatically with no
// settings screen. Never hardcode real credentials into a file that gets
// committed to version control.

const Supabein = (() => {
  const DEFAULT_BASE = "https://supabein.dxinnovationhub.com/api/v1";

  function getConfig() {
    return (typeof HAGAH_CONFIG !== "undefined" && HAGAH_CONFIG) || {};
  }

  function isConfigured() {
    const { projectId, token } = getConfig();
    return Boolean(projectId && token);
  }

  async function request(path, { method = "GET", body, headers = {} } = {}) {
    const { token } = getConfig();
    if (!token) throw new Error("Missing js/config.js — see js/config.example.js.");
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

  async function listRecordings() {
    const { projectId } = getConfig();
    return request(`/data/${projectId}/recordings?order=created_at.desc&limit=100`);
  }

  async function insertRecording(row) {
    const { projectId } = getConfig();
    return request(`/data/${projectId}/recordings`, { method: "POST", body: row });
  }

  async function updateRecording(id, row) {
    const { projectId } = getConfig();
    return request(`/data/${projectId}/recordings/${id}`, { method: "PATCH", body: row });
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
    isConfigured,
    listRecordings,
    insertRecording,
    updateRecording,
    deleteRecording,
    uploadAudio,
    deleteAudio,
  };
})();
