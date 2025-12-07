// backend/server.js
const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const morgan = require('morgan');
const multer = require('multer');
const fs = require('fs');
const db = require('./db'); // uses mysql2 helper (get/all/run)

dotenv.config();

const app = express();
// Use 5500 so it matches frontend API_BASE_URL = 'http://localhost:5500'
const PORT = process.env.PORT || 5500;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

// ---- Middleware ----
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Serve frontend
const FRONTEND_PATH = path.join(__dirname, '..', 'frontend');
app.use(express.static(FRONTEND_PATH));

// Uploads directory
const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR);
}
const upload = multer({ dest: UPLOADS_DIR });

// ---- Auth helper ----
function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : null;
  if (!token) {
    return res.status(401).json({ error: 'Missing auth token' });
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = { id: payload.userId, email: payload.email };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// ---- Tiny helpers ----
function nowISO() {
  return new Date().toISOString().slice(0, 19).replace('T', ' ');
}

async function logActivity(orgId, userId, type, payload) {
  if (!orgId) return;
  await db.run(
    `INSERT INTO activity_log (org_id, user_id, type, payload_json, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [orgId, userId || null, type, JSON.stringify(payload || {}), nowISO()]
  );
}

// ---- Auth routes ----
// REGISTER:
// - name, email, password
// - security_question, security_answer
// - is_admin: bool
// - org_token: 6-digit token REQUIRED if is_admin === true
// - org_name: optional name for the organization (admins)
app.post('/api/auth/register', async (req, res) => {
  const {
    email,
    name,
    password,
    security_question,
    security_answer,
    is_admin,
    org_token,
    org_name
  } = req.body || {};

  if (!email || !password || !name || !security_question || !security_answer) {
    return res.status(400).json({
      error: 'Name, email, password, security question, and answer are required.'
    });
  }

  const trimmedEmail = String(email).toLowerCase().trim();
  if (!trimmedEmail.includes('@')) {
    return res.status(400).json({ error: 'Invalid email.' });
  }
  if (password.length < 6) {
    return res
      .status(400)
      .json({ error: 'Password must be at least 6 characters.' });
  }

  const isAdmin = !!is_admin;
  let trimmedOrgToken = null;

  try {
    if (isAdmin) {
      if (!org_token) {
        return res
          .status(400)
          .json({ error: 'Organization 6-digit token is required for admins.' });
      }
      trimmedOrgToken = String(org_token).trim();
      if (!/^\d{6}$/.test(trimmedOrgToken)) {
        return res
          .status(400)
          .json({ error: 'Organization token must be exactly 6 digits.' });
      }

      const existingTokenOrg = await db.get(
        'SELECT id FROM organizations WHERE join_token = ?',
        [trimmedOrgToken]
      );
      if (existingTokenOrg) {
        return res
          .status(409)
          .json({ error: 'That organization token is already in use.' });
      }
    }

    const existing = await db.get(
      'SELECT id FROM users WHERE email = ?',
      [trimmedEmail]
    );
    if (existing) {
      return res.status(409).json({ error: 'Email already registered.' });
    }

    const passwordHash = bcrypt.hashSync(password, 10);
    const createdAt = nowISO();

    const secQuestion = String(security_question).trim();
    const secAnswer = String(security_answer).trim().toLowerCase();
    const secAnswerHash = bcrypt.hashSync(secAnswer, 10);

    const userInfo = await db.run(
      `INSERT INTO users
       (email, name, password_hash, security_question, security_answer_hash, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [trimmedEmail, name.trim(), passwordHash, secQuestion, secAnswerHash, createdAt]
    );

    const userId = userInfo.lastInsertId;
    let orgId = null;

    if (isAdmin) {
      // Create organization with this admin + join token
      const finalOrgName =
        (org_name && String(org_name).trim()) || `${name.trim()}'s Workspace`;

      const orgInfo = await db.run(
        'INSERT INTO organizations (name, owner_user_id, join_token, created_at) VALUES (?, ?, ?, ?)',
        [finalOrgName, userId, trimmedOrgToken, createdAt]
      );
      orgId = orgInfo.lastInsertId;

      await db.run(
        'INSERT INTO org_members (org_id, user_id, role, invited_at) VALUES (?, ?, ?, ?)',
        [orgId, userId, 'owner', createdAt]
      );

      // Create a sample project + columns
      const projInfo = await db.run(
        'INSERT INTO projects (org_id, name, description, status, created_at) VALUES (?, ?, ?, ?, ?)',
        [orgId, 'Welcome Project', 'Your first project in XYMZ.Ops', 'active', createdAt]
      );
      const projectId = projInfo.lastInsertId;

      const defaultColumns = ['Backlog', 'In Progress', 'Review', 'Done'];
      for (let i = 0; i < defaultColumns.length; i += 1) {
        const colName = defaultColumns[i];
        await db.run(
          'INSERT INTO project_columns (project_id, name, position, created_at) VALUES (?, ?, ?, ?)',
          [projectId, colName, i, createdAt]
        );
      }

      await logActivity(orgId, userId, 'org_created', {
        name: finalOrgName,
        join_token: trimmedOrgToken
      });
    }

    if (orgId) {
      await logActivity(orgId, userId, 'user_registered', { email: trimmedEmail });
    }

    const token = jwt.sign(
      { userId, email: trimmedEmail },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      token,
      user: { id: userId, email: trimmedEmail, name: name.trim() }
    });
  } catch (err) {
    console.error('Error in /api/auth/register:', err);
    res.status(500).json({ error: 'Registration failed.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res
      .status(400)
      .json({ error: 'Email and password are required.' });
  }
  const trimmedEmail = String(email).toLowerCase().trim();

  try {
    const user = await db.get('SELECT * FROM users WHERE email = ?', [trimmedEmail]);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }
    const valid = bcrypt.compareSync(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name }
    });
  } catch (err) {
    console.error('Error in /api/auth/login:', err);
    res.status(500).json({ error: 'Login failed.' });
  }
});

// NEW: Get security question for an email (for password reset)
app.get('/api/auth/security-question', async (req, res) => {
  const emailRaw = req.query.email || '';
  const email = String(emailRaw).toLowerCase().trim();
  if (!email) {
    return res.status(400).json({ error: 'Email is required.' });
  }

  try {
    const user = await db.get(
      'SELECT security_question FROM users WHERE email = ?',
      [email]
    );

    if (!user || !user.security_question) {
      return res
        .status(404)
        .json({ error: 'No security question found for that email.' });
    }

    res.json({ security_question: user.security_question });
  } catch (err) {
    console.error('Error in GET /api/auth/security-question:', err);
    res.status(500).json({ error: 'Failed to fetch security question.' });
  }
});

// NEW: Reset password using security answer
app.post('/api/auth/reset-password', async (req, res) => {
  const { email, security_answer, new_password } = req.body || {};
  if (!email || !security_answer || !new_password) {
    return res.status(400).json({
      error: 'Email, security answer, and new password are required.'
    });
  }

  const trimmedEmail = String(email).toLowerCase().trim();
  const answer = String(security_answer).trim().toLowerCase();
  const newPwd = String(new_password);

  if (newPwd.length < 6) {
    return res
      .status(400)
      .json({ error: 'Password must be at least 6 characters.' });
  }

  try {
    const user = await db.get(
      'SELECT id, security_answer_hash FROM users WHERE email = ?',
      [trimmedEmail]
    );

    if (!user || !user.security_answer_hash) {
      return res
        .status(404)
        .json({ error: 'No security question found for that email.' });
    }

    const ok = bcrypt.compareSync(answer, user.security_answer_hash);
    if (!ok) {
      return res.status(401).json({ error: 'Incorrect security answer.' });
    }

    const newHash = bcrypt.hashSync(newPwd, 10);
    await db.run('UPDATE users SET password_hash = ? WHERE id = ?', [
      newHash,
      user.id
    ]);

    res.json({ success: true });
  } catch (err) {
    console.error('Error in POST /api/auth/reset-password:', err);
    res.status(500).json({ error: 'Failed to reset password.' });
  }
});

// NEW: Reset organization 6-digit token (admin / owner only)
app.post('/api/auth/reset-org-token', async (req, res) => {
  const { email, password, new_token } = req.body || {};
  if (!email || !password || !new_token) {
    return res.status(400).json({
      error: 'Email, password, and new 6-digit token are required.'
    });
  }

  const trimmedEmail = String(email).toLowerCase().trim();
  const token = String(new_token).trim();

  if (!/^\d{6}$/.test(token)) {
    return res
      .status(400)
      .json({ error: 'New organization token must be 6 digits.' });
  }

  try {
    const user = await db.get('SELECT * FROM users WHERE email = ?', [
      trimmedEmail
    ]);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const ok = bcrypt.compareSync(password, user.password_hash);
    if (!ok) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    const existingTokenOrg = await db.get(
      'SELECT id FROM organizations WHERE join_token = ?',
      [token]
    );
    if (existingTokenOrg) {
      return res
        .status(409)
        .json({ error: 'That organization token is already in use.' });
    }

    // Find an organization where this user is owner
    const org = await db.get(
      `SELECT o.*
       FROM organizations o
       JOIN org_members m ON m.org_id = o.id
       WHERE m.user_id = ? AND m.role = 'owner'
       ORDER BY o.created_at ASC
       LIMIT 1`,
      [user.id]
    );

    if (!org) {
      return res.status(403).json({
        error: 'No organization found where this user is an owner.'
      });
    }

    await db.run('UPDATE organizations SET join_token = ? WHERE id = ?', [
      token,
      org.id
    ]);

    await logActivity(org.id, user.id, 'org_token_reset', {
      join_token: token
    });

    res.json({
      success: true,
      org_id: org.id,
      join_token: token
    });
  } catch (err) {
    console.error('Error in POST /api/auth/reset-org-token:', err);
    res.status(500).json({ error: 'Failed to reset organization token.' });
  }
});

// Current user + org memberships
app.get('/api/me', authMiddleware, async (req, res) => {
  try {
    const user = await db.get(
      'SELECT id, email, name, created_at FROM users WHERE id = ?',
      [req.user.id]
    );
    if (!user) return res.status(404).json({ error: 'User not found' });

    const orgs = await db.all(
      `SELECT o.id, o.name, o.created_at, m.role
       FROM organizations o
       JOIN org_members m ON m.org_id = o.id
       WHERE m.user_id = ?
       ORDER BY o.created_at ASC`,
      [req.user.id]
    );

    res.json({ user, orgs });
  } catch (err) {
    console.error('Error in /api/me:', err);
    res.status(500).json({ error: 'Failed to load session.' });
  }
});

// ---- Join organization by 6-digit token ----
app.post('/api/orgs/join-token', authMiddleware, async (req, res) => {
  const { token } = req.body || {};
  const trimmedToken = String(token || '').trim();

  if (!trimmedToken) {
    return res.status(400).json({ error: 'Organization token is required.' });
  }
  if (!/^\d{6}$/.test(trimmedToken)) {
    return res.status(400).json({ error: 'Organization token must be 6 digits.' });
  }

  try {
    const org = await db.get(
      'SELECT id, name, created_at FROM organizations WHERE join_token = ?',
      [trimmedToken]
    );

    if (!org) {
      return res.status(404).json({ error: 'No organization found for that token.' });
    }

    const existingMembership = await db.get(
      'SELECT * FROM org_members WHERE org_id = ? AND user_id = ?',
      [org.id, req.user.id]
    );

    if (!existingMembership) {
      const now = nowISO();
      await db.run(
        'INSERT INTO org_members (org_id, user_id, role, invited_at) VALUES (?, ?, ?, ?)',
        [org.id, req.user.id, 'member', now]
      );

      await logActivity(org.id, req.user.id, 'member_joined_by_token', {
        user_email: req.user.email
      });
    }

    res.json({ organization: org });
  } catch (err) {
    console.error('Error in /api/orgs/join-token:', err);
    res.status(500).json({ error: 'Failed to join organization via token.' });
  }
});

// ---- Organizations & projects ----

// List orgs current user is in
app.get('/api/orgs', authMiddleware, async (req, res) => {
  try {
    const orgs = await db.all(
      `SELECT o.id, o.name, o.created_at, m.role
       FROM organizations o
       JOIN org_members m ON m.org_id = o.id
       WHERE m.user_id = ?
       ORDER BY o.created_at ASC`,
      [req.user.id]
    );
    res.json({ organizations: orgs });
  } catch (err) {
    console.error('Error in GET /api/orgs:', err);
    res.status(500).json({ error: 'Failed to load organizations.' });
  }
});

// Create a new org
app.post('/api/orgs', authMiddleware, async (req, res) => {
  const { name } = req.body || {};
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Organization name is required.' });
  }
  const createdAt = nowISO();
  try {
    const info = await db.run(
      'INSERT INTO organizations (name, owner_user_id, created_at) VALUES (?, ?, ?)',
      [name.trim(), req.user.id, createdAt]
    );
    const orgId = info.lastInsertId;

    await db.run(
      'INSERT INTO org_members (org_id, user_id, role, invited_at) VALUES (?, ?, ?, ?)',
      [orgId, req.user.id, 'owner', createdAt]
    );

    await logActivity(orgId, req.user.id, 'org_created', { name: name.trim() });
    res
      .status(201)
      .json({ id: orgId, name: name.trim(), created_at: createdAt });
  } catch (err) {
    console.error('Error in POST /api/orgs:', err);
    res.status(500).json({ error: 'Failed to create organization.' });
  }
});

// List projects in an org
app.get('/api/orgs/:orgId/projects', authMiddleware, async (req, res) => {
  const orgId = Number(req.params.orgId);
  if (!orgId) return res.status(400).json({ error: 'Invalid orgId' });

  try {
    const member = await db.get(
      'SELECT * FROM org_members WHERE org_id = ? AND user_id = ?',
      [orgId, req.user.id]
    );
    if (!member) {
      return res.status(403).json({ error: 'Not a member of this org.' });
    }

    const projects = await db.all(
      'SELECT * FROM projects WHERE org_id = ? ORDER BY created_at DESC',
      [orgId]
    );

    res.json({ projects });
  } catch (err) {
    console.error('Error in GET /api/orgs/:orgId/projects:', err);
    res.status(500).json({ error: 'Failed to load projects.' });
  }
});

// Create project in an org
app.post('/api/orgs/:orgId/projects', authMiddleware, async (req, res) => {
  const orgId = Number(req.params.orgId);
  const { name, description } = req.body || {};
  if (!orgId) return res.status(400).json({ error: 'Invalid orgId' });
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Project name is required.' });
  }

  try {
    const member = await db.get(
      'SELECT * FROM org_members WHERE org_id = ? AND user_id = ?',
      [orgId, req.user.id]
    );
    if (!member) {
      return res.status(403).json({ error: 'Not a member of this org.' });
    }

    const createdAt = nowISO();
    const info = await db.run(
      'INSERT INTO projects (org_id, name, description, status, created_at) VALUES (?, ?, ?, ?, ?)',
      [orgId, name.trim(), description || '', 'active', createdAt]
    );
    const projectId = info.lastInsertId;

    const defaultColumns = ['Backlog', 'In Progress', 'Review', 'Done'];
    for (let i = 0; i < defaultColumns.length; i += 1) {
      const colName = defaultColumns[i];
      await db.run(
        'INSERT INTO project_columns (project_id, name, position, created_at) VALUES (?, ?, ?, ?)',
        [projectId, colName, i, createdAt]
      );
    }

    await logActivity(orgId, req.user.id, 'project_created', {
      project_id: projectId,
      name: name.trim()
    });

    const project = await db.get('SELECT * FROM projects WHERE id = ?', [
      projectId
    ]);

    res.status(201).json({ project });
  } catch (err) {
    console.error('Error in POST /api/orgs/:orgId/projects:', err);
    res.status(500).json({ error: 'Failed to create project.' });
  }
});

// Get full project board (columns + tasks)
app.get('/api/projects/:projectId/board', authMiddleware, async (req, res) => {
  const projectId = Number(req.params.projectId);
  if (!projectId) {
    return res.status(400).json({ error: 'Invalid projectId' });
  }

  try {
    const project = await db.get('SELECT * FROM projects WHERE id = ?', [
      projectId
    ]);
    if (!project) return res.status(404).json({ error: 'Project not found.' });

    const member = await db.get(
      'SELECT * FROM org_members WHERE org_id = ? AND user_id = ?',
      [project.org_id, req.user.id]
    );
    if (!member) {
      return res.status(403).json({ error: 'Not a member of this org.' });
    }

    const columns = await db.all(
      'SELECT * FROM project_columns WHERE project_id = ? ORDER BY position ASC',
      [projectId]
    );

    const tasks = await db.all(
      'SELECT * FROM tasks WHERE project_id = ? ORDER BY column_id, position ASC',
      [projectId]
    );

    const users = await db.all(
      `SELECT u.id, u.name, u.email
       FROM users u
       JOIN org_members m ON m.user_id = u.id
       WHERE m.org_id = ?`,
      [project.org_id]
    );

    res.json({ project, columns, tasks, members: users });
  } catch (err) {
    console.error('Error in GET /api/projects/:projectId/board:', err);
    res.status(500).json({ error: 'Failed to load board.' });
  }
});

// ---- Columns ----

app.post('/api/projects/:projectId/columns', authMiddleware, async (req, res) => {
  const projectId = Number(req.params.projectId);
  const { name } = req.body || {};
  if (!projectId) return res.status(400).json({ error: 'Invalid projectId' });
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Column name is required.' });
  }

  try {
    const project = await db.get('SELECT * FROM projects WHERE id = ?', [
      projectId
    ]);
    if (!project) return res.status(404).json({ error: 'Project not found.' });

    const member = await db.get(
      'SELECT * FROM org_members WHERE org_id = ? AND user_id = ?',
      [project.org_id, req.user.id]
    );
    if (!member) {
      return res.status(403).json({ error: 'Not a member of this org.' });
    }

    const createdAt = nowISO();
    const maxPosRow = await db.get(
      'SELECT MAX(position) AS max_pos FROM project_columns WHERE project_id = ?',
      [projectId]
    );
    const position = ((maxPosRow && maxPosRow.max_pos) || 0) + 1;

    const info = await db.run(
      'INSERT INTO project_columns (project_id, name, position, created_at) VALUES (?, ?, ?, ?)',
      [projectId, name.trim(), position, createdAt]
    );

    const column = await db.get(
      'SELECT * FROM project_columns WHERE id = ?',
      [info.lastInsertId]
    );

    await logActivity(project.org_id, req.user.id, 'column_created', {
      project_id: projectId,
      column_id: column.id,
      name: column.name
    });

    res.status(201).json({ column });
  } catch (err) {
    console.error('Error in POST /api/projects/:projectId/columns:', err);
    res.status(500).json({ error: 'Failed to create column.' });
  }
});

// ---- Tasks ----

// Create task
app.post('/api/projects/:projectId/tasks', authMiddleware, async (req, res) => {
  const projectId = Number(req.params.projectId);
  const {
    title,
    description,
    priority = 'medium',
    column_id,
    due_date,
    assigned_to
  } = req.body || {};

  if (!projectId) return res.status(400).json({ error: 'Invalid projectId' });
  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'Task title is required.' });
  }
  if (!column_id) {
    return res.status(400).json({ error: 'column_id is required.' });
  }

  try {
    const project = await db.get('SELECT * FROM projects WHERE id = ?', [
      projectId
    ]);
    if (!project) return res.status(404).json({ error: 'Project not found.' });

    const member = await db.get(
      'SELECT * FROM org_members WHERE org_id = ? AND user_id = ?',
      [project.org_id, req.user.id]
    );
    if (!member) {
      return res.status(403).json({ error: 'Not a member of this org.' });
    }

    const column = await db.get(
      'SELECT * FROM project_columns WHERE id = ? AND project_id = ?',
      [column_id, projectId]
    );
    if (!column) {
      return res.status(400).json({ error: 'Column not found in this project.' });
    }

    const createdAt = nowISO();
    const maxPosRow = await db.get(
      'SELECT MAX(position) AS max_pos FROM tasks WHERE column_id = ?',
      [column_id]
    );
    const position = ((maxPosRow && maxPosRow.max_pos) || 0) + 1;

    const info = await db.run(
      `INSERT INTO tasks
       (project_id, column_id, title, description, priority, position, due_date, assigned_to, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        projectId,
        column_id,
        title.trim(),
        description || '',
        priority,
        position,
        due_date || null,
        assigned_to || null,
        createdAt
      ]
    );

    const task = await db.get('SELECT * FROM tasks WHERE id = ?', [
      info.lastInsertId
    ]);

    await logActivity(project.org_id, req.user.id, 'task_created', {
      project_id: projectId,
      task_id: task.id,
      title: task.title
    });

    res.status(201).json({ task });
  } catch (err) {
    console.error('Error in POST /api/projects/:projectId/tasks:', err);
    res.status(500).json({ error: 'Failed to create task.' });
  }
});

// Update task
app.put('/api/tasks/:taskId', authMiddleware, async (req, res) => {
  const taskId = Number(req.params.taskId);
  if (!taskId) return res.status(400).json({ error: 'Invalid taskId' });

  const {
    title,
    description,
    priority,
    due_date,
    assigned_to
  } = req.body || {};

  try {
    const task = await db.get('SELECT * FROM tasks WHERE id = ?', [taskId]);
    if (!task) return res.status(404).json({ error: 'Task not found.' });

    const project = await db.get('SELECT * FROM projects WHERE id = ?', [
      task.project_id
    ]);

    const member = await db.get(
      'SELECT * FROM org_members WHERE org_id = ? AND user_id = ?',
      [project.org_id, req.user.id]
    );
    if (!member) {
      return res.status(403).json({ error: 'Not a member of this org.' });
    }

    const updated = {
      title: title ?? task.title,
      description: description ?? task.description,
      priority: priority ?? task.priority,
      due_date: due_date ?? task.due_date,
      assigned_to: assigned_to ?? task.assigned_to
    };

    await db.run(
      `UPDATE tasks
       SET title = ?, description = ?, priority = ?, due_date = ?, assigned_to = ?
       WHERE id = ?`,
      [
        updated.title,
        updated.description,
        updated.priority,
        updated.due_date,
        updated.assigned_to,
        taskId
      ]
    );

    const saved = await db.get('SELECT * FROM tasks WHERE id = ?', [taskId]);

    await logActivity(project.org_id, req.user.id, 'task_updated', {
      project_id: project.id,
      task_id: taskId
    });

    res.json({ task: saved });
  } catch (err) {
    console.error('Error in PUT /api/tasks/:taskId:', err);
    res.status(500).json({ error: 'Failed to update task.' });
  }
});

// Move task (drag & drop)
app.patch('/api/tasks/:taskId/move', authMiddleware, async (req, res) => {
  const taskId = Number(req.params.taskId);
  const { to_column_id, to_position } = req.body || {};
  if (!taskId || !to_column_id) {
    return res.status(400).json({ error: 'taskId and to_column_id required.' });
  }

  try {
    const task = await db.get('SELECT * FROM tasks WHERE id = ?', [taskId]);
    if (!task) return res.status(404).json({ error: 'Task not found.' });

    const project = await db.get('SELECT * FROM projects WHERE id = ?', [
      task.project_id
    ]);
    const member = await db.get(
      'SELECT * FROM org_members WHERE org_id = ? AND user_id = ?',
      [project.org_id, req.user.id]
    );
    if (!member) {
      return res.status(403).json({ error: 'Not a member of this org.' });
    }

    const targetColumn = await db.get(
      'SELECT * FROM project_columns WHERE id = ? AND project_id = ?',
      [to_column_id, project.id]
    );
    if (!targetColumn) {
      return res.status(400).json({ error: 'Target column not found.' });
    }

    // Adjust positions in source column
    await db.run(
      `UPDATE tasks
       SET position = position - 1
       WHERE column_id = ? AND position > ?`,
      [task.column_id, task.position]
    );

    const maxPosRow = await db.get(
      'SELECT MAX(position) AS max_pos FROM tasks WHERE column_id = ?',
      [to_column_id]
    );
    const maxPos = (maxPosRow && maxPosRow.max_pos) || 0;

    let newPos = Number(to_position);
    if (!newPos || newPos < 1 || newPos > maxPos + 1) {
      newPos = maxPos + 1;
    }

    await db.run(
      `UPDATE tasks
       SET position = position + 1
       WHERE column_id = ? AND position >= ?`,
      [to_column_id, newPos]
    );

    await db.run(
      `UPDATE tasks
       SET column_id = ?, position = ?
       WHERE id = ?`,
      [to_column_id, newPos, taskId]
    );

    const saved = await db.get('SELECT * FROM tasks WHERE id = ?', [taskId]);

    await logActivity(project.org_id, req.user.id, 'task_moved', {
      project_id: project.id,
      task_id: taskId,
      from_column_id: task.column_id,
      to_column_id,
      position: newPos
    });

    res.json({ task: saved });
  } catch (err) {
    console.error('Error in PATCH /api/tasks/:taskId/move:', err);
    res.status(500).json({ error: 'Failed to move task.' });
  }
});

// Delete task
app.delete('/api/tasks/:taskId', authMiddleware, async (req, res) => {
  const taskId = Number(req.params.taskId);
  if (!taskId) return res.status(400).json({ error: 'Invalid taskId' });

  try {
    const task = await db.get('SELECT * FROM tasks WHERE id = ?', [taskId]);
    if (!task) return res.status(404).json({ error: 'Task not found.' });

    const project = await db.get('SELECT * FROM projects WHERE id = ?', [
      task.project_id
    ]);

    const member = await db.get(
      'SELECT * FROM org_members WHERE org_id = ? AND user_id = ?',
      [project.org_id, req.user.id]
    );
    if (!member) {
      return res.status(403).json({ error: 'Not a member of this org.' });
    }

    await db.run(
      `UPDATE tasks
       SET position = position - 1
       WHERE column_id = ? AND position > ?`,
      [task.column_id, task.position]
    );

    await db.run('DELETE FROM tasks WHERE id = ?', [taskId]);

    await logActivity(project.org_id, req.user.id, 'task_deleted', {
      project_id: project.id,
      task_id: taskId
    });

    res.json({ success: true });
  } catch (err) {
    console.error('Error in DELETE /api/tasks/:taskId:', err);
    res.status(500).json({ error: 'Failed to delete task.' });
  }
});

// ---- Comments ----
app.get('/api/tasks/:taskId/comments', authMiddleware, async (req, res) => {
  const taskId = Number(req.params.taskId);
  if (!taskId) return res.status(400).json({ error: 'Invalid taskId' });

  try {
    const task = await db.get('SELECT * FROM tasks WHERE id = ?', [taskId]);
    if (!task) return res.status(404).json({ error: 'Task not found.' });

    const project = await db.get('SELECT * FROM projects WHERE id = ?', [
      task.project_id
    ]);
    const member = await db.get(
      'SELECT * FROM org_members WHERE org_id = ? AND user_id = ?',
      [project.org_id, req.user.id]
    );
    if (!member) {
      return res.status(403).json({ error: 'Not a member of this org.' });
    }

    const comments = await db.all(
      `SELECT c.*, u.name AS author_name
       FROM comments c
       JOIN users u ON u.id = c.user_id
       WHERE c.task_id = ?
       ORDER BY c.created_at ASC`,
      [taskId]
    );

    res.json({ comments });
  } catch (err) {
    console.error('Error in GET /api/tasks/:taskId/comments:', err);
    res.status(500).json({ error: 'Failed to load comments.' });
  }
});

app.post('/api/tasks/:taskId/comments', authMiddleware, async (req, res) => {
  const taskId = Number(req.params.taskId);
  const { body } = req.body || {};
  if (!taskId) return res.status(400).json({ error: 'Invalid taskId' });
  if (!body || !body.trim()) {
    return res.status(400).json({ error: 'Comment body is required.' });
  }

  try {
    const task = await db.get('SELECT * FROM tasks WHERE id = ?', [taskId]);
    if (!task) return res.status(404).json({ error: 'Task not found.' });

    const project = await db.get('SELECT * FROM projects WHERE id = ?', [
      task.project_id
    ]);
    const member = await db.get(
      'SELECT * FROM org_members WHERE org_id = ? AND user_id = ?',
      [project.org_id, req.user.id]
    );
    if (!member) {
      return res.status(403).json({ error: 'Not a member of this org.' });
    }

    const createdAt = nowISO();
    const info = await db.run(
      'INSERT INTO comments (task_id, user_id, body, created_at) VALUES (?, ?, ?, ?)',
      [taskId, req.user.id, body.trim(), createdAt]
    );

    const comment = await db.get(
      `SELECT c.*, u.name AS author_name
       FROM comments c
       JOIN users u ON u.id = c.user_id
       WHERE c.id = ?`,
      [info.lastInsertId]
    );

    await logActivity(project.org_id, req.user.id, 'comment_added', {
      project_id: project.id,
      task_id: taskId,
      comment_id: comment.id
    });

    res.status(201).json({ comment });
  } catch (err) {
    console.error('Error in POST /api/tasks/:taskId/comments:', err);
    res.status(500).json({ error: 'Failed to add comment.' });
  }
});

// ---- Attachments (simple file upload) ----
app.post(
  '/api/tasks/:taskId/attachments',
  authMiddleware,
  upload.single('file'),
  async (req, res) => {
    const taskId = Number(req.params.taskId);
    if (!taskId) return res.status(400).json({ error: 'Invalid taskId' });

    const file = req.file;
    if (!file) return res.status(400).json({ error: 'No file uploaded.' });

    try {
      const task = await db.get('SELECT * FROM tasks WHERE id = ?', [taskId]);
      if (!task) return res.status(404).json({ error: 'Task not found.' });

      const project = await db.get('SELECT * FROM projects WHERE id = ?', [
        task.project_id
      ]);
      const member = await db.get(
        'SELECT * FROM org_members WHERE org_id = ? AND user_id = ?',
        [project.org_id, req.user.id]
      );
      if (!member) {
        return res.status(403).json({ error: 'Not a member of this org.' });
      }

      const createdAt = nowISO();
      const info = await db.run(
        `INSERT INTO attachments (task_id, filename, original_name, mime_type, size, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          taskId,
          file.filename,
          file.originalname,
          file.mimetype,
          file.size,
          createdAt
        ]
      );

      const attachment = await db.get(
        'SELECT * FROM attachments WHERE id = ?',
        [info.lastInsertId]
      );

      await logActivity(project.org_id, req.user.id, 'attachment_added', {
        project_id: project.id,
        task_id: taskId,
        attachment_id: attachment.id
      });

      res.status(201).json({ attachment });
    } catch (err) {
      console.error('Error in POST /api/tasks/:taskId/attachments:', err);
      res.status(500).json({ error: 'Failed to save attachment.' });
    }
  }
);

// Static route to serve uploaded files (dev only)
app.use('/uploads', express.static(UPLOADS_DIR));

// ---- BI summary (XYMZ.BI) ----
app.get('/api/orgs/:orgId/bi-summary', authMiddleware, async (req, res) => {
  const orgId = Number(req.params.orgId);
  if (!orgId) return res.status(400).json({ error: 'Invalid orgId' });

  try {
    const member = await db.get(
      'SELECT * FROM org_members WHERE org_id = ? AND user_id = ?',
      [orgId, req.user.id]
    );
    if (!member) {
      return res.status(403).json({ error: 'Not a member of this org.' });
    }

    const projects = await db.all(
      'SELECT id, name FROM projects WHERE org_id = ? ORDER BY created_at DESC',
      [orgId]
    );

    if (!projects.length) {
      return res.json({ projects: [] });
    }

    const today = new Date();
    const results = [];

    for (const proj of projects) {
      const columns = await db.all(
        'SELECT id, name FROM project_columns WHERE project_id = ?',
        [proj.id]
      );
      const columnById = {};
      columns.forEach((c) => {
        columnById[c.id] = c;
      });

      const tasks = await db.all(
        `SELECT t.*, u.name AS assignee_name
         FROM tasks t
         LEFT JOIN users u ON u.id = t.assigned_to
         WHERE t.project_id = ?`,
        [proj.id]
      );

      const counts = { in_progress: 0, review: 0, complete: 0 };
      const assigneesSet = new Set();
      let soonestDue = null;

      tasks.forEach((t) => {
        const col = columnById[t.column_id];
        const colName = (col ? col.name : '').toLowerCase();

        if (colName.includes('progress')) counts.in_progress += 1;
        else if (colName.includes('review')) counts.review += 1;
        else if (colName.includes('done') || colName.includes('complete')) {
          counts.complete += 1;
        }

        if (t.assigned_to && t.assignee_name) {
          assigneesSet.add(t.assignee_name);
        }

        if (t.due_date) {
          const due = new Date(t.due_date);
          if (!Number.isNaN(due.getTime())) {
            const diffMs = due - today;
            if (diffMs > 0 && (!soonestDue || due < soonestDue)) {
              soonestDue = due;
            }
          }
        }
      });

      let daysLeft = null;
      if (soonestDue) {
        const diffMs = soonestDue - today;
        daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      }

      results.push({
        project_id: proj.id,
        project_name: proj.name,
        in_progress: counts.in_progress,
        review: counts.review,
        complete: counts.complete,
        assignees: Array.from(assigneesSet),
        days_left: daysLeft
      });
    }

    res.json({ projects: results });
  } catch (err) {
    console.error('Error in GET /api/orgs/:orgId/bi-summary:', err);
    res.status(500).json({ error: 'Failed to load BI summary.' });
  }
});

// ---- BI: Tasks inside a single project (for drilldown) ----
app.get('/api/projects/:projectId/bi-tasks', authMiddleware, async (req, res) => {
  const projectId = Number(req.params.projectId);
  if (!projectId) return res.status(400).json({ error: 'Invalid projectId' });

  try {
    const project = await db.get('SELECT * FROM projects WHERE id = ?', [
      projectId
    ]);
    if (!project) return res.status(404).json({ error: 'Project not found.' });

    const member = await db.get(
      'SELECT * FROM org_members WHERE org_id = ? AND user_id = ?',
      [project.org_id, req.user.id]
    );
    if (!member) {
      return res.status(403).json({ error: 'Not a member of this org.' });
    }

    const tasks = await db.all(
      `SELECT 
         t.id AS task_id,
         t.title,
         t.priority,
         t.due_date,
         u.name AS assignee_name
       FROM tasks t
       LEFT JOIN users u ON u.id = t.assigned_to
       WHERE t.project_id = ?
       ORDER BY t.created_at ASC`,
      [projectId]
    );

    const today = new Date();

    const formatted = tasks.map((t) => {
      let daysLeft = null;
      if (t.due_date) {
        const due = new Date(t.due_date);
        if (!Number.isNaN(due.getTime())) {
          const diff = Math.ceil(
            (due - today) / (1000 * 60 * 60 * 24)
          );
          daysLeft = diff;
        }
      }
      return {
        task_id: t.task_id,
        title: t.title,
        priority: t.priority,
        assigned_to: t.assignee_name || null,
        days_left: daysLeft
      };
    });

    res.json({ project_id: projectId, tasks: formatted });
  } catch (err) {
    console.error('Error in GET /api/projects/:projectId/bi-tasks:', err);
    res.status(500).json({ error: 'Failed to load BI tasks.' });
  }
});

// ---- Activity feed ----
app.get('/api/orgs/:orgId/activity', authMiddleware, async (req, res) => {
  const orgId = Number(req.params.orgId);
  if (!orgId) return res.status(400).json({ error: 'Invalid orgId' });

  try {
    const member = await db.get(
      'SELECT * FROM org_members WHERE org_id = ? AND user_id = ?',
      [orgId, req.user.id]
    );
    if (!member) {
      return res.status(403).json({ error: 'Not a member of this org.' });
    }

    const activities = await db.all(
      `SELECT a.*, u.name AS actor_name
       FROM activity_log a
       LEFT JOIN users u ON u.id = a.user_id
       WHERE a.org_id = ?
       ORDER BY a.created_at DESC
       LIMIT 30`,
      [orgId]
    );

    res.json({ activities });
  } catch (err) {
    console.error('Error in GET /api/orgs/:orgId/activity:', err);
    res.status(500).json({ error: 'Failed to load activity.' });
  }
});

// ---- XYMZ.Fleet: org member directory ----
app.get('/api/orgs/:orgId/fleet', authMiddleware, async (req, res) => {
  const orgId = Number(req.params.orgId);
  if (!orgId) return res.status(400).json({ error: 'Invalid orgId' });

  try {
    const member = await db.get(
      'SELECT * FROM org_members WHERE org_id = ? AND user_id = ?',
      [orgId, req.user.id]
    );
    if (!member) {
      return res.status(403).json({ error: 'Not a member of this org.' });
    }

    const fleet = await db.all(
      `SELECT 
         u.id,
         u.name,
         u.email,
         m.role,
         m.invited_at
       FROM org_members m
       JOIN users u ON u.id = m.user_id
       WHERE m.org_id = ?
       ORDER BY 
         CASE m.role 
           WHEN 'owner' THEN 0 
           WHEN 'admin' THEN 1 
           ELSE 2 
         END,
         u.name ASC`,
      [orgId]
    );

    res.json({ fleet });
  } catch (err) {
    console.error('Error in GET /api/orgs/:orgId/fleet:', err);
    res.status(500).json({ error: 'Failed to load fleet.' });
  }
});

// ---- XYMZ.Radar: org health snapshot ----
app.get('/api/orgs/:orgId/radar', authMiddleware, async (req, res) => {
  const orgId = Number(req.params.orgId);
  if (!orgId) return res.status(400).json({ error: 'Invalid orgId' });

  try {
    const member = await db.get(
      'SELECT * FROM org_members WHERE org_id = ? AND user_id = ?',
      [orgId, req.user.id]
    );
    if (!member) {
      return res.status(403).json({ error: 'Not a member of this org.' });
    }

    // Projects
    const projects = await db.all(
      'SELECT id, name, status, created_at FROM projects WHERE org_id = ?',
      [orgId]
    );

    const totalProjects = projects.length;
    const activeProjects = projects.filter((p) =>
      (p.status || '').toLowerCase() === 'active'
    ).length;

    // Tasks + status from columns
    const tasks = await db.all(
      `SELECT 
         t.*,
         c.name AS column_name
       FROM tasks t
       JOIN project_columns c ON c.id = t.column_id
       JOIN projects p ON p.id = t.project_id
       WHERE p.org_id = ?`,
      [orgId]
    );

    const totalTasks = tasks.length;

    let inProgress = 0;
    let review = 0;
    let complete = 0;

    const today = new Date();
    const startOfToday = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate()
    );
    const startOfTomorrow = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() + 1
    );

    let dueToday = 0;
    let dueSoon = 0; // next 7 days
    let overdue = 0;

    tasks.forEach((t) => {
      const colName = (t.column_name || '').toLowerCase();
      if (colName.includes('progress')) inProgress += 1;
      else if (colName.includes('review')) review += 1;
      else if (colName.includes('done') || colName.includes('complete'))
        complete += 1;

      if (t.due_date) {
        const due = new Date(t.due_date);
        if (!Number.isNaN(due.getTime())) {
          if (due >= startOfToday && due < startOfTomorrow) {
            dueToday += 1;
          } else if (due < startOfToday) {
            overdue += 1;
          } else {
            const diffDays = Math.ceil(
              (due - startOfToday) / (1000 * 60 * 60 * 24)
            );
            if (diffDays > 1 && diffDays <= 7) {
              dueSoon += 1;
            }
          }
        }
      }
    });

    // Members count
    const memberCountsRow = await db.get(
      `SELECT 
         COUNT(*) AS total_members,
         SUM(CASE WHEN role = 'owner' THEN 1 ELSE 0 END) AS owners,
         SUM(CASE WHEN role = 'admin' THEN 1 ELSE 0 END) AS admins
       FROM org_members
       WHERE org_id = ?`,
      [orgId]
    );

    const totalMembers = memberCountsRow.total_members || 0;
    const owners = memberCountsRow.owners || 0;
    const admins = memberCountsRow.admins || 0;

    // Most recent activity timestamp
    const lastActivityRow = await db.get(
      'SELECT created_at FROM activity_log WHERE org_id = ? ORDER BY created_at DESC LIMIT 1',
      [orgId]
    );
    const lastActivityAt = lastActivityRow ? lastActivityRow.created_at : null;

    res.json({
      org_id: orgId,
      projects: {
        total: totalProjects,
        active: activeProjects
      },
      tasks: {
        total: totalTasks,
        in_progress: inProgress,
        review,
        complete
      },
      due_dates: {
        today: dueToday,
        soon: dueSoon,
        overdue
      },
      members: {
        total: totalMembers,
        owners,
        admins
      },
      last_activity_at: lastActivityAt
    });
  } catch (err) {
    console.error('Error in GET /api/orgs/:orgId/radar:', err);
    res.status(500).json({ error: 'Failed to load radar snapshot.' });
  }
});

// ---- DELETE PROJECT ----
app.delete('/api/projects/:projectId', authMiddleware, async (req, res) => {
  const projectId = Number(req.params.projectId);
  if (!projectId) {
    return res.status(400).json({ error: 'Invalid projectId' });
  }

  try {
    const project = await db.get('SELECT * FROM projects WHERE id = ?', [
      projectId
    ]);
    if (!project) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    const member = await db.get(
      'SELECT * FROM org_members WHERE org_id = ? AND user_id = ?',
      [project.org_id, req.user.id]
    );

    if (!member) {
      return res
        .status(403)
        .json({ error: 'You are not a member of this organization.' });
    }

    await db.run('DELETE FROM projects WHERE id = ?', [projectId]);

    await logActivity(project.org_id, req.user.id, 'project_deleted', {
      project_id: projectId,
      project_name: project.name
    });

    res.json({ success: true, message: 'Project deleted successfully.' });
  } catch (err) {
    console.error('Error deleting project:', err);
    res.status(500).json({ error: 'Failed to delete project.' });
  }
});

// ---- Global error handler (for unexpected server errors) ----
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  if (res.headersSent) {
    return next(err);
  }
  res.status(500).json({ error: 'Internal server error' });
});

// ---- Fallback to frontend ----
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'API route not found' });
  }
  res.sendFile(path.join(FRONTEND_PATH, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`XYMZ backend running at http://localhost:${PORT}`);
});
