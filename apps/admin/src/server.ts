import http from 'http';
import { URL } from 'url';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3005;
const BACKEND_API = process.env.BACKEND_API_URL || 'http://localhost:3001';
const ADMIN_COOKIE_NAME = 'meditory_admin_session';

/**
 * Extracts the admin JWT token from incoming request headers or cookies.
 */
function extractAdminToken(req: http.IncomingMessage): string | null {
  // 1. Authorization header: Bearer <token>
  const authHeader = req.headers['authorization'];
  if (authHeader) {
    const match = authHeader.match(/^bearer\s+(.+)$/i);
    if (match && match[1]) return match[1].trim();
    if (!authHeader.includes(' ')) return authHeader.trim();
  }

  // 2. Cookie header: meditory_admin_session=<token>
  const rawCookie = req.headers['cookie'];
  if (rawCookie) {
    const parts = rawCookie.split(';');
    for (const part of parts) {
      const [k, v] = part.trim().split('=');
      if (k === ADMIN_COOKIE_NAME && v) {
        return decodeURIComponent(v);
      }
    }
  }

  return null;
}

/**
 * Modern HTML Template for District Health Authority Admin Login Screen
 */
function renderAdminLoginHtml(errorMessage?: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sign In | Meditory District Health Authority</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;600&display=swap" rel="stylesheet">
  <style>
    :root {
      --primary: #00382d;
      --primary-accent: #006a56;
      --primary-light: #e6f4f0;
      --surface: #f8fafc;
      --card-bg: #ffffff;
      --border: #e2e8f0;
      --text: #0f172a;
      --text-muted: #64748b;
      --danger: #b91c1c;
      --danger-bg: #fef2f2;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Plus Jakarta Sans', -apple-system, sans-serif;
      background: radial-gradient(circle at 50% 0%, #e6f4f0 0%, #f8fafc 60%);
      color: var(--text);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 1.5rem;
    }
    .login-container {
      max-width: 460px;
      width: 100%;
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 1.25rem;
      padding: 2.5rem;
      box-shadow: 0 20px 25px -5px rgba(0, 56, 45, 0.08), 0 8px 10px -6px rgba(0, 56, 45, 0.04);
      display: flex;
      flex-direction: column;
      gap: 1.75rem;
    }
    .emblem-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      background: var(--primary-light);
      color: var(--primary-accent);
      padding: 0.35rem 0.85rem;
      border-radius: 9999px;
      font-size: 0.72rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      border: 1px solid #bfe3da;
    }
    .header-box {
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.75rem;
    }
    .header-box h1 {
      font-size: 1.45rem;
      font-weight: 800;
      color: var(--primary);
      letter-spacing: -0.02em;
      line-height: 1.2;
    }
    .header-box p {
      font-size: 0.84rem;
      color: var(--text-muted);
      line-height: 1.45;
    }
    .form-group {
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
    }
    .form-group label {
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      color: var(--text-muted);
    }
    .form-group input {
      padding: 0.75rem 0.95rem;
      border: 1.5px solid var(--border);
      border-radius: 0.6rem;
      font-size: 0.88rem;
      font-family: inherit;
      color: var(--text);
      outline: none;
      transition: all 0.15s ease;
    }
    .form-group input:focus {
      border-color: var(--primary-accent);
      box-shadow: 0 0 0 3px rgba(0, 106, 86, 0.15);
    }
    .btn-submit {
      background: var(--primary-accent);
      color: #ffffff;
      border: none;
      font-size: 0.88rem;
      font-weight: 700;
      padding: 0.85rem 1.25rem;
      border-radius: 0.6rem;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      transition: background 0.15s ease;
      box-shadow: 0 4px 6px -1px rgba(0, 106, 86, 0.2);
    }
    .btn-submit:hover { background: var(--primary); }
    .btn-submit:disabled { opacity: 0.6; cursor: not-allowed; }
    .demo-box {
      background: #f8fafc;
      border: 1px dashed var(--border);
      border-radius: 0.75rem;
      padding: 1rem;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    .demo-title {
      font-size: 0.72rem;
      font-weight: 700;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }
    .btn-demo {
      background: #ffffff;
      color: var(--primary-accent);
      border: 1px solid #bfe3da;
      padding: 0.5rem 0.85rem;
      border-radius: 0.5rem;
      font-size: 0.75rem;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: space-between;
      transition: all 0.15s ease;
    }
    .btn-demo:hover { background: var(--primary-light); }
    .alert-error {
      background: var(--danger-bg);
      border: 1px solid #fecaca;
      color: var(--danger);
      font-size: 0.78rem;
      padding: 0.75rem 1rem;
      border-radius: 0.5rem;
      font-weight: 600;
      display: ${errorMessage ? 'block' : 'none'};
    }
    .footer-note {
      text-align: center;
      font-size: 0.75rem;
      color: var(--text-muted);
      margin-top: 1.5rem;
    }
    .footer-note a {
      color: var(--primary-accent);
      text-decoration: none;
      font-weight: 600;
    }
  </style>
</head>
<body>
  <div class="login-container">
    <div class="header-box">
      <span class="emblem-badge">🏛️ District Health Authority</span>
      <h1>State Health Mission Admin Portal</h1>
      <p>Authorized access for District Civil Surgeons, Licensing Officers, and State Formulary Administrators.</p>
    </div>

    <div id="alertBox" class="alert-error">${errorMessage || ''}</div>

    <form id="loginForm" onsubmit="handleLogin(event)" style="display: flex; flex-direction: column; gap: 1.15rem;">
      <div class="form-group">
        <label for="email">Health Officer Official Email</label>
        <input type="email" id="email" required placeholder="admin@meditory.gov.in" value="admin@meditory.gov.in" autocomplete="username">
      </div>

      <div class="form-group">
        <label for="password">Authority Password</label>
        <input type="password" id="password" required placeholder="••••••••••••" value="Password@123" autocomplete="current-password">
      </div>

      <button type="submit" id="submitBtn" class="btn-submit">
        <span>Sign In to Governance Console</span>
        <span>→</span>
      </button>
    </form>

    <div class="demo-box">
      <span class="demo-title">⚡ Hackathon Evaluation Quick Credentials</span>
      <button type="button" onclick="prefillAdmin()" class="btn-demo">
        <span>Civil Surgeon Admin (admin@meditory.gov.in)</span>
        <span style="font-family: 'JetBrains Mono', monospace; font-size: 0.7rem; color: var(--primary);">Password@123</span>
      </button>
    </div>
  </div>

  <div class="footer-note">
    Need dispensary workstation instead? <a href="http://localhost:3000/login">Open Clinic Terminal (:3000) ↗</a>
  </div>

  <script>
    function prefillAdmin() {
      document.getElementById('email').value = 'admin@meditory.gov.in';
      document.getElementById('password').value = 'Password@123';
    }

    async function handleLogin(e) {
      e.preventDefault();
      const email = document.getElementById('email').value.trim();
      const password = document.getElementById('password').value;
      const alertBox = document.getElementById('alertBox');
      const submitBtn = document.getElementById('submitBtn');

      alertBox.style.display = 'none';
      submitBtn.disabled = true;
      submitBtn.textContent = 'Authenticating Health Authority...';

      try {
        const res = await fetch('/api/admin/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });

        const data = await res.json();
        if (res.ok && data.success) {
          // Redirect to governance dashboard
          window.location.href = '/dashboard';
        } else {
          alertBox.textContent = data.message || data.error || 'Authentication failed. Please verify credentials.';
          alertBox.style.display = 'block';
          submitBtn.disabled = false;
          submitBtn.innerHTML = '<span>Sign In to Governance Console</span><span>→</span>';
        }
      } catch (err) {
        alertBox.textContent = 'Failed to communicate with Admin server. Please try again.';
        alertBox.style.display = 'block';
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<span>Sign In to Governance Console</span><span>→</span>';
      }
    }
  </script>
</body>
</html>`;
}

/**
 * Modern HTML Template for District Health Authority Admin Dashboard
 */
function renderAdminDashboardHtml(adminName?: string, adminEmail?: string): string {
  const displayName = adminName || 'Dr. State Health Mission Admin';
  const displayEmail = adminEmail || 'admin@meditory.gov.in';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Meditory District Health Authority | Clinic Approvals</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;600&display=swap" rel="stylesheet">
  <style>
    :root {
      --primary: #00382d;
      --primary-accent: #006a56;
      --primary-light: #e6f4f0;
      --secondary: #006874;
      --surface: #f8fafc;
      --card-bg: #ffffff;
      --border: #e2e8f0;
      --text: #0f172a;
      --text-muted: #64748b;
      --warning: #d97706;
      --warning-bg: #fffbeb;
      --success: #15803d;
      --success-bg: #f0fdf4;
      --danger: #b91c1c;
      --danger-bg: #fef2f2;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Plus Jakarta Sans', -apple-system, sans-serif;
      background: var(--surface);
      color: var(--text);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }
    .header {
      background: #ffffff;
      border-bottom: 1px solid var(--border);
      padding: 0.85rem 2rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      position: sticky;
      top: 0;
      z-index: 100;
      box-shadow: 0 1px 3px rgba(0,0,0,0.03);
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 0.85rem;
    }
    .badge-admin {
      background: var(--primary-light);
      color: var(--primary-accent);
      font-size: 0.72rem;
      font-weight: 700;
      padding: 0.25rem 0.6rem;
      border-radius: 9999px;
      border: 1px solid #bfe3da;
      text-transform: uppercase;
    }
    .officer-badge {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      background: #f1f5f9;
      padding: 0.35rem 0.75rem;
      border-radius: 0.5rem;
      font-size: 0.78rem;
    }
    .officer-name {
      font-weight: 700;
      color: var(--primary);
    }
    .officer-role {
      font-size: 0.68rem;
      color: var(--text-muted);
    }
    .btn-signout {
      background: #ffffff;
      border: 1px solid var(--border);
      color: var(--danger);
      font-size: 0.75rem;
      font-weight: 700;
      padding: 0.45rem 0.85rem;
      border-radius: 0.45rem;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .btn-signout:hover {
      background: var(--danger-bg);
      border-color: #fca5a5;
    }
    .container {
      max-width: 1240px;
      width: 100%;
      margin: 0 auto;
      padding: 2rem 1.5rem;
      flex: 1;
    }
    .hero {
      margin-bottom: 2rem;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    .hero h1 {
      font-size: 1.65rem;
      font-weight: 800;
      color: var(--primary);
      letter-spacing: -0.02em;
    }
    .hero p {
      color: var(--text-muted);
      font-size: 0.88rem;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 1rem;
      margin-bottom: 2rem;
    }
    .stat-card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 0.75rem;
      padding: 1.25rem 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
      box-shadow: 0 1px 2px rgba(0,0,0,0.02);
    }
    .stat-title {
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .stat-value {
      font-size: 1.9rem;
      font-weight: 800;
      color: var(--text);
    }
    .stat-value.amber { color: var(--warning); }
    .stat-value.green { color: var(--success); }
    .controls {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      margin-bottom: 1.25rem;
      flex-wrap: wrap;
    }
    .tabs {
      display: flex;
      gap: 0.35rem;
      background: #e2e8f0;
      padding: 0.25rem;
      border-radius: 0.5rem;
    }
    .tab-btn {
      border: none;
      background: transparent;
      padding: 0.45rem 0.95rem;
      font-size: 0.78rem;
      font-weight: 600;
      color: var(--text-muted);
      border-radius: 0.35rem;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .tab-btn.active {
      background: #ffffff;
      color: var(--text);
      box-shadow: 0 1px 2px rgba(0,0,0,0.06);
    }
    .btn-action {
      background: var(--primary-accent);
      color: #ffffff;
      border: none;
      font-size: 0.78rem;
      font-weight: 600;
      padding: 0.55rem 1.1rem;
      border-radius: 0.5rem;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      transition: background 0.15s ease;
    }
    .btn-action:hover { background: var(--primary); }
    .btn-action.secondary {
      background: #ffffff;
      color: var(--text);
      border: 1px solid var(--border);
    }
    .btn-action.secondary:hover { background: #f1f5f9; }
    .clinics-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 1rem;
    }
    .clinic-card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 0.85rem;
      padding: 1.4rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;
      box-shadow: 0 2px 4px rgba(0,0,0,0.02);
      transition: all 0.2s ease;
    }
    .clinic-card.pending {
      border-left: 5px solid var(--warning);
      background: linear-gradient(to right, #fffdf8, #ffffff);
    }
    .clinic-card.approved {
      border-left: 5px solid var(--success);
    }
    .clinic-card.rejected {
      border-left: 5px solid var(--danger);
      opacity: 0.8;
    }
    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 1rem;
      flex-wrap: wrap;
    }
    .clinic-title-box h3 {
      font-size: 1.1rem;
      font-weight: 700;
      color: var(--text);
      margin-bottom: 0.25rem;
    }
    .clinic-id {
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.72rem;
      color: var(--text-muted);
    }
    .status-badge {
      font-size: 0.72rem;
      font-weight: 700;
      padding: 0.3rem 0.75rem;
      border-radius: 9999px;
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }
    .status-badge.pending {
      background: var(--warning-bg);
      color: var(--warning);
      border: 1px solid #fde68a;
    }
    .status-badge.approved {
      background: var(--success-bg);
      color: var(--success);
      border: 1px solid #bbf7d0;
    }
    .status-badge.rejected {
      background: var(--danger-bg);
      color: var(--danger);
      border: 1px solid #fecaca;
    }
    .details-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 0.75rem 1.25rem;
      font-size: 0.78rem;
      background: #f8fafc;
      padding: 1rem;
      border-radius: 0.5rem;
      border: 1px solid #f1f5f9;
    }
    .detail-item {
      display: flex;
      flex-direction: column;
      gap: 0.15rem;
    }
    .detail-label {
      color: var(--text-muted);
      font-size: 0.68rem;
      font-weight: 600;
      text-transform: uppercase;
    }
    .detail-val {
      font-weight: 600;
      color: var(--text);
    }
    .card-actions {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 0.65rem;
      padding-top: 0.5rem;
      border-top: 1px dashed var(--border);
    }
    .btn-approve {
      background: var(--success);
      color: #ffffff;
      border: none;
      font-size: 0.78rem;
      font-weight: 700;
      padding: 0.5rem 1.2rem;
      border-radius: 0.4rem;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      transition: background 0.15s ease;
    }
    .btn-approve:hover { background: #166534; }
    .btn-reject {
      background: #ffffff;
      color: var(--danger);
      border: 1px solid #fca5a5;
      font-size: 0.78rem;
      font-weight: 700;
      padding: 0.5rem 1rem;
      border-radius: 0.4rem;
      cursor: pointer;
      transition: background 0.15s ease;
    }
    .btn-reject:hover { background: var(--danger-bg); }
    .toast {
      position: fixed;
      bottom: 2rem;
      right: 2rem;
      background: #0f172a;
      color: #ffffff;
      padding: 0.85rem 1.35rem;
      border-radius: 0.5rem;
      font-size: 0.82rem;
      font-weight: 600;
      box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1);
      display: none;
      z-index: 200;
      animation: slideUp 0.2s ease;
    }
    @keyframes slideUp {
      from { transform: translateY(10px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
    .empty-state {
      background: #ffffff;
      border: 1px dashed var(--border);
      border-radius: 0.75rem;
      padding: 3rem 1.5rem;
      text-align: center;
      color: var(--text-muted);
      font-size: 0.85rem;
    }
  </style>
</head>
<body>
  <!-- Header -->
  <header class="header">
    <div class="brand">
      <div style="font-weight: 800; font-size: 1.15rem; color: var(--primary); letter-spacing: -0.02em;">
        🏛️ MEDITORY <span style="font-weight: 500; color: var(--text-muted); font-size: 0.95rem;">• District Health Authority</span>
      </div>
      <span class="badge-admin">Governance Active</span>
    </div>

    <div style="display: flex; align-items: center; gap: 0.85rem;">
      <div class="officer-badge">
        <span>👨‍⚕️</span>
        <div style="text-align: left;">
          <div class="officer-name">${displayName}</div>
          <div class="officer-role">${displayEmail} • DHA Officer</div>
        </div>
      </div>
      <button onclick="loadRegistrations()" class="btn-action secondary">
        🔄 Refresh
      </button>
      <button onclick="signOutAdmin()" class="btn-signout" title="Sign out of District Health Authority console">
        Sign Out 🚪
      </button>
      <a href="http://localhost:3000/login" target="_blank" class="btn-action">
        🏥 Dispensary Portal ↗
      </a>
    </div>
  </header>

  <div class="container">
    <div class="hero">
      <div style="display: inline-flex; align-items: center; gap: 0.5rem;">
        <span style="display: inline-block; width: 8px; height: 8px; border-radius: 9999px; background: #22c55e;"></span>
        <span style="font-size: 0.75rem; font-weight: 700; color: #15803d; text-transform: uppercase;">
          District Health Grid Governance Active • Raigad District Civil Surgeon
        </span>
      </div>
      <h1>Clinic Licensing & Formulary Authorization Authority</h1>
      <p>
        Review applications from rural Primary Health Centres (PHC), Community Health Centres (CHC), and sub-dispensaries. Approving an application formally grants their medical practice license, activates staff login credentials, and provisions the emergency formulary.
      </p>
    </div>

    <!-- Live Telemetry Stats -->
    <div class="stats-grid">
      <div class="stat-card">
        <span class="stat-title">Pending Approvals</span>
        <div class="stat-value amber" id="pendingCount">0</div>
        <span style="font-size: 0.72rem; color: var(--text-muted);">Awaiting Health Officer sign-off</span>
      </div>
      <div class="stat-card">
        <span class="stat-title">Active Licensed Clinics</span>
        <div class="stat-value green" id="approvedCount">0</div>
        <span style="font-size: 0.72rem; color: var(--text-muted);">Transacting on inventory grid</span>
      </div>
      <div class="stat-card">
        <span class="stat-title">Total Network Facilities</span>
        <div class="stat-value" id="totalCount">0</div>
        <span style="font-size: 0.72rem; color: var(--text-muted);">Registered in district registry</span>
      </div>
    </div>

    <!-- Filter Controls -->
    <div class="controls">
      <div class="tabs">
        <button class="tab-btn active" onclick="filterBy('ALL', this)">All Facilities</button>
        <button class="tab-btn" onclick="filterBy('PENDING', this)">⏳ Pending Review</button>
        <button class="tab-btn" onclick="filterBy('APPROVED', this)">✅ Approved</button>
        <button class="tab-btn" onclick="filterBy('REJECTED', this)">❌ Rejected</button>
      </div>

      <div style="font-size: 0.78rem; color: var(--text-muted);" id="lastRefreshed">
        Auto-syncing with backend on :3001
      </div>
    </div>

    <!-- Clinic Applications Queue -->
    <div class="clinics-grid" id="clinicsContainer">
      <div class="empty-state">Loading registered clinics from Meditory backend...</div>
    </div>
  </div>

  <div id="toast" class="toast"></div>

  <script>
    let allFacilities = [];
    let currentFilter = 'ALL';

    function showToast(msg) {
      const toast = document.getElementById('toast');
      toast.textContent = msg;
      toast.style.display = 'block';
      setTimeout(() => { toast.style.display = 'none'; }, 4000);
    }

    async function signOutAdmin() {
      try {
        await fetch('/api/admin/logout', { method: 'POST' });
      } catch (e) {}
      window.location.href = '/login';
    }

    async function loadRegistrations() {
      try {
        const res = await fetch('/api/admin/registrations');
        if (res.status === 401 || res.status === 403) {
          window.location.href = '/login';
          return;
        }
        const data = await res.json();
        allFacilities = data.facilities || [];
        
        document.getElementById('pendingCount').textContent = data.pendingCount ?? 0;
        document.getElementById('approvedCount').textContent = data.approvedCount ?? 0;
        document.getElementById('totalCount').textContent = data.total ?? allFacilities.length;
        document.getElementById('lastRefreshed').textContent = 'Last updated: ' + new Date().toLocaleTimeString();

        renderCards();
      } catch (err) {
        document.getElementById('clinicsContainer').innerHTML =
          '<div class="empty-state" style="color: #b91c1c;">Failed to connect to backend API on port 3001. Please ensure backend server is active.</div>';
      }
    }

    function filterBy(status, btn) {
      currentFilter = status;
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderCards();
    }

    function renderCards() {
      const container = document.getElementById('clinicsContainer');
      let filtered = allFacilities;
      if (currentFilter !== 'ALL') {
        filtered = allFacilities.filter(f => f.approvalStatus === currentFilter);
      }

      if (!filtered.length) {
        container.innerHTML = '<div class="empty-state">No clinic applications found matching filter "' + currentFilter + '".</div>';
        return;
      }

      container.innerHTML = filtered.map(f => {
        const isPending = f.approvalStatus === 'PENDING';
        const isApproved = f.approvalStatus === 'APPROVED';
        const statusClass = isPending ? 'pending' : (isApproved ? 'approved' : 'rejected');
        const statusLabel = isPending ? '⏳ PENDING REVIEW' : (isApproved ? '✅ LICENSED & APPROVED' : '❌ REJECTED');

        return \`
          <div class="clinic-card \${statusClass}">
            <div class="card-header">
              <div class="clinic-title-box">
                <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.2rem;">
                  <span style="font-size: 0.68rem; font-weight: 700; background: #f1f5f9; padding: 0.15rem 0.45rem; border-radius: 4px;">\${f.type}</span>
                  <h3>\${f.name}</h3>
                </div>
                <span class="clinic-id">\${f.id} • Registered: \${new Date(f.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <span class="status-badge \${statusClass}">\${statusLabel}</span>
            </div>

            <div class="details-grid">
              <div class="detail-item">
                <span class="detail-label">District & Taluka</span>
                <span class="detail-val">\${f.taluka ? f.taluka + ', ' : ''}\${f.districtName}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Lead Medical Officer</span>
                <span class="detail-val">\${f.leadDoctorName || 'Dr. Assigned In-Charge'}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Official Work Email</span>
                <span class="detail-val" style="font-family: monospace;">\${f.leadDoctorEmail || 'staff@phc.in'}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Emergency Telephone</span>
                <span class="detail-val">\${f.phone}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Physical Address</span>
                <span class="detail-val">\${f.address || 'Civil Health Complex, Raigad'}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">GPS Coordinates</span>
                <span class="detail-val" style="font-family: monospace;">\${f.latitude?.toFixed(4)}, \${f.longitude?.toFixed(4)}</span>
              </div>
            </div>

            \${isPending ? \`
              <div class="card-actions">
                <span style="font-size: 0.72rem; color: var(--text-muted); margin-right: auto;">
                  ⚡ Action will activate doctor login and seed starter Anti-Snake Venom, ARV & ORS stock
                </span>
                <button class="btn-reject" onclick="rejectClinic('\${f.id}', '\${f.name}')">
                  Reject Application
                </button>
                <button class="btn-approve" onclick="approveClinic('\${f.id}', '\${f.name}')">
                  ✅ Approve & Grant Clinic License
                </button>
              </div>
            \` : isApproved ? \`
              <div style="font-size: 0.72rem; color: #166534; font-weight: 600; display: flex; align-items: center; justify-content: space-between;">
                <span>✓ Approved & Operational. Starter formulary seeded.</span>
                <span style="color: var(--text-muted); font-size: 0.68rem;">Approved: \${f.approvedAt ? new Date(f.approvedAt).toLocaleDateString() : 'Active'}</span>
              </div>
            \` : \`
              <div style="font-size: 0.72rem; color: #b91c1c; font-weight: 600;">
                Application Rejected. Reason: \${f.rejectionReason || 'Verification incomplete.'}
              </div>
            \`}
          </div>
        \`;
      }).join('');
    }

    async function approveClinic(facilityId, name) {
      if (!confirm('Approve ' + name + '?\\n\\nThis will:\\n1. Grant formal health authority license\\n2. Activate Lead MOIC doctor login credentials\\n3. Seed starter emergency formulary (ASV, ARV, ORS, PCM)')) {
        return;
      }

      try {
        const res = await fetch('/api/admin/approve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            facilityId,
            remarks: 'Verified by Raigad District Civil Surgeon',
            approvedBy: '${displayName}'
          })
        });
        const data = await res.json();
        if (data.success) {
          const emailNotice = data.emailNotification?.sent ? ' ✉️ Email notification sent.' : '';
          showToast('✅ ' + name + ' APPROVED!' + emailNotice + ' Credentials active & inventory seeded.');
          loadRegistrations();
        } else {
          alert(data.message || 'Approval failed.');
        }
      } catch (err) {
        alert('Failed to execute approval.');
      }
    }

    async function rejectClinic(facilityId, name) {
      const reason = prompt('Please specify rejection reason for ' + name + ':', 'Clinic license document verification incomplete.');
      if (!reason) return;

      try {
        const res = await fetch('/api/admin/reject', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            facilityId,
            rejectionReason: reason,
            rejectedBy: '${displayName}'
          })
        });
        const data = await res.json();
        if (data.success) {
          showToast('❌ ' + name + ' marked as REJECTED.');
          loadRegistrations();
        } else {
          alert(data.message || 'Rejection failed.');
        }
      } catch (err) {
        alert('Failed to execute rejection.');
      }
    }

    // Initial Load
    loadRegistrations();
    // Periodic refresh every 15s
    setInterval(loadRegistrations, 15000);
  </script>
</body>
</html>`;
}

/**
 * Validates the admin session against backend or cached token
 */
async function verifyAdminSession(token: string | null): Promise<{ valid: boolean; user?: any }> {
  if (!token) return { valid: false };
  try {
    const res = await fetch(`${BACKEND_API}/auth/me`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    if (!res.ok) return { valid: false };
    const data: any = await res.json();
    if (data?.user?.role === 'admin') {
      return { valid: true, user: data.user };
    }
    return { valid: false };
  } catch {
    return { valid: false };
  }
}

/**
 * HTTP Server for District Authority Administration (Port 3005)
 */
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost:3005'}`);

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Health Check
  if (req.method === 'GET' && url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', server: 'meditory-admin-portal', port: PORT }));
    return;
  }

  // =========================================================================
  // Authentication API Endpoints
  // =========================================================================

  // POST /api/admin/login
  if (req.method === 'POST' && url.pathname === '/api/admin/login') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const backendRes = await fetch(`${BACKEND_API}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
        });
        const data: any = await backendRes.json();

        if (!backendRes.ok) {
          res.writeHead(backendRes.status, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(data));
          return;
        }

        // Enforce RBAC: Caller MUST have 'admin' role
        if (data.user?.role !== 'admin') {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            error: 'FORBIDDEN',
            message: 'Access Denied: This portal is strictly restricted to District Health Authority Administrators. Clinic staff should access the dispensary terminal at :3000.',
          }));
          return;
        }

        // Set HttpOnly Admin Session Cookie
        const isSecure = process.env.NODE_ENV === 'production' ? 'Secure; ' : '';
        const cookieHeader = `${ADMIN_COOKIE_NAME}=${data.token}; Path=/; ${isSecure}HttpOnly; SameSite=Lax; Max-Age=86400`;

        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Set-Cookie': cookieHeader,
        });
        res.end(JSON.stringify({
          success: true,
          token: data.token,
          user: data.user,
          facility: data.facility,
        }));
      } catch (err: any) {
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'BAD_GATEWAY', message: err?.message || 'Failed to communicate with authentication service.' }));
      }
    });
    return;
  }

  // POST /api/admin/logout
  if (req.method === 'POST' && url.pathname === '/api/admin/logout') {
    const clearCookie = `${ADMIN_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Set-Cookie': clearCookie,
    });
    res.end(JSON.stringify({ success: true, message: 'Admin logged out successfully.' }));
    return;
  }

  // GET /api/admin/me
  if (req.method === 'GET' && url.pathname === '/api/admin/me') {
    const token = extractAdminToken(req);
    if (!token) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'UNAUTHORIZED', message: 'No active administrator session.' }));
      return;
    }
    const session = await verifyAdminSession(token);
    if (!session.valid) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'UNAUTHORIZED', message: 'Session expired or invalid.' }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ user: session.user }));
    return;
  }

  // =========================================================================
  // Protected API Proxies (Enforce Bearer token forwarding)
  // =========================================================================

  const adminToken = extractAdminToken(req);

  // API Proxy: GET /api/admin/registrations
  if (req.method === 'GET' && url.pathname === '/api/admin/registrations') {
    if (!adminToken) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'UNAUTHORIZED', message: 'Authentication required. Please sign in as District Health Authority.' }));
      return;
    }

    try {
      const backendRes = await fetch(`${BACKEND_API}/admin/registrations`, {
        headers: {
          'Authorization': `Bearer ${adminToken}`,
        },
      });
      const data: any = await backendRes.json();
      res.writeHead(backendRes.status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
    } catch (err: any) {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'BAD_GATEWAY', message: err?.message || 'Failed to reach API backend on port 3001' }));
    }
    return;
  }

  // API Proxy: POST /api/admin/approve
  if (req.method === 'POST' && url.pathname === '/api/admin/approve') {
    if (!adminToken) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'UNAUTHORIZED', message: 'Authentication required.' }));
      return;
    }

    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const backendRes = await fetch(`${BACKEND_API}/admin/registrations/approve`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${adminToken}`,
          },
          body,
        });
        const data: any = await backendRes.json();
        res.writeHead(backendRes.status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data));
      } catch (err: any) {
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'BAD_GATEWAY', message: err?.message || 'Failed to reach API backend' }));
      }
    });
    return;
  }

  // API Proxy: POST /api/admin/reject
  if (req.method === 'POST' && url.pathname === '/api/admin/reject') {
    if (!adminToken) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'UNAUTHORIZED', message: 'Authentication required.' }));
      return;
    }

    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const backendRes = await fetch(`${BACKEND_API}/admin/registrations/reject`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${adminToken}`,
          },
          body,
        });
        const data: any = await backendRes.json();
        res.writeHead(backendRes.status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data));
      } catch (err: any) {
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'BAD_GATEWAY', message: err?.message || 'Failed to reach API backend' }));
      }
    });
    return;
  }

  // =========================================================================
  // HTML UI Routes
  // =========================================================================

  // Serve Admin Login Page explicitly
  if (req.method === 'GET' && url.pathname === '/login') {
    const html = renderAdminLoginHtml();
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
    return;
  }

  // Serve Main Dashboard or Redirect to Login
  if ((req.method === 'GET' || req.method === 'HEAD') && (url.pathname === '/' || url.pathname === '/admin' || url.pathname === '/dashboard')) {
    const session = await verifyAdminSession(adminToken);

    if (!session.valid) {
      // Not logged in -> Render login page
      const html = renderAdminLoginHtml();
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
      return;
    }

    // Authenticated admin -> Render dashboard
    const html = renderAdminDashboardHtml(session.user?.name, session.user?.email);
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    if (req.method === 'HEAD') {
      res.end();
    } else {
      res.end(html);
    }
    return;
  }

  // Default 404
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found on Meditory Admin Server (Port 3005)');
});

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n❌ [Meditory Admin Server] Port ${PORT} is already in use by another running process.`);
    console.error(`   To free port ${PORT}, kill the existing process: npx kill-port ${PORT} or fuser -k ${PORT}/tcp\n`);
    process.exit(1);
  } else {
    console.error('❌ [Meditory Admin Server] Server error:', err);
    process.exit(1);
  }
});

server.listen(PORT, () => {
  console.log(`\n========================================================================`);
  console.log(`🏛️ [Meditory Admin Server] District Health Authority Active on Port ${PORT}`);
  console.log(`👉 Admin Sign-in & Dashboard URL: http://localhost:${PORT}`);
  console.log(`👉 Backend Proxy URL:            ${BACKEND_API}`);
  console.log(`========================================================================\n`);
});
