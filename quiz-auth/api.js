// Thin client for the SupaBein data API, scoped to the players/admins login tables.

const SESSION_KEYS = { player: "quiz_player_session", admin: "quiz_admin_session" };

async function supabeinRequest(method, path, body, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${SUPABEIN_BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  let data = null;
  try {
    data = await res.json();
  } catch (_) {
    // no body
  }

  if (!res.ok) {
    const message = (data && (data.error || data.message)) || `Request failed (${res.status})`;
    throw new Error(message);
  }
  return data;
}

function saveSession(kind, session) {
  localStorage.setItem(SESSION_KEYS[kind], JSON.stringify(session));
}

function getSession(kind) {
  const raw = localStorage.getItem(SESSION_KEYS[kind]);
  return raw ? JSON.parse(raw) : null;
}

function clearSession(kind) {
  localStorage.removeItem(SESSION_KEYS[kind]);
}

function requireSession(kind, loginPage) {
  const session = getSession(kind);
  if (!session || !session.token) {
    window.location.href = loginPage;
    return null;
  }
  return session;
}

// ── Players (quiz-takers) ──────────────────────────────────────────────────

async function playerSignup(username, password, displayName) {
  return supabeinRequest("POST", `/data/${SUPABEIN_PROJECT_ID}/players`, {
    username,
    password,
    display_name: displayName || null,
  });
}

async function playerLogin(username, password) {
  const result = await supabeinRequest("POST", `/data/${SUPABEIN_PROJECT_ID}/players/login`, {
    username,
    password,
  });
  saveSession("player", { token: result.token, user: result.user });
  return result;
}

// ── Admins ───────────────────────────────────────────────────────────────

async function adminLogin(email, password) {
  const result = await supabeinRequest("POST", `/data/${SUPABEIN_PROJECT_ID}/admins/login`, {
    email,
    password,
  });
  saveSession("admin", { token: result.token, user: result.user });
  return result;
}
