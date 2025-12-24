// frontend/js/app.js
(() => {
  /* =========================
     CONFIG + KEYS
  ========================== */
  const API_BASE_URL =
    window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      ? 'http://localhost:5500'
      : '';

  const KEYS = {
    token: 'td_token',
    lastView: 'xymz_last_view',
    lastOrg: 'xymz_last_org_id',
    lastProject: 'xymz_last_project_id',
    theme: 'xymz_theme',
    projectOrderPrefix: 'xymz_project_order_'
  };

  /* =========================
     DOM HELPERS
  ========================== */
  const $ = (id) => document.getElementById(id);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));
  const setText = (el, v) => el && (el.textContent = v ?? '');
  const show = (el, on) => el && el.classList.toggle('hidden', !on);
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

  const els = {
    // auth
    authPanel: $('auth-panel'),
    appPanel: $('app-panel'),
    authStatus: $('auth-status'),
    tabLogin: $('tab-login'),
    tabRegister: $('tab-register'),
    loginForm: $('login-form'),
    loginEmail: $('login-email'),
    loginPassword: $('login-password'),
    loginOrgToken: $('login-org-token'),
    linkResetPassword: $('link-reset-password'),
    linkResetToken: $('link-reset-token'),
    registerForm: $('register-form'),
    registerName: $('register-name'),
    registerEmail: $('register-email'),
    registerPassword: $('register-password'),
    registerSecurityQuestion: $('register-security-question'),
    registerSecurityAnswer: $('register-security-answer'),
    registerIsAdmin: $('register-is-admin'),
    registerOrgTokenRow: $('register-org-token-row'),
    registerOrgToken: $('register-org-token'),
    registerOrgName: $('register-org-name'),

    // brand/topbar
    brandTitle: $('brand-title'),
    brandSubtitle: $('brand-subtitle'),
    userNameSpan: $('user-name'),
    userEmailSpan: $('user-email'),
    logoutBtn: $('btn-logout'),
    btnTheme: $('btn-theme'),

    // org/project
    orgSwitcher: $('org-switcher'),
    orgSelect: $('org-select'),
    btnNewOrg: $('btn-new-org'),
    projectListEl: $('project-list'),
    btnNewProject: $('btn-new-project'),
    activityListEl: $('activity-list'),

    // ops board
    boardProjectNameEl: $('board-project-name'),
    boardProjectDescEl: $('board-project-desc'),
    boardEl: $('board'),
    btnAddColumn: $('btn-add-column'),
    btnAddTask: $('btn-add-task'),
    btnDeleteProject: $('btn-delete-project'),

    // task detail
    taskDetailPanel: $('task-detail-panel'),
    btnCloseDetail: $('btn-close-detail'),
    detailTitleEl: $('detail-title'),
    detailMetaEl: $('detail-meta'),
    detailDescriptionEl: $('detail-description'),
    detailInputTitle: $('detail-input-title'),
    detailInputDesc: $('detail-input-desc'),
    detailInputPriority: $('detail-input-priority'),
    detailInputDue: $('detail-input-due'),
    detailInputAssignee: $('detail-input-assignee'),
    detailStatus: $('detail-status'),
    detailSaveBtn: $('detail-save-btn'),
    detailDeleteTaskBtn: $('detail-delete-task'),

    // comments
    detailCommentsList: $('detail-comments'),
    detailCommentForm: $('detail-comment-form'),
    detailCommentBody: $('detail-comment-body'),

    // attachments
    detailAttachmentsList: $('detail-attachments'),
    detailAttachmentForm: $('detail-attachment-form'),
    detailAttachmentFile: $('detail-attachment-file'),
    detailAttachmentStatus: $('detail-attachment-status'),

    // views/tabs
    suiteTabs: $$('.suite-tab'),
    suiteView: $('suite-view'),
    opsView: $('ops-view'),
    biView: $('bi-view'),
    fleetView: $('fleet-view'),
    radarView: $('radar-view'),

    // fleet
    fleetListEl: $('fleet-list'),
    fleetTotalCountEl: $('fleet-total-count'),
    fleetProjectCountEl: $('fleet-project-count'),
    fleetTasksPerPersonEl: $('fleet-tasks-per-person'),
    fleetFocusTextEl: $('fleet-focus-text'),

    // radar
    radarOverdueList: $('radar-overdue-list'),
    radarProjectsList: $('radar-projects-list'),
    radarUpcomingList: $('radar-upcoming-list'),

    // BI
    biMeta: $('bi-meta'),
    biChartCanvas: $('bi-chart'),
    btnBiDownloadPdf: $('btn-bi-download-pdf'),
    btnBiDownloadSvg: $('btn-bi-download-svg'),
    biTaskChartArea: $('bi-task-chart-area'),
    biTaskChartTitle: $('bi-task-chart-title'),
    biTaskChartCanvas: $('bi-task-chart')
  };

  /* =========================
     STATE
  ========================== */
  const S = {
    currentUser: null,
    orgs: [],
    currentOrgId: null,
    projects: [],
    currentProjectId: null,
    currentView: 'suite',

    board: { project: null, columns: [], tasks: [], members: [] },
    selectedTaskId: null,
    dragTaskId: null,
    dragFromColumnId: null,

    touchTaskDragState: null,
    touchProjectDragState: null,

    projectCompletion: {},
    projectListDnDInitialized: false,

    // BI charts + export data
    biChart: null,
    biTaskChart: null,
    lastBiSummary: [],
    lastBiDrilldownTasks: [],
    lastBiDrilldownProjectName: ''
  };

  /* =========================
     STORAGE + AUTH HELPERS
  ========================== */
  const storage = {
    getStr: (k) => {
      try {
        return localStorage.getItem(k);
      } catch {
        return null;
      }
    },
    setStr: (k, v) => {
      try {
        if (v == null) localStorage.removeItem(k);
        else localStorage.setItem(k, String(v));
      } catch {}
    },
    getNum: (k) => {
      const raw = storage.getStr(k);
      if (!raw) return null;
      const n = Number(raw);
      return Number.isNaN(n) ? null : n;
    }
  };

  const auth = {
    getToken: () => storage.getStr(KEYS.token),
    setToken: (t) => storage.setStr(KEYS.token, t),
    headers: () => (auth.getToken() ? { Authorization: `Bearer ${auth.getToken()}` } : {})
  };

  async function safeJson(res) {
    const text = await res.text();
    if (!text) return {};
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`Server returned non-JSON (status ${res.status})`);
    }
  }

  async function api(path, opts = {}) {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      ...opts,
      headers: {
        ...(opts.headers || {}),
        ...auth.headers()
      }
    });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
    return data;
  }

  function setAuthStatus(msg) {
    setText(els.authStatus, msg || '');
  }

  function setCurrentOrgId(id) {
    S.currentOrgId = id != null ? Number(id) : null;
    storage.setStr(KEYS.lastOrg, S.currentOrgId != null ? String(S.currentOrgId) : null);
  }

  function setCurrentProjectId(id) {
    S.currentProjectId = id != null ? Number(id) : null;
    storage.setStr(KEYS.lastProject, S.currentProjectId != null ? String(S.currentProjectId) : null);
  }

  /* =========================
     THEME (DARK/LIGHT)
  ========================== */
  function normalizeTheme(t) {
    return t === 'light' ? 'light' : 'dark';
  }

  function updateThemeMetaColor(theme) {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) return;
    meta.setAttribute('content', theme === 'light' ? '#f8fafc' : '#020617');
  }

  function updateThemeButton(theme) {
    if (!els.btnTheme) return;
    els.btnTheme.textContent = theme === 'dark' ? 'Light' : 'Dark';
    els.btnTheme.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');
    els.btnTheme.title = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
  }

  // ✅ NEW: centralized chart theme tokens (forces correct text color in light mode)
  function getChartThemeTokens() {
    const styles = getComputedStyle(document.documentElement);
    const text = (styles.getPropertyValue('--text') || '').trim() || '#111827';
    const muted = (styles.getPropertyValue('--muted') || '').trim() || '#6b7280';
    const border2 = (styles.getPropertyValue('--border2') || '').trim() || 'rgba(148,163,184,0.35)';
    return { text, muted, border2 };
  }

  // ✅ UPDATED: hard-apply to defaults AND existing charts
  function syncChartsToTheme() {
    if (!window.Chart) return;

    const { text, border2 } = getChartThemeTokens();

    try {
      window.Chart.defaults.color = text;
      window.Chart.defaults.borderColor = border2;
      window.Chart.defaults.plugins = window.Chart.defaults.plugins || {};
      window.Chart.defaults.plugins.legend = window.Chart.defaults.plugins.legend || {};
      window.Chart.defaults.plugins.legend.labels = window.Chart.defaults.plugins.legend.labels || {};
      window.Chart.defaults.plugins.legend.labels.color = text;
    } catch {}

    const patchChart = (ch) => {
      if (!ch) return;
      try {
        ch.options = ch.options || {};
        ch.options.plugins = ch.options.plugins || {};
        ch.options.plugins.legend = ch.options.plugins.legend || {};
        ch.options.plugins.legend.labels = ch.options.plugins.legend.labels || {};
        ch.options.plugins.legend.labels.color = text;

        if (ch.options.scales) {
          Object.values(ch.options.scales).forEach((scale) => {
            if (!scale) return;
            scale.ticks = scale.ticks || {};
            scale.ticks.color = text;

            scale.grid = scale.grid || {};
            scale.grid.color = border2;

            scale.border = scale.border || {};
            scale.border.color = border2;
          });
        }

        ch.update('none');
      } catch {}
    };

    patchChart(S.biChart);
    patchChart(S.biTaskChart);
  }

  function applyTheme(theme, persist = true) {
    const t = normalizeTheme(theme);
    document.documentElement.setAttribute('data-theme', t);
    if (persist) storage.setStr(KEYS.theme, t);
    updateThemeMetaColor(t);
    updateThemeButton(t);
    syncChartsToTheme();
  }

  function initTheme() {
    const initial = normalizeTheme(storage.getStr(KEYS.theme) || document.documentElement.getAttribute('data-theme') || 'dark');
    applyTheme(initial, false);

    if (els.btnTheme) {
      els.btnTheme.addEventListener('click', () => {
        const current = normalizeTheme(document.documentElement.getAttribute('data-theme'));
        applyTheme(current === 'dark' ? 'light' : 'dark', true);
      });
    }
  }

  /* =========================
     BRAND + VIEW SWITCHING
  ========================== */
  function setBrandLoggedOut() {
    setText(els.brandTitle, 'XYMZ');
    setText(els.brandSubtitle, 'Sign in to access XYMZ.Suite.');
  }

  function setBrandForView(view) {
    if (!els.brandTitle || !els.brandSubtitle) return;
    const map = {
      fleet: ['XYMZ.Fleet', 'Teams, capacity & coverage.'],
      radar: ['XYMZ.Radar', 'Live risk signals & delivery health.'],
      ops: ['XYMZ.Ops', 'Operational boards for shared client delivery.'],
      bi: ['XYMZ.BI', 'Project insights & portfolio intelligence.'],
      suite: ['XYMZ.Suite', 'Shared workspaces for agencies & clients.']
    };
    const [t, s] = map[view] || map.suite;
    setText(els.brandTitle, t);
    setText(els.brandSubtitle, s);
  }

  function setThemeForView(view) {
    const body = document.body;
    if (!body) return;
    body.classList.remove('theme-suite', 'theme-ops', 'theme-bi', 'theme-fleet', 'theme-radar');
    body.classList.add(
      view === 'ops' ? 'theme-ops'
      : view === 'bi' ? 'theme-bi'
      : view === 'fleet' ? 'theme-fleet'
      : view === 'radar' ? 'theme-radar'
      : 'theme-suite'
    );
  }

  function setActiveView(view) {
    S.currentView = view;
    storage.setStr(KEYS.lastView, view);

    els.suiteTabs.forEach((btn) => btn.classList.toggle('active', btn.dataset.view === view));

    show(els.suiteView, view === 'suite');
    show(els.opsView, view === 'ops');
    show(els.biView, view === 'bi');
    show(els.fleetView, view === 'fleet');
    show(els.radarView, view === 'radar');

    setBrandForView(view);
    setThemeForView(view);

    if (view === 'bi') loadBiDashboard();
    if (view === 'fleet') renderFleetView();
    if (view === 'radar') loadRadarSnapshot();
  }

  /* =========================
     BI EXPORT (REPORT PDF + SVG)
  ========================== */
  const safeTextForSvg = (str) =>
    String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  function setBiDownloadButtonsEnabled(enabled) {
    if (els.btnBiDownloadPdf) els.btnBiDownloadPdf.disabled = !enabled;
    if (els.btnBiDownloadSvg) els.btnBiDownloadSvg.disabled = !enabled;
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

  function getActiveBiCanvas() {
    const drillVisible = els.biTaskChartArea && !els.biTaskChartArea.classList.contains('hidden');
    if (drillVisible && S.biTaskChart && els.biTaskChartCanvas) return els.biTaskChartCanvas;
    if (S.biChart && els.biChartCanvas) return els.biChartCanvas;
    return null;
  }

  function getActiveBiFilenameBase() {
    const drillVisible = els.biTaskChartArea && !els.biTaskChartArea.classList.contains('hidden');
    if (drillVisible) {
      const title = (els.biTaskChartTitle && els.biTaskChartTitle.textContent) || 'XYMZ_BI_Task_Drilldown';
      return title.replace(/[^\w\-]+/g, '_');
    }
    return 'XYMZ_BI_Project_Insights';
  }

  function formatDateShort(isoLike) {
    if (!isoLike) return 'N/A';
    const d = new Date(isoLike);
    return Number.isNaN(d.getTime()) ? 'N/A' : d.toLocaleDateString();
  }

  function computeDaysLeft(isoLike) {
    if (!isoLike) return null;
    const due = new Date(isoLike);
    if (Number.isNaN(due.getTime())) return null;
    const today = new Date();
    const dueMid = new Date(due.getFullYear(), due.getMonth(), due.getDate());
    const todayMid = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    return Math.ceil((dueMid - todayMid) / (1000 * 60 * 60 * 24));
  }

  function buildBiReportPacket() {
    const drillVisible = els.biTaskChartArea && !els.biTaskChartArea.classList.contains('hidden') && S.biTaskChart;
    const generatedAt = new Date().toLocaleString();
    const orgName = (S.orgs.find((o) => o.id === S.currentOrgId)?.name) || (S.currentOrgId ? `Org #${S.currentOrgId}` : 'No Organization');

    if (!drillVisible) {
      const summary = Array.isArray(S.lastBiSummary) ? S.lastBiSummary : [];
      let inP = 0, rev = 0, done = 0;
      summary.forEach((p) => { inP += p.in_progress || 0; rev += p.review || 0; done += p.complete || 0; });
      const total = inP + rev + done;
      const reviewShare = total ? Math.round((rev / total) * 100) : 0;
      const doneShare = total ? Math.round((done / total) * 100) : 0;

      const ranked = [...summary].sort((a, b) => {
        const activeA = (a.in_progress || 0) + (a.review || 0);
        const activeB = (b.in_progress || 0) + (b.review || 0);
        if (activeB !== activeA) return activeB - activeA;
        return (a.days_left ?? 9999) - (b.days_left ?? 9999);
      });

      const lines = [];
      lines.push(`Organization: ${orgName}`);
      lines.push(`Generated: ${generatedAt}`);
      lines.push(`Projects included: ${summary.length}`);
      lines.push(`Total tasks tracked: ${total}`);
      lines.push(`In progress: ${inP} (${total ? Math.round((inP / total) * 100) : 0}%)`);
      lines.push(`In review: ${rev} (${reviewShare}%)`);
      lines.push(`Done: ${done} (${doneShare}%)`);
      if (total) {
        lines.push(`Delivery health: ${doneShare >= 70 ? 'Strong completion pace' : doneShare >= 40 ? 'Moderate progress, monitor flow' : 'At risk, execution needs attention'}`);
        if (reviewShare >= 35) lines.push('Signal: Review backlog (QA/approvals may be bottleneck)');
        const active = inP + rev;
        if (active > done && done > 0) lines.push('Signal: WIP higher than throughput (risk of piling work)');
        if (done === 0) lines.push('Signal: No completed tasks yet (timeline risk)');
      } else {
        lines.push('Note: No tasks recorded in BI yet');
      }

      const topRisks = ranked.slice(0, 3).map((p) => {
        const active = (p.in_progress || 0) + (p.review || 0);
        const dl = p.days_left != null ? (p.days_left === 0 ? 'due today' : `due in ${p.days_left} day(s)`) : 'no deadline';
        return `${p.project_name}: ${active} active, ${dl}`;
      });

      if (topRisks.length) {
        lines.push('Top at-risk projects:');
        topRisks.forEach((l) => lines.push(`- ${l}`));
      }

      return { title: 'XYMZ.BI Report - Project Portfolio', subtitle: `Organization: ${orgName}`, generatedAt, lines };
    }

    const title = els.biTaskChartTitle?.textContent || 'XYMZ.BI Report - Task Drilldown';
    const tasks = Array.isArray(S.lastBiDrilldownTasks) ? S.lastBiDrilldownTasks : [];
    const members = Array.isArray(S.board.members) ? S.board.members : [];
    const lines = [];
    lines.push(`Organization: ${orgName}`);
    lines.push(`Generated: ${generatedAt}`);
    if (S.lastBiDrilldownProjectName) lines.push(`Project: ${S.lastBiDrilldownProjectName}`);

    if (!tasks.length) {
      lines.push('No tasks found for this project.');
      return { title, subtitle: `Organization: ${orgName}`, generatedAt, lines };
    }

    const dueTasks = tasks.filter((t) => !!t.due_date);
    const overdue = dueTasks.filter((t) => (computeDaysLeft(t.due_date) ?? 0) < 0);
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
    lines.push('Task breakdown:');

    tasks.slice(0, 40).forEach((t) => {
      const due = t.due_date ? formatDateShort(t.due_date) : 'N/A';
      const dl = computeDaysLeft(t.due_date);
      const daysText = dl == null ? 'No due date' : dl < 0 ? `Overdue ${Math.abs(dl)}d` : `${dl}d left`;
      const assignee =
        members.find((m) => m.id === t.assigned_to)?.name ||
        members.find((m) => m.id === t.assigned_to)?.email ||
        'Unassigned';
      lines.push(`• ${t.title} - Due: ${due} (${daysText}) - Priority: ${(t.priority || 'medium').toLowerCase()} - Assigned: ${assignee}`);
    });

    if (tasks.length > 40) lines.push('(Showing first 40 tasks - export limited for readability)');

    return { title, subtitle: `Organization: ${orgName}`, generatedAt, lines };
  }

  function downloadActiveBiAsPdf() {
    const canvas = getActiveBiCanvas();
    if (!canvas) return alert('No chart available to export yet.');
    const jspdf = window.jspdf;
    if (!jspdf || !jspdf.jsPDF) {
      return alert('PDF export library failed to load (jsPDF). Check your index.html script tag.');
    }

    const packet = buildBiReportPacket();
    const filename = `${getActiveBiFilenameBase()}_Report.pdf`;

    const pdf = new jspdf.jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const margin = 40;
    let y = 46;

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

    y += 14;
    pdf.setDrawColor(220);
    pdf.line(margin, y, pageW - margin, y);

    const imgData = canvasToPngDataUrl(canvas);
    const imgMaxW = pageW - margin * 2;
    const imgMaxH = 280;
    const ratio = canvas.width / canvas.height || 1;
    let imgW = imgMaxW;
    let imgH = imgW / ratio;
    if (imgH > imgMaxH) { imgH = imgMaxH; imgW = imgH * ratio; }

    y += 18;
    const imgX = margin + (imgMaxW - imgW) / 2;
    pdf.addImage(imgData, 'PNG', imgX, y, imgW, imgH);
    y += imgH + 20;

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(12);
    pdf.text('Analysis', margin, y);
    y += 14;

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);

    const wrapWidth = pageW - margin * 2;
    const lineSpacing = 13;

    packet.lines.forEach((raw) => {
      const wrapped = pdf.splitTextToSize(String(raw), wrapWidth);
      wrapped.forEach((line) => {
        if (y > pageH - margin) { pdf.addPage(); y = margin; }
        pdf.text(line, margin, y);
        y += lineSpacing;
      });
    });

    pdf.save(filename);
  }

  function downloadActiveBiAsSvg() {
    const canvas = getActiveBiCanvas();
    if (!canvas) return alert('No chart available to export yet.');

    const packet = buildBiReportPacket();
    const filename = `${getActiveBiFilenameBase()}_Report.svg`;

    const pngDataUrl = canvasToPngDataUrl(canvas);

    const pageW = 1240;
    const pageH = 1754;
    const margin = 70;

    const headerTopY = 90;
    const titleY = headerTopY;
    const subtitleY = titleY + 56;
    const generatedY = subtitleY + 34;
    const dividerY = generatedY + 30;
    const chartY = dividerY + 50;

    const title = safeTextForSvg(packet.title);
    const subtitle = safeTextForSvg(packet.subtitle);
    const generated = safeTextForSvg(`Generated: ${packet.generatedAt}`);

    const chartMaxW = pageW - margin * 2;
    const chartMaxH = 520;

    const ratio = canvas.width / canvas.height || 1;
    let chartW = chartMaxW;
    let chartH = chartW / ratio;
    if (chartH > chartMaxH) { chartH = chartMaxH; chartW = chartH * ratio; }
    const chartX = margin + (chartMaxW - chartW) / 2;

    const analysisStartY = chartY + chartH + 80;
    const maxLines = 65;
    const lines = packet.lines.slice(0, maxLines).map((l) => safeTextForSvg(l));
    if (packet.lines.length > maxLines) lines.push(safeTextForSvg(`(Showing first ${maxLines} lines)`));
    const lineHeight = 26;

    const analysisText = lines
      .map((l, i) => {
        const yy = analysisStartY + i * lineHeight;
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
  ${analysisText}
</svg>`.trim();

    downloadBlob(filename, new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
  }

  /* =========================
     AUTH TABS + FLOWS
  ========================== */
  function wireAuthTabs() {
    if (els.tabLogin) {
      els.tabLogin.onclick = () => {
        els.tabLogin.classList.add('active');
        els.tabRegister && els.tabRegister.classList.remove('active');
        els.loginForm && els.loginForm.classList.remove('hidden');
        els.registerForm && els.registerForm.classList.add('hidden');
        setAuthStatus('');
      };
    }
    if (els.tabRegister) {
      els.tabRegister.onclick = () => {
        els.tabRegister.classList.add('active');
        els.tabLogin && els.tabLogin.classList.remove('active');
        els.registerForm && els.registerForm.classList.remove('hidden');
        els.loginForm && els.loginForm.classList.add('hidden');
        setAuthStatus('');
      };
    }

    if (els.registerIsAdmin) {
      els.registerIsAdmin.addEventListener('change', () => {
        const checked = els.registerIsAdmin.checked;
        if (!els.registerOrgTokenRow) return;
        els.registerOrgTokenRow.classList.toggle('hidden', !checked);
        if (!checked) {
          if (els.registerOrgToken) els.registerOrgToken.value = '';
          if (els.registerOrgName) els.registerOrgName.value = '';
        }
      });
    }
  }

  async function handleLogin(e) {
    e.preventDefault();
    setAuthStatus('Logging in...');

    const orgTokenVal = (els.loginOrgToken?.value || '').trim();

    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: /* no auth header */ JSON.stringify({
          email: (els.loginEmail?.value || '').trim(),
          password: els.loginPassword?.value || ''
        })
      });
      const data = await safeJson(res);
      if (!res.ok) throw new Error(data.error || 'Login failed');

      auth.setToken(data.token);
      await loadSession();
      setAuthStatus('');

      if (orgTokenVal) await joinOrgByToken(orgTokenVal);
    } catch (err) {
      setAuthStatus(`Error: ${err.message}`);
    }
  }

  async function handleRegister(e) {
    e.preventDefault();
    setAuthStatus('Creating account...');

    const isAdmin = !!els.registerIsAdmin?.checked;
    const orgTokenVal = (els.registerOrgToken?.value || '').trim();
    const orgNameVal = (els.registerOrgName?.value || '').trim();
    const secQuestion = els.registerSecurityQuestion?.value || '';
    const secAnswer = (els.registerSecurityAnswer?.value || '').trim();

    if (!secQuestion) return setAuthStatus('Please select a security question.');
    if (!secAnswer) return setAuthStatus('Please provide an answer to your security question.');

    if (isAdmin) {
      if (!/^\d{6}$/.test(orgTokenVal)) return setAuthStatus('Admin accounts must set a 6-digit organization token.');
      if (els.registerOrgName && !orgNameVal) return setAuthStatus('Admin accounts must enter an organization name.');
    }

    try {
      const emailVal = (els.registerEmail?.value || '').trim();
      const res = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: (els.registerName?.value || '').trim(),
          email: emailVal,
          password: els.registerPassword?.value || '',
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
        auth.setToken(data.token);
        await loadSession();
        setAuthStatus('');
        return;
      }

      setAuthStatus('');
      alert('Your participant account was created successfully.\n\nPlease log in using the 6-digit organization token that was shared with you by your workspace admin.');

      // flip to login
      els.tabLogin?.classList.add('active');
      els.tabRegister?.classList.remove('active');
      els.loginForm?.classList.remove('hidden');
      els.registerForm?.classList.add('hidden');

      if (els.loginEmail) els.loginEmail.value = emailVal;
      if (els.loginPassword) els.loginPassword.value = '';
    } catch (err) {
      setAuthStatus(`Error: ${err.message}`);
    }
  }

  function handleLogout() {
    auth.setToken(null);
    S.currentUser = null;
    S.orgs = [];
    setCurrentOrgId(null);
    S.projects = [];
    setCurrentProjectId(null);
    S.board = { project: null, columns: [], tasks: [], members: [] };
    S.selectedTaskId = null;
    S.dragTaskId = null;
    S.dragFromColumnId = null;
    S.projectCompletion = {};
    S.projectListDnDInitialized = false;

    if (S.biChart) { try { S.biChart.destroy(); } catch {} }
    if (S.biTaskChart) { try { S.biTaskChart.destroy(); } catch {} }
    S.biChart = null;
    S.biTaskChart = null;

    setBiDownloadButtonsEnabled(false);

    show(els.authPanel, true);
    show(els.appPanel, false);
    els.logoutBtn && els.logoutBtn.classList.add('hidden');
    els.orgSwitcher && els.orgSwitcher.classList.add('hidden');

    setText(els.userNameSpan, '');
    setText(els.userEmailSpan, '');

    document.body && document.body.classList.remove('theme-suite','theme-ops','theme-bi','theme-fleet','theme-radar');

    setActiveView('suite');
    setBrandLoggedOut();
  }

  /* =========================
     RESET PASSWORD / TOKEN
  ========================== */
  function wireResets() {
    if (els.linkResetPassword) {
      els.linkResetPassword.onclick = async () => {
        const email = (prompt('Enter your email address:') || '').trim();
        if (!email) return;

        try {
          const qRes = await fetch(`${API_BASE_URL}/api/auth/security-question?email=${encodeURIComponent(email)}`);
          const qData = await safeJson(qRes);
          if (!qRes.ok) throw new Error(qData.error || 'Could not find that email.');

          const answer = (prompt(`Security question:\n${qData.security_question}\n\nEnter your answer:`) || '').trim();
          if (!answer) return;

          const newPassword = (prompt('Enter your new password (minimum 6 characters):') || '').trim();
          if (!newPassword) return;
          if (newPassword.length < 6) return alert('Password must be at least 6 characters.');

          const rRes = await fetch(`${API_BASE_URL}/api/auth/reset-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, security_answer: answer, new_password: newPassword })
          });
          const rData = await safeJson(rRes);
          if (!rRes.ok) throw new Error(rData.error || 'Password reset failed.');

          alert('Password reset successfully. You can now log in with your new password.');
        } catch (err) {
          alert(`Password reset error: ${err.message}`);
        }
      };
    }

    if (els.linkResetToken) {
      els.linkResetToken.onclick = async () => {
        const email = (prompt('Admin email (owner of the workspace):') || '').trim();
        if (!email) return;

        const password = (prompt('Admin account password:') || '').trim();
        if (!password) return;

        const newToken = (prompt('New 6-digit organization token:') || '').trim();
        if (!/^\d{6}$/.test(newToken)) return alert('Token must be exactly 6 digits.');

        try {
          const res = await fetch(`${API_BASE_URL}/api/auth/reset-org-token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, new_token: newToken })
          });
          const data = await safeJson(res);
          if (!res.ok) throw new Error(data.error || 'Failed to reset token.');

          alert(`Organization token updated successfully.\n\nNew token: ${data.join_token}`);
        } catch (err) {
          alert(`Token reset error: ${err.message}`);
        }
      };
    }
  }

  /* =========================
     SESSION LOADING
  ========================== */
  async function loadSession() {
    const token = auth.getToken();
    if (!token) {
      show(els.authPanel, true);
      show(els.appPanel, false);
      els.logoutBtn && els.logoutBtn.classList.add('hidden');
      els.orgSwitcher && els.orgSwitcher.classList.add('hidden');
      setBiDownloadButtonsEnabled(false);
      document.body && document.body.classList.remove('theme-suite','theme-ops','theme-bi','theme-fleet','theme-radar');
      setActiveView('suite');
      setBrandLoggedOut();
      return;
    }

    try {
      const data = await api('/api/me');
      S.currentUser = data.user;
      S.orgs = data.orgs || [];

      setText(els.userNameSpan, S.currentUser?.name || '');
      setText(els.userEmailSpan, S.currentUser?.email || '');

      show(els.authPanel, false);
      show(els.appPanel, true);
      els.logoutBtn && els.logoutBtn.classList.remove('hidden');
      els.orgSwitcher && els.orgSwitcher.classList.remove('hidden');

      // view
      const initialView = storage.getStr(KEYS.lastView) || 'suite';

      // org
      const storedOrgId = storage.getNum(KEYS.lastOrg);
      if (storedOrgId && S.orgs.some((o) => o.id === storedOrgId)) setCurrentOrgId(storedOrgId);
      else if (!S.currentOrgId && S.orgs.length) setCurrentOrgId(S.orgs[0].id);

      setActiveView(initialView);
      setBrandForView(S.currentView);

      renderOrgOptions();

      if (S.currentOrgId) {
        if (els.orgSelect) els.orgSelect.value = String(S.currentOrgId);
        await loadProjectsForOrg(S.currentOrgId);
        await loadActivity(S.currentOrgId);
      }
    } catch (err) {
      auth.setToken(null);
      setAuthStatus(`Session error: ${err.message}`);
      show(els.authPanel, true);
      show(els.appPanel, false);
      setBiDownloadButtonsEnabled(false);
      setActiveView('suite');
      setBrandLoggedOut();
    }
  }

  function renderOrgOptions() {
    if (!els.orgSelect) return;
    els.orgSelect.innerHTML = '';
    S.orgs.forEach((org) => {
      const opt = document.createElement('option');
      opt.value = org.id;
      opt.textContent = org.name;
      els.orgSelect.appendChild(opt);
    });
  }

  /* =========================
     PROJECT ORDER (DnD)
  ========================== */
  const projectOrderKey = (orgId) => `${KEYS.projectOrderPrefix}${orgId}`;

  function loadProjectOrder(orgId) {
    if (!orgId) return [];
    try {
      const raw = localStorage.getItem(projectOrderKey(orgId));
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function saveProjectOrder(orgId) {
    if (!orgId || !els.projectListEl) return;
    const order = [];
    els.projectListEl.querySelectorAll('li[data-id]').forEach((li) => order.push(Number(li.dataset.id)));
    try {
      localStorage.setItem(projectOrderKey(orgId), JSON.stringify(order));
    } catch {}
  }

  function getProjectAfterElement(container, y) {
    const items = [...container.querySelectorAll('li[data-id]:not(.dragging)')];
    return items.reduce(
      (closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) return { offset, element: child };
        return closest;
      },
      { offset: Number.NEGATIVE_INFINITY, element: null }
    ).element;
  }

  /* =========================
     ORGS / PROJECTS / ACTIVITY
  ========================== */
  async function joinOrgByToken(token) {
    const trimmed = (token || '').trim();
    if (!trimmed) return;

    try {
      const data = await api('/api/orgs/join-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: trimmed })
      });

      // prefer joined org
      storage.setStr(KEYS.lastOrg, String(data.organization.id));
      await loadSession();
      alert(`Joined organization: ${data.organization.name}`);
    } catch (err) {
      alert(`Organization token error: ${err.message}`);
    }
  }

  async function refreshProjectCompletion(orgId) {
    S.projectCompletion = {};
    if (!orgId) return;
    try {
      const data = await api(`/api/orgs/${orgId}/bi-summary`);
      const summary = data.projects || [];
      summary.forEach((p) => {
        const total = (p.in_progress || 0) + (p.review || 0) + (p.complete || 0);
        S.projectCompletion[p.project_id] = total > 0 && p.complete === total;
      });
    } catch (err) {
      console.error('refreshProjectCompletion error:', err.message);
    }
  }

  async function loadProjectsForOrg(orgId) {
    if (!els.projectListEl) return;
    els.projectListEl.innerHTML = '';

    try {
      const data = await api(`/api/orgs/${orgId}/projects`);
      S.projects = data.projects || [];

      await refreshProjectCompletion(orgId);

      // pick project
      if (!S.currentProjectId) {
        const stored = storage.getNum(KEYS.lastProject);
        if (stored && S.projects.some((p) => p.id === stored)) setCurrentProjectId(stored);
        else if (S.projects.length) setCurrentProjectId(S.projects[0].id);
      } else if (!S.projects.some((p) => p.id === S.currentProjectId)) {
        setCurrentProjectId(S.projects.length ? S.projects[0].id : null);
      }

      renderProjectList();

      if (S.currentProjectId) await loadBoard(S.currentProjectId);
      else {
        S.board = { project: null, columns: [], tasks: [], members: [] };
        renderBoard();
        renderTaskDetail(null);
        renderFleetView();
      }
    } catch (err) {
      setText(els.projectListEl, `Error: ${err.message}`);
    }
  }

  function renderProjectList() {
    if (!els.projectListEl) return;
    els.projectListEl.innerHTML = '';

    if (!S.projects.length) {
      const li = document.createElement('li');
      li.textContent = 'No projects yet.';
      els.projectListEl.appendChild(li);
      return;
    }

    const ordered = [...S.projects];
    const order = S.currentOrgId ? loadProjectOrder(S.currentOrgId) : [];
    if (order.length) {
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
      if (p.id === S.currentProjectId) li.classList.add('selected');

      const nameSpan = document.createElement('span');
      nameSpan.classList.add('project-name-text');
      nameSpan.textContent = p.name;
      li.appendChild(nameSpan);

      if (S.projectCompletion[p.id]) {
        const check = document.createElement('span');
        check.textContent = ' ✓';
        check.classList.add('project-done-check');
        li.appendChild(check);
        li.classList.add('project-done');
      }

      li.addEventListener('click', async () => {
        if (li.classList.contains('dragging') || li.classList.contains('dragging-project')) return;
        setCurrentProjectId(p.id);
        renderProjectList();
        await loadBoard(S.currentProjectId);
      });

      li.addEventListener('dragstart', () => li.classList.add('dragging', 'dragging-project'));
      li.addEventListener('dragend', () => {
        li.classList.remove('dragging', 'dragging-project');
        saveProjectOrder(S.currentOrgId);
      });

      els.projectListEl.appendChild(li);
    });

    if (!S.projectListDnDInitialized) {
      els.projectListEl.addEventListener('dragover', (e) => {
        e.preventDefault();
        const dragging = els.projectListEl.querySelector('li.dragging');
        if (!dragging) return;
        const after = getProjectAfterElement(els.projectListEl, e.clientY);
        if (!after) els.projectListEl.appendChild(dragging);
        else els.projectListEl.insertBefore(dragging, after);
      });
      S.projectListDnDInitialized = true;
    }
  }

  async function loadActivity(orgId) {
    if (!els.activityListEl) return;
    els.activityListEl.innerHTML = '';

    try {
      const data = await api(`/api/orgs/${orgId}/activity`);
      const acts = data.activities || [];
      if (!acts.length) {
        const li = document.createElement('li');
        li.textContent = 'No recent activity.';
        els.activityListEl.appendChild(li);
        return;
      }

      acts.forEach((a) => {
        const li = document.createElement('li');
        const ts = new Date(a.created_at).toLocaleString();
        const actor = a.actor_name || 'System';
        li.textContent = `[${ts}] ${actor}: ${a.type}`;
        els.activityListEl.appendChild(li);
      });
    } catch (err) {
      const li = document.createElement('li');
      li.textContent = `Error: ${err.message}`;
      els.activityListEl.appendChild(li);
    }
  }

  /* =========================
     BI DASHBOARD (WORKING)
  ========================== */
  function ensureCanvasHasHeight(canvas, fallbackPx = 360) {
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;
    const h = parent.getBoundingClientRect().height;
    if (h < 40) parent.style.height = `${fallbackPx}px`;
  }

  async function loadBiDashboard() {
    if (S.currentView !== 'bi') return;
    if (!els.biMeta || !els.biChartCanvas) return;

    if (!S.currentOrgId) {
      setText(els.biMeta, 'Select an organization first.');
      if (S.biChart) { try { S.biChart.destroy(); } catch {} S.biChart = null; }
      if (S.biTaskChart) { try { S.biTaskChart.destroy(); } catch {} S.biTaskChart = null; }
      setBiDownloadButtonsEnabled(false);
      return;
    }

    setText(els.biMeta, 'Loading insights...');
    els.biTaskChartArea && els.biTaskChartArea.classList.add('hidden');

    try {
      const data = await api(`/api/orgs/${S.currentOrgId}/bi-summary`);
      const summary = data.projects || [];
      S.lastBiSummary = summary;

      if (!summary.length) {
        setText(els.biMeta, 'No projects.');
        if (S.biChart) { try { S.biChart.destroy(); } catch {} S.biChart = null; }
        if (S.biTaskChart) { try { S.biTaskChart.destroy(); } catch {} S.biTaskChart = null; }
        S.projectCompletion = {};
        renderProjectList();
        setBiDownloadButtonsEnabled(false);
        return;
      }

      // refresh completion + project list checkmarks
      S.projectCompletion = {};
      summary.forEach((p) => {
        const total = (p.in_progress || 0) + (p.review || 0) + (p.complete || 0);
        S.projectCompletion[p.project_id] = total > 0 && p.complete === total;
      });
      renderProjectList();

      const labels = summary.map((p) => p.project_name);
      const inProgressData = summary.map((p) => p.in_progress || 0);
      const reviewData = summary.map((p) => p.review || 0);
      const completeData = summary.map((p) => p.complete || 0);

      if (!window.Chart) throw new Error('Chart.js not loaded. Check your index.html script tag.');
      ensureCanvasHasHeight(els.biChartCanvas, 360);

      const { text, border2 } = getChartThemeTokens();

      if (S.biChart) { try { S.biChart.destroy(); } catch {} }
      const ctx = els.biChartCanvas.getContext('2d');

      S.biChart = new Chart(ctx, {
        type: 'bar',
        data: {
          labels,
          datasets: [
            { label: 'In Progress', data: inProgressData, backgroundColor: 'rgba(59,130,246,0.8)' },
            { label: 'Review', data: reviewData, backgroundColor: 'rgba(234,179,8,0.8)' },
            { label: 'Complete', data: completeData, backgroundColor: 'rgba(34,197,94,0.8)' }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: {
              stacked: true,
              ticks: { color: text },
              grid: { color: border2 },
              border: { color: border2 }
            },
            y: {
              stacked: true,
              beginAtZero: true,
              ticks: { color: text },
              grid: { color: border2 },
              border: { color: border2 }
            }
          },
          plugins: {
            legend: { position: 'bottom', labels: { color: text } },
            tooltip: {
              callbacks: {
                afterBody(ctxItems) {
                  const idx = ctxItems[0].dataIndex;
                  const proj = summary[idx];
                  const owners = proj.assignees?.length ? `Owners: ${proj.assignees.join(', ')}` : 'Owners: (none)';
                  const deadline =
                    proj.days_left != null ? `Due soonest in ${proj.days_left} day(s)` : 'No future deadlines recorded';
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

      syncChartsToTheme();

      setText(els.biMeta, 'Click a project bar to see its tasks.');
      setBiDownloadButtonsEnabled(true);
    } catch (err) {
      setText(els.biMeta, `Error: ${err.message}`);
      setBiDownloadButtonsEnabled(false);
    }
  }

  async function loadBiTaskDrilldown(projectId, projectName) {
    if (!els.biTaskChartArea || !els.biTaskChartTitle || !els.biTaskChartCanvas) return;

    els.biTaskChartArea.classList.remove('hidden');
    els.biTaskChartTitle.textContent = `Tasks – ${projectName}`;
    S.lastBiDrilldownProjectName = projectName;

    try {
      const data = await api(`/api/projects/${projectId}/board`);
      const tasks = data.tasks || [];
      S.lastBiDrilldownTasks = tasks;

      const labels = tasks.map((t) => t.title);
      const daysLeft = tasks.map((t) => (t.due_date ? computeDaysLeft(t.due_date) : null));

      if (!window.Chart) throw new Error('Chart.js not loaded. Check your index.html script tag.');
      ensureCanvasHasHeight(els.biTaskChartCanvas, 320);

      const { text, border2 } = getChartThemeTokens();

      if (S.biTaskChart) { try { S.biTaskChart.destroy(); } catch {} }
      const ctx = els.biTaskChartCanvas.getContext('2d');

      S.biTaskChart = new Chart(ctx, {
        type: 'bar',
        data: { labels, datasets: [{ label: 'Days Left', data: daysLeft, backgroundColor: 'rgba(99,102,241,0.8)' }] },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: {
              ticks: { color: text },
              grid: { color: border2 },
              border: { color: border2 }
            },
            y: {
              ticks: { color: text },
              grid: { color: border2 },
              border: { color: border2 }
            }
          },
          plugins: {
            legend: { position: 'top', labels: { color: text } },
            tooltip: {
              callbacks: {
                // ✅ UPDATED: due date shows DATE ONLY (no time)
                afterBody(c) {
                  const t = tasks[c[0].dataIndex];
                  const member = (S.board.members || []).find((m) => m.id === t.assigned_to) || null;
                  return [
                    `Due: ${t.due_date ? formatDateShort(t.due_date) : 'N/A'}`,
                    `Priority: ${t.priority}`,
                    `Assigned: ${member ? member.name : 'None'}`
                  ];
                }
              }
            }
          }
        }
      });

      syncChartsToTheme();
      setBiDownloadButtonsEnabled(true);
    } catch (err) {
      setText(els.biMeta, `Error: ${err.message}`);
      setBiDownloadButtonsEnabled(false);
    }
  }

  /* =========================
     FLEET
  ========================== */
  function renderFleetView() {
    if (!els.fleetListEl) return;
    els.fleetListEl.innerHTML = '';

    const members = S.board.members || [];
    const tasks = S.board.tasks || [];

    setText(els.fleetTotalCountEl, '–');
    setText(els.fleetProjectCountEl, '–');
    setText(els.fleetTasksPerPersonEl, '–');

    if (!S.board.project || !S.currentOrgId) {
      const li = document.createElement('li');
      li.textContent = 'Select a project to see your team.';
      els.fleetListEl.appendChild(li);
      setText(
        els.fleetFocusTextEl,
        'Once hooked to data, this panel will highlight who is overloaded, who is free for new work, and suggested rebalancing moves.'
      );
      return;
    }

    const totalMembers = members.length;
    const totalTasks = tasks.length;
    const tasksPerPerson = totalMembers > 0 ? (totalTasks / totalMembers).toFixed(1) : '0.0';

    setText(els.fleetTotalCountEl, String(totalMembers));
    const projectCount = S.projects.filter((p) => p.org_id === S.currentOrgId).length || S.projects.length || 1;
    setText(els.fleetProjectCountEl, String(projectCount));
    setText(els.fleetTasksPerPersonEl, tasksPerPerson);

    if (!members.length) {
      const li = document.createElement('li');
      li.textContent = 'No members in this workspace yet.';
      els.fleetListEl.appendChild(li);
    } else {
      const doneColumnIds = S.board.columns.filter((c) => /done|complete/i.test(c.name || '')).map((c) => c.id);

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
        els.fleetListEl.appendChild(li);
      });
    }

    setText(
      els.fleetFocusTextEl,
      `In this project, ${totalMembers || 'no'} member(s) are sharing ${totalTasks || 'no'} task(s), for an average of ${tasksPerPerson} tasks per person. As you assign more work, this panel will surface who is overloaded and who has room for new work.`
    );
  }

  /* =========================
     RADAR
  ========================== */
  async function handleRadarClick(projectId, taskId = null) {
    if (!projectId) return;

    setCurrentProjectId(projectId);
    setActiveView('ops');
    await loadBoard(projectId);

    if (taskId && els.boardEl) {
      const task = (S.board.tasks || []).find((t) => t.id === taskId);
      if (task) {
        S.selectedTaskId = taskId;
        renderTaskDetail(taskId);
        const card = els.boardEl.querySelector(`.task-card[data-task-id="${taskId}"]`);
        card && card.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
      }
    }
  }

  async function loadRadarSnapshot() {
    if (!els.radarOverdueList || !els.radarProjectsList || !els.radarUpcomingList) return;

    els.radarOverdueList.innerHTML = '';
    els.radarProjectsList.innerHTML = '';
    els.radarUpcomingList.innerHTML = '';

    if (!S.currentOrgId) {
      const msg = document.createElement('li');
      msg.textContent = 'Select an organization to see portfolio radar.';
      els.radarOverdueList.appendChild(msg);
      return;
    }

    try {
      const data = await api(`/api/orgs/${S.currentOrgId}/bi-summary`);
      const summary = data.projects || [];
      if (!summary.length) {
        const msg = document.createElement('li');
        msg.textContent = 'No projects in this organization yet.';
        els.radarOverdueList.appendChild(msg);
        return;
      }

      // overdue tasks across projects
      const overdueItems = [];
      await Promise.all(
        summary.map(async (p) => {
          try {
            const tData = await api(`/api/projects/${p.project_id}/bi-tasks`);
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
          } catch {}
        })
      );

      overdueItems.sort((a, b) => a.daysLeft - b.daysLeft);
      if (overdueItems.length) {
        overdueItems.slice(0, 6).forEach((item) => {
          const li = document.createElement('li');
          li.textContent = `${item.taskTitle} (${item.projectName}) - overdue by ${Math.abs(item.daysLeft)} day(s)`;
          li.classList.add('radar-clickable');
          li.style.cursor = 'pointer';
          li.addEventListener('click', () => handleRadarClick(item.projectId, item.taskId));
          els.radarOverdueList.appendChild(li);
        });
      } else {
        const li = document.createElement('li');
        li.textContent = 'No overdue tasks 😎🥳';
        els.radarOverdueList.appendChild(li);
      }

      // at-risk projects
      const atRisk = [...summary].sort((a, b) => {
        const activeA = (a.in_progress || 0) + (a.review || 0);
        const activeB = (b.in_progress || 0) + (b.review || 0);
        if (activeB !== activeA) return activeB - activeA;
        return (a.days_left ?? 9999) - (b.days_left ?? 9999);
      });

      atRisk.slice(0, 5).forEach((p) => {
        const totalActive = (p.in_progress || 0) + (p.review || 0);
        const dl = p.days_left != null ? (p.days_left === 0 ? 'due today' : `soonest due in ${p.days_left} day(s)`) : 'no upcoming deadlines recorded';
        const li = document.createElement('li');
        li.textContent = `${p.project_name}: ${totalActive} active task(s), ${dl}`;
        li.classList.add('radar-clickable');
        li.style.cursor = 'pointer';
        li.addEventListener('click', () => handleRadarClick(p.project_id, null));
        els.radarProjectsList.appendChild(li);
      });

      // upcoming deadlines
      const withDeadline = summary.filter((p) => typeof p.days_left === 'number').sort((a, b) => (a.days_left ?? 9999) - (b.days_left ?? 9999));
      if (withDeadline.length) {
        withDeadline.slice(0, 5).forEach((p) => {
          const li = document.createElement('li');
          li.textContent =
            p.days_left === 0 ? `${p.project_name}: due today`
            : p.days_left > 0 ? `${p.project_name}: due in ${p.days_left} day(s)`
            : `${p.project_name}: timeline not set`;
          li.classList.add('radar-clickable');
          li.style.cursor = 'pointer';
          li.addEventListener('click', () => handleRadarClick(p.project_id, null));
          els.radarUpcomingList.appendChild(li);
        });
      } else {
        const li = document.createElement('li');
        li.textContent = 'No upcoming deadlines recorded.';
        els.radarUpcomingList.appendChild(li);
      }
    } catch (err) {
      const li = document.createElement('li');
      li.textContent = `Error: ${err.message}`;
      els.radarOverdueList.appendChild(li);
    }
  }

  /* =========================
     BOARD (OPS)
  ========================== */
  async function loadBoard(projectId) {
    if (!projectId) {
      S.board = { project: null, columns: [], tasks: [], members: [] };
      setText(els.boardProjectNameEl, 'Select a project to see board.');
      setText(els.boardProjectDescEl, '');
      renderBoard();
      renderTaskDetail(null);
      renderFleetView();
      return;
    }

    setCurrentProjectId(projectId);
    setText(els.boardProjectNameEl, 'Loading...');
    setText(els.boardProjectDescEl, '');
    if (els.boardEl) els.boardEl.innerHTML = '';

    try {
      const data = await api(`/api/projects/${projectId}/board`);
      S.board = {
        project: data.project,
        columns: data.columns || [],
        tasks: data.tasks || [],
        members: data.members || []
      };

      setText(els.boardProjectNameEl, data.project.name);
      setText(els.boardProjectDescEl, data.project.description || '');

      // update completion for ✓
      const doneColumnIds = S.board.columns.filter((c) => /done|complete/i.test(c.name || '')).map((c) => c.id);
      const total = S.board.tasks.length;
      const complete = S.board.tasks.filter((t) => doneColumnIds.includes(t.column_id)).length;
      if (S.board.project) S.projectCompletion[S.board.project.id] = total > 0 && complete === total;

      renderProjectList();
      renderBoard();
      renderTaskDetail(null);
      renderFleetView();
    } catch (err) {
      setText(els.boardProjectNameEl, 'Error loading project');
      setText(els.boardProjectDescEl, err.message);
    }
  }

  function tasksInColumn(columnId) {
    return (S.board.tasks || []).filter((t) => t.column_id === columnId).sort((a, b) => a.position - b.position);
  }

  function renderBoard() {
    if (!els.boardEl) return;
    els.boardEl.innerHTML = '';

    if (!S.board.project) {
      const div = document.createElement('div');
      div.textContent = 'Select a project to see board.';
      els.boardEl.appendChild(div);
      return;
    }

    S.board.columns.forEach((col) => {
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

      // ✅ MOD: allow dropping onto whole column (including header)
      const allowDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
      };

      colDiv.addEventListener('dragover', allowDrop);
      colDiv.addEventListener('drop', handleColumnDrop);
      header.addEventListener('dragover', allowDrop);
      header.addEventListener('drop', handleColumnDrop);
      body.addEventListener('dragover', allowDrop);
      body.addEventListener('drop', handleColumnDrop);

      colTasks.forEach((task) => body.appendChild(renderTaskCard(task)));
      colDiv.appendChild(header);
      colDiv.appendChild(body);
      els.boardEl.appendChild(colDiv);
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
      S.selectedTaskId = task.id;
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
    if (task.due_date) dueSpan.textContent = new Date(task.due_date).toLocaleDateString();

    meta.appendChild(prioritySpan);
    meta.appendChild(dueSpan);

    card.appendChild(title);
    card.appendChild(meta);

    return card;
  }

  /* =========================
     DRAG & DROP (TASKS)
     ✅ MODS:
     - Firefox/Safari setData
     - Drop works on column/header/body
     - Target resolution via closest(.column)
  ========================== */
  function handleTaskDragStart(e) {
    e.stopPropagation();
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      // ✅ MOD: needed for Firefox/Safari
      e.dataTransfer.setData('text/plain', String(e.currentTarget?.dataset?.taskId || ''));
    }
    const card = e.currentTarget;
    S.dragTaskId = Number(card.dataset.taskId);
    S.dragFromColumnId = Number(card.dataset.columnId);
    card.classList.add('dragging');
  }

  function handleTaskDragEnd(e) {
    e.stopPropagation();
    e.currentTarget.classList.remove('dragging');
    S.dragTaskId = null;
    S.dragFromColumnId = null;
  }

  async function moveTaskToColumn(taskId, columnId) {
    if (!taskId || !columnId || !S.board.project) return;

    try {
      await api(`/api/tasks/${taskId}/move`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to_column_id: columnId })
      });

      await loadBoard(S.board.project.id);
      if (S.currentView !== 'ops') setActiveView('ops');
    } catch (err) {
      alert(err.message);
    } finally {
      S.dragTaskId = null;
      S.dragFromColumnId = null;
    }
  }

  async function handleColumnDrop(e) {
    e.preventDefault();
    e.stopPropagation();

    const colEl = e.currentTarget?.closest?.('.column') || e.target?.closest?.('.column');
    const columnId = Number(colEl?.dataset?.columnId || e.currentTarget?.dataset?.columnId);

    let taskId = S.dragTaskId;
    if (!taskId && e.dataTransfer) {
      const raw = e.dataTransfer.getData('text/plain');
      const n = Number(raw);
      if (!Number.isNaN(n) && n > 0) taskId = n;
    }

    if (!taskId || !columnId) return;
    await moveTaskToColumn(taskId, columnId);
  }

  /* =========================
     TOUCH DRAG (TASKS + PROJECTS)
  ========================== */
  function isTouchLikeDevice() {
    return (
      'ontouchstart' in window ||
      (navigator && typeof navigator.maxTouchPoints === 'number' && navigator.maxTouchPoints > 0) ||
      (navigator && typeof navigator.msMaxTouchPoints === 'number' && navigator.msMaxTouchPoints > 0)
    );
  }

  function initTouchDnD() {
    if (!isTouchLikeDevice()) return;
    initTouchTaskDnD();
    initTouchProjectDnD();
  }

  function initTouchTaskDnD() {
    if (!els.boardEl) return;
    els.boardEl.addEventListener('touchstart', onTaskTouchStart, { passive: true });

    function onTaskTouchStart(e) {
      const card = e.target.closest('.task-card');
      if (!card) return;

      const touch = e.touches[0];
      S.touchTaskDragState = {
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
      const st = S.touchTaskDragState;
      if (!st) return;
      const touch = e.touches[0];
      const dx = touch.clientX - st.startX;
      const dy = touch.clientY - st.startY;
      const distanceSq = dx * dx + dy * dy;

      if (!st.isDragging) {
        if (distanceSq < 100) return; // ~10px
        st.isDragging = true;
        S.dragTaskId = st.taskId;
        S.dragFromColumnId = st.startColId;
        st.card.classList.add('dragging');
      }
      e.preventDefault();
    }

    async function onTaskTouchEnd(e) {
      const st = S.touchTaskDragState;
      if (!st) return;

      const { card, taskId, startColId, isDragging } = st;
      S.touchTaskDragState = null;

      window.removeEventListener('touchmove', onTaskTouchMove);
      window.removeEventListener('touchend', onTaskTouchEnd);
      window.removeEventListener('touchcancel', onTaskTouchEnd);

      if (!isDragging) return;

      e.preventDefault();
      card.classList.remove('dragging');

      const touch = e.changedTouches[0];
      const el = document.elementFromPoint(touch.clientX, touch.clientY);

      // ✅ MOD: allow dropping onto column OR column-body
      const col = el && el.closest('.column, .column-body, .column-header');
      const toColumnId = col ? Number(col.dataset.columnId || col.closest('.column')?.dataset?.columnId) : startColId;

      if (!toColumnId || toColumnId === startColId) {
        S.dragTaskId = null;
        S.dragFromColumnId = null;
        return;
      }

      await moveTaskToColumn(taskId, toColumnId);
    }
  }

  function initTouchProjectDnD() {
    if (!els.projectListEl) return;
    els.projectListEl.addEventListener('touchstart', onProjectTouchStart, { passive: true });

    function onProjectTouchStart(e) {
      const li = e.target.closest('li[data-id]');
      if (!li) return;

      const touch = e.touches[0];
      S.touchProjectDragState = { li, startX: touch.clientX, startY: touch.clientY, isDragging: false };

      window.addEventListener('touchmove', onProjectTouchMove, { passive: false });
      window.addEventListener('touchend', onProjectTouchEnd, { passive: false });
      window.addEventListener('touchcancel', onProjectTouchEnd, { passive: false });
    }

    function onProjectTouchMove(e) {
      const st = S.touchProjectDragState;
      if (!st) return;

      const touch = e.touches[0];
      const dx = touch.clientX - st.startX;
      const dy = touch.clientY - st.startY;
      const distanceSq = dx * dx + dy * dy;

      if (!st.isDragging) {
        if (distanceSq < 100) return;
        st.isDragging = true;
        st.li.classList.add('dragging', 'dragging-project');
      }

      e.preventDefault();
      const after = getProjectAfterElement(els.projectListEl, touch.clientY);
      if (!after) els.projectListEl.appendChild(st.li);
      else els.projectListEl.insertBefore(st.li, after);
    }

    function onProjectTouchEnd(e) {
      const st = S.touchProjectDragState;
      if (!st) return;

      const { li, isDragging } = st;
      S.touchProjectDragState = null;

      window.removeEventListener('touchmove', onProjectTouchMove);
      window.removeEventListener('touchend', onProjectTouchEnd);
      window.removeEventListener('touchcancel', onProjectTouchEnd);

      if (!isDragging) return;

      e.preventDefault();
      li.classList.remove('dragging', 'dragging-project');
      saveProjectOrder(S.currentOrgId);
    }
  }

  /* =========================
     ADD COLUMNS & TASKS
  ========================== */
  async function addColumn() {
    if (!S.board.project) return alert('Select a project first.');
    const name = (prompt('Column name:') || '').trim();
    if (!name) return;

    try {
      await api(`/api/projects/${S.board.project.id}/columns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      await loadBoard(S.board.project.id);
    } catch (err) {
      alert(err.message);
    }
  }

  async function addTask() {
    if (!S.board.project) return alert('Select a project first.');
    if (!S.board.columns.length) return alert('Add a column first.');

    const title = (prompt('Task title:') || '').trim();
    if (!title) return;

    try {
      await api(`/api/projects/${S.board.project.id}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, column_id: S.board.columns[0].id })
      });
      await loadBoard(S.board.project.id);
    } catch (err) {
      alert(err.message);
    }
  }

  /* =========================
     TASK DETAIL + COMMENTS + ATTACHMENTS
  ========================== */
  async function loadComments(taskId) {
    if (!els.detailCommentsList) return;
    els.detailCommentsList.innerHTML = '';

    try {
      const data = await api(`/api/tasks/${taskId}/comments`);
      const comments = data.comments || [];
      if (!comments.length) {
        const li = document.createElement('li');
        li.textContent = 'No comments yet.';
        els.detailCommentsList.appendChild(li);
        return;
      }
      comments.forEach((c) => {
        const li = document.createElement('li');
        const ts = new Date(c.created_at).toLocaleString();
        li.innerHTML = `<strong>${c.author_name}</strong> <span class="muted">(${ts})</span><br/>${c.body}`;
        els.detailCommentsList.appendChild(li);
      });
    } catch (err) {
      const li = document.createElement('li');
      li.textContent = `Error: ${err.message}`;
      els.detailCommentsList.appendChild(li);
    }
  }

  async function loadAttachments(taskId) {
    if (!els.detailAttachmentsList) return;
    els.detailAttachmentsList.innerHTML = '';
    if (!taskId) return;

    try {
      const data = await api(`/api/tasks/${taskId}/attachments`);
      const attachments = data.attachments || [];

      if (!attachments.length) {
        const li = document.createElement('li');
        li.textContent = 'No attachments yet.';
        els.detailAttachmentsList.appendChild(li);
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

        const delBtn = document.createElement('button');
        delBtn.type = 'button';
        delBtn.textContent = 'Delete';
        delBtn.classList.add('attachment-delete-btn');

        delBtn.addEventListener('click', async () => {
          if (!confirm('Delete this attachment?')) return;
          try {
            setText(els.detailAttachmentStatus, 'Deleting attachment...');
            await api(`/api/attachments/${a.id}`, { method: 'DELETE' });
            await loadAttachments(taskId);
            setText(els.detailAttachmentStatus, 'Attachment deleted.');
            setTimeout(() => setText(els.detailAttachmentStatus, ''), 2000);
          } catch (err) {
            setText(els.detailAttachmentStatus, `Error: ${err.message}`);
          }
        });

        li.appendChild(link);
        if (metaSpan.textContent) li.appendChild(metaSpan);
        li.appendChild(delBtn);
        els.detailAttachmentsList.appendChild(li);
      });
    } catch (err) {
      const li = document.createElement('li');
      li.textContent = `Error: ${err.message}`;
      els.detailAttachmentsList.appendChild(li);
    }
  }

  function renderTaskDetail(taskId) {
    if (!els.taskDetailPanel) return;

    if (!taskId) {
      els.taskDetailPanel.classList.add('hidden');
      S.selectedTaskId = null;
      return;
    }

    const task = (S.board.tasks || []).find((t) => t.id === taskId);
    if (!task) {
      els.taskDetailPanel.classList.add('hidden');
      S.selectedTaskId = null;
      return;
    }

    S.selectedTaskId = taskId;
    els.taskDetailPanel.classList.remove('hidden');

    setText(els.detailTitleEl, task.title);

    const col = (S.board.columns || []).find((c) => c.id === task.column_id);
    const colName = col ? col.name : 'N/A';
    setText(els.detailMetaEl, `Column: ${colName} • Priority: ${task.priority}`);
    setText(els.detailDescriptionEl, task.description || '');

    if (els.detailInputTitle) els.detailInputTitle.value = task.title;
    if (els.detailInputDesc) els.detailInputDesc.value = task.description || '';
    if (els.detailInputPriority) els.detailInputPriority.value = task.priority || 'medium';
    if (els.detailInputDue) els.detailInputDue.value = task.due_date || '';

    if (els.detailInputAssignee) {
      els.detailInputAssignee.innerHTML = '<option value="">Unassigned</option>';
      (S.board.members || []).forEach((m) => {
        const opt = document.createElement('option');
        opt.value = m.id;
        opt.textContent = `${m.name} (${m.email})`;
        if (m.id === task.assigned_to) opt.selected = true;
        els.detailInputAssignee.appendChild(opt);
      });
    }

    setText(els.detailStatus, '');

    loadComments(taskId);
    loadAttachments(taskId);
  }

  async function saveTask() {
    if (!S.selectedTaskId) return;
    setText(els.detailStatus, 'Saving...');

    const payload = {
      title: (els.detailInputTitle?.value || '').trim(),
      description: (els.detailInputDesc?.value || '').trim(),
      priority: els.detailInputPriority?.value || 'medium',
      due_date: els.detailInputDue?.value || null,
      assigned_to: els.detailInputAssignee?.value || null
    };

    try {
      const data = await api(`/api/tasks/${S.selectedTaskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const i = (S.board.tasks || []).findIndex((t) => t.id === S.selectedTaskId);
      if (i !== -1) S.board.tasks[i] = data.task;

      setText(els.detailStatus, 'Saved.');
      renderBoard();
      renderTaskDetail(S.selectedTaskId);
      renderFleetView();
    } catch (err) {
      setText(els.detailStatus, `Error: ${err.message}`);
    }
  }

  async function deleteTask() {
    if (!S.selectedTaskId) return;
    if (!confirm('Delete this task permanently?')) return;

    try {
      await api(`/api/tasks/${S.selectedTaskId}`, { method: 'DELETE' });
      await loadBoard(S.board.project.id);
      renderTaskDetail(null);
    } catch (err) {
      alert(err.message);
    }
  }

  async function deleteProject() {
    if (!S.currentProjectId) return alert('Select a project first.');
    if (!confirm('Delete this project and ALL its tasks?')) return;

    try {
      await api(`/api/projects/${S.currentProjectId}`, { method: 'DELETE' });

      S.projects = S.projects.filter((p) => p.id !== S.currentProjectId);
      delete S.projectCompletion[S.currentProjectId];

      if (S.projects.length) setCurrentProjectId(S.projects[0].id);
      else {
        setCurrentProjectId(null);
        S.board = { project: null, columns: [], tasks: [], members: [] };
        renderBoard();
        renderTaskDetail(null);
        renderFleetView();
      }

      renderProjectList();
      if (S.currentProjectId) await loadBoard(S.currentProjectId);
      if (S.currentView === 'bi') loadBiDashboard();
      if (S.currentView === 'radar') loadRadarSnapshot();
    } catch (err) {
      alert(err.message);
    }
  }

  /* =========================
     WIRES
  ========================== */
  function wireMainUi() {
    // suite tabs
    els.suiteTabs.forEach((btn) => btn.addEventListener('click', () => setActiveView(btn.dataset.view)));

    // org switcher
    if (els.orgSelect) {
      els.orgSelect.onchange = async () => {
        setCurrentOrgId(Number(els.orgSelect.value));
        setCurrentProjectId(null);

        S.board = { project: null, columns: [], tasks: [], members: [] };
        renderBoard();
        renderTaskDetail(null);
        renderFleetView();

        await loadProjectsForOrg(S.currentOrgId);
        await loadActivity(S.currentOrgId);
        if (S.currentView === 'bi') loadBiDashboard();
        if (S.currentView === 'radar') loadRadarSnapshot();
      };
    }

    if (els.btnNewOrg) {
      els.btnNewOrg.onclick = async () => {
        const name = (prompt('New organization name:') || '').trim();
        if (!name) return;
        try {
          const data = await api('/api/orgs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name })
          });
          S.orgs.push(data);
          setCurrentOrgId(data.id);
          setCurrentProjectId(null);
          renderOrgOptions();
          if (els.orgSelect) els.orgSelect.value = String(S.currentOrgId);
          await loadProjectsForOrg(S.currentOrgId);
          await loadActivity(S.currentOrgId);
          if (S.currentView === 'bi') loadBiDashboard();
          if (S.currentView === 'radar') loadRadarSnapshot();
        } catch (err) {
          alert(err.message);
        }
      };
    }

    if (els.btnNewProject) {
      els.btnNewProject.onclick = async () => {
        if (!S.currentOrgId) return alert('Select an organization first.');
        const name = (prompt('Project name:') || '').trim();
        if (!name) return;
        const description = (prompt('Project description (optional):') || '').trim();

        try {
          const data = await api(`/api/orgs/${S.currentOrgId}/projects`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, description })
          });

          S.projects.unshift(data.project);
          setCurrentProjectId(data.project.id);
          S.projectCompletion[data.project.id] = false;

          renderProjectList();
          await loadBoard(S.currentProjectId);
          if (S.currentView === 'bi') loadBiDashboard();
          if (S.currentView === 'radar') loadRadarSnapshot();
        } catch (err) {
          alert(err.message);
        }
      };
    }

    if (els.btnAddColumn) els.btnAddColumn.onclick = addColumn;
    if (els.btnAddTask) els.btnAddTask.onclick = addTask;

    if (els.btnDeleteProject) els.btnDeleteProject.onclick = deleteProject;

    if (els.btnCloseDetail) els.btnCloseDetail.onclick = () => renderTaskDetail(null);
    if (els.detailSaveBtn) els.detailSaveBtn.onclick = saveTask;
    if (els.detailDeleteTaskBtn) els.detailDeleteTaskBtn.onclick = deleteTask;

    if (els.detailCommentForm) {
      els.detailCommentForm.onsubmit = async (e) => {
        e.preventDefault();
        if (!S.selectedTaskId) return;
        const body = (els.detailCommentBody?.value || '').trim();
        if (!body) return;

        try {
          await api(`/api/tasks/${S.selectedTaskId}/comments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ body })
          });
          if (els.detailCommentBody) els.detailCommentBody.value = '';
          loadComments(S.selectedTaskId);
        } catch (err) {
          alert(err.message);
        }
      };
    }

    if (els.detailAttachmentForm && els.detailAttachmentFile) {
      els.detailAttachmentForm.onsubmit = async (e) => {
        e.preventDefault();
        if (!S.selectedTaskId) return;

        const file = els.detailAttachmentFile.files[0];
        if (!file) return setText(els.detailAttachmentStatus, 'Please choose a file first.');

        try {
          setText(els.detailAttachmentStatus, 'Uploading attachment...');
          const formData = new FormData();
          formData.append('file', file);

          const res = await fetch(`${API_BASE_URL}/api/tasks/${S.selectedTaskId}/attachments`, {
            method: 'POST',
            headers: { ...auth.headers() }, // don't set content-type
            body: formData
          });
          const data = await safeJson(res);
          if (!res.ok) throw new Error(data.error || 'Failed to upload attachment');

          els.detailAttachmentFile.value = '';
          await loadAttachments(S.selectedTaskId);

          setText(els.detailAttachmentStatus, 'Attachment uploaded.');
          setTimeout(() => setText(els.detailAttachmentStatus, ''), 2000);
        } catch (err) {
          setText(els.detailAttachmentStatus, `Error: ${err.message}`);
        }
      };
    }

    if (els.logoutBtn) els.logoutBtn.onclick = handleLogout;

    // BI export buttons
    if (els.btnBiDownloadPdf) {
      els.btnBiDownloadPdf.addEventListener('click', () => {
        try { downloadActiveBiAsPdf(); } catch (e) { alert(`PDF export failed: ${e.message}`); }
      });
    }
    if (els.btnBiDownloadSvg) {
      els.btnBiDownloadSvg.addEventListener('click', () => {
        try { downloadActiveBiAsSvg(); } catch (e) { alert(`SVG export failed: ${e.message}`); }
      });
    }
    setBiDownloadButtonsEnabled(false);

    // login/register
    if (els.loginForm) els.loginForm.onsubmit = handleLogin;
    if (els.registerForm) els.registerForm.onsubmit = handleRegister;
  }

  /* =========================
     GLOBAL DRAG/DROP SAFETY
     ✅ MOD: include .column + header
  ========================== */
  function wireGlobalDnDSafety() {
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach((eventName) => {
      const handler = (e) => {
        if (!(e.target && e.target.closest && e.target.closest('.column, .column-header, .column-body, .task-card, #project-list'))) {
          e.preventDefault();
          e.stopPropagation();
        }
      };
      window.addEventListener(eventName, handler, false);
      document.addEventListener(eventName, handler, false);
      document.body && document.body.addEventListener(eventName, handler, false);
    });
  }

  /* =========================
     INIT
  ========================== */
  function init() {
    initTheme();
    setBrandLoggedOut();
    wireAuthTabs();
    wireResets();
    wireMainUi();
    wireGlobalDnDSafety();
    initTouchDnD();
    loadSession();
  }

  window.addEventListener('DOMContentLoaded', init);
})();
