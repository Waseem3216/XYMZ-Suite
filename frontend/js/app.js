// frontend/js/app.js

// 🔗 API base URL:
// - Local dev: talk to http://localhost:5500
// - Production: same origin ('' = relative URLs like /api/...)
const API_BASE_URL =
  window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:5500'
    : '';

// Keys to remember UI state across reloads
const LAST_VIEW_KEY = 'xymz_last_view';
const LAST_ORG_KEY = 'xymz_last_org_id';
const LAST_PROJECT_KEY = 'xymz_last_project_id';

/* ============================================================
   ELEMENT REFERENCES
   ============================================================ */

// Auth
const authPanel = document.getElementById('auth-panel');
const appPanel = document.getElementById('app-panel');
const authStatus = document.getElementById('auth-status');

const tabLogin = document.getElementById('tab-login');
const tabRegister = document.getElementById('tab-register');

const loginForm = document.getElementById('login-form');
const loginEmail = document.getElementById('login-email');
const loginPassword = document.getElementById('login-password');
const loginOrgToken = document.getElementById('login-org-token');
const linkResetPassword = document.getElementById('link-reset-password');
const linkResetToken = document.getElementById('link-reset-token');

const registerForm = document.getElementById('register-form');
const registerName = document.getElementById('register-name');
const registerEmail = document.getElementById('register-email');
const registerPassword = document.getElementById('register-password');
const registerSecurityQuestion = document.getElementById('register-security-question');
const registerSecurityAnswer = document.getElementById('register-security-answer');
const registerIsAdmin = document.getElementById('register-is-admin');
const registerOrgTokenRow = document.getElementById('register-org-token-row');
const registerOrgToken = document.getElementById('register-org-token');
const registerOrgName = document.getElementById('register-org-name');

// Brand / topbar
const brandTitle = document.getElementById('brand-title');
const brandSubtitle = document.getElementById('brand-subtitle');

const userNameSpan = document.getElementById('user-name');
const userEmailSpan = document.getElementById('user-email');
const logoutBtn = document.getElementById('btn-logout');

// Org / Project
const orgSwitcher = document.getElementById('org-switcher');
const orgSelect = document.getElementById('org-select');
const btnNewOrg = document.getElementById('btn-new-org');
const projectListEl = document.getElementById('project-list');
const btnNewProject = document.getElementById('btn-new-project');
const activityListEl = document.getElementById('activity-list');

// Board (XYMZ.Ops)
const boardProjectNameEl = document.getElementById('board-project-name');
const boardProjectDescEl = document.getElementById('board-project-desc');
const boardEl = document.getElementById('board');
const btnAddColumn = document.getElementById('btn-add-column');
const btnAddTask = document.getElementById('btn-add-task');

// Delete Project button
const btnDeleteProject = document.getElementById('btn-delete-project');

// Task Detail
const taskDetailPanel = document.getElementById('task-detail-panel');
const btnCloseDetail = document.getElementById('btn-close-detail');
const detailTitleEl = document.getElementById('detail-title');
const detailMetaEl = document.getElementById('detail-meta');
const detailDescriptionEl = document.getElementById('detail-description');

const detailForm = document.getElementById('detail-form');
const detailInputTitle = document.getElementById('detail-input-title');
const detailInputDesc = document.getElementById('detail-input-desc');
const detailInputPriority = document.getElementById('detail-input-priority');
const detailInputDue = document.getElementById('detail-input-due');
const detailInputAssignee = document.getElementById('detail-input-assignee');
const detailStatus = document.getElementById('detail-status');

// Bottom Save Task button
const detailSaveBtn = document.getElementById('detail-save-btn');

// Delete Task button
const detailDeleteTaskBtn = document.getElementById('detail-delete-task');

// Comments
const detailCommentsList = document.getElementById('detail-comments');
const detailCommentForm = document.getElementById('detail-comment-form');
const detailCommentBody = document.getElementById('detail-comment-body');

// Suite navigation tabs
const suiteTabs = document.querySelectorAll('.suite-tab');
const suiteView = document.getElementById('suite-view');
const opsView = document.getElementById('ops-view');
const biView = document.getElementById('bi-view');

// NEW: Fleet & Radar views
const fleetView = document.getElementById('fleet-view');
const radarView = document.getElementById('radar-view');

// XYMZ.Fleet elements (match index.html IDs)
const fleetListEl = document.getElementById('fleet-list');
const fleetTotalCountEl = document.getElementById('fleet-total-count');
const fleetProjectCountEl = document.getElementById('fleet-project-count');
const fleetTasksPerPersonEl = document.getElementById('fleet-tasks-per-person');
const fleetFocusTextEl = document.getElementById('fleet-focus-text');

// XYMZ.Radar elements (match index.html IDs)
const radarOverdueList = document.getElementById('radar-overdue-list');
const radarProjectsList = document.getElementById('radar-projects-list');
const radarUpcomingList = document.getElementById('radar-upcoming-list');

// BI elements
const biMeta = document.getElementById('bi-meta');
const biChartCanvas = document.getElementById('bi-chart');
let biChart = null;

// BI Task Drilldown
const biTaskChartArea = document.getElementById('bi-task-chart-area');
const biTaskChartTitle = document.getElementById('bi-task-chart-title');
const biTaskChartCanvas = document.getElementById('bi-task-chart');
let biTaskChart = null;

/* ============================================================
   GLOBAL STATE
   ============================================================ */

let currentUser = null;
let orgs = [];
let currentOrgId = null;
let projects = [];
let currentProjectId = null;

let boardState = {
  project: null,
  columns: [],
  tasks: [],
  members: []
};

let selectedTaskId = null;
let dragTaskId = null;
let dragFromColumnId = null;

let currentView = 'suite';

// projectCompletion[projectId] = true/false
let projectCompletion = {};
let projectListDnDInitialized = false;

/* ============================================================
   HELPERS
   ============================================================ */

function setAuthStatus(msg) {
  authStatus.textContent = msg || '';
}

function getToken() {
  return localStorage.getItem('td_token');
}

function setToken(token) {
  if (token) localStorage.setItem('td_token', token);
  else localStorage.removeItem('td_token');
}

function authHeaders() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function safeJson(res) {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Server returned non-JSON (status ${res.status})`);
  }
}

/* ---------- Persisted selection helpers ---------- */

function getStoredLastOrgId() {
  try {
    const raw = localStorage.getItem(LAST_ORG_KEY);
    if (!raw) return null;
    const n = Number(raw);
    return Number.isNaN(n) ? null : n;
  } catch {
    return null;
  }
}

function getStoredLastProjectId() {
  try {
    const raw = localStorage.getItem(LAST_PROJECT_KEY);
    if (!raw) return null;
    const n = Number(raw);
    return Number.isNaN(n) ? null : n;
  } catch {
    return null;
  }
}

function setCurrentOrgId(newOrgId) {
  currentOrgId = newOrgId != null ? Number(newOrgId) : null;
  try {
    if (currentOrgId != null) {
      localStorage.setItem(LAST_ORG_KEY, String(currentOrgId));
    } else {
      localStorage.removeItem(LAST_ORG_KEY);
    }
  } catch {
    // ignore storage issues
  }
}

function setCurrentProjectId(newProjectId) {
  currentProjectId = newProjectId != null ? Number(newProjectId) : null;
  try {
    if (currentProjectId != null) {
      localStorage.setItem(LAST_PROJECT_KEY, String(currentProjectId));
    } else {
      localStorage.removeItem(LAST_PROJECT_KEY);
    }
  } catch {
    // ignore
  }
}

/* ---------- Brand + Theme helpers ---------- */

function setBrandLoggedOut() {
  if (brandTitle) brandTitle.textContent = 'XYMZ';
  if (brandSubtitle)
    brandSubtitle.textContent = 'Sign in to access XYMZ.Suite.';
}

function setBrandForView(view) {
  if (!brandTitle || !brandSubtitle) return;

  if (view === 'fleet') {
    brandTitle.textContent = 'XYMZ.Fleet';
    brandSubtitle.textContent = 'Teams, capacity & coverage.';
  } else if (view === 'radar') {
    brandTitle.textContent = 'XYMZ.Radar';
    brandSubtitle.textContent = 'Live risk signals & delivery health.';
  } else if (view === 'ops') {
    brandTitle.textContent = 'XYMZ.Ops';
    brandSubtitle.textContent =
      'Operational boards for shared client delivery.';
  } else if (view === 'bi') {
    brandTitle.textContent = 'XYMZ.BI';
    brandSubtitle.textContent =
      'Project insights & portfolio intelligence.';
  } else {
    brandTitle.textContent = 'XYMZ.Suite';
    brandSubtitle.textContent =
      'Shared workspaces for agencies & clients.';
  }
}

function setThemeForView(view) {
  const body = document.body;
  if (!body) return;

  body.classList.remove(
    'theme-suite',
    'theme-ops',
    'theme-bi',
    'theme-fleet',
    'theme-radar'
  );

  if (view === 'ops') {
    body.classList.add('theme-ops');
  } else if (view === 'bi') {
    body.classList.add('theme-bi');
  } else if (view === 'fleet') {
    body.classList.add('theme-fleet');
  } else if (view === 'radar') {
    body.classList.add('theme-radar');
  } else {
    body.classList.add('theme-suite');
  }
}

function setBrandLoggedIn() {
  setBrandForView(currentView || 'suite');
}

/* ============================================================
   VIEW SWITCHING
   ============================================================ */

function setActiveView(view) {
  currentView = view;

  // 🔐 Remember last view across reloads
  try {
    localStorage.setItem(LAST_VIEW_KEY, view);
  } catch (e) {
    // ignore storage errors
  }

  // Tabs
  suiteTabs.forEach((btn) =>
    btn.classList.toggle('active', btn.dataset.view === view)
  );

  // Sections
  if (suiteView) suiteView.classList.toggle('hidden', view !== 'suite');
  if (opsView) opsView.classList.toggle('hidden', view !== 'ops');
  if (biView) biView.classList.toggle('hidden', view !== 'bi');
  if (fleetView) fleetView.classList.toggle('hidden', view !== 'fleet');
  if (radarView) radarView.classList.toggle('hidden', view !== 'radar');

  // Brand & theme
  setBrandForView(view);
  setThemeForView(view);

  // View-specific data
  if (view === 'bi') {
    loadBiDashboard();
  } else if (view === 'fleet') {
    renderFleetView();
  } else if (view === 'radar') {
    loadRadarSnapshot();
  }
}

/* ============================================================
   AUTH TABS
   ============================================================ */

tabLogin.onclick = () => {
  tabLogin.classList.add('active');
  tabRegister.classList.remove('active');
  loginForm.classList.remove('hidden');
  registerForm.classList.add('hidden');
  setAuthStatus('');
};

tabRegister.onclick = () => {
  tabRegister.classList.add('active');
  tabLogin.classList.remove('active');
  registerForm.classList.remove('hidden');
  loginForm.classList.add('hidden');
  setAuthStatus('');
};

/* ============================================================
   SUITE NAV
   ============================================================ */

suiteTabs.forEach((btn) => {
  btn.addEventListener('click', () => setActiveView(btn.dataset.view));
});

/* ============================================================
   ADMIN CHECKBOX BEHAVIOR (SIGNUP)
   ============================================================ */

if (registerIsAdmin) {
  registerIsAdmin.addEventListener('change', () => {
    const checked = registerIsAdmin.checked;

    if (registerOrgTokenRow) {
      if (checked) {
        registerOrgTokenRow.classList.remove('hidden');
      } else {
        registerOrgTokenRow.classList.add('hidden');
        if (registerOrgToken) registerOrgToken.value = '';
        if (registerOrgName) registerOrgName.value = '';
      }
    }
  });
}

/* ============================================================
   AUTH FLOWS
   ============================================================ */

loginForm.onsubmit = async (e) => {
  e.preventDefault();
  setAuthStatus('Logging in...');

  const orgTokenVal = (loginOrgToken ? loginOrgToken.value : '').trim();

  try {
    const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: loginEmail.value.trim(),
        password: loginPassword.value
      })
    });

    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.error || 'Login failed');

    setToken(data.token);
    await loadSession();
    setAuthStatus('');

    if (orgTokenVal) {
      await joinOrgByToken(orgTokenVal);
    }
  } catch (err) {
    setAuthStatus(`Error: ${err.message}`);
  }
};

registerForm.onsubmit = async (e) => {
  e.preventDefault();
  setAuthStatus('Creating account...');

  const isAdmin = registerIsAdmin.checked;
  const orgTokenVal = (registerOrgToken ? registerOrgToken.value : '').trim();
  const orgNameVal = registerOrgName ? registerOrgName.value.trim() : '';
  const secQuestion = registerSecurityQuestion.value;
  const secAnswer = (registerSecurityAnswer.value || '').trim();

  if (!secQuestion) {
    setAuthStatus('Please select a security question.');
    return;
  }
  if (!secAnswer) {
    setAuthStatus('Please provide an answer to your security question.');
    return;
  }

  if (isAdmin) {
    if (!/^\d{6}$/.test(orgTokenVal)) {
      setAuthStatus('Admin accounts must set a 6-digit organization token.');
      return;
    }
    if (registerOrgName && !orgNameVal) {
      setAuthStatus('Admin accounts must enter an organization name.');
      return;
    }
  }

  try {
    const emailVal = registerEmail.value.trim();

    const res = await fetch(`${API_BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: registerName.value.trim(),
        email: emailVal,
        password: registerPassword.value,
        security_question: secQuestion,
        security_answer: secAnswer,
        is_admin: isAdmin,
        org_token: isAdmin ? orgTokenVal : null,
        org_name: isAdmin ? orgNameVal : null
      })
    });

    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.error || 'Register failed');

    if (isAdmin) {
      setToken(data.token);
      await loadSession();
      setAuthStatus('');
      return;
    }

    setAuthStatus('');
    alert(
      'Your participant account was created successfully.\n\nPlease log in using the 6-digit organization token that was shared with you by your workspace admin.'
    );

    tabLogin.classList.add('active');
    tabRegister.classList.remove('active');
    loginForm.classList.remove('hidden');
    registerForm.classList.add('hidden');

    loginEmail.value = emailVal;
    loginPassword.value = '';
  } catch (err) {
    setAuthStatus(`Error: ${err.message}`);
  }
};

logoutBtn.onclick = () => {
  setToken(null);
  currentUser = null;
  orgs = [];
  setCurrentOrgId(null);
  projects = [];
  setCurrentProjectId(null);

  boardState = { project: null, columns: [], tasks: [], members: [] };
  selectedTaskId = null;
  dragTaskId = null;
  dragFromColumnId = null;
  projectCompletion = {};
  projectListDnDInitialized = false;

  authPanel.classList.remove('hidden');
  appPanel.classList.add('hidden');
  logoutBtn.classList.add('hidden');
  orgSwitcher.classList.add('hidden');

  userNameSpan.textContent = '';
  userEmailSpan.textContent = '';

  if (biChart) biChart.destroy();
  if (biTaskChart) biTaskChart.destroy();

  document.body.classList.remove(
    'theme-suite',
    'theme-ops',
    'theme-bi',
    'theme-fleet',
    'theme-radar'
  );

  // Just start on the main Suite view
  setActiveView('suite');
  setBrandLoggedIn();
};

/* ============================================================
   RESET PASSWORD / RESET TOKEN HANDLERS
   ============================================================ */

if (linkResetPassword) {
  linkResetPassword.onclick = async () => {
    const email = (prompt('Enter your email address:') || '').trim();
    if (!email) return;

    try {
      const qRes = await fetch(
        `${API_BASE_URL}/api/auth/security-question?email=${encodeURIComponent(
          email
        )}`
      );
      const qData = await safeJson(qRes);
      if (!qRes.ok) throw new Error(qData.error || 'Could not find that email.');

      const answer = (prompt(
        `Security question:\n${qData.security_question}\n\nEnter your answer:`
      ) || '').trim();
      if (!answer) return;

      const newPassword = (prompt(
        'Enter your new password (minimum 6 characters):'
      ) || '').trim();
      if (!newPassword) return;
      if (newPassword.length < 6) {
        alert('Password must be at least 6 characters.');
        return;
      }

      const rRes = await fetch(`${API_BASE_URL}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          security_answer: answer,
          new_password: newPassword
        })
      });
      const rData = await safeJson(rRes);
      if (!rRes.ok) throw new Error(rData.error || 'Password reset failed.');

      alert('Password reset successfully. You can now log in with your new password.');
    } catch (err) {
      alert(`Password reset error: ${err.message}`);
    }
  };
}

if (linkResetToken) {
  linkResetToken.onclick = async () => {
    const email = (prompt('Admin email (owner of the workspace):') || '').trim();
    if (!email) return;

    const password = (prompt('Admin account password:') || '').trim();
    if (!password) return;

    const newToken = (prompt('New 6-digit organization token:') || '').trim();
    if (!/^\d{6}$/.test(newToken)) {
      alert('Token must be exactly 6 digits.');
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/reset-org-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          new_token: newToken
        })
      });

      const data = await safeJson(res);
      if (!res.ok) throw new Error(data.error || 'Failed to reset token.');

      alert(
        `Organization token updated successfully.\n\nNew token: ${data.join_token}`
      );
    } catch (err) {
      alert(`Token reset error: ${err.message}`);
    }
  };
}

/* ============================================================
   SESSION LOADING
   ============================================================ */

async function loadSession() {
  const token = getToken();
  if (!token) {
    authPanel.classList.remove('hidden');
    appPanel.classList.add('hidden');
    logoutBtn.classList.add('hidden');
    orgSwitcher.classList.add('hidden');

    document.body.classList.remove(
      'theme-suite',
      'theme-ops',
      'theme-bi',
      'theme-fleet',
      'theme-radar'
    );
    setActiveView('suite');
    setBrandLoggedOut();
    return;
  }

  try {
    const res = await fetch(`${API_BASE_URL}/api/me`, {
      headers: authHeaders()
    });

    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.error || 'Invalid session');

    currentUser = data.user;
    orgs = data.orgs || [];

    userNameSpan.textContent = currentUser.name;
    userEmailSpan.textContent = currentUser.email;

    authPanel.classList.add('hidden');
    appPanel.classList.remove('hidden');
    logoutBtn.classList.remove('hidden');
    orgSwitcher.classList.remove('hidden');

    // Prefer the last view, default to Suite when logged in
    let initialView = 'suite';
    try {
      const saved = localStorage.getItem(LAST_VIEW_KEY);
      if (saved) initialView = saved;
    } catch (e) {
      // ignore
    }

    // Determine initial org (prefer last used if it still exists)
    const storedOrgId = getStoredLastOrgId();
    if (storedOrgId && orgs.some((o) => o.id === storedOrgId)) {
      setCurrentOrgId(storedOrgId);
    } else if (!currentOrgId && orgs.length) {
      setCurrentOrgId(orgs[0].id);
    }

    setActiveView(initialView);
    setBrandLoggedIn();

    renderOrgOptions();

    if (currentOrgId) {
      orgSelect.value = currentOrgId;
      await loadProjectsForOrg(currentOrgId);
      await loadActivity(currentOrgId);
    }
  } catch (err) {
    setToken(null);
    setAuthStatus(`Session error: ${err.message}`);
    authPanel.classList.remove('hidden');
    appPanel.classList.add('hidden');
    document.body.classList.remove(
      'theme-suite',
      'theme-ops',
      'theme-bi',
      'theme-fleet',
      'theme-radar'
    );
    setActiveView('suite');
    setBrandLoggedOut();
  }
}

function renderOrgOptions() {
  orgSelect.innerHTML = '';
  orgs.forEach((org) => {
    const opt = document.createElement('option');
    opt.value = org.id;
    opt.textContent = org.name;
    orgSelect.appendChild(opt);
  });
}

/* ============================================================
   PROJECT ORDER HELPERS (DRAG & DROP + LOCALSTORAGE)
   ============================================================ */

function getProjectOrderKey(orgId) {
  return `xymz_project_order_${orgId}`;
}

function loadProjectOrder(orgId) {
  if (!orgId) return [];
  try {
    const raw = localStorage.getItem(getProjectOrderKey(orgId));
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveProjectOrder(orgId) {
  if (!orgId) return;
  const order = [];
  projectListEl.querySelectorAll('li[data-id]').forEach((li) => {
    order.push(Number(li.dataset.id));
  });
  localStorage.setItem(getProjectOrderKey(orgId), JSON.stringify(order));
}

function getProjectAfterElement(container, y) {
  const items = [...container.querySelectorAll('li[data-id]:not(.dragging)')];

  return items.reduce(
    (closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closest.offset) {
        return { offset, element: child };
      }
      return closest;
    },
    { offset: Number.NEGATIVE_INFINITY, element: null }
  ).element;
}

/* ============================================================
   ORGS / PROJECTS / ACTIVITY
   ============================================================ */

orgSelect.onchange = async () => {
  setCurrentOrgId(Number(orgSelect.value));
  setCurrentProjectId(null);

  boardState = { project: null, columns: [], tasks: [], members: [] };
  renderBoard();
  renderTaskDetail(null);
  renderFleetView();

  await loadProjectsForOrg(currentOrgId);
  await loadActivity(currentOrgId);

  if (currentView === 'bi') loadBiDashboard();
  if (currentView === 'radar') loadRadarSnapshot();
};

btnNewOrg.onclick = async () => {
  const name = prompt('New organization name:');
  if (!name) return;

  try {
    const res = await fetch(`${API_BASE_URL}/api/orgs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders()
      },
      body: JSON.stringify({ name })
    });

    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.error || 'Failed to create org');

    orgs.push(data);
    setCurrentOrgId(data.id);
    setCurrentProjectId(null);

    renderOrgOptions();
    orgSelect.value = currentOrgId;

    await loadProjectsForOrg(currentOrgId);
    await loadActivity(currentOrgId);
    if (currentView === 'bi') loadBiDashboard();
    if (currentView === 'radar') loadRadarSnapshot();
  } catch (err) {
    alert(err.message);
  }
};

async function joinOrgByToken(token) {
  const trimmed = (token || '').trim();
  if (!trimmed) return;

  try {
    const res = await fetch(`${API_BASE_URL}/api/orgs/join-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders()
      },
      body: JSON.stringify({ token: trimmed })
    });

    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.error || 'Failed to join organization.');

    // Make joined org the active org
    try {
      localStorage.setItem(LAST_ORG_KEY, String(data.organization.id));
    } catch {
      // ignore
    }

    await loadSession();
    alert(`Joined organization: ${data.organization.name}`);
  } catch (err) {
    alert(`Organization token error: ${err.message}`);
  }
}

// NEW: refresh completion map from BI summary
async function refreshProjectCompletion(orgId) {
  projectCompletion = {};
  if (!orgId) return;

  try {
    const res = await fetch(
      `${API_BASE_URL}/api/orgs/${orgId}/bi-summary`,
      { headers: authHeaders() }
    );
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.error || 'Failed to load BI summary');

    const summary = data.projects || [];
    summary.forEach((p) => {
      const total =
        (p.in_progress || 0) + (p.review || 0) + (p.complete || 0);
      projectCompletion[p.project_id] = total > 0 && p.complete === total;
    });
  } catch (err) {
    console.error('refreshProjectCompletion error:', err.message);
  }
}

async function loadProjectsForOrg(orgId) {
  projectListEl.innerHTML = '';

  try {
    const res = await fetch(`${API_BASE_URL}/api/orgs/${orgId}/projects`, {
      headers: authHeaders()
    });

    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.error || 'Failed to load projects');

    projects = data.projects || [];

    await refreshProjectCompletion(orgId);

    // Choose which project to show:
    if (!currentProjectId) {
      const storedProjectId = getStoredLastProjectId();
      if (
        storedProjectId &&
        projects.some((p) => p.id === storedProjectId)
      ) {
        setCurrentProjectId(storedProjectId);
      } else if (projects.length) {
        setCurrentProjectId(projects[0].id);
      }
    } else {
      // Ensure current project belongs to this org
      if (!projects.some((p) => p.id === currentProjectId)) {
        setCurrentProjectId(projects.length ? projects[0].id : null);
      }
    }

    renderProjectList();

    if (currentProjectId) {
      await loadBoard(currentProjectId);
    } else {
      // No projects in this org
      boardState = { project: null, columns: [], tasks: [], members: [] };
      renderBoard();
      renderTaskDetail(null);
      renderFleetView();
    }
  } catch (err) {
    projectListEl.textContent = `Error: ${err.message}`;
  }
}

// Renders project list with drag & drop + ✓ indicator
function renderProjectList() {
  projectListEl.innerHTML = '';

  if (!projects.length) {
    const li = document.createElement('li');
    li.textContent = 'No projects yet.';
    projectListEl.appendChild(li);
    return;
  }

  const ordered = [...projects];
  if (currentOrgId) {
    const order = loadProjectOrder(currentOrgId);
    ordered.sort((a, b) => {
      const ia = order.indexOf(a.id);
      const ib = order.indexOf(b.id);
      if (ia === -1 && ib === -1) return 0;
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
  }

  ordered.forEach((p) => {
    const li = document.createElement('li');
    li.dataset.id = p.id;
    li.draggable = true;
    if (p.id === currentProjectId) li.classList.add('selected');

    const nameSpan = document.createElement('span');
    nameSpan.classList.add('project-name-text');
    nameSpan.textContent = p.name;
    li.appendChild(nameSpan);

    if (projectCompletion[p.id]) {
      const checkSpan = document.createElement('span');
      checkSpan.textContent = ' ✓';
      checkSpan.classList.add('project-done-check');
      li.appendChild(checkSpan);
      li.classList.add('project-done');
    }

    li.addEventListener('click', async () => {
      // ignore click if we're dragging
      if (li.classList.contains('dragging') || li.classList.contains('dragging-project')) return;
      setCurrentProjectId(p.id);
      renderProjectList();
      await loadBoard(currentProjectId);
    });

    // ✅ Add both a generic "dragging" class (used by logic)
    //    and "dragging-project" (used by your CSS)
    li.addEventListener('dragstart', () => {
      li.classList.add('dragging', 'dragging-project');
    });

    li.addEventListener('dragend', () => {
      li.classList.remove('dragging', 'dragging-project');
      saveProjectOrder(currentOrgId);
    });

    projectListEl.appendChild(li);
  });

  if (!projectListDnDInitialized) {
    projectListEl.addEventListener('dragover', (e) => {
      e.preventDefault();
      const dragging = projectListEl.querySelector('li.dragging');
      if (!dragging) return;

      const afterElement = getProjectAfterElement(projectListEl, e.clientY);
      if (!afterElement) {
        projectListEl.appendChild(dragging);
      } else {
        projectListEl.insertBefore(dragging, afterElement);
      }
    });

    projectListDnDInitialized = true;
  }
}

btnNewProject.onclick = async () => {
  if (!currentOrgId) {
    alert('Select an organization first.');
    return;
  }

  const name = prompt('Project name:');
  if (!name) return;

  const description = prompt('Project description (optional):') || '';

  try {
    const res = await fetch(
      `${API_BASE_URL}/api/orgs/${currentOrgId}/projects`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders()
        },
        body: JSON.stringify({ name, description })
      }
    );

    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.error || 'Failed to create project');

    projects.unshift(data.project);
    setCurrentProjectId(data.project.id);
    projectCompletion[data.project.id] = false;

    renderProjectList();
    await loadBoard(currentProjectId);
    if (currentView === 'bi') loadBiDashboard();
    if (currentView === 'radar') loadRadarSnapshot();
  } catch (err) {
    alert(err.message);
  }
};

async function loadActivity(orgId) {
  activityListEl.innerHTML = '';

  try {
    const res = await fetch(
      `${API_BASE_URL}/api/orgs/${orgId}/activity`,
      { headers: authHeaders() }
    );

    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.error || 'Failed to load activity');

    const acts = data.activities || [];
    if (!acts.length) {
      const li = document.createElement('li');
      li.textContent = 'No recent activity.';
      activityListEl.appendChild(li);
      return;
    }

    acts.forEach((a) => {
      const li = document.createElement('li');
      const ts = new Date(a.created_at).toLocaleString();
      const actor = a.actor_name || 'System';
      li.textContent = `[${ts}] ${actor}: ${a.type}`;
      activityListEl.appendChild(li);
    });
  } catch (err) {
    const li = document.createElement('li');
    li.textContent = `Error: ${err.message}`;
    activityListEl.appendChild(li);
  }
}

/* ============================================================
   BI DASHBOARD (PROJECT OVERVIEW)
   ============================================================ */

async function loadBiDashboard() {
  if (!currentOrgId) {
    biMeta.textContent = 'Select an organization first.';
    if (biChart) biChart.destroy();
    if (biTaskChart) biTaskChart.destroy();
    return;
  }

  biMeta.textContent = 'Loading insights...';
  biTaskChartArea.classList.add('hidden');

  try {
    const res = await fetch(
      `${API_BASE_URL}/api/orgs/${currentOrgId}/bi-summary`,
      { headers: authHeaders() }
    );

    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.error || 'Failed to load BI summary');

    const summary = data.projects || [];
    if (!summary.length) {
      biMeta.textContent = 'No projects.';
      if (biChart) biChart.destroy();
      if (biTaskChart) biTaskChart.destroy();
      projectCompletion = {};
      renderProjectList();
      return;
    }

    projectCompletion = {};
    summary.forEach((p) => {
      const total =
        (p.in_progress || 0) + (p.review || 0) + (p.complete || 0);
      projectCompletion[p.project_id] = total > 0 && p.complete === total;
    });
    renderProjectList();

    const labels = summary.map((p) => p.project_name);
    const inProgressData = summary.map((p) => p.in_progress || 0);
    const reviewData = summary.map((p) => p.review || 0);
    const completeData = summary.map((p) => p.complete || 0);

    if (biChart) biChart.destroy();
    const ctx = biChartCanvas.getContext('2d');

    biChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'In Progress',
            data: inProgressData,
            backgroundColor: 'rgba(59,130,246,0.8)'
          },
          {
            label: 'Review',
            data: reviewData,
            backgroundColor: 'rgba(234,179,8,0.8)'
          },
          {
            label: 'Complete',
            data: completeData,
            backgroundColor: 'rgba(34,197,94,0.8)'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } },
        plugins: {
          legend: { position: 'bottom' },
          tooltip: {
            callbacks: {
              afterBody(ctx) {
                const idx = ctx[0].dataIndex;
                const proj = summary[idx];
                const owners = proj.assignees?.length
                  ? `Owners: ${proj.assignees.join(', ')}`
                  : 'Owners: (none)';
                const deadline =
                  proj.days_left != null
                    ? `Due soonest in ${proj.days_left} day(s)`
                    : 'No future deadlines recorded';
                return [owners, deadline];
              }
            }
          }
        },
        onClick: async (_, elements) => {
          if (!elements.length) return;
          const idx = elements[0].index;
          await loadBiTaskDrilldown(
            summary[idx].project_id,
            summary[idx].project_name
          );
        }
      }
    });

    biMeta.textContent = 'Click a project bar to see its tasks.';
  } catch (err) {
    biMeta.textContent = `Error: ${err.message}`;
  }
}

/* ============================================================
   BI TASK DRILLDOWN CHART
   ============================================================ */

async function loadBiTaskDrilldown(projectId, projectName) {
  biTaskChartArea.classList.remove('hidden');
  biTaskChartTitle.textContent = `Tasks – ${projectName}`;

  try {
    const res = await fetch(
      `${API_BASE_URL}/api/projects/${projectId}/board`,
      { headers: authHeaders() }
    );

    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.error || 'Failed to load project tasks');

    const tasks = data.tasks || [];
    const members = data.members || [];

    const labels = tasks.map((t) => t.title);
    const daysLeft = tasks.map((t) => {
      if (!t.due_date) return null;
      const due = new Date(t.due_date);
      return Math.ceil((due - new Date()) / (1000 * 60 * 60 * 24));
    });

    if (biTaskChart) biTaskChart.destroy();
    const ctx = biTaskChartCanvas.getContext('2d');

    biTaskChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Days Left',
            data: daysLeft,
            backgroundColor: 'rgba(99,102,241,0.8)'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          tooltip: {
            callbacks: {
              afterBody(c) {
                const t = tasks[c[0].dataIndex];
                const member =
                  members.find((m) => m.id === t.assigned_to) || null;
                return [
                  `Due: ${t.due_date ?? 'N/A'}`,
                  `Priority: ${t.priority}`,
                  `Assigned: ${member ? member.name : 'None'}`
                ];
              }
            }
          }
        }
      }
    });
  } catch (err) {
    biMeta.textContent = `Error: ${err.message}`;
  }
}

/* ============================================================
   XYMZ.Fleet – Team / ownership view
   ============================================================ */

function renderFleetView() {
  if (!fleetListEl) return;

  fleetListEl.innerHTML = '';

  const members = boardState.members || [];
  const tasks = boardState.tasks || [];

  // Metrics defaults
  if (fleetTotalCountEl) fleetTotalCountEl.textContent = '–';
  if (fleetProjectCountEl) fleetProjectCountEl.textContent = '–';
  if (fleetTasksPerPersonEl) fleetTasksPerPersonEl.textContent = '–';

  if (!boardState.project || !currentOrgId) {
    const li = document.createElement('li');
    li.textContent = 'Select a project to see your team.';
    fleetListEl.appendChild(li);

    if (fleetFocusTextEl) {
      fleetFocusTextEl.textContent =
        'Once hooked to data, this panel will highlight who is overloaded, who is free for new work, and suggested rebalancing moves.';
    }
    return;
  }

  const totalMembers = members.length;
  const totalTasks = tasks.length;

  const tasksPerPerson =
    totalMembers > 0 ? (totalTasks / totalMembers).toFixed(1) : '0.0';

  if (fleetTotalCountEl) fleetTotalCountEl.textContent = String(totalMembers);
  if (fleetProjectCountEl) {
    const projectCount = projects.filter((p) => p.org_id === currentOrgId).length || projects.length || 1;
    fleetProjectCountEl.textContent = String(projectCount);
  }
  if (fleetTasksPerPersonEl) fleetTasksPerPersonEl.textContent = tasksPerPerson;

  if (!members.length) {
    const li = document.createElement('li');
    li.textContent = 'No members in this workspace yet.';
    fleetListEl.appendChild(li);
  } else {
    const doneColumnIds = boardState.columns
      .filter((c) => /done|complete/i.test(c.name || ''))
      .map((c) => c.id);

    members.forEach((m) => {
      const memberTasks = tasks.filter((t) => t.assigned_to === m.id);
      const activeTasks = memberTasks.filter(
        (t) => !doneColumnIds.includes(t.column_id)
      );
      const doneTasks = memberTasks.filter((t) =>
        doneColumnIds.includes(t.column_id)
      );
      const highPriority = memberTasks.filter((t) => t.priority === 'high');

      const li = document.createElement('li');

      const nameDiv = document.createElement('div');
      nameDiv.classList.add('fleet-name');
      nameDiv.textContent = m.name || m.email || 'Unknown member';

      const metaDiv = document.createElement('div');
      metaDiv.classList.add('fleet-meta');
      const email = m.email ? ` • ${m.email}` : '';
      metaDiv.textContent = `${memberTasks.length} task(s) • ${activeTasks.length} active • ${doneTasks.length} done • ${highPriority.length} high-priority${email}`;

      li.appendChild(nameDiv);
      li.appendChild(metaDiv);
      fleetListEl.appendChild(li);
    });
  }

  if (fleetFocusTextEl) {
    fleetFocusTextEl.textContent =
      `In this project, ${totalMembers || 'no'} member(s) are sharing ${totalTasks || 'no'} task(s), for an average of ${tasksPerPerson} tasks per person. As you assign more work, this panel will surface who is overloaded and who has room for new work.`;
  }
}

/* ============================================================
   XYMZ.Radar – Portfolio snapshot + click-through
   ============================================================ */

/**
 * When you click a Radar item, jump into Ops.
 * If taskId is provided, open that specific task.
 */
async function handleRadarClick(projectId, taskId = null) {
  if (!projectId) return;

  // Set current project and switch to Ops
  setCurrentProjectId(projectId);
  setActiveView('ops');

  // Load the board for that project
  await loadBoard(projectId);

  // If we want a specific task, open it and scroll into view
  if (taskId) {
    const task = boardState.tasks.find((t) => t.id === taskId);
    if (task) {
      selectedTaskId = taskId;
      renderTaskDetail(taskId);

      const card = boardEl.querySelector(
        `.task-card[data-task-id="${taskId}"]`
      );
      if (card) {
        card.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
          inline: 'center'
        });
      }
    }
  }
}

async function loadRadarSnapshot() {
  if (!radarOverdueList || !radarProjectsList || !radarUpcomingList) return;

  radarOverdueList.innerHTML = '';
  radarProjectsList.innerHTML = '';
  radarUpcomingList.innerHTML = '';

  if (!currentOrgId) {
    const msg = document.createElement('li');
    msg.textContent = 'Select an organization to see portfolio radar.';
    radarOverdueList.appendChild(msg);
    return;
  }

  try {
    const res = await fetch(
      `${API_BASE_URL}/api/orgs/${currentOrgId}/bi-summary`,
      { headers: authHeaders() }
    );
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.error || 'Failed to load portfolio data');

    const summary = data.projects || [];
    if (!summary.length) {
      const msg = document.createElement('li');
      msg.textContent = 'No projects in this organization yet.';
      radarOverdueList.appendChild(msg);
      return;
    }

    // ---------- Overdue Tasks (across projects) ----------
    const overdueItems = [];

    await Promise.all(
      summary.map(async (p) => {
        try {
          const tRes = await fetch(
            `${API_BASE_URL}/api/projects/${p.project_id}/bi-tasks`,
            { headers: authHeaders() }
          );
          const tData = await safeJson(tRes);
          if (!tRes.ok) return;

          (tData.tasks || []).forEach((t) => {
            if (typeof t.days_left === 'number' && t.days_left < 0) {
              overdueItems.push({
                projectName: p.project_name,
                projectId: p.project_id,
                taskTitle: t.title,
                taskId: t.id,
                daysLeft: t.days_left
              });
            }
          });
        } catch (err) {
          console.error('Radar bi-tasks error:', err.message);
        }
      })
    );

    overdueItems.sort((a, b) => a.daysLeft - b.daysLeft);

    if (overdueItems.length) {
      overdueItems.slice(0, 6).forEach((item) => {
        const li = document.createElement('li');
        const daysOverdue = Math.abs(item.daysLeft);
        li.textContent = `${item.taskTitle} (${item.projectName}) - overdue by ${daysOverdue} day(s)`;

        li.classList.add('radar-clickable');
        li.style.cursor = 'pointer';
        li.addEventListener('click', () =>
          handleRadarClick(item.projectId, item.taskId)
        );

        radarOverdueList.appendChild(li);
      });
    } else {
      const li = document.createElement('li');
      li.textContent = 'No overdue tasks 😎🥳';
      radarOverdueList.appendChild(li);
    }

    // ---------- At-Risk Projects ----------
    const atRisk = [...summary].sort((a, b) => {
      const activeA = (a.in_progress || 0) + (a.review || 0);
      const activeB = (b.in_progress || 0) + (b.review || 0);
      if (activeB !== activeA) return activeB - activeA;
      const dlA = a.days_left ?? 9999;
      const dlB = b.days_left ?? 9999;
      return dlA - dlB;
    });

    atRisk.slice(0, 5).forEach((p) => {
      const totalActive = (p.in_progress || 0) + (p.review || 0);
      const li = document.createElement('li');
      const dl =
        p.days_left != null
          ? p.days_left === 0
            ? 'due today'
            : `soonest due in ${p.days_left} day(s)`
          : 'no upcoming deadlines recorded';
      li.textContent = `${p.project_name}: ${totalActive} active task(s), ${dl}`;

      li.classList.add('radar-clickable');
      li.style.cursor = 'pointer';
      li.addEventListener('click', () =>
        handleRadarClick(p.project_id, null)
      );

      radarProjectsList.appendChild(li);
    });

    // ---------- Upcoming Deadlines ----------
    const withDeadline = summary.filter(
      (p) => typeof p.days_left === 'number'
    );

    withDeadline.sort((a, b) => (a.days_left ?? 9999) - (b.days_left ?? 9999));

    if (withDeadline.length) {
      withDeadline.slice(0, 5).forEach((p) => {
        const li = document.createElement('li');
        if (p.days_left === 0) {
          li.textContent = `${p.project_name}: due today`;
        } else if (p.days_left > 0) {
          li.textContent = `${p.project_name}: due in ${p.days_left} day(s)`;
        } else {
          li.textContent = `${p.project_name}: timeline not set`;
        }

        li.classList.add('radar-clickable');
        li.style.cursor = 'pointer';
        li.addEventListener('click', () =>
          handleRadarClick(p.project_id, null)
        );

        radarUpcomingList.appendChild(li);
      });
    } else {
      const li = document.createElement('li');
      li.textContent = 'No upcoming deadlines recorded.';
      radarUpcomingList.appendChild(li);
    }
  } catch (err) {
    const li = document.createElement('li');
    li.textContent = `Error: ${err.message}`;
    radarOverdueList.appendChild(li);
  }
}

/* ============================================================
   KANBAN BOARD LOADING
   ============================================================ */

async function loadBoard(projectId) {
  if (!projectId) {
    boardState = { project: null, columns: [], tasks: [], members: [] };
    boardProjectNameEl.textContent = 'Select a project to see board.';
    boardProjectDescEl.textContent = '';
    renderBoard();
    renderTaskDetail(null);
    renderFleetView();
    return;
  }

  // keep "last project" in sync any time we load a board
  setCurrentProjectId(projectId);

  boardProjectNameEl.textContent = 'Loading...';
  boardProjectDescEl.textContent = '';
  boardEl.innerHTML = '';

  try {
    const res = await fetch(
      `${API_BASE_URL}/api/projects/${projectId}/board`,
      {
        headers: authHeaders()
      }
    );

    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.error || 'Failed to load board');

    boardState = {
      project: data.project,
      columns: data.columns || [],
      tasks: data.tasks || [],
      members: data.members || []
    };

    boardProjectNameEl.textContent = data.project.name;
    boardProjectDescEl.textContent = data.project.description || '';

    const doneColumnIds = boardState.columns
      .filter((c) => /done|complete/i.test(c.name || ''))
      .map((c) => c.id);
    const totalTasks = boardState.tasks.length;
    const completeTasks = boardState.tasks.filter((t) =>
      doneColumnIds.includes(t.column_id)
    ).length;
    const allDone = totalTasks > 0 && completeTasks === totalTasks;
    if (boardState.project) {
      projectCompletion[boardState.project.id] = allDone;
    }

    renderProjectList();
    renderBoard();
    renderTaskDetail(null);
    renderFleetView();
  } catch (err) {
    boardProjectNameEl.textContent = 'Error loading project';
    boardProjectDescEl.textContent = err.message;
  }
}

function tasksInColumn(columnId) {
  return boardState.tasks
    .filter((t) => t.column_id === columnId)
    .sort((a, b) => a.position - b.position);
}

function renderBoard() {
  boardEl.innerHTML = '';

  if (!boardState.project) {
    const div = document.createElement('div');
    div.textContent = 'Select a project to see board.';
    boardEl.appendChild(div);
    return;
  }

  boardState.columns.forEach((col) => {
    const colDiv = document.createElement('div');
    colDiv.classList.add('column');
    colDiv.dataset.columnId = col.id;

    const header = document.createElement('div');
    header.classList.add('column-header');

    const title = document.createElement('div');
    title.classList.add('column-title');
    title.textContent = col.name;

    const count = document.createElement('div');
    count.classList.add('column-count');
    const colTasks = tasksInColumn(col.id);
    count.textContent = `${colTasks.length} task(s)`;

    header.appendChild(title);
    header.appendChild(count);

    const body = document.createElement('div');
    body.classList.add('column-body');
    body.dataset.columnId = col.id;

    body.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
    body.addEventListener('drop', handleColumnDrop);

    colTasks.forEach((task) => {
      const card = renderTaskCard(task);
      body.appendChild(card);
    });

    colDiv.appendChild(header);
    colDiv.appendChild(body);
    boardEl.appendChild(colDiv);
  });
}

function renderTaskCard(task) {
  const card = document.createElement('div');
  card.classList.add('task-card');
  card.draggable = true;
  card.dataset.taskId = task.id;
  card.dataset.columnId = task.column_id;

  card.addEventListener('dragstart', handleTaskDragStart);
  card.addEventListener('dragend', handleTaskDragEnd);
  card.addEventListener('click', () => {
    selectedTaskId = task.id;
    renderTaskDetail(task.id);
  });

  const title = document.createElement('div');
  title.classList.add('task-title');
  title.textContent = task.title;

  const meta = document.createElement('div');
  meta.classList.add('task-meta');

  const prioritySpan = document.createElement('span');
  prioritySpan.classList.add('priority-pill');
  prioritySpan.textContent = task.priority || 'medium';
  if (task.priority === 'low') prioritySpan.classList.add('priority-low');
  else if (task.priority === 'high') prioritySpan.classList.add('priority-high');
  else prioritySpan.classList.add('priority-medium');

  const dueSpan = document.createElement('span');
  if (task.due_date) {
    dueSpan.textContent = new Date(task.due_date).toLocaleDateString();
  }

  meta.appendChild(prioritySpan);
  meta.appendChild(dueSpan);

  card.appendChild(title);
  card.appendChild(meta);

  return card;
}

/* ============================================================
   DRAG & DROP
   ============================================================ */

function handleTaskDragStart(e) {
  e.stopPropagation();
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move';
  }

  const card = e.currentTarget;
  dragTaskId = Number(card.dataset.taskId);
  dragFromColumnId = Number(card.dataset.columnId);
  card.classList.add('dragging');
}

function handleTaskDragEnd(e) {
  e.stopPropagation();
  e.currentTarget.classList.remove('dragging');
  dragTaskId = null;
  dragFromColumnId = null;
}

async function handleColumnDrop(e) {
  e.preventDefault();
  e.stopPropagation();
  if (!dragTaskId) return;

  const columnId = Number(e.currentTarget.dataset.columnId);

  try {
    const res = await fetch(
      `${API_BASE_URL}/api/tasks/${dragTaskId}/move`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders()
        },
        body: JSON.stringify({ to_column_id: columnId })
      }
    );

    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.error || 'Failed to move task');

    // Reload board data, but stay on same org/project and view
    await loadBoard(boardState.project.id);
    if (currentView !== 'ops') {
      setActiveView('ops');
    }
  } catch (err) {
    alert(err.message);
  }
}

/* ============================================================
   ADD COLUMNS & TASKS
   ============================================================ */

btnAddColumn.onclick = async () => {
  if (!boardState.project) return alert('Select a project first.');

  const name = prompt('Column name:');
  if (!name) return;

  try {
    const res = await fetch(
      `${API_BASE_URL}/api/projects/${boardState.project.id}/columns`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders()
        },
        body: JSON.stringify({ name })
      }
    );

    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.error || 'Failed to create column');

    await loadBoard(boardState.project.id);
  } catch (err) {
    alert(err.message);
  }
};

btnAddTask.onclick = async () => {
  if (!boardState.project) return alert('Select a project first.');
  if (!boardState.columns.length) return alert('Add a column first.');

  const title = prompt('Task title:');
  if (!title) return;

  const columnId = boardState.columns[0].id;

  try {
    const res = await fetch(
      `${API_BASE_URL}/api/projects/${boardState.project.id}/tasks`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders()
        },
        body: JSON.stringify({ title, column_id: columnId })
      }
    );

    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.error || 'Failed to create task');

    await loadBoard(boardState.project.id);
  } catch (err) {
    alert(err.message);
  }
};

/* ============================================================
   TASK DETAIL PANEL
   ============================================================ */

function renderTaskDetail(taskId) {
  if (!taskId) {
    taskDetailPanel.classList.add('hidden');
    selectedTaskId = null;
    return;
  }

  const task = boardState.tasks.find((t) => t.id === taskId);
  if (!task) {
    taskDetailPanel.classList.add('hidden');
    selectedTaskId = null;
    return;
  }

  selectedTaskId = taskId;
  taskDetailPanel.classList.remove('hidden');

  detailTitleEl.textContent = task.title;

  const col = boardState.columns.find((c) => c.id === task.column_id);
  const colName = col ? col.name : 'N/A';
  detailMetaEl.textContent = `Column: ${colName} • Priority: ${task.priority}`;

  detailDescriptionEl.textContent = task.description || '';

  detailInputTitle.value = task.title;
  detailInputDesc.value = task.description || '';
  detailInputPriority.value = task.priority || 'medium';
  detailInputDue.value = task.due_date || '';

  detailInputAssignee.innerHTML = '<option value="">Unassigned</option>';
  boardState.members.forEach((m) => {
    const opt = document.createElement('option');
    opt.value = m.id;
    opt.textContent = `${m.name} (${m.email})`;
    if (m.id === task.assigned_to) opt.selected = true;
    detailInputAssignee.appendChild(opt);
  });

  detailStatus.textContent = '';

  loadComments(taskId);
}

btnCloseDetail.onclick = () => renderTaskDetail(null);

/* ============================================================
   SAVE TASK (BOTTOM BUTTON)
   ============================================================ */

detailSaveBtn.onclick = async () => {
  if (!selectedTaskId) return;
  detailStatus.textContent = 'Saving...';

  const payload = {
    title: detailInputTitle.value.trim(),
    description: detailInputDesc.value.trim(),
    priority: detailInputPriority.value,
    due_date: detailInputDue.value || null,
    assigned_to: detailInputAssignee.value || null
  };

  try {
    const res = await fetch(
      `${API_BASE_URL}/api/tasks/${selectedTaskId}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders()
        },
        body: JSON.stringify(payload)
      }
    );

    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.error || 'Failed to update task');

    const i = boardState.tasks.findIndex((t) => t.id === selectedTaskId);
    if (i !== -1) boardState.tasks[i] = data.task;

    detailStatus.textContent = 'Saved.';
    renderBoard();
    renderTaskDetail(selectedTaskId);
    renderFleetView();
  } catch (err) {
    detailStatus.textContent = `Error: ${err.message}`;
  }
};

/* ============================================================
   DELETE TASK
   ============================================================ */

detailDeleteTaskBtn.onclick = async () => {
  if (!selectedTaskId) return;
  if (!confirm('Delete this task permanently?')) return;

  try {
    const res = await fetch(
      `${API_BASE_URL}/api/tasks/${selectedTaskId}`,
      {
        method: 'DELETE',
        headers: authHeaders()
      }
    );

    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.error || 'Failed to delete task');

    await loadBoard(boardState.project.id);
    renderTaskDetail(null);
  } catch (err) {
    alert(err.message);
  }
};

/* ============================================================
   DELETE PROJECT
   ============================================================ */

if (btnDeleteProject) {
  btnDeleteProject.onclick = async () => {
    if (!currentProjectId) return alert('Select a project first.');
    if (!confirm('Delete this project and ALL its tasks?')) return;

    try {
      const res = await fetch(
        `${API_BASE_URL}/api/projects/${currentProjectId}`,
        {
          method: 'DELETE',
          headers: authHeaders()
        }
      );

      const data = await safeJson(res);
      if (!res.ok) throw new Error(data.error || 'Failed to delete project');

      projects = projects.filter((p) => p.id !== currentProjectId);
      delete projectCompletion[currentProjectId];

      if (projects.length) {
        setCurrentProjectId(projects[0].id);
      } else {
        setCurrentProjectId(null);
        boardState = {
          project: null,
          columns: [],
          tasks: [],
          members: []
        };
        renderBoard();
        renderTaskDetail(null);
        renderFleetView();
      }

      renderProjectList();
      if (currentProjectId) {
        await loadBoard(currentProjectId);
      }

      if (currentView === 'bi') loadBiDashboard();
      if (currentView === 'radar') loadRadarSnapshot();
    } catch (err) {
      alert(err.message);
    }
  };
}

/* ============================================================
   COMMENTS
   ============================================================ */

async function loadComments(taskId) {
  detailCommentsList.innerHTML = '';

  try {
    const res = await fetch(
      `${API_BASE_URL}/api/tasks/${taskId}/comments`,
      { headers: authHeaders() }
    );

    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.error || 'Failed to load comments');

    const comments = data.comments || [];
    if (!comments.length) {
      const li = document.createElement('li');
      li.textContent = 'No comments yet.';
      detailCommentsList.appendChild(li);
      return;
    }

    comments.forEach((c) => {
      const li = document.createElement('li');
      const ts = new Date(c.created_at).toLocaleString();
      li.innerHTML = `<strong>${c.author_name}</strong>
        <span class="muted">(${ts})</span><br/>${c.body}`;
      detailCommentsList.appendChild(li);
    });
  } catch (err) {
    const li = document.createElement('li');
    li.textContent = `Error: ${err.message}`;
    detailCommentsList.appendChild(li);
  }
}

detailCommentForm.onsubmit = async (e) => {
  e.preventDefault();
  if (!selectedTaskId) return;

  const body = detailCommentBody.value.trim();
  if (!body) return;

  try {
    const res = await fetch(
      `${API_BASE_URL}/api/tasks/${selectedTaskId}/comments`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders()
        },
        body: JSON.stringify({ body })
      }
    );

    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.error || 'Failed to add comment');

    detailCommentBody.value = '';
    loadComments(selectedTaskId);
  } catch (err) {
    alert(err.message);
  }
};

/* ============================================================
   GLOBAL DRAG/DROP SAFETY
   (Prevents browser navigation / page reload on drop)
   ============================================================ */

['dragenter', 'dragover', 'dragleave', 'drop'].forEach((eventName) => {
  const handler = (e) => {
    // Only globally block if the target isn't one of our draggable columns/cards
    if (!(e.target && e.target.closest && e.target.closest('.column-body, .task-card, #project-list'))) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  window.addEventListener(eventName, handler, false);
  document.addEventListener(eventName, handler, false);
  if (document.body) {
    document.body.addEventListener(eventName, handler, false);
  }
});

/* ============================================================
   INIT
   ============================================================ */

setBrandLoggedOut();
loadSession();
