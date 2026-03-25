from flask import Flask, request, jsonify, session
from flask_cors import CORS
import mysql.connector
import hashlib
import os

app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", "evapelink_secret_2026")

# ── Session cookie: must be SameSite=None + Secure for cross-origin requests ──
app.config.update(
    SESSION_COOKIE_SAMESITE="None",
    SESSION_COOKIE_SECURE=True,          # required when SameSite=None
    SESSION_COOKIE_HTTPONLY=True,
)

FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost")
CORS(app,
     supports_credentials=True,
     origins=[FRONTEND_URL, "http://localhost", "http://127.0.0.1",
              "http://localhost:5500", "http://127.0.0.1:5500"])   # VS Code Live Server

def get_db():
    return mysql.connector.connect(
        host=os.environ.get("DB_HOST", "localhost"),
        user=os.environ.get("DB_USER", "root"),
        password=os.environ.get("DB_PASS", ""),
        database=os.environ.get("DB_NAME", "evapelink")
    )

def hash_password(password):
    return hashlib.sha256(password.encode()).hexdigest()

# ── Auth ──────────────────────────────────────────────────────────────────────
@app.route("/register", methods=["POST"])
def register():
    data     = request.json
    email    = data.get("email", "").strip()
    password = data.get("password", "").strip()
    role     = data.get("role", "student")
    if role not in ("teacher", "parent", "student"):
        role = "student"
    if not email or not password:
        return jsonify({"error": "Email and password are required."}), 400
    if len(password) < 6:
        return jsonify({"error": "Password must be at least 6 characters."}), 400
    db = get_db(); cur = db.cursor()
    cur.execute("SELECT id FROM users WHERE email=%s", (email,))
    if cur.fetchone():
        return jsonify({"error": "An account with that email already exists."}), 409
    cur.execute(
        "INSERT INTO users (email, password_hash, role) VALUES (%s,%s,%s)",
        (email, hash_password(password), role)
    )
    db.commit(); new_id = cur.lastrowid; cur.close(); db.close()
    session["user_id"] = new_id
    session["email"]   = email
    session["role"]    = role
    return jsonify({"message": "Account created!", "email": email, "id": new_id, "role": role})

@app.route("/login", methods=["POST"])
def login():
    data     = request.json
    email    = data.get("email", "").strip()
    password = data.get("password", "").strip()
    db = get_db(); cur = db.cursor(dictionary=True)
    cur.execute(
        "SELECT id, email, role FROM users WHERE email=%s AND password_hash=%s",
        (email, hash_password(password))
    )
    user = cur.fetchone(); cur.close(); db.close()
    if not user:
        return jsonify({"error": "Wrong email or password."}), 401
    session["user_id"] = user["id"]
    session["email"]   = user["email"]
    session["role"]    = user["role"]
    return jsonify({"message": "Login successful.", "email": user["email"],
                    "id": user["id"], "role": user["role"]})

@app.route("/logout", methods=["POST"])
def logout():
    session.clear()
    return jsonify({"message": "Logged out."})

@app.route("/session", methods=["GET"])
def check_session():
    if "email" in session:
        return jsonify({"email": session["email"], "id": session["user_id"], "role": session["role"]})
    return jsonify({"email": None})

# ── Grades & Subjects ─────────────────────────────────────────────────────────
@app.route("/grades", methods=["GET"])
def get_grades():
    if "user_id" not in session:
        return jsonify({"error": "Not logged in."}), 401
    db = get_db(); cur = db.cursor(dictionary=True)
    cur.execute("SELECT * FROM grades ORDER BY name ASC")
    rows = cur.fetchall(); cur.close(); db.close()
    return jsonify(rows)

@app.route("/grades", methods=["POST"])
def add_grade():
    if session.get("role") != "teacher":
        return jsonify({"error": "Teachers only."}), 403
    data = request.json
    name = data.get("name", "").strip()
    if not name:
        return jsonify({"error": "Grade name required."}), 400
    db = get_db(); cur = db.cursor()
    cur.execute("INSERT IGNORE INTO grades (name) VALUES (%s)", (name,))
    db.commit(); new_id = cur.lastrowid; cur.close(); db.close()
    return jsonify({"id": new_id, "name": name})

@app.route("/grades/<int:gid>", methods=["DELETE"])
def delete_grade(gid):
    if session.get("role") != "teacher":
        return jsonify({"error": "Teachers only."}), 403
    db = get_db(); cur = db.cursor()
    cur.execute("DELETE FROM grades WHERE id=%s", (gid,))
    db.commit(); cur.close(); db.close()
    return jsonify({"message": "Deleted."})

@app.route("/subjects", methods=["GET"])
def get_subjects():
    if "user_id" not in session:
        return jsonify({"error": "Not logged in."}), 401
    db = get_db(); cur = db.cursor(dictionary=True)
    cur.execute("SELECT * FROM subjects ORDER BY name ASC")
    rows = cur.fetchall(); cur.close(); db.close()
    return jsonify(rows)

@app.route("/subjects", methods=["POST"])
def add_subject():
    if session.get("role") != "teacher":
        return jsonify({"error": "Teachers only."}), 403
    data = request.json
    name = data.get("name", "").strip()
    if not name:
        return jsonify({"error": "Subject name required."}), 400
    db = get_db(); cur = db.cursor()
    cur.execute("INSERT IGNORE INTO subjects (name) VALUES (%s)", (name,))
    db.commit(); new_id = cur.lastrowid; new_id = cur.lastrowid; cur.close(); db.close()
    return jsonify({"id": new_id, "name": name})

@app.route("/subjects/<int:sid>", methods=["DELETE"])
def delete_subject(sid):
    if session.get("role") != "teacher":
        return jsonify({"error": "Teachers only."}), 403
    db = get_db(); cur = db.cursor()
    cur.execute("DELETE FROM subjects WHERE id=%s", (sid,))
    db.commit(); cur.close(); db.close()
    return jsonify({"message": "Deleted."})

# ── Homework ──────────────────────────────────────────────────────────────────
@app.route("/homework", methods=["GET"])
def get_homework():
    if "user_id" not in session:
        return jsonify({"error": "Not logged in."}), 401
    db = get_db(); cur = db.cursor(dictionary=True)
    cur.execute("SELECT id,title,due,subject,class_name,hw_type,description,assigned_date FROM homework ORDER BY due ASC")
    rows = cur.fetchall(); cur.close(); db.close()
    for row in rows:
        if row["due"]:           row["due"]           = str(row["due"])
        if row["assigned_date"]: row["assigned_date"] = str(row["assigned_date"])
    return jsonify(rows)

@app.route("/homework", methods=["POST"])
def add_homework():
    if "user_id" not in session:
        return jsonify({"error": "Not logged in."}), 401
    if session.get("role") != "teacher":
        return jsonify({"error": "Only teachers can assign homework."}), 403
    data        = request.json
    title       = data.get("title", "").strip()
    due         = data.get("due", "").strip()
    subject     = data.get("subject", "General")
    class_name  = data.get("class_name", "Grade 9A")
    hw_type     = data.get("hw_type", "manual")
    description = data.get("description", "")
    if not title or not due:
        return jsonify({"error": "Title and due date are required."}), 400
    db = get_db(); cur = db.cursor()
    cur.execute(
        "INSERT INTO homework (user_id,title,due,subject,class_name,hw_type,description) VALUES (%s,%s,%s,%s,%s,%s,%s)",
        (session["user_id"], title, due, subject, class_name, hw_type, description)
    )
    db.commit(); new_id = cur.lastrowid; cur.close(); db.close()
    return jsonify({"id": new_id, "title": title, "due": due, "subject": subject,
                    "class_name": class_name, "hw_type": hw_type, "description": description})

@app.route("/homework/<int:hw_id>", methods=["DELETE"])
def delete_homework(hw_id):
    if "user_id" not in session:
        return jsonify({"error": "Not logged in."}), 401
    if session.get("role") != "teacher":
        return jsonify({"error": "Only teachers can delete homework."}), 403
    db = get_db(); cur = db.cursor()
    cur.execute("DELETE FROM homework WHERE id=%s", (hw_id,))
    db.commit(); cur.close(); db.close()
    return jsonify({"message": "Deleted."})

# ── Difficulty ratings ────────────────────────────────────────────────────────
@app.route("/difficulty", methods=["GET"])
def get_difficulty():
    db = get_db(); cur = db.cursor(dictionary=True)
    cur.execute("""
        SELECT d.*, u.email as student_email
        FROM difficulty_ratings d
        JOIN users u ON d.user_id=u.id
    """)
    rows = cur.fetchall(); cur.close(); db.close()
    return jsonify(rows)

@app.route("/difficulty", methods=["POST"])
def add_difficulty():
    if "user_id" not in session:
        return jsonify({"error": "Not logged in."}), 401
    data    = request.json
    hw_id   = data.get("hw_id")
    rating  = data.get("rating")
    comment = data.get("comment", "")
    db = get_db(); cur = db.cursor()
    cur.execute("DELETE FROM difficulty_ratings WHERE user_id=%s AND hw_id=%s",
                (session["user_id"], hw_id))
    cur.execute("INSERT INTO difficulty_ratings (user_id,hw_id,rating,comment) VALUES (%s,%s,%s,%s)",
                (session["user_id"], hw_id, rating, comment))
    db.commit(); cur.close(); db.close()
    return jsonify({"message": "Rating saved."})

# ── Policies ──────────────────────────────────────────────────────────────────
@app.route("/policies", methods=["GET"])
def get_policies():
    db = get_db(); cur = db.cursor(dictionary=True)
    cur.execute("SELECT * FROM policies ORDER BY created_at DESC")
    rows = cur.fetchall(); cur.close(); db.close()
    for row in rows:
        if row.get("created_at"): row["created_at"] = str(row["created_at"])
    return jsonify(rows)

@app.route("/policies", methods=["POST"])
def add_policy():
    if "user_id" not in session:
        return jsonify({"error": "Not logged in."}), 401
    data  = request.json
    title = data.get("title", "").strip()
    desc  = data.get("description", "").strip()
    if not title or not desc:
        return jsonify({"error": "Title and description required."}), 400
    db = get_db(); cur = db.cursor()
    cur.execute("INSERT INTO policies (title,description,status) VALUES (%s,%s,'pending')", (title, desc))
    db.commit(); new_id = cur.lastrowid; cur.close(); db.close()
    return jsonify({"id": new_id, "title": title, "description": desc, "status": "pending"})

@app.route("/policies/<int:pid>", methods=["PATCH"])
def update_policy(pid):
    if "user_id" not in session:
        return jsonify({"error": "Not logged in."}), 401
    status = request.json.get("status")
    db = get_db(); cur = db.cursor()
    cur.execute("UPDATE policies SET status=%s WHERE id=%s", (status, pid))
    db.commit(); cur.close(); db.close()
    return jsonify({"message": "Policy updated."})

@app.route("/policies/<int:pid>", methods=["DELETE"])
def delete_policy(pid):
    if session.get("role") != "teacher":
        return jsonify({"error": "Teachers only."}), 403
    db = get_db(); cur = db.cursor()
    cur.execute("DELETE FROM policies WHERE id=%s", (pid,))
    db.commit(); cur.close(); db.close()
    return jsonify({"message": "Policy deleted."})

# ── Quiz submissions ──────────────────────────────────────────────────────────
@app.route("/quiz_submissions", methods=["GET"])
def get_quiz_submissions():
    db = get_db(); cur = db.cursor(dictionary=True)
    cur.execute("""
        SELECT q.*, u.email as student_email
        FROM quiz_submissions q
        JOIN users u ON q.user_id=u.id
    """)
    rows = cur.fetchall(); cur.close(); db.close()
    for row in rows:
        if row.get("submitted_at"): row["submitted_at"] = str(row["submitted_at"])
    return jsonify(rows)

@app.route("/quiz_submissions", methods=["POST"])
def add_quiz_submission():
    if "user_id" not in session:
        return jsonify({"error": "Not logged in."}), 401
    data  = request.json
    hw_id, score, total, pct = data.get("hw_id"), data.get("score"), data.get("total"), data.get("pct")
    db = get_db(); cur = db.cursor()
    cur.execute("DELETE FROM quiz_submissions WHERE user_id=%s AND hw_id=%s", (session["user_id"], hw_id))
    cur.execute("INSERT INTO quiz_submissions (user_id,hw_id,score,total,pct) VALUES (%s,%s,%s,%s,%s)",
                (session["user_id"], hw_id, score, total, pct))
    db.commit(); cur.close(); db.close()
    return jsonify({"message": "Submitted."})

if __name__ == "__main__":
    # Local dev — HTTP is fine, disable Secure cookie so sessions work on localhost
    app.config["SESSION_COOKIE_SECURE"] = False
    app.run(debug=True, port=5000)
