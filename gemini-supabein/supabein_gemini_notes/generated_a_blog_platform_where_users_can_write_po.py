import json
import urllib.request
import os
from datetime import datetime

# --- Configuration ---
SUPABEIN_EMAIL = os.getenv("SUPABEIN_EMAIL")
SUPABEIN_PASSWORD = os.getenv("SUPABEIN_PASSWORD")
SUPABEIN_BASE = os.getenv("SUPABEIN_BASE", "http://supabein.dxinnovationhub.com/api/v1")

if not SUPABEIN_EMAIL or not SUPABEIN_PASSWORD:
    print("Error: Please set SUPABEIN_EMAIL and SUPABEIN_PASSWORD environment variables.")
    exit(1)

# --- SupaBein API Helper ---
def api(method, path, body=None, token=None, base_url=SUPABEIN_BASE):
    url = f"{base_url}{path}"
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"

    data = json.dumps(body).encode('utf-8') if body else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)

    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            response_body = r.read().decode('utf-8')
            return json.loads(response_body) if response_body else {}
    except urllib.error.HTTPError as e:
        print(f"HTTP Error for {method} {path}: {e.code} - {e.reason}")
        try:
            error_details = json.loads(e.read().decode('utf-8'))
            print(f"Error details: {error_details}")
        except json.JSONDecodeError:
            print(f"Error details: {e.read().decode('utf-8')}")
        raise
    except urllib.error.URLError as e:
        print(f"URL Error for {method} {path}: {e.reason}")
        raise
    except Exception as e:
        print(f"An unexpected error occurred for {method} {path}: {e}")
        raise

# --- Main Script ---
def setup_blog_platform():
    print("--- SupaBein Blog Platform Setup ---")

    token = None
    user_id = None
    project_id = None

    try:
        # 1. Sign up / Log in
        print("\n1. Authenticating...")
        try:
            auth_response = api("POST", "/auth/signup", {"email": SUPABEIN_EMAIL, "password": SUPABEIN_PASSWORD})
            token = auth_response.get("token")
            print(f"Signed up and logged in as {SUPABEIN_EMAIL}")
        except urllib.error.HTTPError as e:
            if e.code == 409: # Conflict, user already exists
                print(f"User {SUPABEIN_EMAIL} already exists. Attempting to log in...")
                auth_response = api("POST", "/auth/login", {"email": SUPABEIN_EMAIL, "password": SUPABEIN_PASSWORD})
                token = auth_response.get("token")
                print(f"Logged in as {SUPABEIN_EMAIL}")
            else:
                raise

        me_response = api("GET", "/auth/me", token=token)
        user_id = me_response.get("id")
        print(f"Authenticated user ID: {user_id}")

        # 2. Create a project
        print("\n2. Creating project 'Blog Platform'...")
        project_name = f"Blog Platform by {SUPABEIN_EMAIL.split('@')[0]}"
        projects = api("GET", "/projects", token=token)
        existing_project = next((p for p in projects if p["name"] == project_name), None)

        if existing_project:
            project_id = existing_project["id"]
            print(f"Project '{project_name}' already exists with ID: {project_id}")
        else:
            project_response = api("POST", "/projects", {"name": project_name}, token=token)
            project_id = project_response.get("id")
            print(f"Project '{project_name}' created with ID: {project_id}")

        # 3. Create tables
        print("\n3. Creating tables...")

        # Table: categories
        print("  - Creating table 'categories'...")
        api("POST", f"/projects/{project_id}/tables", {"name": "categories"}, token=token)
        api("POST", f"/projects/{project_id}/tables/categories/columns", {"name": "name", "type": "VARCHAR(100)", "nullable": False}, token=token)
        print("    'categories' table created.")

        # Table: posts
        print("  - Creating table 'posts'...")
        api("POST", f"/projects/{project_id}/tables", {"name": "posts"}, token=token)
        api("POST", f"/projects/{project_id}/tables/posts/columns", {"name": "title", "type": "VARCHAR(255)", "nullable": False}, token=token)
        api("POST", f"/projects/{project_id}/tables/posts/columns", {"name": "content", "type": "TEXT"}, token=token)
        api("POST", f"/projects/{project_id}/tables/posts/columns", {"name": "category_id", "type": "INT"}, token=token)
        api("POST", f"/projects/{project_id}/tables/posts/columns", {"name": "user_id", "type": "INT", "nullable": False}, token=token)
        api("POST", f"/projects/{project_id}/tables/posts/columns", {"name": "status", "type": "VARCHAR(50)", "nullable": False, "default": "'draft'"}, token=token)
        api("POST", f"/projects/{project_id}/tables/posts/columns", {"name": "published_at", "type": "DATETIME"}, token=token)
        print("    'posts' table created.")

        # Table: comments
        print("  - Creating table 'comments'...")
        api("POST", f"/projects/{project_id}/tables", {"name": "comments"}, token=token)
        api("POST", f"/projects/{project_id}/tables/comments/columns", {"name": "post_id", "type": "INT", "nullable": False}, token=token)
        api("POST", f"/projects/{project_id}/tables/comments/columns", {"name": "user_id", "type": "INT", "nullable": False}, token=token)
        api("POST", f"/projects/{project_id}/tables/comments/columns", {"name": "content", "type": "TEXT", "nullable": False}, token=token)
        print("    'comments' table created.")

        # 4. Set RLS Policies
        print("\n4. Setting RLS policies...")

        # Policies for 'categories'
        print("  - Setting policies for 'categories'...")
        api("PUT", f"/projects/{project_id}/tables/categories/policies", [
            {"api_role": "anon", "operation": "SELECT", "allowed": True},
            {"api_role": "authenticated", "operation": "SELECT", "allowed": True},
            {"api_role": "authenticated", "operation": "INSERT", "allowed": True},
            {"api_role": "authenticated", "operation": "UPDATE", "allowed": True},
            {"api_role": "authenticated", "operation": "DELETE", "allowed": True}
        ], token=token)
        print("    'categories' policies set.")

        # Policies for 'posts'
        print("  - Setting policies for 'posts'...")
        api("PUT", f"/projects/{project_id}/tables/posts/policies", [
            {"api_role": "anon", "operation": "SELECT", "allowed": True, "constraint_sql": "status = 'published'"},
            {"api_role": "authenticated", "operation": "SELECT", "allowed": True},
            {"api_role": "authenticated", "operation": "INSERT", "allowed": True, "constraint_sql": "user_id = :current_user_id"},
            {"api_role": "authenticated", "operation": "UPDATE", "allowed": True, "constraint_sql": "user_id = :current_user_id"},
            {"api_role": "authenticated", "operation": "DELETE", "allowed": True, "constraint_sql": "user_id = :current_user_id"}
        ], token=token)
        print("    'posts' policies set.")

        # Policies for 'comments'
        print("  - Setting policies for 'comments'...")
        api("PUT", f"/projects/{project_id}/tables/comments/policies", [
            {"api_role": "anon", "operation": "SELECT", "allowed": True},
            {"api_role": "authenticated", "operation": "SELECT", "allowed": True},
            {"api_role": "authenticated", "operation": "INSERT", "allowed": True, "constraint_sql": "user_id = :current_user_id"},
            {"api_role": "authenticated", "operation": "UPDATE", "allowed": True, "constraint_sql": "user_id = :current_user_id"},
            {"api_role": "authenticated", "operation": "DELETE", "allowed": True, "constraint_sql": "user_id = :current_user_id"}
        ], token=token)
        print("    'comments' policies set.")

        # 5. Insert sample data
        print("\n5. Inserting sample data...")

        # Insert categories
        print("  - Inserting categories...")
        category_tech = api("POST", f"/data/{project_id}/categories", {"name": "Technology"}, token=token)
        category_lifestyle = api("POST", f"/data/{project_id}/categories", {"name": "Lifestyle"}, token=token)
        category_travel = api("POST", f"/data/{project_id}/categories", {"name": "Travel"}, token=token)
        print(f"    Categories created: {category_tech['name']}, {category_lifestyle['name']}, {category_travel['name']}")

        # Insert posts
        print("  - Inserting posts...")
        now_str = datetime.now().isoformat(timespec='seconds')
        post1 = api("POST", f"/data/{project_id}/posts", {
            "title": "Mastering SupaBein: A Developer's Guide",
            "content": "SupaBein offers a powerful backend-as-a-service. This post explores its features...",
            "category_id": category_tech["id"],
            "user_id": user_id,
            "status": "published",
            "published_at": now_str
        }, token=token)
        print(f"    Post created: '{post1['title']}' (ID: {post1['id']})")

        post2 = api("POST", f"/data/{project_id}/posts", {
            "title": "My Next Adventure: Planning a Trip to Japan",
            "content": "Dreaming of cherry blossoms and sushi. Here's my itinerary...",
            "category_id": category_travel["id"],
            "user_id": user_id,
            "status": "published",
            "published_at": now_str
        }, token=token)
        print(f"    Post created: '{post2['title']}' (ID: {post2['id']})")

        post3 = api("POST", f"/data/{project_id}/posts", {
            "title": "Draft: The Art of Mindful Living",
            "content": "Exploring techniques for reducing stress and increasing presence...",
            "category_id": category_lifestyle["id"],
            "user_id": user_id,
            "status": "draft",
            "published_at": None
        }, token=token)
        print(f"    Post created: '{post3['title']}' (ID: {post3['id']})")

        # Insert comments
        print("  - Inserting comments...")
        comment1 = api("POST", f"/data/{project_id}/comments", {
            "post_id": post1["id"],
            "user_id": user_id,
            "content": "This is a fantastic guide! Very helpful for getting started."
        }, token=token)
        print(f"    Comment added to Post {post1['id']}: '{comment1['content']}'")

        comment2 = api("POST", f"/data/{project_id}/comments", {
            "post_id": post2["id"],
            "user_id": user_id,
            "content": "Japan is amazing! Don't forget to visit Kyoto."
        }, token=token)
        print(f"    Comment added to Post {post2['id']}: '{comment2['content']}'")

        print("\n--- SupaBein Blog Platform Setup Complete! ---")
        print(f"Project ID: {project_id}")
        print(f"You can now interact with your data using the API endpoints:")
        print(f"  - Categories: {SUPABEIN_BASE}/data/{project_id}/categories")
        print(f"  - Posts: {SUPABEIN_BASE}/data/{project_id}/posts")
        print(f"  - Comments: {SUPABEIN_BASE}/data/{project_id}/comments")

    except Exception as e:
        print(f"\nSetup failed: {e}")
        if project_id:
            print(f"Consider deleting project {project_id} manually if it's in an inconsistent state.")

if __name__ == "__main__":
    setup_blog_platform()