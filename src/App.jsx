import React, { useEffect, useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import CampusMap, { buildings } from './components/CampusMap'
import BuildingDetails from './components/BuildingDetails'
import DeadZonePanel from './components/DeadZonePanel'
import ITActionView from './components/ITActionView'
import { initRealtime, submitReading, subscribeToReadings, fetchSeeded, hasSupabase, onAuthStateChange, signIn, signUp, signOut } from './supabaseClient'

export default function App(){
  const [heatmapOpacity, setHeatmapOpacity] = useState(0.95)
  const [uiMode, setUiMode] = useState('live') // 'live' or 'survey'
  const [readings, setReadings] = useState([])
  const [status, setStatus] = useState('ready')
  const [timeFilter, setTimeFilter] = useState('all')
  const [signalFilter, setSignalFilter] = useState('all')
  const [viewMode, setViewMode] = useState('coverage')
  const [user, setUser] = useState(null)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedBuildingId, setSelectedBuildingId] = useState(null)
  const [openReportFor, setOpenReportFor] = useState(null)
  const [focusReadingId, setFocusReadingId] = useState(null)

  useEffect(()=>{
    initRealtime()
    const unsubAuth = onAuthStateChange((currentUser) => {
      setUser(currentUser)
    })
    const unsub = subscribeToReadings((rows)=>{
      setReadings(rows)
    })
    fetchSeeded().then(rows=>{
      if(rows && rows.length) setReadings(rows)
    })
    return ()=> {
      unsubAuth && unsubAuth()
      unsub && unsub()
    }
  },[])

  const onReport = async (report)=>{
    if(!user){
      setShowAuthModal(true)
      return
    }
    setStatus('submitting')
    await submitReading({ ...report, reporterEmail: user.email })
    setStatus('ready')
  }

  const seedDemo = async ()=>{
    if(!confirm('Load demo data with 40 sample readings? This will write to Supabase if configured, otherwise localStorage.')) return
    setStatus('seeding')
    const count = 40
    const samples = []
    const reporter = user ? user.email : 'student-demo@campus.edu'
    // distribution per building: Library:3.5-4, Admin:3-4, Academic:2-3, Hostel:1-2, Computer Lab:0-1.5
    const ranges = {
      'Library': [3.5,4],
      'Admin Block': [3,4],
      'Academic Block': [2,3],
      'Hostel': [1,2],
      'Computer Lab': [0,1.5]
    }
    // allocate roughly proportional counts
    const alloc = { 'Library':8, 'Admin Block':8, 'Academic Block':10, 'Hostel':7, 'Computer Lab':7 }
    for(const [bName,countFor] of Object.entries(alloc)){
      const b = buildings.find(bb=> bb.name === bName)
      for(let i=0;i<countFor;i++){
        const jitterX = Math.round(Math.random() * (b.width - 20))
        const jitterY = Math.round(Math.random() * (b.height - 20))
        const x = Math.round(b.x + 10 + jitterX)
        const y = Math.round(b.y + 10 + jitterY)
        const rmin = ranges[bName][0]
        const rmax = ranges[bName][1]
        const avg = rmin + Math.random() * (rmax - rmin)
        // map avg 0-4 to integer bars with some noise
        const bars = Math.max(0, Math.round(avg + (Math.random()-0.5)*0.6))
        samples.push({id: uuidv4(), x,y,buildingLabel:bName, bars, timestamp: new Date(Date.now() - Math.floor(Math.random()*1000*60*60*24*7)).toISOString(), reporterEmail: reporter})
      }
    }
    for(const s of samples){
      await submitReading(s)
      await new Promise(r=>setTimeout(r,25))
    }
    setStatus('ready')
  }

  const filteredReadings = readings.filter(r => {
    if (timeFilter === 'all') return true
    const ageMs = Date.now() - new Date(r.timestamp).getTime()
    if (timeFilter === '24h') return ageMs <= 24 * 60 * 60 * 1000
    if (timeFilter === '7d') return ageMs <= 7 * 24 * 60 * 60 * 1000
    if (timeFilter === '30d') return ageMs <= 30 * 24 * 60 * 60 * 1000
    return true
  })
  // apply signal filter
  const signalFilteredReadings = filteredReadings.filter(r => {
    if(signalFilter === 'all') return true
    if(signalFilter === 'good') return (Number(r.bars) || 0) >= 3
    if(signalFilter === 'fair') return (Number(r.bars) || 0) === 2
    if(signalFilter === 'weak') return (Number(r.bars) || 0) === 1
    if(signalFilter === 'dead') return (Number(r.bars) || 0) === 0
    return true
  })

  const matchedBuildings = searchQuery.trim() && !buildings.some(b => b.name === searchQuery)
    ? buildings.filter(b => b.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : []

  const selectedBuilding = buildings.find(b => b.id === selectedBuildingId)
  
  // compute per-building stats
  const buildingStats = {}
  for(const b of buildings){
    const bReadings = readings.filter(r => r.buildingLabel === b.name)
    const total = bReadings.length
    const avg = total ? +(bReadings.reduce((s,r)=>s + (Number(r.bars)||0),0)/total).toFixed(2) : null
    const dead = bReadings.filter(r=> (Number(r.bars)||0) <= 1).length
    const last = bReadings.length ? bReadings.reduce((a,c)=> new Date(a.timestamp || a) > new Date(c.timestamp) ? a : c).timestamp : null
    buildingStats[b.id] = { total, avg, dead, last }
  }

  const selectedBuildingStats = selectedBuilding ? buildingStats[selectedBuilding.id] : null

  // detect dead zones (rule-based)
  const deadZones = Object.entries(buildingStats).map(([id,st])=> ({ id, name: buildings.find(b=>b.id===id).name, ...st })).filter(d=> d.avg!=null && d.avg < 1.0 && d.total >= 5).sort((a,b)=> a.avg - b.avg)

  const total = signalFilteredReadings.length
  const deadCount = signalFilteredReadings.filter(r=> (Number(r.bars)||0) <= 1).length
  const avg = total? (signalFilteredReadings.reduce((s,r)=>s + (Number(r.bars)||0),0)/total).toFixed(2): '—'
  const coverage = total ? Math.round((signalFilteredReadings.filter(r=> (Number(r.bars)||0) >= 3).length / total) * 100) : 0
  // find worst-reported building by average bars
  const byBuilding = {}
  for(const r of filteredReadings){
    const name = r.buildingLabel || 'Unknown'
    if(!byBuilding[name]) byBuilding[name] = {sum:0, n:0}
    byBuilding[name].sum += Number(r.bars)||0
    byBuilding[name].n += 1
  }
  let worst = '—'
  let worstVal = Infinity
  for(const [k,v] of Object.entries(byBuilding)){
    const a = v.sum / v.n
    if(a < worstVal){ worstVal = a; worst = k }
  }

  return (
    <div className="app">
      <header className="topbar">SignalMap — Campus WiFi Dead-Zone Mapper (Demo)</header>
      <div className="main">
        <div style={{marginBottom:12}}>
          <div className="topToolbar">
            <div className="toolbarLeft">
              <div className="modeGroup">
                <button className={`modeBtn ${uiMode==='live'? 'active':''}`} onClick={()=>setUiMode('live')}>Live Scan</button>
                <button className={`modeBtn ${uiMode==='survey'? 'active':''}`} onClick={()=>setUiMode('survey')}>Survey Mode</button>
              </div>
              <div className="metricCards">
                <div className="metricCard"><div className="metricValue">{coverage}%</div><div className="metricLabel">Coverage</div></div>
                <div className="metricCard"><div className="metricValue">{avg}</div><div className="metricLabel">Avg Signal</div></div>
                <div className="metricCard"><div className="metricValue">{deadZones.length}</div><div className="metricLabel">Critical</div></div>
              </div>
            </div>
            <div className="toolbarRight">
              <label className="opacityControl">Heatmap</label>
              <input type="range" min="0" max="1" step="0.05" value={heatmapOpacity} onChange={(e)=> setHeatmapOpacity(Number(e.target.value))} />
              <button className="exportBtn" onClick={()=> alert('Export PNG not implemented in demo')}>Export</button>
            </div>
          </div>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,marginBottom:8}}>
            <div style={{fontWeight:800,color:'#cfe9ff'}}>DSVV NETWORK STATUS</div>
            <div style={{fontFamily:'var(--mono)',color:'#9fb0c4'}}>
              <span style={{marginRight:12}}>Coverage: <strong>{coverage}%</strong></span>
              <span style={{marginRight:12}}>Avg: <strong>{avg}</strong></span>
              <span>Critical: <strong>{deadZones.length}</strong></span>
            </div>
          </div>
          <div style={{marginBottom:8,color:'#93a3b8'}}>
            {deadZones.length>0 ? `⚠ ${deadZones[0].name} requires immediate attention` : '✓ Campus Wi-Fi coverage is currently healthy.'}
          </div>
        </div>

        {/* Dashboard grid: left reports, center map, right status/control */}
        <div className="dashboardGrid">
          <div className="reportsColumn">
            <div className="reportsPanel">
              <h3>Live Reports</h3>
              <div style={{marginBottom:12,fontFamily:'var(--mono)'}}>
                <div style={{marginBottom:6,color:'#93a3b8'}}>Recent reports from campus users</div>
                <div style={{marginTop:6,fontSize:12,color:'#93a3b8'}}>{hasSupabase? 'Realtime: Supabase' : 'Running offline (localStorage)'}</div>
              </div>

              {/* Reports header with quick filters */}
              <div className="reportsHeader">
                <div className="liveReportsTitle">Live Reports</div>
                <div className="reportTabs">
                  {[
                    {k:'all',label:`All (${filteredReadings.length})`},
                    {k:'good',label:`Good (${filteredReadings.filter(r=> (Number(r.bars)||0) >= 3).length})`},
                    {k:'weak',label:`Weak (${filteredReadings.filter(r=> (Number(r.bars)||0) === 1).length})`},
                    {k:'dead',label:`Dead (${filteredReadings.filter(r=> (Number(r.bars)||0) === 0).length})`}
                  ].map(t => (
                    <button key={t.k} className={`filterPill ${signalFilter===t.k? 'active':''}`} onClick={()=> setSignalFilter(t.k)}>{t.label}</button>
                  ))}
                </div>
              </div>

              <div className="feed reportList">
                {filteredReadings.slice().reverse().slice(0,50).map(r=> {
                  const bars = Number(r.bars) || 0
                  const signalLabel = bars === 4 ? '-48 dBm' : bars === 3 ? '-60 dBm' : bars === 2 ? '-72 dBm' : bars === 1 ? '-85 dBm' : 'No Signal'
                  const statusText = bars <= 0 ? 'DEAD' : bars === 1 ? 'WEAK' : bars === 2 ? 'FAIR' : 'GOOD'
                  const iconEmoji = bars <= 0 ? '📴' : bars === 1 ? '📶' : bars === 2 ? '📶' : '📶'
                  return (
                  <div key={r.id} className="reportCard" onClick={()=>{
                    const b = buildings.find(bb => bb.name === r.buildingLabel)
                    if(b) setSelectedBuildingId(b.id)
                    setFocusReadingId(r.id)
                    setTimeout(()=> setFocusReadingId(null), 1800)
                  }}>
                    <div className={`reportIcon status-${statusText.toLowerCase()}`}>{iconEmoji}</div>
                    <div className="reportDetails">
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                        <div style={{fontWeight:800}}>{r.buildingLabel || 'On Campus'}</div>
                        <div className={`statusBadge status-${statusText.toLowerCase()}`}>{statusText}</div>
                      </div>
                      <div style={{fontSize:13,color:'#93a3b8',marginTop:6}}>{`Signal: ${signalLabel}`} • {new Date(r.timestamp).toLocaleString()}</div>
                      <div style={{marginTop:8,display:'flex',gap:8,alignItems:'center'}}>
                        <button className="viewBtn" onClick={(e)=>{ e.stopPropagation(); setFocusReadingId(r.id); setTimeout(()=> setFocusReadingId(null), 1800) }}>View on Map</button>
                        <button className="reportBtn" onClick={(e)=>{ e.stopPropagation(); setOpenReportFor(r.buildingLabel && buildings.find(bb=>bb.name===r.buildingLabel)?.id); setTimeout(()=> setOpenReportFor(null),150) }}>Report</button>
                      </div>
                    </div>
                    <div className="reportActions">
                      <button className="kebabBtn">⋮</button>
                    </div>
                  </div>
                  )
                })}
              </div>

              <ITActionView readings={filteredReadings} maxItems={3} onView={(name)=>{
                const b = buildings.find(bb=>bb.name === name)
                if(b) setSelectedBuildingId(b.id)
              }} onCreateIssue={(name)=>{
                alert(`Create issue: ${name} — Suggest investigation.`)
              }} />
            </div>
          </div>

          <div className="mapColumn">
            <div className="mapPanel">
              <div className="filterOverlay">
            {['all', '24h', '7d', '30d'].map(f => (
              <button
                key={f}
                className={`filterPill ${timeFilter === f ? 'active' : ''}`}
                onClick={() => setTimeFilter(f)}
              >
                {f === 'all' ? 'All-Time' : f === '24h' ? 'Last 24h' : f === '7d' ? '7 Days' : '30 Days'}
              </button>
            ))}
            <div style={{marginLeft:12,display:'inline-flex',gap:8}}>
              {[
                {k:'all',label:'All'},
                {k:'good',label:'🟢 Good'},
                {k:'fair',label:'🟡 Fair'},
                {k:'weak',label:'🟠 Weak'},
                {k:'dead',label:'🔴 Dead'}
              ].map(opt=> (
                <button key={opt.k} className={`filterPill ${signalFilter===opt.k? 'active':''}`} onClick={()=> setSignalFilter(opt.k)}>{opt.label}</button>
              ))}
            </div>
            <div style={{marginLeft:12,display:'inline-flex',gap:8,alignItems:'center',marginLeft:20}}>
              {[
                {k:'coverage',label:'Coverage'},
                {k:'problems',label:'Problems Only'},
                {k:'reports',label:'Reports'},
                {k:'buildings',label:'Buildings'}
              ].map(o=> (
                <button key={o.k} className={`filterPill ${viewMode===o.k? 'active':''}`} onClick={()=> setViewMode(o.k)}>{o.label}</button>
              ))}
            </div>
          </div>
          <CampusMap readings={signalFilteredReadings} onReport={onReport} user={user} onAuthPrompt={() => setShowAuthModal(true)} highlightedBuildingId={selectedBuildingId} onSelectBuilding={(id)=> setSelectedBuildingId(id)} openReportFor={openReportFor} focusReadingId={focusReadingId} viewMode={viewMode} heatmapOpacity={heatmapOpacity} onReadingClick={(readingId)=>{
            // focus a reading from the feed
            const r = readings.find(rr=> rr.id === readingId)
            if(!r) return
            // set selected building if applicable
            const b = buildings.find(bb=> bb.name === r.buildingLabel)
            if(b) setSelectedBuildingId(b.id)
            // briefly pulse the reading
            setFocusReadingId(readingId)
            setTimeout(()=> setFocusReadingId(null), 2000)
          }} />
          </div>
          </div>

          <div className="rightColumn">
            <aside className="controlPanel">
              <div className="searchContainer" style={{position:'relative',marginBottom:16}}>
                <input
                  type="text"
                  placeholder="🔍 Search campus buildings..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value)
                    if (!e.target.value) {
                      setSelectedBuildingId(null)
                    }
                  }}
                  className="searchInput"
                />
                {matchedBuildings.length > 0 && (
                  <div className="suggestionsDropdown">
                    {matchedBuildings.map(b => (
                      <div
                        key={b.id}
                        className="suggestionItem"
                        onClick={() => {
                          setSelectedBuildingId(b.id)
                          setSearchQuery(b.name)
                        }}
                      >
                        {b.name}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {selectedBuilding && selectedBuildingStats && (
                <div style={{marginBottom:16}}>
                  <BuildingDetails building={selectedBuilding} stats={selectedBuildingStats} onRequestReport={(id)=>{
                    setOpenReportFor(id)
                    setTimeout(()=> setOpenReportFor(null), 150)
                  }} onFocus={(id)=> setSelectedBuildingId(id)} />
                </div>
              )}

              <div style={{marginBottom:12}}>
                <div style={{padding:12,background:'rgba(2,6,23,0.6)',border:'1px solid rgba(255,255,255,0.04)',borderRadius:8,marginBottom:12}}>
                  <div style={{fontWeight:800,color:'#cfe9ff',marginBottom:6}}>CAMPUS STATUS</div>
                  <div style={{fontFamily:'var(--mono)'}}>
                    <div><strong>{coverage}%</strong> Coverage</div>
                    <div><strong>{avg}</strong> Avg Signal</div>
                    <div><strong>{deadZones.length}</strong> Critical Areas</div>
                  </div>
                </div>

                <DeadZonePanel deadZones={deadZones} onFocus={(id)=> setSelectedBuildingId(id)} />
              </div>

              <div className="authSection" style={{marginTop:12,paddingTop:12,borderTop:'1px solid rgba(255,255,255,0.08)'}}>
                {user ? (
                  <div>
                    <div className="userBadge">
                      <span className="userIcon">👤</span>
                      <span className="userEmail" title={user.email}>{user.email}</span>
                    </div>
                    <div style={{display:'flex',gap:8,marginTop:8}}>
                      <button onClick={()=>signOut()} className="authBtn signOutBtn">Sign Out</button>
                      <button onClick={seedDemo} className="authBtn seedBtn">Load Demo</button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={{fontSize:12,color:'#93a3b8',marginBottom:6}}>Sign in to submit WiFi reports</div>
                    <div style={{display:'flex',gap:8}}>
                      <button onClick={() => setShowAuthModal(true)} className="authBtn signInBtn">Sign In</button>
                      <button onClick={seedDemo} className="authBtn seedBtn">Load Demo</button>
                    </div>
                  </div>
                )}
              </div>
            </aside>
          </div>
        </div>
      </div>
      {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} onAuthSuccess={() => setShowAuthModal(false)} />}
      <footer className="footer">Honest readings only — user self-rated bars (0–4). Optional connection hints used when available.</footer>
    </div>
  )
}

function AuthModal({ onClose, onAuthSuccess }) {
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)

    const lower = email.toLowerCase()
    // Accept DSVV campus addresses (contains '@dsvv' or endsWith @dsvv.edu), or legacy @campus.edu
    if (!(lower.endsWith('@campus.edu') || lower.includes('@dsvv') || lower.endsWith('@dsvv.edu'))) {
      setError('Access restricted. Please use your DSVV campus email (e.g. you@dsvv.edu).')
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }

    setLoading(true)
    try {
      if (isSignUp) {
        await signUp(email, password)
      } else {
        await signIn(email, password)
      }
      onAuthSuccess()
    } catch (err) {
      setError(err.message || 'Authentication failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="authModalOverlay" onClick={onClose}>
      <div className="authModalCard" onClick={(e) => e.stopPropagation()}>
        <button className="authModalClose" onClick={onClose}>&times;</button>
        <h3>{isSignUp ? 'Create Campus Account' : 'Campus Sign In'}</h3>
        <p style={{ fontSize: 13, color: '#93a3b8', marginBottom: 16 }}>
          Only users with a verified DSVV campus email (for example <strong>@dsvv.edu</strong>) can report dead zones.
        </p>

        {error && <div className="authError">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="formGroup">
            <label>Campus Email</label>
            <input
              type="email"
              placeholder="yourname@campus.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
            />
          </div>
          <div className="formGroup">
            <label>Password</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
            />
          </div>
          <button type="submit" className="authSubmitBtn" disabled={loading}>
            {loading ? 'Processing...' : isSignUp ? 'Register' : 'Sign In'}
          </button>
        </form>

        <div style={{ marginTop: 16, textAlign: 'center', fontSize: 13 }}>
          <span style={{ color: '#93a3b8' }}>
            {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
          </span>
          <button
            onClick={() => {
              setIsSignUp(!isSignUp)
              setError(null)
            }}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--accent)',
              cursor: 'pointer',
              textDecoration: 'underline',
              padding: 0,
            }}
          >
            {isSignUp ? 'Sign In' : 'Register'}
          </button>
        </div>
      </div>
    </div>
  )
}
