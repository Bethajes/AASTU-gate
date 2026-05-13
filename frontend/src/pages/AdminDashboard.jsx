import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import API from '../api/axios'
import StudentsTab from './StudentsTab'
import BulkUploadModal from './BulkUploadModal'
import BulkPhotoUploadModal from './BulkPhotoUploadModal'
import AddStudentModal from './AddStudentModal'
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  AreaChart, Area
} from 'recharts'

// ─── Google Fonts Injection ───────────────────────────────────────────────────
const fontLink = document.createElement('link')
fontLink.rel = 'stylesheet'
fontLink.href = 'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap'
if (!document.head.querySelector('[href*="IBM+Plex"]')) document.head.appendChild(fontLink)

// ─── Constants ────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'overview',  label: 'Overview',    icon: '▣' },
  { id: 'students',  label: 'Students',    icon: '◎' },
  { id: 'laptops',   label: 'Laptops',     icon: '▤' },
  { id: 'logs',      label: 'Gate Logs',   icon: '▦' },
  { id: 'analytics', label: 'Analytics',   icon: '▲' },
]

const PAGE_SIZE = 20

// ─── Custom Hook ──────────────────────────────────────────────────────────────

function useDashboardData() {
  const [laptops, setLaptops] = useState([])
  const [logs, setLogs]       = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)

  const fetchAllData = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const [laptopsRes, logsRes] = await Promise.all([
        API.get('/laptops/all'),
        API.get('/gate/logs'),
      ])
      setLaptops(laptopsRes.data)
      setLogs(logsRes.data)
    } catch (err) {
      setError(err?.response?.data?.message ?? 'Failed to load dashboard data.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAllData() }, [fetchAllData])
  return { laptops, logs, loading, error, refetch: fetchAllData }
}

// ─── Pure Helpers ─────────────────────────────────────────────────────────────

function buildChartData(logs, laptops) {
  const now = new Date()
  const last24h = new Date(now - 24 * 60 * 60 * 1000)
  const last7d  = new Date(now - 7 * 24 * 60 * 60 * 1000)
  const last28d = new Date(now - 28 * 24 * 60 * 60 * 1000)

  const hourlyMap = {}
  logs.forEach(log => {
    const d = new Date(log.scanned_at)
    if (d >= last24h) hourlyMap[d.getHours()] = (hourlyMap[d.getHours()] || 0) + 1
  })
  const hourly = Array.from({ length: 24 }, (_, i) => ({ hour: `${i}h`, scans: hourlyMap[i] || 0 }))

  const dailyMap = {}
  logs.forEach(log => {
    const d = new Date(log.scanned_at)
    if (d >= last7d) {
      const day = d.toLocaleDateString('en-US', { weekday: 'short' })
      dailyMap[day] = (dailyMap[day] || 0) + 1
    }
  })
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const daily = weekDays.map(day => ({ day, scans: dailyMap[day] || 0 }))

  const weeklyMap = {}
  logs.forEach(log => {
    const d = new Date(log.scanned_at)
    if (d >= last28d) {
      const wk = `W${Math.floor((d - last28d) / (7 * 24 * 60 * 60 * 1000)) + 1}`
      weeklyMap[wk] = (weeklyMap[wk] || 0) + 1
    }
  })
  const weekly = Object.entries(weeklyMap).map(([week, scans]) => ({ week, scans }))

  const onCampus  = laptops.filter(l => l.is_in_campus).length
  const offCampus = laptops.length - onCampus
  const statusDistribution = [
    { name: 'On Campus',  value: onCampus,  color: '#10b981' },
    { name: 'Off Campus', value: offCampus, color: '#f43f5e' },
  ]

  const studentMap = {}
  laptops.forEach(l => { studentMap[l.owner_name] = (studentMap[l.owner_name] || 0) + 1 })
  const topStudents = Object.entries(studentMap)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  return { hourly, daily, weekly, statusDistribution, topStudents }
}

function exportToCSV(logs) {
  const header = ['Date', 'Time', 'Brand', 'Serial', 'Scan Type', 'Scanned By']
  const rows = logs.map(log => [
    new Date(log.scanned_at).toLocaleDateString(),
    new Date(log.scanned_at).toLocaleTimeString(),
    log.brand, log.serial_number, log.scan_type, log.scanned_by_name,
  ])
  const csv  = [header, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url  = URL.createObjectURL(blob)
  const a    = Object.assign(document.createElement('a'), { href: url, download: `gate-logs-${new Date().toISOString().split('T')[0]}.csv` })
  a.click(); URL.revokeObjectURL(url)
}

function todayISO() { return new Date().toISOString().split('T')[0] }

// ─── CSS-in-JS Global Styles ──────────────────────────────────────────────────

const globalCSS = `
  @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --navy-950: #060d1f;
    --navy-900: #0c1635;
    --navy-800: #0f1f4a;
    --navy-700: #162552;
    --navy-600: #1d3060;
    --blue-500: #2563eb;
    --blue-400: #3b82f6;
    --blue-300: #93c5fd;
    --slate-100: #f1f5f9;
    --slate-200: #e2e8f0;
    --slate-300: #cbd5e1;
    --slate-400: #94a3b8;
    --slate-500: #64748b;
    --slate-600: #475569;
    --slate-700: #334155;
    --slate-800: #1e293b;
    --green-500: #10b981;
    --green-100: #d1fae5;
    --red-500: #f43f5e;
    --red-100: #ffe4e6;
    --amber-500: #f59e0b;
    --amber-100: #fef3c7;
    --font-main: 'IBM Plex Sans', -apple-system, sans-serif;
    --font-mono: 'IBM Plex Mono', 'Courier New', monospace;
    --shadow-sm: 0 1px 3px rgba(0,0,0,.06), 0 1px 2px rgba(0,0,0,.04);
    --shadow-md: 0 4px 12px rgba(0,0,0,.08), 0 2px 4px rgba(0,0,0,.04);
    --shadow-lg: 0 12px 32px rgba(0,0,0,.12), 0 4px 8px rgba(0,0,0,.06);
    --radius-sm: 6px;
    --radius-md: 10px;
    --radius-lg: 16px;
    --transition: 0.18s cubic-bezier(0.4, 0, 0.2, 1);
  }

  body { font-family: var(--font-main); background: var(--slate-100); color: var(--slate-800); -webkit-font-smoothing: antialiased; }

  /* Sidebar */
  .aastu-sidebar {
    position: fixed; top: 0; left: 0; height: 100vh; width: 240px;
    background: var(--navy-900);
    border-right: 1px solid rgba(255,255,255,0.06);
    display: flex; flex-direction: column;
    z-index: 100;
    transition: width var(--transition);
    overflow: hidden;
  }
  .aastu-sidebar.collapsed { width: 64px; }

  .sidebar-logo {
    display: flex; align-items: center; gap: 10px;
    padding: 22px 20px 18px;
    border-bottom: 1px solid rgba(255,255,255,0.07);
    min-height: 72px;
  }
  .sidebar-logo-mark {
    width: 34px; height: 34px; flex-shrink: 0;
    background: linear-gradient(135deg, var(--blue-400), var(--blue-500));
    border-radius: var(--radius-sm);
    display: flex; align-items: center; justify-content: center;
    font-size: 16px; font-weight: 700; color: #fff;
    box-shadow: 0 2px 8px rgba(37,99,235,0.4);
  }
  .sidebar-logo-text { overflow: hidden; white-space: nowrap; }
  .sidebar-logo-title { font-size: 13px; font-weight: 700; color: #fff; letter-spacing: 0.02em; line-height: 1.2; }
  .sidebar-logo-sub   { font-size: 10px; color: var(--slate-400); letter-spacing: 0.05em; text-transform: uppercase; margin-top: 2px; }

  .sidebar-nav { flex: 1; padding: 16px 10px; overflow-y: auto; }
  .sidebar-section-label {
    font-size: 9.5px; font-weight: 600; letter-spacing: 0.1em;
    text-transform: uppercase; color: var(--slate-500);
    padding: 8px 10px 4px; white-space: nowrap; overflow: hidden;
  }
  .sidebar-item {
    display: flex; align-items: center; gap: 12px;
    padding: 9px 10px; border-radius: var(--radius-sm);
    cursor: pointer; margin-bottom: 2px;
    transition: background var(--transition), color var(--transition);
    color: var(--slate-400); font-size: 13.5px; font-weight: 500;
    white-space: nowrap; overflow: hidden;
  }
  .sidebar-item:hover { background: rgba(255,255,255,0.06); color: #fff; }
  .sidebar-item.active {
    background: rgba(37,99,235,0.18);
    color: var(--blue-300);
    box-shadow: inset 3px 0 0 var(--blue-400);
  }
  .sidebar-icon {
    width: 20px; height: 20px; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    font-size: 15px;
  }
  .sidebar-collapse-btn {
    margin: 0 10px 16px;
    display: flex; align-items: center; gap: 12px;
    padding: 8px 10px; border-radius: var(--radius-sm);
    cursor: pointer; color: var(--slate-500); font-size: 12px;
    transition: background var(--transition), color var(--transition);
    border: none; background: transparent; width: calc(100% - 20px);
  }
  .sidebar-collapse-btn:hover { background: rgba(255,255,255,0.05); color: var(--slate-300); }

  /* Topbar */
  .aastu-topbar {
    position: fixed; top: 0; left: 240px; right: 0; height: 64px;
    background: #fff;
    border-bottom: 1px solid var(--slate-200);
    display: flex; align-items: center; justify-content: space-between;
    padding: 0 28px;
    z-index: 90;
    transition: left var(--transition);
    box-shadow: var(--shadow-sm);
  }
  .aastu-topbar.sidebar-collapsed { left: 64px; }

  .topbar-left { display: flex; align-items: center; gap: 16px; }
  .topbar-breadcrumb { font-size: 13px; color: var(--slate-400); display: flex; align-items: center; gap: 6px; }
  .topbar-breadcrumb strong { color: var(--slate-700); font-weight: 600; }
  .topbar-right { display: flex; align-items: center; gap: 8px; }

  .topbar-btn {
    width: 36px; height: 36px;
    border: 1px solid var(--slate-200); border-radius: var(--radius-sm);
    background: transparent; cursor: pointer; font-size: 16px;
    display: flex; align-items: center; justify-content: center;
    color: var(--slate-500); transition: all var(--transition);
    position: relative;
  }
  .topbar-btn:hover { background: var(--slate-100); color: var(--slate-700); border-color: var(--slate-300); }

  .topbar-badge {
    position: absolute; top: 6px; right: 6px;
    width: 7px; height: 7px; border-radius: 50%;
    background: var(--red-500); border: 1.5px solid #fff;
  }

  .topbar-profile {
    display: flex; align-items: center; gap: 10px;
    padding: 5px 12px 5px 5px;
    border: 1px solid var(--slate-200); border-radius: var(--radius-md);
    cursor: pointer; background: transparent;
    transition: all var(--transition);
  }
  .topbar-profile:hover { background: var(--slate-50); border-color: var(--slate-300); }
  .topbar-avatar {
    width: 28px; height: 28px; border-radius: 50%;
    background: linear-gradient(135deg, var(--blue-400), var(--navy-800));
    display: flex; align-items: center; justify-content: center;
    font-size: 11px; font-weight: 700; color: #fff; flex-shrink: 0;
  }
  .topbar-profile-info { text-align: left; }
  .topbar-profile-name { font-size: 12.5px; font-weight: 600; color: var(--slate-700); line-height: 1.2; }
  .topbar-profile-role { font-size: 10.5px; color: var(--slate-400); }
  .logout-btn {
    display: flex; align-items: center; gap: 6px;
    padding: 6px 12px; border-radius: var(--radius-sm);
    background: transparent; border: 1px solid var(--slate-200);
    color: var(--slate-500); font-size: 12px; font-weight: 500;
    cursor: pointer; transition: all var(--transition);
    font-family: var(--font-main);
  }
  .logout-btn:hover { background: var(--red-100); color: var(--red-500); border-color: var(--red-500); }

  /* Main Content */
  .aastu-main {
    margin-left: 240px; margin-top: 64px;
    padding: 28px; min-height: calc(100vh - 64px);
    transition: margin-left var(--transition);
    display: flex; flex-direction: column; gap: 0;
  }
  .aastu-main.sidebar-collapsed { margin-left: 64px; }

  /* Page Header */
  .page-header { margin-bottom: 24px; }
  .page-title { font-size: 22px; font-weight: 700; color: var(--slate-900, #0f172a); letter-spacing: -0.02em; }
  .page-subtitle { font-size: 13px; color: var(--slate-400); margin-top: 3px; }

  /* Stat Cards */
  .stat-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 16px; margin-bottom: 24px; }
  .stat-card {
    background: #fff; border-radius: var(--radius-lg); padding: 20px 22px;
    border: 1px solid var(--slate-200); box-shadow: var(--shadow-sm);
    display: flex; align-items: flex-start; gap: 14px;
    transition: box-shadow var(--transition), transform var(--transition);
    position: relative; overflow: hidden;
  }
  .stat-card::after {
    content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px;
    background: linear-gradient(90deg, var(--stat-color, var(--blue-500)), transparent);
  }
  .stat-card:hover { box-shadow: var(--shadow-md); transform: translateY(-1px); }
  .stat-icon {
    width: 40px; height: 40px; border-radius: var(--radius-sm);
    background: var(--stat-bg, #eff6ff);
    display: flex; align-items: center; justify-content: center;
    font-size: 18px; flex-shrink: 0;
  }
  .stat-body { flex: 1; min-width: 0; }
  .stat-value { font-size: 26px; font-weight: 700; color: var(--slate-900, #0f172a); line-height: 1.1; letter-spacing: -0.03em; }
  .stat-label { font-size: 12px; color: var(--slate-500); margin-top: 3px; font-weight: 500; }
  .stat-delta { font-size: 11px; margin-top: 6px; font-weight: 500; display: flex; align-items: center; gap: 3px; }
  .stat-delta.up { color: var(--green-500); }
  .stat-delta.neutral { color: var(--slate-400); }

  /* Content Card */
  .content-card {
    background: #fff; border-radius: var(--radius-lg);
    border: 1px solid var(--slate-200); box-shadow: var(--shadow-sm);
    overflow: hidden;
  }
  .content-card + .content-card { margin-top: 20px; }
  .card-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 18px 22px; border-bottom: 1px solid var(--slate-100);
    flex-wrap: wrap; gap: 12px;
  }
  .card-header-left { display: flex; align-items: center; gap: 10px; }
  .card-icon {
    width: 32px; height: 32px; border-radius: var(--radius-sm);
    background: var(--slate-100); display: flex; align-items: center;
    justify-content: center; font-size: 15px;
  }
  .card-title { font-size: 14px; font-weight: 600; color: var(--slate-800); }
  .card-subtitle { font-size: 12px; color: var(--slate-400); margin-top: 1px; }
  .card-body { padding: 22px; }
  .card-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }

  /* Chart Grid */
  .chart-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 20px; }
  @media (max-width: 900px) { .chart-grid-2 { grid-template-columns: 1fr; } }

  /* Tables */
  .table-wrapper { overflow-x: auto; }
  table.data-table { width: 100%; border-collapse: collapse; font-size: 13px; }
  table.data-table thead tr { background: var(--slate-50); }
  table.data-table thead th {
    padding: 11px 14px; text-align: left;
    font-size: 11px; font-weight: 600; letter-spacing: 0.06em;
    text-transform: uppercase; color: var(--slate-500);
    border-bottom: 1px solid var(--slate-200);
    white-space: nowrap; position: sticky; top: 0;
    background: var(--slate-50); z-index: 1;
  }
  table.data-table tbody tr {
    border-bottom: 1px solid var(--slate-100);
    transition: background var(--transition);
  }
  table.data-table tbody tr:hover { background: var(--slate-50); }
  table.data-table tbody tr:last-child { border-bottom: none; }
  table.data-table td { padding: 12px 14px; color: var(--slate-700); vertical-align: middle; }

  /* Badges */
  .badge {
    display: inline-flex; align-items: center; gap: 5px;
    padding: 3px 9px; border-radius: 20px; font-size: 11px; font-weight: 600;
    white-space: nowrap;
  }
  .badge-dot { width: 6px; height: 6px; border-radius: 50%; }
  .badge-green  { background: var(--green-100); color: #065f46; }
  .badge-red    { background: var(--red-100);   color: #9f1239; }
  .badge-blue   { background: #dbeafe; color: #1e40af; }
  .badge-amber  { background: var(--amber-100); color: #92400e; }
  .badge-slate  { background: var(--slate-100); color: var(--slate-600); }

  /* Buttons */
  .btn {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 8px 14px; border-radius: var(--radius-sm);
    font-family: var(--font-main); font-size: 12.5px; font-weight: 600;
    cursor: pointer; transition: all var(--transition);
    border: none; white-space: nowrap;
  }
  .btn-primary {
    background: var(--blue-500); color: #fff;
  }
  .btn-primary:hover { background: #1d4ed8; box-shadow: 0 2px 8px rgba(37,99,235,0.3); }
  .btn-outline {
    background: transparent; color: var(--slate-600);
    border: 1px solid var(--slate-200);
  }
  .btn-outline:hover { background: var(--slate-50); border-color: var(--slate-300); color: var(--slate-700); }
  .btn-ghost {
    background: transparent; color: var(--slate-500); border: none;
  }
  .btn-ghost:hover { background: var(--slate-100); color: var(--slate-700); }
  .btn-danger-outline {
    background: transparent; color: var(--red-500);
    border: 1px solid currentColor;
  }
  .btn-danger-outline:hover { background: var(--red-100); }
  .btn-sm { padding: 5px 10px; font-size: 11.5px; }
  .btn-icon { width: 32px; height: 32px; padding: 0; justify-content: center; }

  /* Search & Filter Bar */
  .filter-bar { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .search-input-wrap { position: relative; flex: 1; min-width: 220px; max-width: 320px; }
  .search-icon { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: var(--slate-400); font-size: 14px; pointer-events: none; }
  .search-input {
    width: 100%; padding: 7px 10px 7px 32px;
    border: 1px solid var(--slate-200); border-radius: var(--radius-sm);
    font-family: var(--font-main); font-size: 13px; color: var(--slate-700);
    background: var(--slate-50); outline: none;
    transition: border-color var(--transition), box-shadow var(--transition);
  }
  .search-input:focus { border-color: var(--blue-400); box-shadow: 0 0 0 3px rgba(37,99,235,0.1); background: #fff; }
  .search-input::placeholder { color: var(--slate-400); }

  .filter-chip {
    padding: 6px 12px; border-radius: 20px; font-size: 12px; font-weight: 500;
    cursor: pointer; transition: all var(--transition); border: 1.5px solid transparent;
    background: var(--slate-100); color: var(--slate-500); font-family: var(--font-main);
  }
  .filter-chip:hover { background: var(--slate-200); color: var(--slate-700); }
  .filter-chip.active { background: var(--navy-900); color: #fff; border-color: var(--navy-900); }

  /* Pagination */
  .pagination {
    display: flex; align-items: center; justify-content: space-between;
    padding: 14px 22px; border-top: 1px solid var(--slate-100);
    background: var(--slate-50);
  }
  .pagination-info { font-size: 12px; color: var(--slate-400); }
  .pagination-btns { display: flex; gap: 4px; }
  .page-btn {
    min-width: 30px; height: 30px; border-radius: var(--radius-sm);
    border: 1px solid var(--slate-200); background: #fff; cursor: pointer;
    font-size: 12px; color: var(--slate-500); font-family: var(--font-main);
    display: flex; align-items: center; justify-content: center;
    transition: all var(--transition);
  }
  .page-btn:hover:not(:disabled) { background: var(--slate-100); border-color: var(--slate-300); }
  .page-btn.active { background: var(--navy-900); color: #fff; border-color: var(--navy-900); }
  .page-btn:disabled { opacity: 0.4; cursor: not-allowed; }

  /* Error Banner */
  .error-banner {
    background: var(--red-100); border: 1px solid #fecdd3;
    border-radius: var(--radius-md); padding: 12px 16px;
    display: flex; align-items: center; justify-content: space-between;
    font-size: 13px; color: #9f1239; margin-bottom: 20px;
  }

  /* Loading */
  @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
  .skeleton {
    background: linear-gradient(90deg, var(--slate-200) 25%, var(--slate-100) 50%, var(--slate-200) 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    border-radius: var(--radius-sm);
  }

  /* Footer */
  .aastu-footer {
    background: #fff; border-top: 1px solid var(--slate-200);
    padding: 16px 28px;
    display: flex; align-items: center; justify-content: space-between;
    flex-wrap: wrap; gap: 8px;
    font-size: 11.5px; color: var(--slate-400);
    margin-top: auto;
  }
  .footer-left { display: flex; align-items: center; gap: 16px; }
  .footer-right { display: flex; align-items: center; gap: 12px; }
  .footer-divider { color: var(--slate-300); }
  .footer-link { color: var(--slate-400); text-decoration: none; transition: color var(--transition); }
  .footer-link:hover { color: var(--blue-500); }
  .footer-version { 
    font-family: var(--font-mono); font-size: 10px;
    background: var(--slate-100); padding: 2px 6px; border-radius: 4px;
    color: var(--slate-500);
  }

  /* Mono text */
  .mono { font-family: var(--font-mono); font-size: 12px; background: var(--slate-100); padding: 3px 7px; border-radius: 4px; color: var(--slate-600); }

  /* Avatar placeholder */
  .student-avatar {
    width: 30px; height: 30px; border-radius: 50%;
    background: linear-gradient(135deg, var(--blue-300), var(--blue-500));
    display: flex; align-items: center; justify-content: center;
    font-size: 11px; font-weight: 700; color: #fff; flex-shrink: 0;
  }
  .student-info { display: flex; align-items: center; gap: 9px; }
  .student-name { font-weight: 600; color: var(--slate-700); font-size: 13px; }
  .student-id   { font-size: 11px; color: var(--slate-400); margin-top: 1px; }

  /* Recharts custom */
  .recharts-tooltip-wrapper .recharts-default-tooltip {
    border: 1px solid var(--slate-200) !important;
    border-radius: var(--radius-sm) !important;
    box-shadow: var(--shadow-md) !important;
    font-family: var(--font-main) !important;
    font-size: 12px !important;
  }

  /* Responsive */
  @media (max-width: 768px) {
    .aastu-sidebar { width: 64px !important; }
    .sidebar-logo-text, .sidebar-item span, .sidebar-section-label { display: none; }
    .aastu-topbar { left: 64px; }
    .aastu-main { margin-left: 64px; padding: 16px; }
    .stat-grid { grid-template-columns: repeat(2, 1fr); }
    .card-header { flex-direction: column; align-items: flex-start; }
  }

  /* Fade-in */
  @keyframes fadeUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
  .fade-up { animation: fadeUp 0.25s ease forwards; }
`

// ─── Sub-components ───────────────────────────────────────────────────────────

function GlobalStyles() {
  useEffect(() => {
    const style = document.createElement('style')
    style.textContent = globalCSS
    document.head.appendChild(style)
    return () => document.head.removeChild(style)
  }, [])
  return null
}

function Sidebar({ activeTab, onTab, collapsed, onToggle }) {
  const items = [
    { id: 'overview',  label: 'Overview',      icon: '⊞' },
    { id: 'students',  label: 'Students',       icon: '◎' },
    { id: 'laptops',   label: 'Laptops',        icon: '▤' },
    { id: 'logs',      label: 'Gate Logs',      icon: '▦' },
    { id: 'analytics', label: 'Analytics',      icon: '▲' },
  ]

  return (
    <aside className={`aastu-sidebar${collapsed ? ' collapsed' : ''}`}>
      <div className="sidebar-logo">
        <div className="sidebar-logo-mark">A</div>
        {!collapsed && (
          <div className="sidebar-logo-text">
            <div className="sidebar-logo-title">AASTU Security Center</div>
            <div className="sidebar-logo-sub">ICT & Campus Operations</div>
          </div>
        )}
      </div>

      <nav className="sidebar-nav">
        {!collapsed && <div className="sidebar-section-label">Main Menu</div>}
        {items.map(item => (
          <div
            key={item.id}
            className={`sidebar-item${activeTab === item.id ? ' active' : ''}`}
            onClick={() => onTab(item.id)}
            title={collapsed ? item.label : undefined}
          >
            <span className="sidebar-icon">{item.icon}</span>
            {!collapsed && <span>{item.label}</span>}
          </div>
        ))}
        {!collapsed && <div className="sidebar-section-label" style={{ marginTop: 12 }}>System</div>}
        {[
          { id: 'reports',  label: 'Reports',  icon: '⊟' },
          { id: 'settings', label: 'Settings', icon: '⊛' },
        ].map(item => (
          <div key={item.id} className="sidebar-item" title={collapsed ? item.label : undefined}>
            <span className="sidebar-icon">{item.icon}</span>
            {!collapsed && <span>{item.label}</span>}
          </div>
        ))}
      </nav>

      <button className="sidebar-collapse-btn" onClick={onToggle} title={collapsed ? 'Expand' : 'Collapse'}>
        <span className="sidebar-icon">{collapsed ? '→' : '←'}</span>
        {!collapsed && <span>Collapse</span>}
      </button>
    </aside>
  )
}

function Topbar({ user, onLogout, activeTab, collapsed, onChangePassword }) {
  const tabLabels = { overview: 'Overview', students: 'Students', laptops: 'Laptops', logs: 'Gate Logs', analytics: 'Analytics' }
  const initials = user?.name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'AD'
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <header className={`aastu-topbar${collapsed ? ' sidebar-collapsed' : ''}`}>
      <div className="topbar-left">
        <div className="topbar-breadcrumb">
          <span>Dashboard</span>
          <span style={{ color: '#cbd5e1' }}>/</span>
          <strong>{tabLabels[activeTab] || activeTab}</strong>
        </div>
      </div>
      <div className="topbar-right">
        <button className="topbar-btn" title="Notifications" style={{ fontSize: 18 }}>
          🔔
          <span className="topbar-badge" />
        </button>
        <button className="topbar-btn" title="Help" style={{ fontSize: 16 }}>?</button>

        {/* Profile dropdown */}
        <div ref={dropdownRef} style={{ position: 'relative' }}>
          <button
            className="topbar-profile"
            onClick={() => setDropdownOpen(o => !o)}
            style={{ cursor: 'pointer' }}
          >
            <div className="topbar-avatar">{initials}</div>
            <div className="topbar-profile-info">
              <div className="topbar-profile-name">{user?.name || 'Admin'}</div>
              <div className="topbar-profile-role">System Admin</div>
            </div>
            <span style={{ marginLeft: 6, fontSize: 10, color: '#94a3b8' }}>▼</span>
          </button>

          {dropdownOpen && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 8px)', right: 0,
              background: '#fff', border: '1px solid #e2e8f0',
              borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
              minWidth: 200, zIndex: 200, overflow: 'hidden',
            }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{user?.name || 'Admin'}</div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{user?.email || 'System Administrator'}</div>
              </div>
              <button
                onClick={() => { setDropdownOpen(false); onChangePassword() }}
                style={{
                  width: '100%', padding: '11px 16px', background: 'none', border: 'none',
                  textAlign: 'left', cursor: 'pointer', fontSize: 13, color: '#334155',
                  display: 'flex', alignItems: 'center', gap: 10,
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}
              >
                <span style={{ fontSize: 15 }}>🔑</span> Change Password
              </button>
              <div style={{ height: 1, background: '#f1f5f9' }} />
              <button
                onClick={() => { setDropdownOpen(false); onLogout() }}
                style={{
                  width: '100%', padding: '11px 16px', background: 'none', border: 'none',
                  textAlign: 'left', cursor: 'pointer', fontSize: 13, color: '#ef4444',
                  display: 'flex', alignItems: 'center', gap: 10,
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#fff5f5'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}
              >
                <span style={{ fontSize: 15 }}>⏻</span> Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

function ChangePasswordModal({ onClose }) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match')
      return
    }
    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters')
      return
    }
    setLoading(true)
    try {
      await API.post('/auth/change-password', { currentPassword, newPassword })
      setSuccess('Password changed successfully')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to change password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000,
    }}>
      <div style={{
        background: '#fff', borderRadius: 16, padding: '32px 28px',
        width: '100%', maxWidth: 420, boxShadow: '0 24px 64px rgba(0,0,0,0.2)',
        position: 'relative',
      }}>
        <button onClick={onClose} style={{
          position: 'absolute', top: 16, right: 16,
          background: 'none', border: 'none', fontSize: 20,
          cursor: 'pointer', color: '#94a3b8', lineHeight: 1,
        }}>✕</button>

        <h2 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 700, color: '#0f172a' }}>Change Password</h2>
        <p style={{ margin: '0 0 24px', fontSize: 13, color: '#64748b' }}>Update your admin account password</p>

        {error && (
          <div style={{ background: '#fff0f0', color: '#e53e3e', padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: 13, border: '1px solid #ffcdd2' }}>
            {error}
          </div>
        )}
        {success && (
          <div style={{ background: '#f0fff4', color: '#276749', padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: 13, border: '1px solid #c6f6d5' }}>
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {[
            { label: 'Current Password', value: currentPassword, setter: setCurrentPassword },
            { label: 'New Password', value: newPassword, setter: setNewPassword },
            { label: 'Confirm New Password', value: confirmPassword, setter: setConfirmPassword },
          ].map(({ label, value, setter }) => (
            <div key={label} style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: '#334155' }}>{label}</label>
              <input
                type="password"
                value={value}
                onChange={e => setter(e.target.value)}
                required
                style={{
                  width: '100%', padding: '10px 14px', borderRadius: 8,
                  border: '1.5px solid #e2e8f0', fontSize: 14, outline: 'none',
                  boxSizing: 'border-box', fontFamily: 'inherit',
                  transition: 'border-color 0.2s',
                }}
                onFocus={e => e.target.style.borderColor = '#3b82f6'}
                onBlur={e => e.target.style.borderColor = '#e2e8f0'}
              />
            </div>
          ))}

          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <button type="button" onClick={onClose} style={{
              flex: 1, padding: '10px', borderRadius: 8, border: '1.5px solid #e2e8f0',
              background: 'transparent', color: '#64748b', fontSize: 14, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
            }}>
              Cancel
            </button>
            <button type="submit" disabled={loading} style={{
              flex: 1, padding: '10px', borderRadius: 8, border: 'none',
              background: loading ? '#93c5fd' : '#2563eb', color: '#fff',
              fontSize: 14, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
            }}>
              {loading ? 'Saving…' : 'Save Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function StatCards({ laptops, logs }) {
  const stats = useMemo(() => ({
    totalLaptops: laptops.length,
    onCampus:     laptops.filter(l => l.is_in_campus).length,
    totalScans:   logs.length,
    scansToday:   logs.filter(l => new Date(l.scanned_at).toISOString().split('T')[0] === todayISO()).length,
  }), [laptops, logs])

  const cards = [
    { label: 'Registered Laptops', value: stats.totalLaptops, icon: '💻', color: '#2563eb', bg: '#dbeafe', delta: null },
    { label: 'On Campus Now',      value: stats.onCampus,     icon: '🏛️', color: '#10b981', bg: '#d1fae5', delta: 'Active' },
    { label: 'Total Gate Scans',   value: stats.totalScans,   icon: '🔍', color: '#6366f1', bg: '#e0e7ff', delta: 'All Time' },
    { label: 'Scans Today',        value: stats.scansToday,   icon: '📅', color: '#f59e0b', bg: '#fef3c7', delta: 'Today' },
  ]

  return (
    <div className="stat-grid">
      {cards.map((c, i) => (
        <div
          key={c.label}
          className="stat-card fade-up"
          style={{ '--stat-color': c.color, '--stat-bg': c.bg, animationDelay: `${i * 60}ms` }}
        >
          <div className="stat-icon">{c.icon}</div>
          <div className="stat-body">
            <div className="stat-value">{c.value.toLocaleString()}</div>
            <div className="stat-label">{c.label}</div>
            {c.delta && <div className="stat-delta neutral">— {c.delta}</div>}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────

const CHART_COLORS = { primary: '#2563eb', secondary: '#10b981', accent: '#6366f1', warm: '#f59e0b' }

function OverviewTab({ chartData }) {
  const { hourly, daily, weekly, statusDistribution, topStudents } = chartData

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null
    return (
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 12px', fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
        <p style={{ fontWeight: 600, color: '#334155', marginBottom: 3 }}>{label}</p>
        {payload.map(p => (
          <p key={p.dataKey} style={{ color: p.color }}>{p.dataKey}: <strong>{p.value}</strong></p>
        ))}
      </div>
    )
  }

  return (
    <div className="fade-up">
      <div className="content-card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <div className="card-header-left">
            <div className="card-icon">📈</div>
            <div>
              <div className="card-title">Scan Activity — Last 24 Hours</div>
              <div className="card-subtitle">Hourly gate scan volume</div>
            </div>
          </div>
        </div>
        <div className="card-body">
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={hourly} margin={{ top: 4, right: 4, bottom: 0, left: -10 }}>
              <defs>
                <linearGradient id="scanGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="10%" stopColor={CHART_COLORS.primary} stopOpacity={0.15} />
                  <stop offset="95%" stopColor={CHART_COLORS.primary} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="hour" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="scans" stroke={CHART_COLORS.primary} strokeWidth={2} fill="url(#scanGrad)" dot={false} activeDot={{ r: 4, fill: CHART_COLORS.primary }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="chart-grid-2">
        <div className="content-card">
          <div className="card-header">
            <div className="card-header-left">
              <div className="card-icon">📊</div>
              <div>
                <div className="card-title">Daily Pattern — Last 7 Days</div>
                <div className="card-subtitle">Scans by day of week</div>
              </div>
            </div>
          </div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={daily} margin={{ top: 4, right: 4, bottom: 0, left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="scans" fill={CHART_COLORS.accent} radius={[4, 4, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="content-card">
          <div className="card-header">
            <div className="card-header-left">
              <div className="card-icon">🍩</div>
              <div>
                <div className="card-title">Campus Presence</div>
                <div className="card-subtitle">On Campus vs Off Campus</div>
              </div>
            </div>
          </div>
          <div className="card-body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={statusDistribution} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value"
                  label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`} labelLine={false}
                >
                  {statusDistribution.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value, name) => [value, name]} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="chart-grid-2" style={{ marginTop: 20 }}>
        <div className="content-card">
          <div className="card-header">
            <div className="card-header-left">
              <div className="card-icon">📉</div>
              <div>
                <div className="card-title">Weekly Trend</div>
                <div className="card-subtitle">Last 4 weeks</div>
              </div>
            </div>
          </div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={weekly} margin={{ top: 4, right: 4, bottom: 0, left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="week" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="scans" stroke={CHART_COLORS.warm} strokeWidth={2.5} dot={{ r: 5, fill: CHART_COLORS.warm, strokeWidth: 0 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="content-card">
          <div className="card-header">
            <div className="card-header-left">
              <div className="card-icon">🏆</div>
              <div>
                <div className="card-title">Top Registered Students</div>
                <div className="card-subtitle">By number of laptops</div>
              </div>
            </div>
          </div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={topStudents} layout="vertical" margin={{ top: 4, right: 20, bottom: 0, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" fill={CHART_COLORS.secondary} radius={[0, 4, 4, 0]} maxBarSize={22} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Laptops Tab ──────────────────────────────────────────────────────────────

// ─── Time Range Filter ────────────────────────────────────────────────────────

const TIME_PRESETS = [
  { id: 'ALL',   label: 'All Time' },
  { id: 'TODAY', label: 'Today' },
  { id: '7D',    label: 'Last 7 Days' },
  { id: '30D',   label: 'Last 30 Days' },
  { id: 'CUSTOM', label: 'Custom Range' },
]

function getPresetRange(preset) {
  const now = new Date()
  if (preset === 'TODAY') {
    const start = new Date(now); start.setHours(0, 0, 0, 0)
    return { start, end: now }
  }
  if (preset === '7D') return { start: new Date(now - 7 * 86400000), end: now }
  if (preset === '30D') return { start: new Date(now - 30 * 86400000), end: now }
  return null
}

function TimeRangeFilter({ preset, onPreset, dateFrom, dateTo, onDateFrom, onDateTo }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      {TIME_PRESETS.map(p => (
        <button
          key={p.id}
          className={`filter-chip${preset === p.id ? ' active' : ''}`}
          onClick={() => onPreset(p.id)}
        >
          {p.label}
        </button>
      ))}
      {preset === 'CUSTOM' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input
            type="date"
            value={dateFrom}
            onChange={e => onDateFrom(e.target.value)}
            style={dateInputStyle}
          />
          <span style={{ fontSize: 12, color: '#94a3b8' }}>→</span>
          <input
            type="date"
            value={dateTo}
            onChange={e => onDateTo(e.target.value)}
            style={dateInputStyle}
          />
        </div>
      )}
    </div>
  )
}

const dateInputStyle = {
  padding: '5px 10px', borderRadius: 6, border: '1.5px solid #e2e8f0',
  fontSize: 12, color: '#334155', fontFamily: 'inherit', outline: 'none',
  cursor: 'pointer',
}

function applyTimeFilter(items, dateField, preset, dateFrom, dateTo) {
  if (preset === 'ALL') return items
  if (preset === 'CUSTOM') {
    const start = dateFrom ? new Date(dateFrom + 'T00:00:00') : null
    const end   = dateTo   ? new Date(dateTo   + 'T23:59:59') : null
    return items.filter(item => {
      const d = new Date(item[dateField])
      if (start && d < start) return false
      if (end   && d > end)   return false
      return true
    })
  }
  const range = getPresetRange(preset)
  if (!range) return items
  return items.filter(item => {
    const d = new Date(item[dateField])
    return d >= range.start && d <= range.end
  })
}

function LaptopsTab({ laptops, onExport }) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [timePreset, setTimePreset] = useState('ALL')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    const timeFiltered = applyTimeFilter(laptops, 'registered_at', timePreset, dateFrom, dateTo)
    return timeFiltered.filter(l => {
      const matchStatus = statusFilter === 'ALL' || (statusFilter === 'ON' ? l.is_in_campus : !l.is_in_campus)
      const matchSearch = !q || l.owner_name?.toLowerCase().includes(q) || l.brand?.toLowerCase().includes(q) || l.serial_number?.toLowerCase().includes(q) || l.student_id?.toLowerCase().includes(q)
      return matchStatus && matchSearch
    })
  }, [laptops, search, statusFilter, timePreset, dateFrom, dateTo])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const resetPage = () => setPage(1)

  return (
    <div className="content-card fade-up">
      <div className="card-header">
        <div className="card-header-left">
          <div className="card-icon">💻</div>
          <div>
            <div className="card-title">Registered Laptops</div>
            <div className="card-subtitle">{filtered.length} of {laptops.length} devices shown</div>
          </div>
        </div>
        <div className="card-actions">
          <button className="btn btn-outline btn-sm" onClick={onExport}>⬇ Export CSV</button>
        </div>
      </div>

      {/* Filters row */}
      <div style={{ padding: '12px 22px', borderBottom: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="filter-bar">
          <div className="search-input-wrap">
            <span className="search-icon">🔍</span>
            <input className="search-input" placeholder="Search owner, brand, serial…" value={search}
              onChange={e => { setSearch(e.target.value); resetPage() }} />
          </div>
          {['ALL', 'ON', 'OFF'].map(v => (
            <button key={v} className={`filter-chip${statusFilter === v ? ' active' : ''}`}
              onClick={() => { setStatusFilter(v); resetPage() }}>
              {v === 'ALL' ? 'All Status' : v === 'ON' ? '🟢 On Campus' : '🔴 Off Campus'}
            </button>
          ))}
        </div>
        <TimeRangeFilter
          preset={timePreset} onPreset={v => { setTimePreset(v); resetPage() }}
          dateFrom={dateFrom} dateTo={dateTo}
          onDateFrom={v => { setDateFrom(v); resetPage() }}
          onDateTo={v => { setDateTo(v); resetPage() }}
        />
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '52px 0', color: '#94a3b8', fontSize: 14 }}>
          {search ? '🔍 No laptops match your search.' : '💻 No laptops registered yet.'}
        </div>
      ) : (
        <>
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  {['Owner', 'Student ID', 'Brand', 'Model', 'Serial Number', 'Status', 'Registered'].map(h => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginated.map(laptop => {
                  const initials = laptop.owner_name?.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase() || '?'
                  return (
                    <tr key={laptop.id}>
                      <td>
                        <div className="student-info">
                          <div className="student-avatar" style={{ background: `hsl(${laptop.id * 47 % 360}, 60%, 55%)` }}>{initials}</div>
                          <span className="student-name">{laptop.owner_name}</span>
                        </div>
                      </td>
                      <td><span className="mono">{laptop.student_id || '—'}</span></td>
                      <td style={{ fontWeight: 500 }}>{laptop.brand}</td>
                      <td style={{ color: '#64748b' }}>{laptop.model}</td>
                      <td><span className="mono">{laptop.serial_number}</span></td>
                      <td>
                        {laptop.is_in_campus
                          ? <span className="badge badge-green"><span className="badge-dot" style={{ background: '#10b981' }} />On Campus</span>
                          : <span className="badge badge-red"><span className="badge-dot"   style={{ background: '#f43f5e' }} />Off Campus</span>
                        }
                      </td>
                      <td style={{ color: '#64748b', fontSize: 12 }}>{new Date(laptop.registered_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <PaginationBar page={page} totalPages={totalPages} total={filtered.length} onPage={setPage} />
        </>
      )}
    </div>
  )
}

// ─── Logs Tab ─────────────────────────────────────────────────────────────────

function LogsTab({ logs }) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('ALL')
  const [timePreset, setTimePreset] = useState('ALL')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    const timeFiltered = applyTimeFilter(logs, 'scanned_at', timePreset, dateFrom, dateTo)
    return timeFiltered.filter(l => {
      const matchType   = filter === 'ALL' || l.scan_type === filter
      const matchSearch = !q || l.brand?.toLowerCase().includes(q) || l.serial_number?.toLowerCase().includes(q) || l.scanned_by_name?.toLowerCase().includes(q)
      return matchType && matchSearch
    })
  }, [logs, search, filter, timePreset, dateFrom, dateTo])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const resetPage = () => setPage(1)

  return (
    <div className="content-card fade-up">
      <div className="card-header">
        <div className="card-header-left">
          <div className="card-icon">📋</div>
          <div>
            <div className="card-title">Gate Scan History</div>
            <div className="card-subtitle">{filtered.length} of {logs.length} scan events shown</div>
          </div>
        </div>
      </div>

      {/* Filters row */}
      <div style={{ padding: '12px 22px', borderBottom: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="filter-bar">
          <div className="search-input-wrap">
            <span className="search-icon">🔍</span>
            <input className="search-input" placeholder="Search brand, serial, guard…" value={search}
              onChange={e => { setSearch(e.target.value); resetPage() }} />
          </div>
          {['ALL', 'IN', 'OUT'].map(v => (
            <button key={v} className={`filter-chip${filter === v ? ' active' : ''}`}
              onClick={() => { setFilter(v); resetPage() }}>
              {v === 'ALL' ? 'All Events' : v === 'IN' ? '🔵 Entry' : '🟡 Exit'}
            </button>
          ))}
        </div>
        <TimeRangeFilter
          preset={timePreset} onPreset={v => { setTimePreset(v); resetPage() }}
          dateFrom={dateFrom} dateTo={dateTo}
          onDateFrom={v => { setDateFrom(v); resetPage() }}
          onDateTo={v => { setDateTo(v); resetPage() }}
        />
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '52px 0', color: '#94a3b8', fontSize: 14 }}>
          {search || filter !== 'ALL' ? '🔍 No records match your filter.' : '📋 No scan events yet.'}
        </div>
      ) : (
        <>
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  {['Date & Time', 'Brand', 'Serial Number', 'Event', 'Guard / Officer', 'Gate'].map(h => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginated.map(log => {
                  const dt = new Date(log.scanned_at)
                  return (
                    <tr key={log.id}>
                      <td>
                        <div style={{ fontWeight: 500, fontSize: 13, color: '#334155' }}>
                          {dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </div>
                        <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1, fontFamily: 'var(--font-mono)' }}>
                          {dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </div>
                      </td>
                      <td style={{ fontWeight: 500 }}>{log.brand}</td>
                      <td><span className="mono">{log.serial_number}</span></td>
                      <td>
                        {log.scan_type === 'IN'
                          ? <span className="badge badge-blue"><span className="badge-dot" style={{ background: '#3b82f6' }} />Entry</span>
                          : <span className="badge badge-amber"><span className="badge-dot" style={{ background: '#f59e0b' }} />Exit</span>
                        }
                      </td>
                      <td>
                        <div className="student-info">
                          <div className="student-avatar" style={{ width: 26, height: 26, fontSize: 10, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}>
                            {log.scanned_by_name?.[0]?.toUpperCase() || 'G'}
                          </div>
                          <span style={{ fontSize: 13, color: '#475569', fontWeight: 500 }}>{log.scanned_by_name}</span>
                        </div>
                      </td>
                      <td><span className="badge badge-slate">Main Gate</span></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <PaginationBar page={page} totalPages={totalPages} total={filtered.length} onPage={setPage} />
        </>
      )}
    </div>
  )
}

// ─── Analytics Tab (reuses chart data in alternate layout) ────────────────────

function AnalyticsTab({ chartData, logs }) {
  const today = todayISO()
  const inToday  = logs.filter(l => l.scan_type === 'IN'  && new Date(l.scanned_at).toISOString().split('T')[0] === today).length
  const outToday = logs.filter(l => l.scan_type === 'OUT' && new Date(l.scanned_at).toISOString().split('T')[0] === today).length

  return (
    <div className="fade-up">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px,1fr))', gap: 16, marginBottom: 20 }}>
        {[
          { label: 'Entries Today',  value: inToday,  color: '#2563eb', bg: '#dbeafe', icon: '🔵' },
          { label: 'Exits Today',    value: outToday, color: '#f59e0b', bg: '#fef3c7', icon: '🟡' },
          { label: 'Total This Week', value: chartData.daily.reduce((a,b) => a + b.scans, 0), color: '#10b981', bg: '#d1fae5', icon: '📊' },
          { label: 'Avg Daily Scans', value: Math.round(chartData.weekly.reduce((a,b)=>a+b.scans,0) / Math.max(1, chartData.weekly.length)), color: '#6366f1', bg: '#e0e7ff', icon: '📈' },
        ].map((c, i) => (
          <div key={c.label} className="stat-card" style={{ '--stat-color': c.color, '--stat-bg': c.bg, animationDelay: `${i*60}ms` }}>
            <div className="stat-icon">{c.icon}</div>
            <div className="stat-body">
              <div className="stat-value">{c.value}</div>
              <div className="stat-label">{c.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="content-card">
        <div className="card-header">
          <div className="card-header-left">
            <div className="card-icon">📈</div>
            <div>
              <div className="card-title">Hourly Activity Heatmap</div>
              <div className="card-subtitle">Scan distribution across the last 24 hours</div>
            </div>
          </div>
        </div>
        <div className="card-body">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData.hourly} margin={{ top: 4, right: 4, bottom: 0, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="hour" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v) => [v, 'Scans']} />
              <Bar dataKey="scans" radius={[4,4,0,0]} maxBarSize={24}>
                {chartData.hourly.map((entry, i) => (
                  <Cell key={i} fill={`hsl(${220 + entry.scans * 8}, 80%, ${65 - entry.scans * 3}%)`} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

// ─── Shared ───────────────────────────────────────────────────────────────────

function PaginationBar({ page, totalPages, total, onPage }) {
  if (totalPages <= 1) return null
  const pages = Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
    if (totalPages <= 7) return i + 1
    if (page <= 4) return i + 1
    if (page >= totalPages - 3) return totalPages - 6 + i
    return page - 3 + i
  })

  return (
    <div className="pagination">
      <span className="pagination-info">Showing {Math.min((page-1)*PAGE_SIZE+1, total)}–{Math.min(page*PAGE_SIZE, total)} of {total} records</span>
      <div className="pagination-btns">
        <button className="page-btn" disabled={page === 1} onClick={() => onPage(1)}>«</button>
        <button className="page-btn" disabled={page === 1} onClick={() => onPage(p => p - 1)}>‹</button>
        {pages.map(n => (
          <button key={n} className={`page-btn${n === page ? ' active' : ''}`} onClick={() => onPage(n)}>{n}</button>
        ))}
        <button className="page-btn" disabled={page === totalPages} onClick={() => onPage(p => p + 1)}>›</button>
        <button className="page-btn" disabled={page === totalPages} onClick={() => onPage(totalPages)}>»</button>
      </div>
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 16 }}>
        {[0,1,2,3].map(i => (
          <div key={i} style={{ height: 96, borderRadius: 16 }} className="skeleton" />
        ))}
      </div>
      <div style={{ height: 320, borderRadius: 16 }} className="skeleton" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div style={{ height: 260, borderRadius: 16 }} className="skeleton" />
        <div style={{ height: 260, borderRadius: 16 }} className="skeleton" />
      </div>
    </div>
  )
}

function Footer() {
  const year = new Date().getFullYear()
  return (
    <footer className="aastu-footer">
      <div className="footer-left">
        <span style={{ fontWeight: 600, color: '#475569' }}>AASTU</span>
        <span className="footer-divider">·</span>
        <span>Campus Security Operations Platform</span>
        <span className="footer-divider">·</span>
        <span>IT Department — Registrar Division</span>
      </div>
      <div className="footer-right">
        <span className="footer-version">v2.0.0</span>
        <span className="footer-divider">·</span>
        <span>© {year} Addis Ababa Science and Technology University</span>
        <span className="footer-divider">·</span>
        <a href="mailto:it-support@aastu.edu.et" className="footer-link">IT Support</a>
      </div>
    </footer>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [activeTab, setActiveTab]         = useState('overview')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [showUploadModal, setShowUploadModal]   = useState(false)
  const [showPhotoUploadModal, setShowPhotoUploadModal] = useState(false)
  const [showAddStudentModal, setShowAddStudentModal] = useState(false)
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false)
  const [studentsKey, setStudentsKey]     = useState(0)

  const { laptops, logs, loading, error, refetch } = useDashboardData()

  const chartData = useMemo(
    () => (laptops.length || logs.length) ? buildChartData(logs, laptops) : null,
    [logs, laptops]
  )

  const handleLogout = () => { logout(); navigate('/login') }
  const handleExport = useCallback(() => exportToCSV(logs), [logs])

  const tabTitles = {
    overview:  { title: 'System Overview', subtitle: `Real-time insights — ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}` },
    students:  { title: 'Student Registry', subtitle: 'Manage enrolled students and their device registrations' },
    laptops:   { title: 'Device Registry', subtitle: 'All registered laptops and campus tracking status' },
    logs:      { title: 'Gate Event Log', subtitle: 'Full audit trail of all entry and exit events' },
    analytics: { title: 'Analytics & Reports', subtitle: 'Statistical analysis and usage patterns' },
  }

  const current = tabTitles[activeTab] || tabTitles.overview

  return (
    <>
      <GlobalStyles />

      <Sidebar
        activeTab={activeTab}
        onTab={setActiveTab}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(c => !c)}
      />

      <Topbar
        user={user}
        onLogout={handleLogout}
        activeTab={activeTab}
        collapsed={sidebarCollapsed}
        onChangePassword={() => setShowChangePasswordModal(true)}
      />

      <main className={`aastu-main${sidebarCollapsed ? ' sidebar-collapsed' : ''}`}>
        {/* Page Header */}
        <div className="page-header">
          <h1 className="page-title">{current.title}</h1>
          <p className="page-subtitle">{current.subtitle}</p>
        </div>

        {/* Stat Cards (always visible) */}
        <StatCards laptops={laptops} logs={logs} />

        {/* Error Banner */}
        {error && (
          <div className="error-banner">
            <span>⚠ {error}</span>
            <button className="btn btn-sm btn-outline" onClick={refetch} style={{ color: '#9f1239', borderColor: '#9f1239' }}>Retry</button>
          </div>
        )}

        {/* Tab Content */}
        {loading ? <LoadingSkeleton /> : (
          <>
            {activeTab === 'overview'  && chartData && <OverviewTab chartData={chartData} />}
            {activeTab === 'laptops'   && <LaptopsTab laptops={laptops} onExport={handleExport} />}
            {activeTab === 'logs'      && <LogsTab logs={logs} />}
            {activeTab === 'analytics' && chartData && <AnalyticsTab chartData={chartData} logs={logs} />}
            {activeTab === 'students'  && (
              <div className="content-card fade-up">
                <div className="card-header">
                  <div className="card-header-left">
                    <div className="card-icon">👥</div>
                    <div>
                      <div className="card-title">Student Registry</div>
                      <div className="card-subtitle">Manage and upload student records</div>
                    </div>
                  </div>
                  <div className="card-actions">
                    <button className="btn btn-outline btn-sm" onClick={() => setShowAddStudentModal(true)}>
                      ➕ Add Student
                    </button>
                  </div>
                </div>
                <div style={{ padding: '0 0 4px' }}>
                  <StudentsTab
                    key={studentsKey}
                    onUploadFile={() => setShowUploadModal(true)}
                    onUploadPhotos={() => setShowPhotoUploadModal(true)}
                  />
                </div>
              </div>
            )}
          </>
        )}

        <Footer />
      </main>

      {showChangePasswordModal && (
        <ChangePasswordModal onClose={() => setShowChangePasswordModal(false)} />
      )}
      {showAddStudentModal && (
        <AddStudentModal
          onSuccess={() => setStudentsKey(k => k + 1)}
          onClose={() => setShowAddStudentModal(false)}
        />
      )}
      {showUploadModal && (
        <BulkUploadModal
          onSuccess={() => setStudentsKey(k => k + 1)}
          onClose={() => setShowUploadModal(false)}
        />
      )}
      {showPhotoUploadModal && (
        <BulkPhotoUploadModal
          onSuccess={() => setStudentsKey(k => k + 1)}
          onClose={() => setShowPhotoUploadModal(false)}
        />
      )}
    </>
  )
}