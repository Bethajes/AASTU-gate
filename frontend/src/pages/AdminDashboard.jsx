import { useState, useEffect, useMemo, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import API from '../api/axios'
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  AreaChart, Area
} from 'recharts'

// ─── Constants ──────────────────────────────────────────────────────────────

const TABS = [
  { id: 'overview', label: '📊 Overview Charts' },
  { id: 'laptops',  label: '📱 Laptops' },
  { id: 'logs',     label: '📋 Gate Logs' },
]

const PAGE_SIZE = 20

// ─── Custom Hooks ────────────────────────────────────────────────────────────

function useDashboardData() {
  const [laptops, setLaptops] = useState([])
  const [logs, setLogs]       = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)

  const fetchAllData = useCallback(async () => {
    setLoading(true)
    setError(null)
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

// ─── Pure helpers ─────────────────────────────────────────────────────────────

function buildChartData(logs, laptops) {
  const now = new Date()
  const last24h  = new Date(now - 24 * 60 * 60 * 1000)
  const last7d   = new Date(now - 7  * 24 * 60 * 60 * 1000)
  const last28d  = new Date(now - 28 * 24 * 60 * 60 * 1000)

  // 1. Hourly (last 24 h)
  const hourlyMap = {}
  logs.forEach(log => {
    const d = new Date(log.scanned_at)
    if (d >= last24h) hourlyMap[d.getHours()] = (hourlyMap[d.getHours()] || 0) + 1
  })
  const hourly = Array.from({ length: 24 }, (_, i) => ({ hour: `${i}:00`, scans: hourlyMap[i] || 0 }))

  // 2. Daily (last 7 days)
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

  // 3. Weekly (last 4 weeks)
  const weeklyMap = {}
  logs.forEach(log => {
    const d = new Date(log.scanned_at)
    if (d >= last28d) {
      const wk = `Week ${Math.floor((d - last28d) / (7 * 24 * 60 * 60 * 1000)) + 1}`
      weeklyMap[wk] = (weeklyMap[wk] || 0) + 1
    }
  })
  const weekly = Object.entries(weeklyMap).map(([week, scans]) => ({ week, scans }))

  // 4. Status distribution
  const onCampus  = laptops.filter(l => l.is_in_campus).length
  const offCampus = laptops.length - onCampus
  const statusDistribution = [
    { name: 'On Campus',  value: onCampus,  color: '#2e7d32' },
    { name: 'Off Campus', value: offCampus, color: '#c62828' },
  ]

  // 5. Top students
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
    log.brand,
    log.serial_number,
    log.scan_type,
    log.scanned_by_name,
  ])
  const csv   = [header, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n')
  const blob  = new Blob([csv], { type: 'text/csv' })
  const url   = URL.createObjectURL(blob)
  const a     = Object.assign(document.createElement('a'), {
    href: url,
    download: `gate-logs-${new Date().toISOString().split('T')[0]}.csv`,
  })
  a.click()
  URL.revokeObjectURL(url)
}

function todayISO() {
  return new Date().toISOString().split('T')[0]
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCards({ laptops, logs }) {
  const stats = useMemo(() => ({
    totalLaptops: laptops.length,
    onCampus:     laptops.filter(l => l.is_in_campus).length,
    totalScans:   logs.length,
    scansToday:   logs.filter(l => new Date(l.scanned_at).toISOString().split('T')[0] === todayISO()).length,
  }), [laptops, logs])

  const cards = [
    { label: 'Total Laptops',  value: stats.totalLaptops },
    { label: 'On Campus Now',  value: stats.onCampus },
    { label: 'Total Scans',    value: stats.totalScans },
    { label: 'Scans Today',    value: stats.scansToday },
  ]

  return (
    <div style={styles.statsContainer}>
      {cards.map(c => (
        <div key={c.label} style={styles.statCard}>
          <div style={styles.statValue}>{c.value}</div>
          <div style={styles.statLabel}>{c.label}</div>
        </div>
      ))}
    </div>
  )
}

function OverviewTab({ chartData }) {
  const { hourly, daily, weekly, statusDistribution, topStudents } = chartData
  return (
    <>
      <ChartCard title="📈 Scans by Hour (Last 24 Hours)" subtitle="Peak hours for gate activity">
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={hourly}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="hour" />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Legend />
            <Area type="monotone" dataKey="scans" stroke="#1a1a2e" fill="#1a1a2e" fillOpacity={0.3} />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="📊 Daily Scan Pattern (Last 7 Days)" subtitle="Which days have the most traffic?">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={daily}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="day" />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Legend />
            <Bar dataKey="scans" fill="#1565c0" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <div style={styles.row}>
        <div style={styles.halfCard}>
          <h2 style={styles.cardTitle}>📉 Weekly Trend</h2>
          <p style={styles.chartSubtitle}>Last 4 weeks activity</p>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={weekly}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="week" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Line type="monotone" dataKey="scans" stroke="#e65100" strokeWidth={2} dot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div style={styles.halfCard}>
          <h2 style={styles.cardTitle}>🍩 Laptop Status Distribution</h2>
          <p style={styles.chartSubtitle}>On Campus vs Off Campus</p>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={statusDistribution}
                cx="50%" cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                dataKey="value"
              >
                {statusDistribution.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <ChartCard title="🏆 Top Students by Laptop Registrations" subtitle="Most active students on campus">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={topStudents} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" allowDecimals={false} />
            <YAxis type="category" dataKey="name" width={150} />
            <Tooltip />
            <Bar dataKey="count" fill="#6a1b9a" radius={[0, 8, 8, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </>
  )
}

function LaptopsTab({ laptops, onExport }) {
  const [search, setSearch] = useState('')
  const [page, setPage]     = useState(1)

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return laptops.filter(l =>
      l.owner_name?.toLowerCase().includes(q) ||
      l.brand?.toLowerCase().includes(q) ||
      l.serial_number?.toLowerCase().includes(q) ||
      l.student_id?.toLowerCase().includes(q)
    )
  }, [laptops, search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const handleSearch = e => { setSearch(e.target.value); setPage(1) }

  return (
    <div style={styles.card}>
      <div style={styles.cardHeader}>
        <h2 style={styles.cardTitle}>All Registered Laptops</h2>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <input
            style={styles.searchInput}
            placeholder="Search owner, brand, serial…"
            value={search}
            onChange={handleSearch}
          />
          <button style={styles.exportBtn} onClick={onExport}>📥 Export Logs</button>
        </div>
      </div>

      {filtered.length === 0
        ? <p style={styles.empty}>{search ? 'No results match your search.' : 'No laptops registered yet.'}</p>
        : (
          <>
            <div style={styles.tableWrapper}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    {['Owner', 'Student ID', 'Brand', 'Model', 'Serial Number', 'Status', 'Registered'].map(h => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginated.map(laptop => (
                    <tr key={laptop.id}>
                      <td>{laptop.owner_name}</td>
                      <td>{laptop.student_id || '—'}</td>
                      <td>{laptop.brand}</td>
                      <td>{laptop.model}</td>
                      <td><code style={styles.code}>{laptop.serial_number}</code></td>
                      <td>
                        <span style={{
                          ...styles.badge,
                          backgroundColor: laptop.is_in_campus ? '#e6ffed' : '#fff0f0',
                          color:           laptop.is_in_campus ? '#2e7d32' : '#c62828',
                        }}>
                          {laptop.is_in_campus ? 'On Campus' : 'Off Campus'}
                        </span>
                      </td>
                      <td>{new Date(laptop.registered_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} totalPages={totalPages} total={filtered.length} onPage={setPage} />
          </>
        )}
    </div>
  )
}

function LogsTab({ logs }) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('ALL')
  const [page, setPage]     = useState(1)

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return logs.filter(l => {
      const matchesType   = filter === 'ALL' || l.scan_type === filter
      const matchesSearch = !q ||
        l.brand?.toLowerCase().includes(q) ||
        l.serial_number?.toLowerCase().includes(q) ||
        l.scanned_by_name?.toLowerCase().includes(q)
      return matchesType && matchesSearch
    })
  }, [logs, search, filter])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const handleSearch = e => { setSearch(e.target.value); setPage(1) }
  const handleFilter = v => { setFilter(v); setPage(1) }

  return (
    <div style={styles.card}>
      <div style={styles.cardHeader}>
        <h2 style={styles.cardTitle}>Gate Scan History</h2>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <input
            style={styles.searchInput}
            placeholder="Search brand, serial, guard…"
            value={search}
            onChange={handleSearch}
          />
          {['ALL', 'IN', 'OUT'].map(v => (
            <button
              key={v}
              style={{ ...styles.filterBtn, ...(filter === v ? styles.filterBtnActive : {}) }}
              onClick={() => handleFilter(v)}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0
        ? <p style={styles.empty}>{search || filter !== 'ALL' ? 'No results match your filter.' : 'No scans yet.'}</p>
        : (
          <>
            <div style={styles.tableWrapper}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    {['Time', 'Brand', 'Serial Number', 'Scan Type', 'Scanned By'].map(h => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginated.map(log => (
                    <tr key={log.id}>
                      <td>{new Date(log.scanned_at).toLocaleString()}</td>
                      <td>{log.brand}</td>
                      <td><code style={styles.code}>{log.serial_number}</code></td>
                      <td>
                        <span style={{
                          ...styles.scanBadge,
                          backgroundColor: log.scan_type === 'IN' ? '#e3f2fd' : '#fff3e0',
                          color:           log.scan_type === 'IN' ? '#1565c0' : '#e65100',
                        }}>
                          {log.scan_type === 'IN' ? '🔵 IN' : '🟡 OUT'}
                        </span>
                      </td>
                      <td>{log.scanned_by_name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} totalPages={totalPages} total={filtered.length} onPage={setPage} />
          </>
        )}
    </div>
  )
}

function ChartCard({ title, subtitle, children }) {
  return (
    <div style={styles.chartCard}>
      <h2 style={styles.cardTitle}>{title}</h2>
      {subtitle && <p style={styles.chartSubtitle}>{subtitle}</p>}
      {children}
    </div>
  )
}

function Pagination({ page, totalPages, total, onPage }) {
  if (totalPages <= 1) return null
  return (
    <div style={styles.pagination}>
      <span style={{ color: '#888', fontSize: 13 }}>
        {total} result{total !== 1 ? 's' : ''}
      </span>
      <div style={{ display: 'flex', gap: 6 }}>
        <button style={styles.pageBtn} disabled={page === 1} onClick={() => onPage(p => p - 1)}>‹</button>
        {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
          <button
            key={n}
            style={{ ...styles.pageBtn, ...(n === page ? styles.pageBtnActive : {}) }}
            onClick={() => onPage(n)}
          >
            {n}
          </button>
        ))}
        <button style={styles.pageBtn} disabled={page === totalPages} onClick={() => onPage(p => p + 1)}>›</button>
      </div>
    </div>
  )
}

function ErrorBanner({ message, onRetry }) {
  return (
    <div style={styles.errorBanner}>
      <span>⚠️ {message}</span>
      <button style={styles.retryBtn} onClick={onRetry}>Retry</button>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('overview')

  const { laptops, logs, loading, error, refetch } = useDashboardData()

  // Memoize chart data — avoids re-computing on every render
  const chartData = useMemo(
    () => (laptops.length || logs.length) ? buildChartData(logs, laptops) : null,
    [logs, laptops]
  )

  const handleLogout = () => { logout(); navigate('/login') }
  const handleExport = useCallback(() => exportToCSV(logs), [logs])

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.headerTitle}>AASTU Gate Pass</h1>
          <p style={styles.headerSub}>Admin Dashboard with Analytics</p>
        </div>
        <div style={styles.headerRight}>
          <span style={styles.userName}>👑 {user?.name}</span>
          <button style={styles.logoutBtn} onClick={handleLogout}>Logout</button>
        </div>
      </div>

      <StatCards laptops={laptops} logs={logs} />

      {/* Tabs */}
      <div style={styles.tabs}>
        {TABS.map(t => (
          <button
            key={t.id}
            style={{ ...styles.tab, ...(activeTab === t.id ? styles.activeTab : {}) }}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={styles.content}>
        {error && <ErrorBanner message={error} onRetry={refetch} />}

        {loading
          ? <LoadingSkeleton />
          : (
            <>
              {activeTab === 'overview' && chartData && <OverviewTab chartData={chartData} />}
              {activeTab === 'laptops'  && <LaptopsTab laptops={laptops} onExport={handleExport} />}
              {activeTab === 'logs'     && <LogsTab logs={logs} />}
            </>
          )}
      </div>
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {[300, 300, 200].map((h, i) => (
        <div key={i} style={{ ...styles.chartCard, height: h, background: '#f0f0f0', animation: 'pulse 1.5s ease-in-out infinite' }} />
      ))}
      <style>{`@keyframes pulse { 0%,100%{opacity:.6} 50%{opacity:1} }`}</style>
    </div>
  )
}

// ─── Styles (defined once, outside component — no re-creation per render) ─────

const styles = {
  container:      { minHeight: '100vh', backgroundColor: '#f0f2f5' },
  header:         { backgroundColor: '#1a1a2e', padding: '16px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle:    { margin: 0, color: '#fff', fontSize: '20px', fontWeight: '700' },
  headerSub:      { margin: 0, color: '#aaa', fontSize: '13px' },
  headerRight:    { display: 'flex', alignItems: 'center', gap: '16px' },
  userName:       { color: '#fff', fontSize: '14px' },
  logoutBtn:      { padding: '8px 16px', backgroundColor: 'transparent', color: '#fff', border: '1px solid #fff', borderRadius: '8px', cursor: 'pointer', fontSize: '13px' },
  statsContainer: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', maxWidth: '1200px', margin: '32px auto 0', padding: '0 16px' },
  statCard:       { backgroundColor: '#fff', borderRadius: '12px', padding: '24px', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' },
  statValue:      { fontSize: '32px', fontWeight: '700', color: '#1a1a2e', marginBottom: '8px' },
  statLabel:      { fontSize: '14px', color: '#666' },
  tabs:           { display: 'flex', gap: '8px', maxWidth: '1200px', margin: '24px auto 0', padding: '0 16px', borderBottom: '2px solid #e0e0e0' },
  tab:            { padding: '12px 24px', backgroundColor: 'transparent', border: 'none', fontSize: '15px', fontWeight: '500', cursor: 'pointer', color: '#666', transition: 'all 0.2s' },
  activeTab:      { color: '#1a1a2e', borderBottom: '2px solid #1a1a2e', marginBottom: '-2px' },
  content:        { maxWidth: '1200px', margin: '24px auto 48px', padding: '0 16px' },
  chartCard:      { backgroundColor: '#fff', borderRadius: '12px', padding: '28px', marginBottom: '24px', boxShadow: '0 2px 12px rgba(0,0,0,0.08)' },
  card:           { backgroundColor: '#fff', borderRadius: '12px', padding: '28px', boxShadow: '0 2px 12px rgba(0,0,0,0.08)' },
  cardHeader:     { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: 12 },
  cardTitle:      { margin: '0 0 8px 0', fontSize: '18px', fontWeight: '600', color: '#1a1a2e' },
  chartSubtitle:  { margin: '0 0 20px 0', fontSize: '13px', color: '#888' },
  row:            { display: 'flex', gap: '24px', marginBottom: '24px', flexWrap: 'wrap' },
  halfCard:       { flex: 1, minWidth: 280, backgroundColor: '#fff', borderRadius: '12px', padding: '24px', boxShadow: '0 2px 12px rgba(0,0,0,0.08)' },
  exportBtn:      { padding: '8px 16px', backgroundColor: '#1a1a2e', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', whiteSpace: 'nowrap' },
  searchInput:    { padding: '7px 12px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '13px', outline: 'none', minWidth: 220 },
  filterBtn:      { padding: '6px 14px', border: '1px solid #ddd', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', backgroundColor: '#fff', color: '#555' },
  filterBtnActive:{ backgroundColor: '#1a1a2e', color: '#fff', borderColor: '#1a1a2e' },
  tableWrapper:   { overflowX: 'auto' },
  table:          { width: '100%', borderCollapse: 'collapse', fontSize: '14px' },
  code:           { fontFamily: 'monospace', fontSize: '12px', backgroundColor: '#f5f5f5', padding: '4px 8px', borderRadius: '4px' },
  badge:          { padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '500', display: 'inline-block' },
  scanBadge:      { padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '500', display: 'inline-block' },
  empty:          { textAlign: 'center', color: '#888', padding: '40px 0' },
  pagination:     { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, paddingTop: 16, borderTop: '1px solid #eee' },
  pageBtn:        { padding: '5px 10px', border: '1px solid #ddd', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', backgroundColor: '#fff', color: '#444' },
  pageBtnActive:  { backgroundColor: '#1a1a2e', color: '#fff', borderColor: '#1a1a2e' },
  errorBanner:    { backgroundColor: '#fff3cd', border: '1px solid #ffc107', borderRadius: '8px', padding: '12px 16px', marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 14 },
  retryBtn:       { padding: '6px 12px', backgroundColor: '#1a1a2e', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' },
}