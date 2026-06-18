"""
SupaBein API client — wraps all REST calls with urllib (zero external deps).
Base URL: http://supabein.dxinnovationhub.com/api/v1
"""

import json
import urllib.request
import urllib.error
import urllib.parse


class SupaBeinError(Exception):
    def __init__(self, message, status_code=None):
        super().__init__(message)
        self.status_code = status_code


class SupaBeinClient:
    def __init__(self, base_url: str, token: str = None):
        self.base_url = base_url.rstrip("/")
        self.token = token

    def _request(self, method: str, path: str, body=None, token: str = None) -> dict:
        url = f"{self.base_url}{path}"
        headers = {"Content-Type": "application/json"}
        tok = token or self.token
        if tok:
            headers["Authorization"] = f"Bearer {tok}"

        data = json.dumps(body).encode() if body is not None else None
        req = urllib.request.Request(url, data=data, headers=headers, method=method)

        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                raw = resp.read().decode()
                return json.loads(raw) if raw.strip() else {}
        except urllib.error.HTTPError as e:
            raw = e.read().decode()
            try:
                err = json.loads(raw)
                msg = err.get("message") or err.get("error") or raw
            except Exception:
                msg = raw
            raise SupaBeinError(f"HTTP {e.code}: {msg}", e.code)

    # ── Platform Auth ────────────────────────────────────────────────────────

    def signup(self, email: str, password: str) -> dict:
        return self._request("POST", "/auth/signup", {"email": email, "password": password})

    def login(self, email: str, password: str) -> dict:
        return self._request("POST", "/auth/login", {"email": email, "password": password})

    def me(self) -> dict:
        return self._request("GET", "/auth/me")

    # ── Projects ─────────────────────────────────────────────────────────────

    def list_projects(self) -> list:
        return self._request("GET", "/projects")

    def create_project(self, name: str) -> dict:
        return self._request("POST", "/projects", {"name": name})

    def delete_project(self, project_id: int) -> dict:
        return self._request("DELETE", f"/projects/{project_id}")

    # ── Tables & Columns ─────────────────────────────────────────────────────

    def list_tables(self, project_id: int) -> list:
        return self._request("GET", f"/projects/{project_id}/tables")

    def create_table(self, project_id: int, name: str) -> dict:
        return self._request("POST", f"/projects/{project_id}/tables", {"name": name})

    def add_column(self, project_id: int, table: str, name: str,
                   col_type: str, nullable: bool = True, default: str = None) -> dict:
        body = {"name": name, "type": col_type, "nullable": nullable}
        if default is not None:
            body["default"] = default
        return self._request("POST", f"/projects/{project_id}/tables/{table}/columns", body)

    # ── Policies (RLS) ───────────────────────────────────────────────────────

    def set_policies(self, project_id: int, table: str, policies: list) -> dict:
        return self._request("PUT", f"/projects/{project_id}/tables/{table}/policies", policies)

    # ── Data API ─────────────────────────────────────────────────────────────

    def insert(self, project_id: int, table: str, row: dict, token: str = None) -> dict:
        return self._request("POST", f"/data/{project_id}/{table}", row, token=token)

    def list_rows(self, project_id: int, table: str,
                  params: dict = None, token: str = None) -> dict:
        path = f"/data/{project_id}/{table}"
        if params:
            path += "?" + urllib.parse.urlencode(params)
        return self._request("GET", path, token=token)

    def get_row(self, project_id: int, table: str, row_id: int, token: str = None) -> dict:
        return self._request("GET", f"/data/{project_id}/{table}/{row_id}", token=token)

    def update_row(self, project_id: int, table: str,
                   row_id: int, data: dict, token: str = None) -> dict:
        return self._request("PATCH", f"/data/{project_id}/{table}/{row_id}", data, token=token)

    def delete_row(self, project_id: int, table: str, row_id: int, token: str = None) -> dict:
        return self._request("DELETE", f"/data/{project_id}/{table}/{row_id}", token=token)
