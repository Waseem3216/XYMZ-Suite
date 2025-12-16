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

// Attachments
const detailAttachmentsList = document.getElementById('detail-attachments');
const detailAttachmentForm = document.getElementById('detail-attachment-form');
const detailAttachmentFile = document.getElementById('detail-attachment-file');
const detailAttachmentStatus = document.getElementById('detail-attachment-status');

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

// ✅ BI download buttons
const btnBiDownloadPdf = document.getElementById('btn-bi-download-pdf');
const btnBiDownloadSvg = document.getElementById('btn-bi-download-svg');

// BI Task Drilldown
const biTaskChartArea = document.getElementById('bi-task-chart-area');
const biTaskChartTitle = document.getElementById('bi-task-chart-title');
const biTaskChartCanvas = document.getElementById('bi-task-chart');
let biTaskChart = null;

// NEW: keep latest BI datasets for report exports
let lastBiSummary = []; // from /bi-summary
let lastBiDrilldownTasks = []; // from /projects/:id/board for drilldown
let lastBiDrilldownProjectName = ''; // for better report header

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

// Touch-drag state (mobile)
let touchTaskDragState = null;
let touchProjectDragState = null;

let currentView = 'suite';

// projectCompletion[projectId] = true/false
let projectCompletion = {};
let projectListDnDInitialized = false;

/* ============================================================
   HELPERS
   ============================================================ */

function isTouchLikeDevice() {
  return (
    'ontouchstart' in window ||
    (navigator && typeof navigator.maxTouchPoints === 'number' && navigator.maxTouchPoints > 0) ||
    (navigator && typeof navigator.msMaxTouchPoints === 'number' && navigator.msMaxTouchPoints > 0)
  );
}

function setAuthStatus(msg) {
  if (authStatus) authStatus.textContent = msg || '';
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

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function formatDateShort(isoLike) {
  if (!isoLike) return 'N/A';
  const d = new Date(isoLike);
  if (Number.isNaN(d.getTime())) return 'N/A';
  return d.toLocaleDateString();
}

function computeDaysLeft(isoLike) {
  if (!isoLike) return null;
  const due = new Date(isoLike);
  if (Number.isNaN(due.getTime())) return null;
  const today = new Date();
  // remove time-of-day effect
  const dueMid = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  const todayMid = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.ceil((dueMid - todayMid) / (1000 * 60 * 60 * 24));
}

function safeTextForSvg(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/* ============================================================
   BI EXPORT HELPERS (REPORT-STYLE PDF + SVG)
   ============================================================ */

function getActiveBiCanvas() {
  // If drilldown is visible + has a chart, export that.
  const drilldownVisible =
    biTaskChartArea && !biTaskChartArea.classList.contains('hidden');
  if (drilldownVisible && biTaskChart && biTaskChartCanvas) return biTaskChartCanvas;

  // Otherwise export the main BI overview chart.
  if (biChart && biChartCanvas) return biChartCanvas;

  return null;
}

function getActiveBiFilenameBase() {
  const drilldownVisible =
    biTaskChartArea && !biTaskChartArea.classList.contains('hidden');

  if (drilldownVisible) {
    const title =
      biTaskChartTitle && biTaskChartTitle.textContent
        ? biTaskChartTitle.textContent
        : 'XYMZ_BI_Task_Drilldown';
    return title.replace(/[^\w\-]+/g, '_');
  }
  return 'XYMZ_BI_Project_Insights';
}

function setBiDownloadButtonsEnabled(enabled) {
  if (btnBiDownloadPdf) btnBiDownloadPdf.disabled = !enabled;
  if (btnBiDownloadSvg) btnBiDownloadSvg.disabled = !enabled;
}

function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

function canvasToPngDataUrl(canvas) {
  return canvas.toDataURL('image/png', 1.0);
}

/**
 * Builds a "report packet" for either:
 * - Project overview chart
 * - Task drilldown chart
 */
function buildBiReportPacket() {
  const drilldownVisible =
    biTaskChartArea && !biTaskChartArea.classList.contains('hidden') && biTaskChart;

  const generatedAt = new Date().toLocaleString();
  const orgName =
    (orgs.find((o) => o.id === currentOrgId)?.name) ||
    (currentOrgId ? `Org #${currentOrgId}` : 'No Organization');

  if (!drilldownVisible) {
    // ---------- PROJECT OVERVIEW ----------
    const summary = Array.isArray(lastBiSummary) ? lastBiSummary : [];

    let totalInProgress = 0;
    let totalReview = 0;
    let totalDone = 0;

    summary.forEach((p) => {
      totalInProgress += (p.in_progress || 0);
      totalReview += (p.review || 0);
      totalDone += (p.complete || 0);
    });

    const total = totalInProgress + totalReview + totalDone;

    // Identify bottleneck: review-heavy or in-progress-heavy
    const reviewShare = total ? Math.round((totalReview / total) * 100) : 0;
    const doneShare = total ? Math.round((totalDone / total) * 100) : 0;

    // Top “at risk” projects: lots of active + soon deadline
    const ranked = [...summary].sort((a, b) => {
      const activeA = (a.in_progress || 0) + (a.review || 0);
      const activeB = (b.in_progress || 0) + (b.review || 0);
      if (activeB !== activeA) return activeB - activeA;
      const dlA = a.days_left ?? 9999;
      const dlB = b.days_left ?? 9999;
      return dlA - dlB;
    });

    const topRisks = ranked.slice(0, 3).map((p) => {
      const active = (p.in_progress || 0) + (p.review || 0);
      const dl =
        p.days_left != null
          ? p.days_left === 0
            ? 'due today'
            : `due in ${p.days_left} day(s)`
          : 'no deadline';
      return `${p.project_name}: ${active} active, ${dl}`;
    });

    const insights = [];

    insights.push(`Organization: ${orgName}`);
    insights.push(`Generated: ${generatedAt}`);
    insights.push(`Projects included: ${summary.length}`);

    insights.push(`Total tasks tracked: ${total}`);
    insights.push(
      `In progress: ${totalInProgress} (${total ? Math.round((totalInProgress / total) * 100) : 0}%)`
    );
    insights.push(`In review: ${totalReview} (${reviewShare}%)`);
    insights.push(`Done: ${totalDone} (${doneShare}%)`);

    if (total > 0) {
      if (doneShare >= 70) {
        insights.push(`Delivery health: Strong completion pace`);
      } else if (doneShare >= 40) {
        insights.push(`Delivery health: Moderate progress, monitor flow`);
      } else {
        insights.push(`Delivery health: At risk, execution needs attention`);
      }

      if (reviewShare >= 35) {
        insights.push(`Signal: Review backlog (QA/approvals may be bottleneck)`);
      }

      const active = totalInProgress + totalReview;
      if (active > totalDone && totalDone > 0) {
        insights.push(`Signal: WIP higher than throughput (risk of piling work)`);
      }
      if (totalDone === 0 && total > 0) {
        insights.push(`Signal: No completed tasks yet (timeline risk)`);
      }
    } else {
      insights.push(`Note: No tasks recorded in BI yet`);
    }

    if (topRisks.length) {
      insights.push(`Top at-risk projects:`);
      topRisks.forEach((line) => insights.push(`- ${line}`));
    }

    return {
      kind: 'project_overview',
      title: 'XYMZ.BI Report - Project Portfolio',
      subtitle: `Organization: ${orgName}`,
      generatedAt,
      lines: insights
    };
  }

  // ---------- TASK DRILLDOWN ----------
  const title = biTaskChartTitle?.textContent || 'XYMZ.BI Report - Task Drilldown';
  const tasks = Array.isArray(lastBiDrilldownTasks) ? lastBiDrilldownTasks : [];

  // Resolve members list for assignee names (prefer current boardState members)
  const memberPool = (boardState && Array.isArray(boardState.members) ? boardState.members : []);

  const lines = [];
  lines.push(`Organization: ${orgName}`);
  lines.push(`Generated: ${generatedAt}`);
  if (lastBiDrilldownProjectName) lines.push(`Project: ${lastBiDrilldownProjectName}`);

  if (!tasks.length) {
    lines.push('No tasks found for this project.');
    return {
      kind: 'task_drilldown',
      title,
      subtitle: `Organization: ${orgName}`,
      generatedAt,
      lines
    };
  }

  // Basic rollups
  const dueTasks = tasks.filter((t) => !!t.due_date);
  const overdue = dueTasks.filter((t) => {
    const dl = computeDaysLeft(t.due_date);
    return typeof dl === 'number' && dl < 0;
  });

  const dueSoon = dueTasks.filter((t) => {
    const dl = computeDaysLeft(t.due_date);
    return typeof dl === 'number' && dl >= 0 && dl <= 3;
  });

  const high = tasks.filter((t) => (t.priority || '').toLowerCase() === 'high');

  lines.push(`Tasks: ${tasks.length}`);
  lines.push(`With due dates: ${dueTasks.length}`);
  lines.push(`Overdue: ${overdue.length}`);
  lines.push(`Due in 3 days or less: ${dueSoon.length}`);
  lines.push(`High priority: ${high.length}`);

  // Detailed per-task analysis lines
  lines.push('Task breakdown:');
  tasks.slice(0, 40).forEach((t) => {
    const due = t.due_date ? formatDateShort(t.due_date) : 'N/A';
    const dl = computeDaysLeft(t.due_date);
    const daysText =
      dl == null
        ? 'No due date'
        : dl < 0
        ? `Overdue ${Math.abs(dl)}d`
        : `${dl}d left`;

    const pr = (t.priority || 'medium').toLowerCase();
    const assignee =
      memberPool.find((m) => m.id === t.assigned_to)?.name ||
      memberPool.find((m) => m.id === t.assigned_to)?.email ||
      'Unassigned';

    lines.push(
      `• ${t.title} - Due: ${due} (${daysText}) - Priority: ${pr} - Assigned: ${assignee}`
    );
  });

  if (tasks.length > 40) {
    lines.push(`(Showing first 40 tasks - export limited for readability)`);
  }

  return {
    kind: 'task_drilldown',
    title,
    subtitle: `Organization: ${orgName}`,
    generatedAt,
    lines
  };
}

/**
 * Report-style PDF:
 * - header
 * - chart image
 * - analysis section
 */
function downloadActiveBiAsPdf() {
  const canvas = getActiveBiCanvas();
  if (!canvas) {
    alert('No chart available to export yet.');
    return;
  }

  // jsPDF UMD global
  const jspdf = window.jspdf;
  if (!jspdf || !jspdf.jsPDF) {
    alert('PDF export library failed to load (jsPDF). Check your index.html script tag.');
    return;
  }

  const packet = buildBiReportPacket();
  const filename = `${getActiveBiFilenameBase()}_Report.pdf`;

  // Use standard A4 so the PDF looks like a report
  const pdf = new jspdf.jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4'
  });

  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();

  const margin = 40;
  let y = 46;

  // Title
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(18);
  pdf.text(packet.title, margin, y);

  y += 20;
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(11);
  pdf.text(packet.subtitle, margin, y);

  y += 16;
  pdf.setFontSize(10);
  pdf.text(`Generated: ${packet.generatedAt}`, margin, y);

  // Divider
  y += 14;
  pdf.setDrawColor(220);
  pdf.line(margin, y, pageW - margin, y);

  // Chart image sizing
  const imgData = canvasToPngDataUrl(canvas);
  const imgMaxW = pageW - margin * 2;
  const imgMaxH = 280;

  // Keep aspect ratio based on canvas dimensions
  const ratio = canvas.width / canvas.height || 1;
  let imgW = imgMaxW;
  let imgH = imgW / ratio;
  if (imgH > imgMaxH) {
    imgH = imgMaxH;
    imgW = imgH * ratio;
  }

  y += 18;
  const imgX = margin + (imgMaxW - imgW) / 2;
  pdf.addImage(imgData, 'PNG', imgX, y, imgW, imgH);

  y += imgH + 20;

  // Analysis header
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(12);
  pdf.text('Analysis', margin, y);
  y += 14;

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);

  // Wrap text lines for PDF width
  const wrapWidth = pageW - margin * 2;
  const lineSpacing = 13;

  packet.lines.forEach((rawLine) => {
    const line = String(rawLine);
    const wrapped = pdf.splitTextToSize(line, wrapWidth);

    wrapped.forEach((wLine) => {
      if (y > pageH - margin) {
        pdf.addPage();
        y = margin;
      }
      pdf.text(wLine, margin, y);
      y += lineSpacing;
    });
  });

  pdf.save(filename);
}

/**
 * Report-style SVG:
 * - white page background
 * - title/subtitle/date
 * - analysis text
 * - embedded chart image
 */
function downloadActiveBiAsSvg() {
  const canvas = getActiveBiCanvas();
  if (!canvas) {
    alert('No chart available to export yet.');
    return;
  }

  const packet = buildBiReportPacket();
  const filename = `${getActiveBiFilenameBase()}_Report.svg`;

  const pngDataUrl = canvasToPngDataUrl(canvas);

  const pageW = 1240;
  const pageH = 1754;

  const margin = 70;

  // Header layout
  const headerTopY = 90;
  const titleY = headerTopY;
  const subtitleY = titleY + 56;
  const generatedY = subtitleY + 34;
  const dividerY = generatedY + 30;

  // ✅ Move chart BELOW the divider with padding
  const chartY = dividerY + 50;

  const title = safeTextForSvg(packet.title);
  const subtitle = safeTextForSvg(packet.subtitle);
  const generated = safeTextForSvg(`Generated: ${packet.generatedAt}`);

  const chartMaxW = pageW - margin * 2;
  const chartMaxH = 520;

  const ratio = canvas.width / canvas.height || 1;
  let chartW = chartMaxW;
  let chartH = chartW / ratio;
  if (chartH > chartMaxH) {
    chartH = chartMaxH;
    chartW = chartH * ratio;
  }

  const chartX = margin + (chartMaxW - chartW) / 2;

  // Analysis text area
  const analysisStartY = chartY + chartH + 80;
  const maxLines = 65;

  const lines = packet.lines.slice(0, maxLines).map((l) => safeTextForSvg(l));
  if (packet.lines.length > maxLines) {
    lines.push(safeTextForSvg(`(Showing first ${maxLines} lines)`));
  }

  const lineHeight = 26;

  const analysisTspans = lines
    .map((l, idx) => {
      const yy = analysisStartY + idx * lineHeight;
      return `<text x="${margin}" y="${yy}" font-family="Arial, Helvetica, sans-serif" font-size="20" fill="#111827">${l}</text>`;
    })
    .join('\n');

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${pageW}" height="${pageH}" viewBox="0 0 ${pageW} ${pageH}">
  <rect width="100%" height="100%" fill="#ffffff"/>

  <text x="${margin}" y="${titleY}" font-family="Arial, Helvetica, sans-serif" font-size="44" font-weight="700" fill="#0f172a">${title}</text>
  <text x="${margin}" y="${subtitleY}" font-family="Arial, Helvetica, sans-serif" font-size="24" fill="#334155">${subtitle}</text>
  <text x="${margin}" y="${generatedY}" font-family="Arial, Helvetica, sans-serif" font-size="20" fill="#64748b">${generated}</text>
  <line x1="${margin}" y1="${dividerY}" x2="${pageW - margin}" y2="${dividerY}" stroke="#e5e7eb" stroke-width="2"/>

  <rect x="${margin}" y="${chartY - 18}" width="${pageW - margin * 2}" height="${chartH + 36}" rx="18" fill="#ffffff" stroke="#e5e7eb" stroke-width="2"/>
  <image href="${pngDataUrl}" x="${chartX}" y="${chartY}" width="${chartW}" height="${chartH}" />

  <text x="${margin}" y="${analysisStartY - 30}" font-family="Arial, Helvetica, sans-serif" font-size="28" font-weight="700" fill="#0f172a">Analysis</text>
  ${analysisTspans}
</svg>
`.trim();

  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  downloadBlob(filename, blob);
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
  if (brandSubtitle) brandSubtitle.textContent = 'Sign in to access XYMZ.Suite.';
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
    brandSubtitle.textContent = 'Operational boards for shared client delivery.';
  } else if (view === 'bi') {
    brandTitle.textContent = 'XYMZ.BI';
    brandSubtitle.textContent = 'Project insights & portfolio intelligence.';
  } else {
    brandTitle.textContent = 'XYMZ.Suite';
    brandSubtitle.textContent = 'Shared workspaces for agencies & clients.';
  }
}

function setThemeForView(view) {
  const body = document.body;
  if (!body) return;

  body.classList.remove('theme-suite', 'theme-ops', 'theme-bi', 'theme-fleet', 'theme-radar');

  if (view === 'ops') body.classList.add('theme-ops');
  else if (view === 'bi') body.classList.add('theme-bi');
  else if (view === 'fleet') body.classList.add('theme-fleet');
  else if (view === 'radar') body.classList.add('theme-radar');
  else body.classList.add('theme-suite');
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
  } catch {
    // ignore storage errors
  }

  // Tabs
  suiteTabs.forEach((btn) => btn.classList.toggle('active', btn.dataset.view === view));

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
  if (view === 'bi') loadBiDashboard();
  else if (view === 'fleet') renderFleetView();
  else if (view === 'radar') loadRadarSnapshot();
}

/* ============================================================
   AUTH TABS
   ============================================================ */

if (tabLogin) {
  tabLogin.onclick = () => {
    tabLogin.classList.add('active');
    tabRegister.classList.remove('active');
    loginForm.classList.remove('hidden');
    registerForm.classList.add('hidden');
    setAuthStatus('');
  };
}

if (tabRegister) {
  tabRegister.onclick = () => {
    tabRegister.classList.add('active');
    tabLogin.classList.remove('active');
    registerForm.classList.remove('hidden');
    loginForm.classList.add('hidden');
    setAuthStatus('');
  };
}

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

if (loginForm) {
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
}

if (registerForm) {
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
}

if (logoutBtn) {
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

    if (authPanel) authPanel.classList.remove('hidden');
    if (appPanel) appPanel.classList.add('hidden');
    logoutBtn.classList.add('hidden');
    if (orgSwitcher) orgSwitcher.classList.add('hidden');

    if (userNameSpan) userNameSpan.textContent = '';
    if (userEmailSpan) userEmailSpan.textContent = '';

    if (biChart) biChart.destroy();
    if (biTaskChart) biTaskChart.destroy();

    // disable exports after logout
    setBiDownloadButtonsEnabled(false);

    document.body.classList.remove('theme-suite', 'theme-ops', 'theme-bi', 'theme-fleet', 'theme-radar');

    // Just start on the main Suite view
    setActiveView('suite');
    setBrandLoggedIn();
  };
}

/* ============================================================
   RESET PASSWORD / RESET TOKEN HANDLERS
   ============================================================ */

if (linkResetPassword) {
  linkResetPassword.onclick = async () => {
    const email = (prompt('Enter your email address:') || '').trim();
    if (!email) return;

    try {
      const qRes = await fetch(
        `${API_BASE_URL}/api/auth/security-question?email=${encodeURIComponent(email)}`
      );
      const qData = await safeJson(qRes);
      if (!qRes.ok) throw new Error(qData.error || 'Could not find that email.');

      const answer = (prompt(
        `Security question:\n${qData.security_question}\n\nEnter your answer:`
      ) || '').trim();
      if (!answer) return;

      const newPassword = (prompt('Enter your new password (minimum 6 characters):') || '').trim();
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

      alert(`Organization token updated successfully.\n\nNew token: ${data.join_token}`);
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
    if (authPanel) authPanel.classList.remove('hidden');
    if (appPanel) appPanel.classList.add('hidden');
    if (logoutBtn) logoutBtn.classList.add('hidden');
    if (orgSwitcher) orgSwitcher.classList.add('hidden');

    // exports disabled if not logged in
    setBiDownloadButtonsEnabled(false);

    document.body.classList.remove('theme-suite', 'theme-ops', 'theme-bi', 'theme-fleet', 'theme-radar');
    setActiveView('suite');
    setBrandLoggedOut();
    return;
  }

  try {
    const res = await fetch(`${API_BASE_URL}/api/me`, { headers: authHeaders() });

    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.error || 'Invalid session');

    currentUser = data.user;
    orgs = data.orgs || [];

    if (userNameSpan) userNameSpan.textContent = currentUser.name;
    if (userEmailSpan) userEmailSpan.textContent = currentUser.email;

    if (authPanel) authPanel.classList.add('hidden');
    if (appPanel) appPanel.classList.remove('hidden');
    if (logoutBtn) logoutBtn.classList.remove('hidden');
    if (orgSwitcher) orgSwitcher.classList.remove('hidden');

    // Prefer the last view, default to Suite when logged in
    let initialView = 'suite';
    try {
      const saved = localStorage.getItem(LAST_VIEW_KEY);
      if (saved) initialView = saved;
    } catch {
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
      if (orgSelect) orgSelect.value = currentOrgId;
      await loadProjectsForOrg(currentOrgId);
      await loadActivity(currentOrgId);
    }
  } catch (err) {
    setToken(null);
    setAuthStatus(`Session error: ${err.message}`);
    if (authPanel) authPanel.classList.remove('hidden');
    if (appPanel) appPanel.classList.add('hidden');

    setBiDownloadButtonsEnabled(false);

    document.body.classList.remove('theme-suite', 'theme-ops', 'theme-bi', 'theme-fleet', 'theme-radar');
    setActiveView('suite');
    setBrandLoggedOut();
  }
}

function renderOrgOptions() {
  if (!orgSelect) return;
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
  if (!orgId || !projectListEl) return;
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

if (orgSelect) {
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
}

if (btnNewOrg) {
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
      if (orgSelect) orgSelect.value = currentOrgId;

      await loadProjectsForOrg(currentOrgId);
      await loadActivity(currentOrgId);
      if (currentView === 'bi') loadBiDashboard();
      if (currentView === 'radar') loadRadarSnapshot();
    } catch (err) {
      alert(err.message);
    }
  };
}

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
    const res = await fetch(`${API_BASE_URL}/api/orgs/${orgId}/bi-summary`, {
      headers: authHeaders()
    });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.error || 'Failed to load BI summary');

    const summary = data.projects || [];
    summary.forEach((p) => {
      const total = (p.in_progress || 0) + (p.review || 0) + (p.complete || 0);
      projectCompletion[p.project_id] = total > 0 && p.complete === total;
    });
  } catch (err) {
    console.error('refreshProjectCompletion error:', err.message);
  }
}

async function loadProjectsForOrg(orgId) {
  if (projectListEl) projectListEl.innerHTML = '';

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
      if (storedProjectId && projects.some((p) => p.id === storedProjectId)) {
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
    if (projectListEl) projectListEl.textContent = `Error: ${err.message}`;
  }
}

// Renders project list with drag & drop + ✓ indicator
function renderProjectList() {
  if (!projectListEl) return;
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

    // Desktop drag & drop
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

if (btnNewProject) {
  btnNewProject.onclick = async () => {
    if (!currentOrgId) {
      alert('Select an organization first.');
      return;
    }

    const name = prompt('Project name:');
    if (!name) return;

    const description = prompt('Project description (optional):') || '';

    try {
      const res = await fetch(`${API_BASE_URL}/api/orgs/${currentOrgId}/projects`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders()
        },
        body: JSON.stringify({ name, description })
      });

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
}

async function loadActivity(orgId) {
  if (!activityListEl) return;
  activityListEl.innerHTML = '';

  try {
    const res = await fetch(`${API_BASE_URL}/api/orgs/${orgId}/activity`, {
      headers: authHeaders()
    });

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
  // If BI view isn't active, don't do work
  if (currentView !== 'bi') return;

  if (!currentOrgId) {
    if (biMeta) biMeta.textContent = 'Select an organization first.';
    if (biChart) biChart.destroy();
    if (biTaskChart) biTaskChart.destroy();
    setBiDownloadButtonsEnabled(false);
    return;
  }

  if (biMeta) biMeta.textContent = 'Loading insights...';
  if (biTaskChartArea) biTaskChartArea.classList.add('hidden');

  try {
    const res = await fetch(`${API_BASE_URL}/api/orgs/${currentOrgId}/bi-summary`, {
      headers: authHeaders()
    });

    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.error || 'Failed to load BI summary');

    const summary = data.projects || [];
    lastBiSummary = summary; // ✅ store for report export

    if (!summary.length) {
      if (biMeta) biMeta.textContent = 'No projects.';
      if (biChart) biChart.destroy();
      if (biTaskChart) biTaskChart.destroy();
      projectCompletion = {};
      renderProjectList();
      setBiDownloadButtonsEnabled(false);
      return;
    }

    projectCompletion = {};
    summary.forEach((p) => {
      const total = (p.in_progress || 0) + (p.review || 0) + (p.complete || 0);
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
          await loadBiTaskDrilldown(summary[idx].project_id, summary[idx].project_name);
        }
      }
    });

    if (biMeta) biMeta.textContent = 'Click a project bar to see its tasks.';
    setBiDownloadButtonsEnabled(true);
  } catch (err) {
    if (biMeta) biMeta.textContent = `Error: ${err.message}`;
    setBiDownloadButtonsEnabled(false);
  }
}

/* ============================================================
   BI TASK DRILLDOWN CHART
   ============================================================ */

async function loadBiTaskDrilldown(projectId, projectName) {
  if (!biTaskChartArea || !biTaskChartTitle) return;
  biTaskChartArea.classList.remove('hidden');
  biTaskChartTitle.textContent = `Tasks – ${projectName}`;
  lastBiDrilldownProjectName = projectName || '';

  try {
    const res = await fetch(`${API_BASE_URL}/api/projects/${projectId}/board`, {
      headers: authHeaders()
    });

    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.error || 'Failed to load project tasks');

    const tasks = data.tasks || [];
    lastBiDrilldownTasks = tasks; // ✅ store for report export

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
                const member = (boardState.members || []).find((m) => m.id === t.assigned_to) || null;
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

    setBiDownloadButtonsEnabled(true);
  } catch (err) {
    if (biMeta) biMeta.textContent = `Error: ${err.message}`;
    setBiDownloadButtonsEnabled(false);
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

  const tasksPerPerson = totalMembers > 0 ? (totalTasks / totalMembers).toFixed(1) : '0.0';

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
      const activeTasks = memberTasks.filter((t) => !doneColumnIds.includes(t.column_id));
      const doneTasks = memberTasks.filter((t) => doneColumnIds.includes(t.column_id));
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

      const card = boardEl.querySelector(`.task-card[data-task-id="${taskId}"]`);
      if (card) {
        card.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
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
    const res = await fetch(`${API_BASE_URL}/api/orgs/${currentOrgId}/bi-summary`, {
      headers: authHeaders()
    });
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
          const tRes = await fetch(`${API_BASE_URL}/api/projects/${p.project_id}/bi-tasks`, {
            headers: authHeaders()
          });
          const tData = await safeJson(tRes);
          if (!tRes.ok) return;

          (tData.tasks || []).forEach((t) => {
            if (typeof t.days_left === 'number' && t.days_left < 0) {
              overdueItems.push({
                projectName: p.project_name,
                projectId: p.project_id,
                taskTitle: t.title,
                taskId: t.task_id || t.id,
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
        li.addEventListener('click', () => handleRadarClick(item.projectId, item.taskId));

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
      li.addEventListener('click', () => handleRadarClick(p.project_id, null));

      radarProjectsList.appendChild(li);
    });

    // ---------- Upcoming Deadlines ----------
    const withDeadline = summary.filter((p) => typeof p.days_left === 'number');
    withDeadline.sort((a, b) => (a.days_left ?? 9999) - (b.days_left ?? 9999));

    if (withDeadline.length) {
      withDeadline.slice(0, 5).forEach((p) => {
        const li = document.createElement('li');
        if (p.days_left === 0) li.textContent = `${p.project_name}: due today`;
        else if (p.days_left > 0) li.textContent = `${p.project_name}: due in ${p.days_left} day(s)`;
        else li.textContent = `${p.project_name}: timeline not set`;

        li.classList.add('radar-clickable');
        li.style.cursor = 'pointer';
        li.addEventListener('click', () => handleRadarClick(p.project_id, null));

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
    if (boardProjectNameEl) boardProjectNameEl.textContent = 'Select a project to see board.';
    if (boardProjectDescEl) boardProjectDescEl.textContent = '';
    renderBoard();
    renderTaskDetail(null);
    renderFleetView();
    return;
  }

  // keep "last project" in sync any time we load a board
  setCurrentProjectId(projectId);

  if (boardProjectNameEl) boardProjectNameEl.textContent = 'Loading...';
  if (boardProjectDescEl) boardProjectDescEl.textContent = '';
  if (boardEl) boardEl.innerHTML = '';

  try {
    const res = await fetch(`${API_BASE_URL}/api/projects/${projectId}/board`, {
      headers: authHeaders()
    });

    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.error || 'Failed to load board');

    boardState = {
      project: data.project,
      columns: data.columns || [],
      tasks: data.tasks || [],
      members: data.members || []
    };

    if (boardProjectNameEl) boardProjectNameEl.textContent = data.project.name;
    if (boardProjectDescEl) boardProjectDescEl.textContent = data.project.description || '';

    const doneColumnIds = boardState.columns
      .filter((c) => /done|complete/i.test(c.name || ''))
      .map((c) => c.id);
    const totalTasks = boardState.tasks.length;
    const completeTasks = boardState.tasks.filter((t) => doneColumnIds.includes(t.column_id)).length;
    const allDone = totalTasks > 0 && completeTasks === totalTasks;
    if (boardState.project) projectCompletion[boardState.project.id] = allDone;

    renderProjectList();
    renderBoard();
    renderTaskDetail(null);
    renderFleetView();
  } catch (err) {
    if (boardProjectNameEl) boardProjectNameEl.textContent = 'Error loading project';
    if (boardProjectDescEl) boardProjectDescEl.textContent = err.message;
  }
}

function tasksInColumn(columnId) {
  return boardState.tasks
    .filter((t) => t.column_id === columnId)
    .sort((a, b) => a.position - b.position);
}

function renderBoard() {
  if (!boardEl) return;
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

    // Desktop HTML5 DnD
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

  // Desktop drag
  card.addEventListener('dragstart', handleTaskDragStart);
  card.addEventListener('dragend', handleTaskDragEnd);

  // Click to open details
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
   DRAG & DROP (Desktop + Mobile)
   ============================================================ */

/* ---------- Desktop HTML5 drag for tasks ---------- */

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

/* ---------- Shared "move task" helper used by desktop + touch ---------- */

async function moveTaskToColumn(taskId, columnId) {
  if (!taskId || !columnId || !boardState.project) return;

  try {
    const res = await fetch(`${API_BASE_URL}/api/tasks/${taskId}/move`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders()
      },
      body: JSON.stringify({ to_column_id: columnId })
    });

    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.error || 'Failed to move task');

    // Reload board data, but stay on same org/project and view
    await loadBoard(boardState.project.id);
    if (currentView !== 'ops') setActiveView('ops');
  } catch (err) {
    alert(err.message);
  } finally {
    dragTaskId = null;
    dragFromColumnId = null;
  }
}

async function handleColumnDrop(e) {
  e.preventDefault();
  e.stopPropagation();
  if (!dragTaskId) return;

  const columnId = Number(e.currentTarget.dataset.columnId);
  await moveTaskToColumn(dragTaskId, columnId);
}

/* ---------- Mobile / touch drag (tasks + projects) ---------- */

function initTouchDnD() {
  if (!isTouchLikeDevice()) return;

  initTouchTaskDnD();
  initTouchProjectDnD();
}

/* Mobile drag for task cards (column-to-column) */
function initTouchTaskDnD() {
  if (!boardEl) return;

  boardEl.addEventListener('touchstart', onTaskTouchStart, { passive: true });

  function onTaskTouchStart(e) {
    const card = e.target.closest('.task-card');
    if (!card) return;

    const touch = e.touches[0];
    touchTaskDragState = {
      card,
      taskId: Number(card.dataset.taskId),
      startColId: Number(card.dataset.columnId),
      startX: touch.clientX,
      startY: touch.clientY,
      isDragging: false
    };

    window.addEventListener('touchmove', onTaskTouchMove, { passive: false });
    window.addEventListener('touchend', onTaskTouchEnd, { passive: false });
    window.addEventListener('touchcancel', onTaskTouchEnd, { passive: false });
  }

  function onTaskTouchMove(e) {
    if (!touchTaskDragState) return;
    const touch = e.touches[0];
    const dx = touch.clientX - touchTaskDragState.startX;
    const dy = touch.clientY - touchTaskDragState.startY;
    const distanceSq = dx * dx + dy * dy;

    // Start drag only after a small movement so taps still work
    if (!touchTaskDragState.isDragging) {
      if (distanceSq < 100) return; // ~10px threshold
      touchTaskDragState.isDragging = true;
      dragTaskId = touchTaskDragState.taskId;
      dragFromColumnId = touchTaskDragState.startColId;
      touchTaskDragState.card.classList.add('dragging');
    }

    // Once dragging, prevent scrolling
    if (touchTaskDragState.isDragging) e.preventDefault();
  }

  async function onTaskTouchEnd(e) {
    if (!touchTaskDragState) return;

    const { card, taskId, startColId, isDragging } = touchTaskDragState;
    touchTaskDragState = null;

    window.removeEventListener('touchmove', onTaskTouchMove);
    window.removeEventListener('touchend', onTaskTouchEnd);
    window.removeEventListener('touchcancel', onTaskTouchEnd);

    if (!isDragging) return; // tap only

    e.preventDefault();
    card.classList.remove('dragging');

    const touch = e.changedTouches[0];
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    const colBody = el && el.closest('.column-body');
    const toColumnId = colBody ? Number(colBody.dataset.columnId) : startColId;

    if (!toColumnId || toColumnId === startColId) {
      dragTaskId = null;
      dragFromColumnId = null;
      return;
    }

    await moveTaskToColumn(taskId, toColumnId);
  }
}

/* Mobile drag for project list (reordering) */
function initTouchProjectDnD() {
  if (!projectListEl) return;

  projectListEl.addEventListener('touchstart', onProjectTouchStart, { passive: true });

  function onProjectTouchStart(e) {
    const li = e.target.closest('li[data-id]');
    if (!li) return;

    const touch = e.touches[0];
    touchProjectDragState = {
      li,
      startX: touch.clientX,
      startY: touch.clientY,
      isDragging: false
    };

    window.addEventListener('touchmove', onProjectTouchMove, { passive: false });
    window.addEventListener('touchend', onProjectTouchEnd, { passive: false });
    window.addEventListener('touchcancel', onProjectTouchEnd, { passive: false });
  }

  function onProjectTouchMove(e) {
    if (!touchProjectDragState) return;

    const touch = e.touches[0];
    const dx = touch.clientX - touchProjectDragState.startX;
    const dy = touch.clientY - touchProjectDragState.startY;
    const distanceSq = dx * dx + dy * dy;

    if (!touchProjectDragState.isDragging) {
      if (distanceSq < 100) return; // ~10px
      touchProjectDragState.isDragging = true;
      touchProjectDragState.li.classList.add('dragging', 'dragging-project');
    }

    if (touchProjectDragState.isDragging) {
      e.preventDefault();
      const afterElement = getProjectAfterElement(projectListEl, touch.clientY);
      if (!afterElement) projectListEl.appendChild(touchProjectDragState.li);
      else projectListEl.insertBefore(touchProjectDragState.li, afterElement);
    }
  }

  function onProjectTouchEnd(e) {
    if (!touchProjectDragState) return;

    const { li, isDragging } = touchProjectDragState;
    touchProjectDragState = null;

    window.removeEventListener('touchmove', onProjectTouchMove);
    window.removeEventListener('touchend', onProjectTouchEnd);
    window.removeEventListener('touchcancel', onProjectTouchEnd);

    if (!isDragging) return;

    e.preventDefault();
    li.classList.remove('dragging', 'dragging-project');
    saveProjectOrder(currentOrgId);
  }
}

/* ============================================================
   ADD COLUMNS & TASKS
   ============================================================ */

if (btnAddColumn) {
  btnAddColumn.onclick = async () => {
    if (!boardState.project) return alert('Select a project first.');

    const name = prompt('Column name:');
    if (!name) return;

    try {
      const res = await fetch(`${API_BASE_URL}/api/projects/${boardState.project.id}/columns`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders()
        },
        body: JSON.stringify({ name })
      });

      const data = await safeJson(res);
      if (!res.ok) throw new Error(data.error || 'Failed to create column');

      await loadBoard(boardState.project.id);
    } catch (err) {
      alert(err.message);
    }
  };
}

if (btnAddTask) {
  btnAddTask.onclick = async () => {
    if (!boardState.project) return alert('Select a project first.');
    if (!boardState.columns.length) return alert('Add a column first.');

    const title = prompt('Task title:');
    if (!title) return;

    const columnId = boardState.columns[0].id;

    try {
      const res = await fetch(`${API_BASE_URL}/api/projects/${boardState.project.id}/tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders()
        },
        body: JSON.stringify({ title, column_id: columnId })
      });

      const data = await safeJson(res);
      if (!res.ok) throw new Error(data.error || 'Failed to create task');

      await loadBoard(boardState.project.id);
    } catch (err) {
      alert(err.message);
    }
  };
}

/* ============================================================
   TASK DETAIL PANEL
   ============================================================ */

function renderTaskDetail(taskId) {
  if (!taskId) {
    if (taskDetailPanel) taskDetailPanel.classList.add('hidden');
    selectedTaskId = null;
    return;
  }

  const task = boardState.tasks.find((t) => t.id === taskId);
  if (!task) {
    if (taskDetailPanel) taskDetailPanel.classList.add('hidden');
    selectedTaskId = null;
    return;
  }

  selectedTaskId = taskId;
  if (taskDetailPanel) taskDetailPanel.classList.remove('hidden');

  if (detailTitleEl) detailTitleEl.textContent = task.title;

  const col = boardState.columns.find((c) => c.id === task.column_id);
  const colName = col ? col.name : 'N/A';
  if (detailMetaEl) detailMetaEl.textContent = `Column: ${colName} • Priority: ${task.priority}`;

  if (detailDescriptionEl) detailDescriptionEl.textContent = task.description || '';

  if (detailInputTitle) detailInputTitle.value = task.title;
  if (detailInputDesc) detailInputDesc.value = task.description || '';
  if (detailInputPriority) detailInputPriority.value = task.priority || 'medium';
  if (detailInputDue) detailInputDue.value = task.due_date || '';

  if (detailInputAssignee) {
    detailInputAssignee.innerHTML = '<option value="">Unassigned</option>';
    (boardState.members || []).forEach((m) => {
      const opt = document.createElement('option');
      opt.value = m.id;
      opt.textContent = `${m.name} (${m.email})`;
      if (m.id === task.assigned_to) opt.selected = true;
      detailInputAssignee.appendChild(opt);
    });
  }

  if (detailStatus) detailStatus.textContent = '';

  loadComments(taskId);
  if (detailAttachmentsList) loadAttachments(taskId);
}

if (btnCloseDetail) btnCloseDetail.onclick = () => renderTaskDetail(null);

/* ============================================================
   SAVE TASK (BOTTOM BUTTON)
   ============================================================ */

if (detailSaveBtn) {
  detailSaveBtn.onclick = async () => {
    if (!selectedTaskId) return;
    if (detailStatus) detailStatus.textContent = 'Saving...';

    const payload = {
      title: detailInputTitle.value.trim(),
      description: detailInputDesc.value.trim(),
      priority: detailInputPriority.value,
      due_date: detailInputDue.value || null,
      assigned_to: detailInputAssignee.value || null
    };

    try {
      const res = await fetch(`${API_BASE_URL}/api/tasks/${selectedTaskId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders()
        },
        body: JSON.stringify(payload)
      });

      const data = await safeJson(res);
      if (!res.ok) throw new Error(data.error || 'Failed to update task');

      const i = boardState.tasks.findIndex((t) => t.id === selectedTaskId);
      if (i !== -1) boardState.tasks[i] = data.task;

      if (detailStatus) detailStatus.textContent = 'Saved.';
      renderBoard();
      renderTaskDetail(selectedTaskId);
      renderFleetView();
    } catch (err) {
      if (detailStatus) detailStatus.textContent = `Error: ${err.message}`;
    }
  };
}

/* ============================================================
   DELETE TASK
   ============================================================ */

if (detailDeleteTaskBtn) {
  detailDeleteTaskBtn.onclick = async () => {
    if (!selectedTaskId) return;
    if (!confirm('Delete this task permanently?')) return;

    try {
      const res = await fetch(`${API_BASE_URL}/api/tasks/${selectedTaskId}`, {
        method: 'DELETE',
        headers: authHeaders()
      });

      const data = await safeJson(res);
      if (!res.ok) throw new Error(data.error || 'Failed to delete task');

      await loadBoard(boardState.project.id);
      renderTaskDetail(null);
    } catch (err) {
      alert(err.message);
    }
  };
}

/* ============================================================
   DELETE PROJECT
   ============================================================ */

if (btnDeleteProject) {
  btnDeleteProject.onclick = async () => {
    if (!currentProjectId) return alert('Select a project first.');
    if (!confirm('Delete this project and ALL its tasks?')) return;

    try {
      const res = await fetch(`${API_BASE_URL}/api/projects/${currentProjectId}`, {
        method: 'DELETE',
        headers: authHeaders()
      });

      const data = await safeJson(res);
      if (!res.ok) throw new Error(data.error || 'Failed to delete project');

      projects = projects.filter((p) => p.id !== currentProjectId);
      delete projectCompletion[currentProjectId];

      if (projects.length) {
        setCurrentProjectId(projects[0].id);
      } else {
        setCurrentProjectId(null);
        boardState = { project: null, columns: [], tasks: [], members: [] };
        renderBoard();
        renderTaskDetail(null);
        renderFleetView();
      }

      renderProjectList();
      if (currentProjectId) await loadBoard(currentProjectId);

      if (currentView === 'bi') loadBiDashboard();
      if (currentView === 'radar') loadRadarSnapshot();
    } catch (err) {
      alert(err.message);
    }
  };
}

/* ============================================================
   ATTACHMENTS
   ============================================================ */

async function loadAttachments(taskId) {
  if (!detailAttachmentsList) return;

  detailAttachmentsList.innerHTML = '';
  if (!taskId) return;

  try {
    const res = await fetch(`${API_BASE_URL}/api/tasks/${taskId}/attachments`, {
      headers: authHeaders()
    });

    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.error || 'Failed to load attachments');

    const attachments = data.attachments || [];

    if (!attachments.length) {
      const li = document.createElement('li');
      li.textContent = 'No attachments yet.';
      detailAttachmentsList.appendChild(li);
      return;
    }

    attachments.forEach((a) => {
      const li = document.createElement('li');
      li.classList.add('attachment-item');

      const urlPath = a.url || (a.filename ? `/uploads/${a.filename}` : '#');

      const link = document.createElement('a');
      link.href = `${API_BASE_URL}${urlPath}`;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = a.original_name || a.filename || 'Download';

      const metaSpan = document.createElement('span');
      metaSpan.classList.add('attachment-meta');
      const sizeKb = a.size ? `${Math.round(a.size / 1024)} KB` : '';
      const ts = a.created_at ? new Date(a.created_at).toLocaleString() : '';
      metaSpan.textContent = [sizeKb && `(${sizeKb})`, ts && ` • ${ts}`].filter(Boolean).join('');

      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.textContent = 'Delete';
      deleteBtn.classList.add('attachment-delete-btn');

      deleteBtn.addEventListener('click', async () => {
        if (!confirm('Delete this attachment?')) return;

        try {
          if (detailAttachmentStatus) detailAttachmentStatus.textContent = 'Deleting attachment...';

          const delRes = await fetch(`${API_BASE_URL}/api/attachments/${a.id}`, {
            method: 'DELETE',
            headers: authHeaders()
          });
          const delData = await safeJson(delRes);
          if (!delRes.ok) throw new Error(delData.error || 'Failed to delete attachment');

          await loadAttachments(taskId);

          if (detailAttachmentStatus) {
            detailAttachmentStatus.textContent = 'Attachment deleted.';
            setTimeout(() => {
              if (detailAttachmentStatus) detailAttachmentStatus.textContent = '';
            }, 2000);
          }
        } catch (err) {
          if (detailAttachmentStatus) detailAttachmentStatus.textContent = `Error: ${err.message}`;
          else alert(err.message);
        }
      });

      li.appendChild(link);
      if (metaSpan.textContent) li.appendChild(metaSpan);
      li.appendChild(deleteBtn);

      detailAttachmentsList.appendChild(li);
    });
  } catch (err) {
    const li = document.createElement('li');
    li.textContent = `Error: ${err.message}`;
    detailAttachmentsList.appendChild(li);
  }
}

/* ============================================================
   COMMENTS
   ============================================================ */

async function loadComments(taskId) {
  if (!detailCommentsList) return;
  detailCommentsList.innerHTML = '';

  try {
    const res = await fetch(`${API_BASE_URL}/api/tasks/${taskId}/comments`, {
      headers: authHeaders()
    });

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

if (detailCommentForm) {
  detailCommentForm.onsubmit = async (e) => {
    e.preventDefault();
    if (!selectedTaskId) return;

    const body = detailCommentBody.value.trim();
    if (!body) return;

    try {
      const res = await fetch(`${API_BASE_URL}/api/tasks/${selectedTaskId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders()
        },
        body: JSON.stringify({ body })
      });

      const data = await safeJson(res);
      if (!res.ok) throw new Error(data.error || 'Failed to add comment');

      detailCommentBody.value = '';
      loadComments(selectedTaskId);
    } catch (err) {
      alert(err.message);
    }
  };
}

/* ============================================================
   ATTACHMENT UPLOAD
   ============================================================ */

if (detailAttachmentForm && detailAttachmentFile) {
  detailAttachmentForm.onsubmit = async (e) => {
    e.preventDefault();
    if (!selectedTaskId) return;

    const file = detailAttachmentFile.files[0];
    if (!file) {
      if (detailAttachmentStatus) detailAttachmentStatus.textContent = 'Please choose a file first.';
      return;
    }

    try {
      if (detailAttachmentStatus) detailAttachmentStatus.textContent = 'Uploading attachment...';

      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`${API_BASE_URL}/api/tasks/${selectedTaskId}/attachments`, {
        method: 'POST',
        headers: authHeaders(), // don't set Content-Type manually
        body: formData
      });

      const data = await safeJson(res);
      if (!res.ok) throw new Error(data.error || 'Failed to upload attachment');

      // Clear input
      detailAttachmentFile.value = '';

      await loadAttachments(selectedTaskId);

      if (detailAttachmentStatus) {
        detailAttachmentStatus.textContent = 'Attachment uploaded.';
        setTimeout(() => {
          if (detailAttachmentStatus) detailAttachmentStatus.textContent = '';
        }, 2000);
      }
    } catch (err) {
      if (detailAttachmentStatus) detailAttachmentStatus.textContent = `Error: ${err.message}`;
      else alert(err.message);
    }
  };
}

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
  if (document.body) document.body.addEventListener(eventName, handler, false);
});

/* ============================================================
   BI EXPORT BUTTON WIRES
   ============================================================ */

if (btnBiDownloadPdf) {
  btnBiDownloadPdf.addEventListener('click', () => {
    try {
      downloadActiveBiAsPdf();
    } catch (e) {
      alert(`PDF export failed: ${e.message}`);
    }
  });
}

if (btnBiDownloadSvg) {
  btnBiDownloadSvg.addEventListener('click', () => {
    try {
      downloadActiveBiAsSvg();
    } catch (e) {
      alert(`SVG export failed: ${e.message}`);
    }
  });
}

// default state (disabled until a chart exists)
setBiDownloadButtonsEnabled(false);

/* ============================================================
   INIT
   ============================================================ */

setBrandLoggedOut();
initTouchDnD();   // enable mobile drag for tasks + projects
loadSession();
