# EduLink — How to Run & Deploy

---

## Option A: Run locally (on your computer)

### Step 1 — Install Python dependencies
Open a terminal in the `backend/` folder and run:
```
pip install flask flask-cors mysql-connector-python gunicorn
```

### Step 2 — Set up the database
1. Open phpMyAdmin (usually at http://localhost/phpmyadmin)
2. Click the **SQL** tab
3. Paste the entire contents of `backend/setup.sql` and click **Go**

### Step 3 — Start the Flask server
In the `backend/` folder run:
```
python server.py
```
You should see: `Running on http://127.0.0.1:5000`

### Step 4 — Open the frontend
- Install the **VS Code Live Server** extension (right-click `index.html` → Open with Live Server)
- OR use Python's built-in server from the project root folder:
  ```
  python -m http.server 8080
  ```
  Then open http://localhost:8080

> ⚠️ Do NOT open index.html by double-clicking it. ES modules (import/export)
> are blocked by browsers on file:// URLs. You must use a local server.

The `js/api.js` file already points to `http://localhost:5000` — no changes needed for local dev.

---

## Option B: Deploy online (free with Render + Netlify + PlanetScale/Aiven)

### Part 1 — Free MySQL database (Aiven)
1. Go to https://aiven.io → sign up free
2. Create a **MySQL** service (free tier)
3. Once created, copy the connection details:
   - Host, Port, User, Password, Database name
4. Connect to it using a MySQL client and run `backend/setup.sql`

### Part 2 — Deploy the backend on Render (free)
1. Push your project to GitHub (only the `backend/` folder is needed)
2. Go to https://render.com → New → Web Service
3. Connect your GitHub repo
4. Set these values:
   - **Root Directory**: `backend`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `gunicorn server:app`
5. Add Environment Variables:
   | Key | Value |
   |-----|-------|
   | DB_HOST | (from Aiven) |
   | DB_USER | (from Aiven) |
   | DB_PASS | (from Aiven) |
   | DB_NAME | evapelink |
   | SECRET_KEY | (any long random string) |
   | FRONTEND_URL | https://your-site.netlify.app ← fill in after step 3 |
6. Click **Deploy**. Copy the URL Render gives you, e.g. `https://evapelink-backend.onrender.com`

### Part 3 — Update the API URL in the frontend
Open `js/api.js` and change the URL:
```js
export const API = "https://evapelink-backend.onrender.com";
```

### Part 4 — Deploy the frontend on Netlify (free)
1. Go to https://netlify.com → Add new site → Deploy manually
2. Drag and drop the entire project folder (everything except `backend/`)
3. Netlify gives you a URL like `https://evapelink.netlify.app`
4. Go back to Render → your service → Environment → update `FRONTEND_URL` to this Netlify URL
5. Click **Redeploy** on Render

---

## Troubleshooting

| Error | Fix |
|-------|-----|
| "Could not connect to server" | Flask is not running, or API URL in api.js is wrong |
| Login works but data doesn't save | Session cookie blocked — make sure FRONTEND_URL is set correctly in Render env vars |
| Opening file:// shows blank page | Use Live Server or `python -m http.server`, not double-click |
| CORS error in browser console | Add your frontend URL to FRONTEND_URL in Render environment variables |

---

## Test accounts (pre-loaded by setup.sql)
| Email | Password | Role |
|-------|----------|------|
| admin@evapelink.com | admin123 | Teacher |
| parent@evapelink.com | parent123 | Parent |
| student@evapelink.com | student123 | Student |
