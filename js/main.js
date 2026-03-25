import { login, logout, restoreSession, getRole, setRole } from "./auth.js";
import { API } from "./api.js";

// ── State ─────────────────────────────────────────────────────────────────────
let currentPanel  = "dashboard";
let hwCache       = [];
let ratingsCache  = [];
let policiesCache = [];
let quizCache     = [];
let gradesCache   = [];
let subjectsCache = [];
let quizState     = {};

const quizQuestions = {
  "Fractions": [
    {q:"What is 3/4 expressed as a decimal?",         options:["0.34","0.75","0.43","0.50"],answer:1},
    {q:"Which fraction is equivalent to 0.6?",        options:["1/6","2/3","3/5","6/100"],answer:2},
    {q:"What is 1/3 + 1/6?",                          options:["2/9","1/2","2/6","1/3"],answer:1},
    {q:"Convert 2.25 to a fraction in simplest form.",options:["225/100","9/4","2/25","45/20"],answer:1},
    {q:"What is 0.125 as a fraction?",                options:["1/4","1/8","12/100","1/5"],answer:1},
  ]
};

function getQs(hw) {
  for (const key of Object.keys(quizQuestions))
    if (hw.title.includes(key)) return quizQuestions[key];
  return null;
}

// ── Register / Login tabs ─────────────────────────────────────────────────────
window.showAuthTab = function(tab) {
  document.getElementById("tab-login").classList.toggle("active", tab==="login");
  document.getElementById("tab-register").classList.toggle("active", tab==="register");
  document.getElementById("login-form").style.display  = tab==="login"    ? "" : "none";
  document.getElementById("register-form").style.display = tab==="register" ? "" : "none";
};

window.selectRegisterRole = function(btn) {
  document.querySelectorAll(".reg-role-btn").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
};

window.doRegister = async function() {
  const email   = document.getElementById("reg-email").value.trim();
  const pass    = document.getElementById("reg-password").value;
  const pass2   = document.getElementById("reg-password2").value;
  const roleBtn = document.querySelector(".reg-role-btn.active");
  const err     = document.getElementById("register-error");
  err.textContent = "";
  if (!email || !pass)          { err.textContent = "Email and password are required."; return; }
  if (pass !== pass2)           { err.textContent = "Passwords do not match."; return; }
  if (pass.length < 6)          { err.textContent = "Password must be at least 6 characters."; return; }
  if (!roleBtn)                 { err.textContent = "Please select a role."; return; }
  const role = roleBtn.dataset.role;
  try {
    const res  = await fetch(`${API}/register`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: pass, role })
    });
    const data = await res.json();
    if (!res.ok) { err.textContent = data.error || "Registration failed."; return; }
    showApp(data);
  } catch(e) { err.textContent = "Could not connect to server."; }
};

// ── Login ─────────────────────────────────────────────────────────────────────
window.doLogin = async function() {
  const email = document.getElementById("login-email").value.trim();
  const pass  = document.getElementById("login-password").value;
  const err   = document.getElementById("login-error");
  err.textContent = "";
  if (!email || !pass) { err.textContent = "Please enter email and password."; return; }
  try {
    const res  = await fetch(`${API}/login`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: pass })
    });
    const data = await res.json();
    if (!res.ok) { err.textContent = data.error || "Login failed."; return; }
    // Set role in auth module from server response
    setRole(data.role);
    showApp(data);
  } catch(e) { err.textContent = "Could not connect to server."; }
};

function showApp(user) {
  setRole(user.role);
  document.getElementById("login-screen").style.display = "none";
  document.getElementById("app").classList.add("visible");
  document.getElementById("user-avatar").textContent       = user.email.slice(0,2).toUpperCase();
  document.getElementById("user-name-display").textContent = user.email;
  const role = getRole();
  document.getElementById("user-role-display").textContent =
    role.charAt(0).toUpperCase() + role.slice(1);
  buildNav();
  navigateTo("dashboard");
}

window.doLogout = async function() {
  await fetch(`${API}/logout`, { method: "POST", credentials: "include" });
  document.getElementById("app").classList.remove("visible");
  document.getElementById("login-screen").style.display = "flex";
  showAuthTab("login");
};

// ── Nav ───────────────────────────────────────────────────────────────────────
const navDef = {
  teacher:[
    {id:"dashboard",     icon:"📊",label:"Dashboard"},
    {id:"homework",      icon:"📚",label:"Homework"},
    {id:"automark",      icon:"✅",label:"Auto-Mark Results"},
    {id:"grades",        icon:"🏫",label:"Grades & Subjects"},
    {id:"policies",      icon:"📋",label:"Policies"},
    {id:"notifications", icon:"🔔",label:"Notifications"},
  ],
  // Parent: only what's relevant — view homework & policies, approve policies, notifications
  parent:[
    {id:"dashboard",     icon:"🏠",label:"Dashboard"},
    {id:"homework",      icon:"📚",label:"Homework"},
    {id:"policies",      icon:"📋",label:"Policies"},
    {id:"notifications", icon:"🔔",label:"Notifications"},
  ],
  student:[
    {id:"dashboard",     icon:"🏠",label:"Dashboard"},
    {id:"homework",      icon:"📚",label:"My Homework"},
    {id:"policies",      icon:"📋",label:"Policies"},
    {id:"notifications", icon:"🔔",label:"Notifications"},
  ],
};

function buildNav() {
  const role = getRole();
  document.getElementById("sidebar-role-label").textContent =
    {teacher:"Teacher Portal",parent:"Parent Portal",student:"Student Portal"}[role];
  document.getElementById("sidebar-nav").innerHTML = navDef[role].map(n => `
    <button class="nav-item" data-panel="${n.id}" onclick="navigateTo('${n.id}')">
      <span class="nav-icon">${n.icon}</span>${n.label}
    </button>`).join("");
}

window.navigateTo = async function(panel) {
  currentPanel = panel;
  document.querySelectorAll(".nav-item").forEach(el =>
    el.classList.toggle("active", el.dataset.panel === panel));
  document.getElementById("topbar-title").textContent =
    {dashboard:"Dashboard",homework:"Homework",automark:"Auto-Mark Results",
     grades:"Grades & Subjects",policies:"Policies",notifications:"Notifications"}[panel] || panel;
  await renderPanel(panel);
};

async function renderPanel(panel) {
  const content = document.getElementById("main-content");
  const actions = document.getElementById("topbar-actions");
  actions.innerHTML = "";
  content.innerHTML = `<div class="loading">Loading…</div>`;

  const fetches = [
    apiFetch("/homework"), apiFetch("/difficulty"),
    apiFetch("/policies"), apiFetch("/quiz_submissions"),
    apiFetch("/grades"),   apiFetch("/subjects"),
  ];
  [hwCache,ratingsCache,policiesCache,quizCache,gradesCache,subjectsCache] = await Promise.all(fetches);

  if      (panel==="dashboard")     renderDashboard(content,actions);
  else if (panel==="homework")      renderHomework(content,actions);
  else if (panel==="automark")      renderAutoMark(content,actions);
  else if (panel==="grades")        renderGradesSubjects(content,actions);
  else if (panel==="policies")      renderPolicies(content,actions);
  else if (panel==="notifications") renderNotifications(content,actions);
}

async function apiFetch(path) {
  try { const r = await fetch(API+path,{credentials:"include"}); return r.ok?r.json():[]; }
  catch { return []; }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const diffLabel = ["","🟢 Easy","🟡 Medium","🔴 Hard"];
const diffColor = ["","var(--sage)","#9a7d20","var(--rust)"];
const diffBg    = ["","rgba(90,122,106,.12)","rgba(200,168,75,.15)","rgba(181,73,42,.12)"];

function ratingsFor(hwId) { return ratingsCache.filter(r=>r.hw_id===hwId); }

function diffSummary(hwId) {
  const rs = ratingsFor(hwId);
  if (!rs.length) return `<span style="color:var(--muted);font-size:.78rem">No feedback yet</span>`;
  const avg = rs.reduce((s,r)=>s+r.rating,0)/rs.length;
  const idx = Math.round(avg);
  return `<span style="font-size:.78rem;font-weight:600;color:${diffColor[idx]}">${diffLabel[idx]} (${rs.length})</span>`;
}

function commentCards(ratings) {
  if (!ratings.length) return `<p style="color:var(--muted);font-size:.85rem;padding:8px 0">No comments yet.</p>`;
  return ratings.map(r => {
    const hw = hwCache.find(h=>h.id===r.hw_id);
    return `
    <div class="comment-item">
      <div class="comment-author">
        <span>${r.student_email}${hw?` <span style="font-weight:400;color:var(--muted)">on</span> <em>${hw.title}</em>`:""}</span>
        <span style="font-size:.7rem;font-weight:700;padding:2px 9px;border-radius:99px;background:${diffBg[r.rating]};color:${diffColor[r.rating]}">${diffLabel[r.rating]}</span>
      </div>
      <div class="comment-text" style="margin-top:5px">"${r.comment}"</div>
    </div>`;
  }).join("");
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
function renderDashboard(el, acts) {
  const role    = getRole();
  const now     = new Date();
  const overdue = hwCache.filter(h=>new Date(h.due)<now);
  const pending = policiesCache.filter(p=>p.status==="pending");

  if (role==="teacher") {
    acts.innerHTML = `<button class="btn btn-primary" onclick="openAddHomework()">+ Assign Homework</button>`;
    el.innerHTML = `
      <div class="stats-grid">
        <div class="stat-card"><div class="stat-value" style="color:var(--gold)">${hwCache.length}</div><div class="stat-label">Active Assignments</div></div>
        <div class="stat-card"><div class="stat-value" style="color:var(--rust)">${overdue.length}</div><div class="stat-label">Overdue</div><div class="stat-trend trend-dn">${overdue.length?"Needs attention":"All on track"}</div></div>
        <div class="stat-card"><div class="stat-value" style="color:var(--sky)">${pending.length}</div><div class="stat-label">Pending Policies</div></div>
        <div class="stat-card"><div class="stat-value" style="color:var(--sage)">${ratingsCache.length}</div><div class="stat-label">Difficulty Ratings</div></div>
      </div>
      <div class="card">
        <div class="card-title">📚 Assignments Overview</div>
        ${hwTable(hwCache.slice(0,5),"teacher")}
      </div>
      <div class="card">
        <div class="card-title">💬 Recent Difficulty Comments</div>
        ${commentCards(ratingsCache.slice(-4).reverse())}
      </div>`;

  } else if (role==="parent") {
    // Parent dashboard: simple overview — upcoming homework + pending policies to approve
    const upcoming = hwCache.filter(h=>new Date(h.due)>=now).slice(0,5);
    el.innerHTML = `
      <div class="stats-grid">
        <div class="stat-card"><div class="stat-value" style="color:var(--gold)">${hwCache.length}</div><div class="stat-label">Homework Items</div></div>
        <div class="stat-card"><div class="stat-value" style="color:var(--rust)">${overdue.length}</div><div class="stat-label">Overdue Assignments</div></div>
        <div class="stat-card"><div class="stat-value" style="color:var(--sky)">${pending.length}</div><div class="stat-label">Policies to Review</div></div>
      </div>
      <div class="card">
        <div class="card-title">📚 Upcoming Homework</div>
        ${parentHwList(upcoming)}
      </div>
      ${pending.length?`
      <div class="card">
        <div class="card-title">📋 Policies Awaiting Your Approval</div>
        ${pending.map(p=>`
          <div class="policy-card" style="border-color:rgba(200,168,75,.4)">
            <div style="flex:1"><div class="policy-title">${p.title}</div><div class="policy-desc">${p.description}</div>
              <span class="badge badge-pending">Awaiting approval</span></div>
            <div class="policy-actions">
              <button class="btn btn-sm btn-primary" onclick="doApprovePolicy(${p.id})">✓ Approve</button>
              <button class="btn btn-sm btn-danger"  onclick="doRejectPolicy(${p.id})">✗ Reject</button>
            </div>
          </div>`).join("")}
      </div>`:""}`;

  } else {
    el.innerHTML = `
      <div class="stats-grid">
        <div class="stat-card"><div class="stat-value" style="color:var(--gold)">${hwCache.length}</div><div class="stat-label">Assignments Due</div></div>
        <div class="stat-card"><div class="stat-value" style="color:var(--rust)">${overdue.length}</div><div class="stat-label">Overdue</div></div>
        <div class="stat-card"><div class="stat-value" style="color:var(--sage)">${quizCache.length}</div><div class="stat-label">Quizzes Done</div></div>
      </div>
      <div class="card">
        <div class="card-title">📚 My Upcoming Homework</div>
        ${hwTable(hwCache,"student")}
      </div>`;
  }
}

// ── Parent homework list (read-only, clean view) ──────────────────────────────
function parentHwList(list) {
  if (!list.length) return `<p style="color:var(--muted);font-size:.875rem;padding:8px 0">No upcoming homework.</p>`;
  const now = new Date();
  return `<div class="table-wrap"><table>
    <tr><th>Subject</th><th>Title</th><th>Class</th><th>Due Date</th><th>Status</th></tr>
    ${list.map(h => {
      const overdue = new Date(h.due) < now;
      const badge   = overdue
        ? `<span class="badge badge-overdue">Overdue</span>`
        : `<span class="badge badge-pending">Upcoming</span>`;
      return `<tr>
        <td><b>${h.subject||"—"}</b></td>
        <td>${h.title}</td>
        <td>${h.class_name||"—"}</td>
        <td>${h.due}</td>
        <td>${badge}</td>
      </tr>`;
    }).join("")}
  </table></div>`;
}

// ── Homework panel ────────────────────────────────────────────────────────────
function renderHomework(el, acts) {
  const role = getRole();
  if (role==="teacher")
    acts.innerHTML = `<button class="btn btn-primary" onclick="openAddHomework()">+ Assign Homework</button>`;

  if (role==="parent") {
    // Parent: full read-only list, can view details only
    el.innerHTML = `
      <div class="card">
        <div class="card-title">📚 All Homework Assignments</div>
        <p style="font-size:.82rem;color:var(--muted);margin-bottom:16px">You can view homework details assigned to your child's class.</p>
        ${parentHwFull(hwCache)}
      </div>`;
  } else {
    el.innerHTML = `
      <div class="card">
        <div class="card-title">📚 ${role==="student"?"My Homework":"All Assignments"}</div>
        ${hwTable(hwCache, role)}
      </div>`;
  }
}

function parentHwFull(list) {
  if (!list.length) return `<p style="color:var(--muted);font-size:.875rem">No homework found.</p>`;
  const now = new Date();
  return `<div class="table-wrap"><table>
    <tr><th>Subject</th><th>Title</th><th>Class</th><th>Type</th><th>Due</th><th>Status</th><th></th></tr>
    ${list.map(h => {
      const overdue = new Date(h.due) < now;
      const typeBadge = h.hw_type==="quiz"
        ? `<span class="badge badge-submitted">Auto-Mark</span>`
        : `<span class="badge" style="background:var(--cream);color:var(--muted)">Written</span>`;
      const statusBadge = overdue
        ? `<span class="badge badge-overdue">Overdue</span>`
        : `<span class="badge badge-pending">Upcoming</span>`;
      return `<tr>
        <td><b>${h.subject||"—"}</b></td>
        <td>${h.title}</td>
        <td>${h.class_name||"—"}</td>
        <td>${typeBadge}</td>
        <td>${h.due}</td>
        <td>${statusBadge}</td>
        <td><button class="btn btn-sm btn-secondary" onclick="viewHW(${h.id})">📄 View</button></td>
      </tr>`;
    }).join("")}
  </table></div>`;
}

function hwTable(list, role) {
  if (!list.length) return `<p style="color:var(--muted);font-size:.875rem;padding:8px 0">No homework found.</p>`;
  const now = new Date();

  const thead = role==="teacher"
    ? `<tr><th>Subject</th><th>Title</th><th>Class</th><th>Type</th><th>Due</th><th>Difficulty Feedback</th><th>Actions</th></tr>`
    : `<tr><th>Subject</th><th>Title</th><th>Due</th><th>Type</th><th>Status</th><th>Actions</th></tr>`;

  const rows = list.map(h => {
    const overdue   = new Date(h.due) < now;
    const typeBadge = h.hw_type==="quiz"
      ? `<span class="badge badge-submitted">Auto-Mark</span>`
      : `<span class="badge" style="background:var(--cream);color:var(--muted)">Written</span>`;
    const statusBadge = overdue
      ? `<span class="badge badge-overdue">Overdue</span>`
      : `<span class="badge badge-pending">Pending</span>`;

    if (role==="teacher") return `<tr>
      <td><b>${h.subject||"—"}</b></td><td>${h.title}</td>
      <td>${h.class_name||"—"}</td><td>${typeBadge}</td><td>${h.due}</td>
      <td>${diffSummary(h.id)}</td>
      <td style="display:flex;gap:5px;flex-wrap:wrap">
        <button class="btn btn-sm btn-secondary" onclick="viewHW(${h.id})">📄 View</button>
        <button class="btn btn-sm btn-secondary" onclick="viewDiffComments(${h.id})">💬 Comments</button>
        <button class="btn btn-sm btn-secondary" onclick="downloadPDF(${h.id})">⬇ PDF</button>
        <button class="btn btn-sm btn-danger"    onclick="confirmDelete(${h.id})">Delete</button>
      </td></tr>`;

    if (role==="student") {
      const myR   = ratingsCache.find(r=>r.hw_id===h.id);
      const dbSub = quizCache.find(q=>q.hw_id===h.id);
      return `<tr>
        <td><b>${h.subject||"—"}</b></td><td>${h.title}</td><td>${h.due}</td>
        <td>${typeBadge}</td><td>${statusBadge}</td>
        <td style="display:flex;gap:5px;flex-wrap:wrap">
          <button class="btn btn-sm btn-secondary" onclick="viewHW(${h.id})">📄 View</button>
          <button class="btn btn-sm btn-secondary" onclick="downloadPDF(${h.id})">⬇ PDF</button>
          ${h.hw_type==="quiz"
            ? `<button class="btn btn-sm btn-primary" onclick="openQuiz(${h.id})">▶ ${dbSub||quizState[h.id]?.submitted?"Results":"Start Quiz"}</button>`
            : `<button class="btn btn-sm btn-primary" onclick="openSubmitModal(${h.id})">Submit</button>`}
          ${!myR
            ? `<button class="btn btn-sm btn-secondary" onclick="openDiffModal(${h.id})">💬 Rate</button>`
            : `<span class="badge" style="background:${diffBg[myR.rating]};color:${diffColor[myR.rating]};align-self:center">${diffLabel[myR.rating]}</span>`}
        </td></tr>`;
    }

    // Fallback row
    return `<tr>
      <td><b>${h.subject||"—"}</b></td><td>${h.title}</td><td>${h.due}</td>
      <td>${typeBadge}</td><td>${statusBadge}</td>
      <td><button class="btn btn-sm btn-secondary" onclick="viewHW(${h.id})">📄 View</button></td></tr>`;
  }).join("");

  return `<div class="table-wrap"><table>${thead}${rows}</table></div>`;
}

// ── View homework ─────────────────────────────────────────────────────────────
window.viewHW = function(id) {
  const h = hwCache.find(x=>x.id===id); if (!h) return;
  document.getElementById("modal-box").className = "modal modal-wide";
  const role  = getRole();
  const myR   = ratingsCache.find(r=>r.hw_id===h.id);
  const dbSub = quizCache.find(q=>q.hw_id===h.id);
  openModal(`📄 ${h.title}`,`
    <div class="hw-viewer-meta">
      <div class="hw-meta-item"><strong>${h.subject||"—"}</strong>Subject</div>
      <div class="hw-meta-item"><strong>${h.class_name||"—"}</strong>Class</div>
      <div class="hw-meta-item"><strong>${h.assigned_date||"—"}</strong>Assigned</div>
      <div class="hw-meta-item"><strong>${h.due}</strong>Due Date</div>
      <div class="hw-meta-item"><strong>${h.hw_type==="quiz"?"Auto-Mark Quiz":"Written"}</strong>Type</div>
    </div>
    <div class="hw-viewer-body">${(h.description||h.title).replace(/</g,"&lt;")}</div>
    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;padding-top:14px;border-top:1px solid var(--border)">
      <div style="font-size:.82rem;color:var(--muted)">Class difficulty: ${diffSummary(h.id)}</div>
      ${role==="student"&&!myR?`<button class="btn btn-sm btn-secondary" onclick="closeModal();openDiffModal(${h.id})">💬 Rate this homework</button>`:""}
      ${role==="student"&&h.hw_type==="quiz"?`<button class="btn btn-sm btn-primary" onclick="closeModal();openQuiz(${h.id})">▶ ${dbSub||quizState[h.id]?.submitted?"View Results":"Start Quiz"}</button>`:""}
    </div>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Close</button>
     ${role!=="parent"?`<button class="btn btn-primary" onclick="downloadPDF(${h.id})">⬇ Download PDF</button>`:""}`
  );
};

// ── PDF ───────────────────────────────────────────────────────────────────────
window.downloadPDF = function(id) {
  const h = hwCache.find(x=>x.id===id); if (!h) return;
  const w = window.open("","_blank");
  w.document.write(`<!DOCTYPE html><html><head><title>${h.title}</title>
  <style>body{font-family:Georgia,serif;max-width:680px;margin:40px auto;color:#111;line-height:1.7}
  h1{font-size:1.5rem;margin-bottom:6px}h2{font-size:.9rem;color:#c8a84b;letter-spacing:1px;text-transform:uppercase;margin-bottom:18px}
  .meta{display:flex;gap:24px;font-size:.83rem;color:#666;margin-bottom:24px;padding-bottom:14px;border-bottom:2px solid #c8a84b;flex-wrap:wrap}
  .meta span b{color:#111;display:block}
  .body{font-size:.95rem;white-space:pre-line;background:#faf8f4;padding:20px 22px;border-left:4px solid #c8a84b;border-radius:0 6px 6px 0;line-height:1.75}
  .footer{margin-top:36px;font-size:.78rem;color:#999;text-align:center;padding-top:14px;border-top:1px solid #eee}
  @media print{.noprint{display:none}}</style></head><body>
  <h2>EduLink Homework Policy Platform</h2><h1>${h.title}</h1>
  <div class="meta">
    <span><b>Subject</b>${h.subject||"—"}</span><span><b>Class</b>${h.class_name||"—"}</span>
    <span><b>Assigned</b>${h.assigned_date||"—"}</span><span><b>Due</b>${h.due}</span>
    <span><b>Type</b>${h.hw_type==="quiz"?"Auto-Mark Quiz":"Written Assignment"}</span>
  </div>
  <div class="body">${(h.description||h.title).replace(/</g,"&lt;")}</div>
  <div class="footer">Generated ${new Date().toLocaleDateString()} · EduLink</div>
  <br><button class="noprint" onclick="window.print()" style="background:#c8a84b;border:none;padding:10px 22px;border-radius:6px;cursor:pointer;font-weight:600">🖨 Print / Save as PDF</button>
  </body></html>`);
  w.document.close();
  toast("PDF opened – click Print to save ✓");
};

// ── Submit homework ───────────────────────────────────────────────────────────
window.openSubmitModal = function(id) {
  const h = hwCache.find(x=>x.id===id); if (!h) return;
  document.getElementById("modal-box").className = "modal";
  openModal(`📤 Submit – ${h.title}`,`
    <div class="form-group"><label>Upload your work (paste link or filename)</label>
      <input type="text" placeholder="e.g. essay_kofi.docx or Google Drive link"/>
    </div>
    <div class="form-group"><label>Notes to teacher (optional)</label>
      <textarea placeholder="Any notes about your submission…"></textarea>
    </div>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
     <button class="btn btn-primary"   onclick="closeModal();toast('Homework submitted ✓')">Submit</button>`
  );
};

// ── Difficulty rating ─────────────────────────────────────────────────────────
window.openDiffModal = function(hwId) {
  const h = hwCache.find(x=>x.id===hwId); if (!h) return;
  document.getElementById("modal-box").className = "modal";
  openModal(`💬 Rate Difficulty – ${h.title}`,`
    <p style="font-size:.85rem;color:var(--muted);margin-bottom:18px">How difficult was this homework? Your feedback helps your teacher plan better lessons.</p>
    <div class="form-group"><label>Difficulty Level</label>
      <div style="display:flex;gap:12px;margin-top:6px">
        ${[1,2,3].map(v=>`<button onclick="selectDiff(${v})" id="diff-opt-${v}" class="btn btn-secondary" style="flex:1;justify-content:center">${v===1?"🟢 Easy":v===2?"🟡 Medium":"🔴 Hard"}</button>`).join("")}
      </div><input type="hidden" id="diff-value" value="0"/>
    </div>
    <div class="form-group"><label>Your comment (optional)</label>
      <textarea id="diff-comment" placeholder="What was tricky? Any specific part?"></textarea>
    </div>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
     <button class="btn btn-primary"   onclick="submitDiff(${hwId})">Submit Feedback</button>`
  );
};

window.selectDiff = function(v) {
  [1,2,3].forEach(x => {
    const b = document.getElementById(`diff-opt-${x}`);
    b.className = `btn ${x===v?"btn-primary":"btn-secondary"}`;
    b.style = "flex:1;justify-content:center";
  });
  document.getElementById("diff-value").value = v;
};

window.submitDiff = async function(hwId) {
  const v = parseInt(document.getElementById("diff-value").value);
  if (!v) { toast("Please select a difficulty level"); return; }
  const comment = document.getElementById("diff-comment").value.trim()
    || ["Felt easy, no problems.","Manageable but tricky in places.","Found this quite challenging."][v-1];
  await fetch(`${API}/difficulty`,{
    method:"POST",credentials:"include",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({hw_id:hwId,rating:v,comment})
  });
  closeModal(); toast("Difficulty feedback submitted ✓");
  await navigateTo(currentPanel);
};

window.viewDiffComments = function(hwId) {
  const h  = hwCache.find(x=>x.id===hwId); if (!h) return;
  const rs = ratingsFor(hwId);
  const avg= rs.length ? Math.round(rs.reduce((s,r)=>s+r.rating,0)/rs.length) : 0;
  document.getElementById("modal-box").className = "modal modal-wide";
  openModal(`💬 Difficulty Feedback – ${h.title}`,`
    <p style="font-size:.85rem;color:var(--muted);margin-bottom:16px">
      ${rs.length} student${rs.length!==1?"s have":"has"} rated this assignment.
      ${rs.length?` Class average: <b>${diffLabel[avg]}</b>`:""}
    </p>
    ${commentCards(rs)||`<div style="text-align:center;padding:32px;color:var(--muted)">No feedback submitted yet.</div>`}`,
    `<button class="btn btn-secondary" onclick="closeModal()">Close</button>`
  );
};

// ── Quiz ──────────────────────────────────────────────────────────────────────
window.openQuiz = function(hwId) {
  const h  = hwCache.find(x=>x.id===hwId); if (!h) return;
  const qs = getQs(h);
  if (!qs) { toast("No quiz questions found for this assignment"); return; }

  const dbSub = quizCache.find(q=>q.hw_id===hwId);
  if (dbSub) { showQuizResult(hwId, dbSub.score, qs.length, dbSub.pct, null); return; }

  if (!quizState[hwId]) quizState[hwId] = {answers:{},submitted:false,score:0};
  if (quizState[hwId].submitted) {
    const st = quizState[hwId];
    showQuizResult(hwId, st.score, qs.length, Math.round(st.score/qs.length*100), st.answers);
    return;
  }

  document.getElementById("modal-box").className = "modal modal-wide";
  openModal(`▶ Auto-Mark Quiz – ${h.subject||h.title}`,`
    <p style="font-size:.85rem;color:var(--muted);margin-bottom:20px">${qs.length} questions · Select one answer per question · Your score is recorded automatically on submission.</p>
    ${qs.map((q,qi)=>`
    <div class="quiz-block">
      <div class="quiz-q">Q${qi+1}. ${q.q}</div>
      ${q.options.map((opt,oi)=>`
      <div class="quiz-option" id="qopt-${qi}-${oi}" onclick="selectQuizOpt(${hwId},${qi},${oi},${qs.length})">
        <span style="font-weight:700;font-size:.8rem;color:var(--muted);width:20px;flex-shrink:0">${String.fromCharCode(65+oi)}.</span>${opt}
      </div>`).join("")}
    </div>`).join("")}`,
    `<button class="btn btn-secondary" onclick="closeModal()">Save & Exit</button>
     <button class="btn btn-primary"   onclick="submitQuiz(${hwId})">Submit & Auto-Mark →</button>`
  );
  Object.entries(quizState[hwId].answers).forEach(([qi,oi])=>{
    const el = document.getElementById(`qopt-${qi}-${oi}`);
    if (el) el.classList.add("selected");
  });
};

window.selectQuizOpt = function(hwId, qi, oi, total) {
  for (let x=0;x<total;x++){
    const el=document.getElementById(`qopt-${qi}-${x}`);
    if (el) el.classList.remove("selected");
  }
  const el=document.getElementById(`qopt-${qi}-${oi}`);
  if (el) el.classList.add("selected");
  quizState[hwId].answers[qi]=oi;
};

window.submitQuiz = async function(hwId) {
  const h  = hwCache.find(x=>x.id===hwId);
  const qs = getQs(h);
  const st = quizState[hwId];
  if (Object.keys(st.answers).length < qs.length) {
    toast(`Please answer all ${qs.length} questions (${Object.keys(st.answers).length} done)`); return;
  }
  let score=0; qs.forEach((q,qi)=>{ if (st.answers[qi]===q.answer) score++; });
  st.score=score; st.submitted=true;
  const pct=Math.round(score/qs.length*100);
  await fetch(`${API}/quiz_submissions`,{
    method:"POST",credentials:"include",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({hw_id:hwId,score,total:qs.length,pct})
  });
  showQuizResult(hwId, score, qs.length, pct, st.answers);
};

function showQuizResult(hwId, score, total, pct, answers) {
  const h  = hwCache.find(x=>x.id===hwId);
  const qs = getQs(h);
  const g  = pct>=80?"A":pct>=65?"B":pct>=50?"C":"D";
  const c  = pct>=80?"var(--sage)":pct>=65?"var(--gold)":"var(--rust)";
  document.getElementById("modal-box").className="modal modal-wide";
  openModal(`✅ Quiz Results`,`
    <div class="score-box">
      <div class="score-big" style="color:${c}">${pct}%</div>
      <div style="font-size:1.1rem;font-weight:700;margin-top:6px">Grade ${g}</div>
      <div style="font-size:.85rem;color:var(--muted);margin-top:4px">${score} correct out of ${total} · Auto-marked instantly</div>
    </div>
    ${qs&&answers?qs.map((q,qi)=>{
      const chosen=answers[qi],correct=q.answer,ok=chosen===correct;
      return`<div class="quiz-block">
        <div class="quiz-q">${ok?"✅":"❌"} Q${qi+1}. ${q.q}</div>
        ${q.options.map((opt,oi)=>`
        <div class="quiz-option ${oi===correct?"correct":oi===chosen&&!ok?"wrong":""}">
          <span style="font-weight:700;font-size:.8rem;width:20px;flex-shrink:0">${String.fromCharCode(65+oi)}.</span>${opt}
          ${oi===correct?` <span style="margin-left:auto;font-size:.75rem;font-weight:600">✓ Correct</span>`:""}
          ${oi===chosen&&!ok?` <span style="margin-left:auto;font-size:.75rem">← Your answer</span>`:""}
        </div>`).join("")}
      </div>`;
    }).join(""):`<p style="color:var(--muted);font-size:.85rem;margin-top:16px">Detailed breakdown not available for previously submitted quizzes.</p>`}`,
    `<button class="btn btn-primary" onclick="closeModal()">Done</button>`
  );
}

// ── Auto-mark results ─────────────────────────────────────────────────────────
function renderAutoMark(el, acts) {
  acts.innerHTML = `<button class="btn btn-secondary" onclick="exportAutoMarkPDF()">⬇ Export Report</button>`;
  const quizHW = hwCache.filter(h=>h.hw_type==="quiz");
  el.innerHTML = `
    <div class="card">
      <div class="card-title">✅ Auto-Marked Quiz Results</div>
      ${quizHW.length?quizHW.map(h=>{
        const subs=quizCache.filter(q=>q.hw_id===h.id);
        const avg=subs.length?Math.round(subs.reduce((s,x)=>s+x.pct,0)/subs.length):null;
        const qs=getQs(h);
        return`<div style="margin-bottom:24px;padding-bottom:24px;border-bottom:1px solid var(--border)">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;gap:8px">
            <div><div style="font-weight:600;font-size:.95rem">${h.title}</div>
              <div style="font-size:.8rem;color:var(--muted)">${h.class_name||"—"} · Due ${h.due} · ${qs?qs.length:5} questions</div></div>
            <div style="text-align:right">
              <div style="font-size:1.15rem;font-weight:700;color:${avg>=70?"var(--sage)":avg!=null?"var(--rust)":"var(--muted)"}">
                ${avg!=null?avg+"% class avg":"No submissions yet"}</div>
              <div style="font-size:.75rem;color:var(--muted)">${subs.length} submission${subs.length!==1?"s":""}</div>
            </div>
          </div>
          ${subs.length?`<div class="table-wrap"><table>
            <tr><th>Student</th><th>Score</th><th>Percentage</th><th>Grade</th></tr>
            ${subs.map(s=>{
              const g=s.pct>=80?"A":s.pct>=65?"B":s.pct>=50?"C":"D";
              return`<tr><td>${s.student_email}</td><td>${s.score}/${s.total}</td>
                <td><b style="color:${s.pct>=80?"var(--sage)":s.pct>=65?"var(--gold)":"var(--rust)"}">${s.pct}%</b></td>
                <td><span class="badge badge-${s.pct>=80?"approved":s.pct>=65?"pending":"overdue"}">${g}</span></td></tr>`;
            }).join("")}
          </table></div>`
          :`<div style="background:var(--cream);border-radius:var(--radius-sm);padding:16px;font-size:.85rem;color:var(--muted);text-align:center">No submissions yet.</div>`}
        </div>`;
      }).join(""):`<p style="color:var(--muted)">No quiz assignments found.</p>`}
    </div>
    <div class="card">
      <div class="card-title">📊 Class Difficulty Feedback Summary</div>
      <div class="table-wrap"><table>
        <tr><th>Assignment</th><th>Ratings</th><th>Average Difficulty</th><th></th></tr>
        ${hwCache.map(h=>{
          const rs=ratingsFor(h.id);
          const avg=rs.length?Math.round(rs.reduce((s,r)=>s+r.rating,0)/rs.length):0;
          return`<tr>
            <td><b>${h.title}</b></td><td>${rs.length}</td>
            <td><span style="font-weight:600">${avg?diffLabel[avg]:"No data yet"}</span></td>
            <td><button class="btn btn-sm btn-secondary" onclick="viewDiffComments(${h.id})">View comments</button></td>
          </tr>`;
        }).join("")}
      </table></div>
    </div>`;
}

window.exportAutoMarkPDF = function() {
  const w=window.open("","_blank");
  let rows="";
  hwCache.filter(h=>h.hw_type==="quiz").forEach(h=>{
    const subs=quizCache.filter(q=>q.hw_id===h.id);
    if (!subs.length){rows+=`<tr><td>${h.title}</td><td colspan="4" style="color:#999">No submissions</td></tr>`;return;}
    subs.forEach(s=>{
      const g=s.pct>=80?"A":s.pct>=65?"B":s.pct>=50?"C":"D";
      rows+=`<tr><td>${h.title}</td><td>${s.student_email}</td><td>${s.score}/${s.total}</td><td>${s.pct}%</td><td>${g}</td></tr>`;
    });
  });
  w.document.write(`<!DOCTYPE html><html><head><title>Auto-Mark Report</title>
  <style>body{font-family:Georgia,serif;max-width:760px;margin:40px auto;color:#111}h1{font-size:1.3rem}
  table{width:100%;border-collapse:collapse;font-size:.88rem}th{background:#f2ede4;padding:9px 12px;text-align:left;font-size:.8rem}
  td{padding:9px 12px;border-bottom:1px solid #ddd}@media print{.noprint{display:none}}</style></head><body>
  <h1>Auto-Mark Quiz Report</h1>
  <p style="color:#666;font-size:.85rem;margin-bottom:20px">Generated ${new Date().toLocaleDateString()}</p>
  <table><tr><th>Quiz</th><th>Student</th><th>Score</th><th>Percentage</th><th>Grade</th></tr>${rows}</table>
  <br><button class="noprint" onclick="window.print()" style="background:#c8a84b;border:none;padding:9px 18px;border-radius:6px;cursor:pointer">🖨 Print / Save as PDF</button>
  </body></html>`);
  w.document.close(); toast("Report opened ✓");
};

// ── Grades & Subjects (teacher only) ─────────────────────────────────────────
function renderGradesSubjects(el, acts) {
  acts.innerHTML = `
    <button class="btn btn-primary"   onclick="openAddGrade()">+ Add Grade</button>
    <button class="btn btn-secondary" onclick="openAddSubject()">+ Add Subject</button>`;

  el.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
      <div class="card">
        <div class="card-title">🏫 Grades / Classes</div>
        <p style="font-size:.82rem;color:var(--muted);margin-bottom:16px">These grades appear in the homework assignment form.</p>
        ${gradesCache.length
          ? `<div class="gs-list">${gradesCache.map(g=>`
            <div class="gs-item">
              <span>${g.name}</span>
              <button class="btn btn-sm btn-danger" onclick="deleteGrade(${g.id},'${g.name.replace(/'/g,"\\'")}')">Remove</button>
            </div>`).join("")}</div>`
          : `<p style="color:var(--muted);font-size:.875rem">No grades added yet.</p>`}
      </div>
      <div class="card">
        <div class="card-title">📖 Subjects</div>
        <p style="font-size:.82rem;color:var(--muted);margin-bottom:16px">These subjects appear in the homework assignment form.</p>
        ${subjectsCache.length
          ? `<div class="gs-list">${subjectsCache.map(s=>`
            <div class="gs-item">
              <span>${s.name}</span>
              <button class="btn btn-sm btn-danger" onclick="deleteSubject(${s.id},'${s.name.replace(/'/g,"\\'")}')">Remove</button>
            </div>`).join("")}</div>`
          : `<p style="color:var(--muted);font-size:.875rem">No subjects added yet.</p>`}
      </div>
    </div>`;
}

window.openAddGrade = function() {
  document.getElementById("modal-box").className = "modal";
  openModal("+ Add Grade / Class",`
    <div class="form-group"><label>Grade Name</label>
      <input type="text" id="new-grade" placeholder="e.g. Grade 10C"/>
    </div>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
     <button class="btn btn-primary"   onclick="submitAddGrade()">Add Grade</button>`
  );
};

window.submitAddGrade = async function() {
  const name = document.getElementById("new-grade").value.trim();
  if (!name) { toast("Please enter a grade name"); return; }
  const res = await fetch(`${API}/grades`,{method:"POST",credentials:"include",
    headers:{"Content-Type":"application/json"},body:JSON.stringify({name})});
  if (res.ok) { closeModal(); toast(`Grade "${name}" added ✓`); await navigateTo(currentPanel); }
  else { const d=await res.json(); toast(d.error||"Failed to add grade"); }
};

window.deleteGrade = function(id, name) {
  document.getElementById("modal-box").className = "modal";
  openModal("Remove Grade",
    `<p style="font-size:.9rem">Remove <b>${name}</b>? This will not affect existing homework.</p>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
     <button class="btn btn-danger"    onclick="doDeleteGrade(${id})">Remove</button>`
  );
};
window.doDeleteGrade = async function(id) {
  await fetch(`${API}/grades/${id}`,{method:"DELETE",credentials:"include"});
  closeModal(); toast("Grade removed ✓"); await navigateTo(currentPanel);
};

window.openAddSubject = function() {
  document.getElementById("modal-box").className = "modal";
  openModal("+ Add Subject",`
    <div class="form-group"><label>Subject Name</label>
      <input type="text" id="new-subject" placeholder="e.g. Business Studies"/>
    </div>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
     <button class="btn btn-primary"   onclick="submitAddSubject()">Add Subject</button>`
  );
};

window.submitAddSubject = async function() {
  const name = document.getElementById("new-subject").value.trim();
  if (!name) { toast("Please enter a subject name"); return; }
  const res = await fetch(`${API}/subjects`,{method:"POST",credentials:"include",
    headers:{"Content-Type":"application/json"},body:JSON.stringify({name})});
  if (res.ok) { closeModal(); toast(`Subject "${name}" added ✓`); await navigateTo(currentPanel); }
  else { const d=await res.json(); toast(d.error||"Failed to add subject"); }
};

window.deleteSubject = function(id, name) {
  document.getElementById("modal-box").className = "modal";
  openModal("Remove Subject",
    `<p style="font-size:.9rem">Remove <b>${name}</b>? This will not affect existing homework.</p>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
     <button class="btn btn-danger"    onclick="doDeleteSubject(${id})">Remove</button>`
  );
};
window.doDeleteSubject = async function(id) {
  await fetch(`${API}/subjects/${id}`,{method:"DELETE",credentials:"include"});
  closeModal(); toast("Subject removed ✓"); await navigateTo(currentPanel);
};

// When teacher opens Add Homework, populate dropdowns from live grades/subjects
window.openAddHomework = async function() {
  // Refresh grades & subjects
  [gradesCache, subjectsCache] = await Promise.all([apiFetch("/grades"), apiFetch("/subjects")]);
  document.getElementById("modal-box").className = "modal";
  const gradeOpts   = gradesCache.map(g=>`<option>${g.name}</option>`).join("");
  const subjectOpts = subjectsCache.map(s=>`<option>${s.name}</option>`).join("");
  openModal("+ Assign New Homework",`
    <div class="form-group"><label>Subject</label>
      <select id="hw-subject">${subjectOpts||"<option>General</option>"}</select></div>
    <div class="form-group"><label>Title</label>
      <input type="text" id="hw-title" placeholder="Assignment title"/></div>
    <div class="form-group"><label>Instructions</label>
      <textarea id="hw-desc" placeholder="Detailed homework instructions…" style="min-height:100px"></textarea></div>
    <div class="form-row">
      <div class="form-group"><label>Class</label>
        <select id="hw-class">${gradeOpts||"<option>Grade 9A</option>"}</select></div>
      <div class="form-group"><label>Due Date</label>
        <input type="date" id="hw-due" value="${new Date().toISOString().split("T")[0]}"/></div>
    </div>
    <div class="form-group"><label>Homework Type</label>
      <select id="hw-type"><option value="manual">Written / Manual Marking</option><option value="quiz">Auto-Mark Quiz (MCQ)</option></select></div>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
     <button class="btn btn-primary"   onclick="submitAddHomework()">Assign & Notify</button>`
  );
};

window.submitAddHomework = async function() {
  const title=document.getElementById("hw-title").value.trim();
  const due  =document.getElementById("hw-due").value;
  if (!title){toast("Please enter a title");return;}
  if (!due)  {toast("Please select a due date");return;}
  await fetch(`${API}/homework`,{method:"POST",credentials:"include",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({
      title,due,
      subject:    document.getElementById("hw-subject").value,
      class_name: document.getElementById("hw-class").value,
      hw_type:    document.getElementById("hw-type").value,
      description:document.getElementById("hw-desc").value.trim()
    })});
  closeModal(); toast("Homework assigned & parents notified ✓");
  await navigateTo(currentPanel);
};

// ── Delete homework ───────────────────────────────────────────────────────────
window.confirmDelete = function(id) {
  const h=hwCache.find(x=>x.id===id); if (!h) return;
  document.getElementById("modal-box").className = "modal";
  openModal("Delete Homework",
    `<p style="font-size:.9rem">Are you sure you want to delete <b>${h.title}</b>?</p>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
     <button class="btn btn-danger"    onclick="doDelete(${id})">Delete</button>`
  );
};
window.doDelete = async function(id) {
  await fetch(`${API}/homework/${id}`,{method:"DELETE",credentials:"include"});
  closeModal(); toast("Homework deleted ✓");
  await navigateTo(currentPanel);
};

// ── Policies ──────────────────────────────────────────────────────────────────
function renderPolicies(el, acts) {
  const role = getRole();
  if (role==="teacher")
    acts.innerHTML=`<button class="btn btn-primary" onclick="openAddPolicy()">+ New Policy</button>`;

  // Parents see all policies (pending ones are actionable); students see approved only
  const list = role==="student" ? policiesCache.filter(p=>p.status==="approved") : policiesCache;

  el.innerHTML=`
    <div class="card">
      <div class="card-title">📋 Homework Policies</div>
      ${role==="parent"?`<p style="font-size:.82rem;color:var(--muted);margin-bottom:16px">Review and approve or reject pending policies proposed by the school.</p>`:""}
      ${list.length?list.map(p=>`
        <div class="policy-card">
          <div style="flex:1">
            <div class="policy-title">${p.title}</div>
            <div class="policy-desc">${p.description}</div>
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
              <span class="badge badge-${p.status}">${p.status}</span>
              ${p.status==="approved"?`<span style="font-size:.75rem;color:var(--sage)">✓ Approved</span>`:""}
            </div>
          </div>
          <div class="policy-actions">
            ${role==="parent"&&p.status==="pending"?`
              <button class="btn btn-sm btn-primary" onclick="doApprovePolicy(${p.id})">✓ Approve</button>
              <button class="btn btn-sm btn-danger"  onclick="doRejectPolicy(${p.id})">✗ Reject</button>`:""}
            ${role==="teacher"?`<button class="btn btn-sm btn-danger" onclick="doDeletePolicy(${p.id})">Remove</button>`:""}
          </div>
        </div>`).join("")
      :`<p style="color:var(--muted);font-size:.875rem">No policies found.</p>`}
    </div>`;
}

window.doApprovePolicy = async function(id) {
  await fetch(`${API}/policies/${id}`,{method:"PATCH",credentials:"include",
    headers:{"Content-Type":"application/json"},body:JSON.stringify({status:"approved"})});
  toast("Policy approved ✓"); await navigateTo(currentPanel);
};
window.doRejectPolicy = async function(id) {
  await fetch(`${API}/policies/${id}`,{method:"PATCH",credentials:"include",
    headers:{"Content-Type":"application/json"},body:JSON.stringify({status:"rejected"})});
  toast("Policy rejected"); await navigateTo(currentPanel);
};
window.doDeletePolicy = async function(id) {
  await fetch(`${API}/policies/${id}`,{method:"DELETE",credentials:"include"});
  toast("Policy removed ✓"); await navigateTo(currentPanel);
};

window.openAddPolicy = function() {
  document.getElementById("modal-box").className = "modal";
  openModal("+ Propose New Policy",`
    <div class="form-group"><label>Policy Title</label>
      <input type="text" id="pol-title" placeholder="e.g. Homework Completion Deadline"/></div>
    <div class="form-group"><label>Description</label>
      <textarea id="pol-desc" placeholder="Describe the policy clearly…" style="min-height:120px"></textarea></div>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
     <button class="btn btn-primary"   onclick="submitAddPolicy()">Propose Policy</button>`
  );
};

window.submitAddPolicy = async function() {
  const title=document.getElementById("pol-title").value.trim();
  const desc =document.getElementById("pol-desc").value.trim();
  if (!title||!desc){toast("Please fill in all fields");return;}
  await fetch(`${API}/policies`,{method:"POST",credentials:"include",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({title,description:desc})});
  closeModal(); toast("Policy proposed & sent for approval ✓");
  await navigateTo(currentPanel);
};

// ── Notifications ─────────────────────────────────────────────────────────────
function renderNotifications(el, acts) {
  acts.innerHTML=`<button class="btn btn-secondary" onclick="toast('All marked as read ✓')">Mark all read</button>`;
  const role=getRole(), now=new Date();
  const overdue=hwCache.filter(h=>new Date(h.due)<now);
  const pending=policiesCache.filter(p=>p.status==="pending");
  const msgs={
    teacher:[
      ...overdue.map(h=>({text:`Overdue assignment: "${h.title}"`,time:"Today",read:false})),
      ...ratingsCache.slice(-3).reverse().map(r=>{
        const hw=hwCache.find(h=>h.id===r.hw_id);
        return{text:`${r.student_email} rated "${hw?.title||"a task"}" as ${diffLabel[r.rating]}`,time:"Recently",read:false};
      }),
      {text:"New quiz results available in Auto-Mark.",time:"Today",read:true},
    ],
    parent:[
      // Only relevant parent notifications
      ...pending.map(p=>({text:`Policy "${p.title}" is awaiting your approval.`,time:"Today",read:false})),
      ...overdue.map(h=>({text:`Overdue homework: "${h.title}" — due ${h.due}.`,time:"Today",read:false})),
      {text:"New homework has been assigned by the teacher.",time:"Today",read:false},
    ],
    student:[
      ...overdue.map(h=>({text:`Reminder: "${h.title}" is overdue!`,time:"Today",read:false})),
      {text:"Your quiz was auto-marked. Check your results.",time:"Today",read:false},
      {text:"New homework has been assigned.",time:"Yesterday",read:true},
    ],
  }[role]||[];
  el.innerHTML=`<div class="card"><div class="card-title">🔔 Notifications</div>
    ${msgs.length?msgs.map(n=>`
      <div class="notif-item notif-${n.read?"read":"unread"}">
        <div class="notif-dot"></div>
        <div><div class="notif-text">${n.text}</div><div class="notif-time">${n.time}</div></div>
      </div>`).join("")
    :`<p style="color:var(--muted);font-size:.875rem">No notifications.</p>`}
  </div>`;
}

// ── Modal helpers ─────────────────────────────────────────────────────────────
function openModal(title, body, actions) {
  document.getElementById("modal-title").innerHTML  =title;
  document.getElementById("modal-body").innerHTML   =body;
  document.getElementById("modal-actions").innerHTML=actions;
  document.getElementById("modal-overlay").classList.add("open");
}
window.closeModal=function(){
  document.getElementById("modal-overlay").classList.remove("open");
  document.getElementById("modal-box").className="modal";
};
window.closeModalOutside=function(e){
  if (e.target===document.getElementById("modal-overlay")) closeModal();
};

// ── Toast ─────────────────────────────────────────────────────────────────────
let toastTimer;
window.toast=function(msg){
  const el=document.getElementById("toast");
  el.textContent=msg; el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>el.classList.remove("show"),3200);
};

// ── Additional CSS ────────────────────────────────────────────────────────────
const style=document.createElement("style");
style.textContent=`
.quiz-option{display:flex;align-items:center;gap:10px;padding:10px 14px;border:1px solid var(--border);border-radius:var(--radius-sm);margin-bottom:8px;cursor:pointer;transition:all .15s;font-size:.875rem;}
.quiz-option:hover{border-color:var(--gold);background:rgba(200,168,75,.05);}
.quiz-option.selected{border-color:var(--sky);background:rgba(58,111,168,.07);}
.quiz-option.correct{border-color:var(--sage)!important;background:rgba(90,122,106,.1)!important;color:var(--sage);}
.quiz-option.wrong{border-color:var(--rust)!important;background:rgba(181,73,42,.07)!important;color:var(--rust);}
.quiz-q{font-weight:600;margin-bottom:10px;font-size:.9rem;}
.quiz-block{margin-bottom:22px;padding-bottom:22px;border-bottom:1px solid var(--border);}
.quiz-block:last-child{border-bottom:none;}
.score-box{background:linear-gradient(135deg,rgba(90,122,106,.08),rgba(200,168,75,.08));border:2px solid var(--sage);border-radius:var(--radius);padding:28px;text-align:center;margin-bottom:24px;}
.score-big{font-family:'Fraunces',serif;font-size:3.5rem;font-weight:900;line-height:1;}
.comment-item{background:var(--cream);border-radius:var(--radius-sm);padding:12px 14px;margin-bottom:10px;}
.comment-author{font-weight:600;font-size:.8rem;margin-bottom:3px;display:flex;align-items:center;justify-content:space-between;}
.comment-text{font-size:.85rem;color:var(--ink);line-height:1.5;}
/* Grades & Subjects list */
.gs-list{display:flex;flex-direction:column;gap:8px;}
.gs-item{display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:var(--cream);border-radius:var(--radius-sm);font-size:.9rem;font-weight:500;}
/* Auth tabs */
.auth-tabs{display:flex;gap:0;margin-bottom:22px;border:1px solid var(--border);border-radius:var(--radius-sm);overflow:hidden;}
.auth-tab{flex:1;padding:10px;background:transparent;border:none;cursor:pointer;font-size:.85rem;font-weight:600;color:var(--muted);transition:all .15s;}
.auth-tab.active{background:var(--gold);color:#fff;}
/* Register role buttons */
.reg-role-grid{display:flex;gap:10px;margin-top:6px;}
.reg-role-btn{flex:1;padding:10px 6px;border:1px solid var(--border);border-radius:var(--radius-sm);background:transparent;cursor:pointer;font-size:.8rem;font-weight:600;color:var(--ink);transition:all .15s;display:flex;flex-direction:column;align-items:center;gap:4px;}
.reg-role-btn .icon{font-size:1.3rem;}
.reg-role-btn:hover{border-color:var(--gold);}
.reg-role-btn.active{border-color:var(--gold);background:rgba(200,168,75,.1);color:var(--gold);}
`;
document.head.appendChild(style);

// ── Boot ──────────────────────────────────────────────────────────────────────
(async () => {
  showAuthTab("login");
  const user = await restoreSession();
  if (user) showApp(user);
})();
