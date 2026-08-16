import React, { useEffect, useRef, useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import HeatmapCanvas from './HeatmapCanvas'
import ReportWifiModal from './ReportWifiModal'

function pointInPolygon(latlng, vs){
  // vs is array of LatLng objects
  const x = latlng.lng, y = latlng.lat
  let inside = false
  for(let i=0, j=vs.length-1; i<vs.length; j=i++){
    const xi = vs[i].lng, yi = vs[i].lat
    const xj = vs[j].lng, yj = vs[j].lat
    const intersect = ((yi>y) !== (yj>y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)
    if(intersect) inside = !inside
  }
  return inside
}

// Keep the campus-building metadata for the side panel/search
export const buildings = [
  { id: 'library', name: 'Library', x: 80, y: 80, width: 180, height: 90 },
  { id: 'admin', name: 'Admin Block', x: 540, y: 80, width: 180, height: 90 },
  { id: 'academic', name: 'Academic Block', x: 290, y: 210, width: 220, height: 100 },
  { id: 'computer-lab', name: 'Computer Lab', x: 80, y: 360, width: 200, height: 100 },
  { id: 'hostel', name: 'Hostel', x: 500, y: 360, width: 220, height: 100 }
]

export default function CampusMap({readings = [], onReport, user, onAuthPrompt, highlightedBuildingId, onSelectBuilding, openReportFor, focusReadingId, onReadingClick, viewMode='coverage', heatmapOpacity=0.95}){
  const containerRef = useRef()
  const [modal, setModal] = useState(null)
  const [selectedReading, setSelectedReading] = useState(null)
  const [deadDetail, setDeadDetail] = useState(null)
  const [pulse, setPulse] = useState(null)
  const [mapOffset, setMapOffset] = useState({tx:0,ty:0})
  const [mapScale, setMapScale] = useState(1)
  const width = 800, height = 600
  const svgW = width, svgH = height
  const [hoverInfo, setHoverInfo] = useState(null)
  const [showHeat, setShowHeat] = useState(true)
  const [showBuildings, setShowBuildings] = useState(true)
  const [showReports, setShowReports] = useState(true)
  const [showDeadZones, setShowDeadZones] = useState(true)

  // No Leaflet: SVG campus map implementation
  useEffect(()=>{
    // nothing to init; heatmap canvas will handle drawing
  }, [])

  // pulse when focusReadingId prop changes
  useEffect(()=>{
    if(!focusReadingId) return
    const r = readings.find(rr=> rr.id === focusReadingId)
    if(!r) return
    setPulse({x:r.x,y:r.y})
    setTimeout(()=> setPulse(null), 2000)
    // center map on reading
    const tx = (width/2) - r.x
    const ty = (height/2) - r.y
    setMapOffset({tx,ty})
    // slight zoom for emphasis
    setMapScale(1.12)
    setTimeout(()=> setMapScale(1), 1800)
  }, [focusReadingId])

  // compute dead buildings for overlay
  const deadBuildings = buildings.map(b=>{
    const bReadings = readings.filter(r=> r.buildingLabel === b.name)
    const total = bReadings.length
    const avg = total? (bReadings.reduce((s,r)=>s + (Number(r.bars)||0),0)/total) : null
    const isDead = avg!=null && avg < 1.0 && total >= 5
    return { id: b.id, name: b.name, isDead, total, avg, x: b.x, y: b.y, width: b.width, height: b.height }
  }).filter(Boolean)

  // compute building-level stats
  const buildingStats = buildings.map(b=>{
    const bReadings = readings.filter(r=> r.buildingLabel === b.name)
    const total = bReadings.length
    const avg = total? +(bReadings.reduce((s,r)=>s + (Number(r.bars)||0),0)/total).toFixed(2) : null
    const deadCount = bReadings.filter(r=> (Number(r.bars)||0) === 0).length
    const weak = bReadings.filter(r=> (Number(r.bars)||0) === 1).length
    const last = bReadings.length ? bReadings.reduce((a,c)=> new Date(a.timestamp || a) > new Date(c.timestamp) ? a : c).timestamp : null
    const status = avg==null ? 'Unknown' : (avg < 1 ? 'CRITICAL' : avg < 2 ? 'WEAK' : avg < 3 ? 'FAIR' : avg < 3.5 ? 'GOOD' : 'EXCELLENT')
    return { id: b.id, name: b.name, x: b.x + Math.round(b.width/2), y: b.y + Math.round(b.height/2), box: b, total, avg, deadCount, weak, last, status }
  })

  // center map when highlighted building changes or dead detail set
  useEffect(()=>{
    if(highlightedBuildingId){
      const b = buildings.find(bb=> bb.id === highlightedBuildingId)
      if(b){
        const cx = b.x + Math.round(b.width/2)
        const cy = b.y + Math.round(b.height/2)
        const tx = (width/2) - cx
        const ty = (height/2) - cy
        setMapOffset({tx,ty})
        setPulse({x:cx,y:cy})
        setMapScale(1.12)
        setTimeout(()=> setPulse(null),2000)
        setTimeout(()=> setMapScale(1), 1800)
      }
    }
  },[highlightedBuildingId])

  useEffect(()=>{
    if(deadDetail){
      const tx = (width/2) - deadDetail.x
      const ty = (height/2) - deadDetail.y
      setMapOffset({tx,ty})
      setPulse({x:deadDetail.x,y:deadDetail.y})
      setMapScale(1.16)
      setTimeout(()=> setPulse(null),2200)
      setTimeout(()=> setMapScale(1), 2000)
    }
  },[deadDetail])

  // convex hull (Monotone chain) for a set of points [{x,y}]
  function convexHull(points){
    if(!points || points.length < 3) return points.slice()
    const pts = points.map(p=> ({x: p.x, y: p.y})).sort((a,b)=> a.x===b.x ? a.y - b.y : a.x - b.x)
    const cross = (o,a,b) => (a.x - o.x)*(b.y - o.y) - (a.y - o.y)*(b.x - o.x)
    const lower = []
    for(const p of pts){
      while(lower.length >= 2 && cross(lower[lower.length-2], lower[lower.length-1], p) <= 0) lower.pop()
      lower.push(p)
    }
    const upper = []
    for(let i = pts.length-1; i>=0; i--){
      const p = pts[i]
      while(upper.length >= 2 && cross(upper[upper.length-2], upper[upper.length-1], p) <= 0) upper.pop()
      upper.push(p)
    }
    upper.pop(); lower.pop()
    return lower.concat(upper)
  }

  return (
    <div className="mapContainer" style={{position:'relative',width:'100%'}}>
      <div style={{position:'relative',width:width,height:height,background:'#021116',borderRadius:8,overflow:'hidden'}} ref={containerRef}>
        {/* Attention Required panel (top-right) */}
        <div className="attentionPanel">
          <h4>⚠ ATTENTION REQUIRED</h4>
          {buildingStats.filter(b=> b.avg!=null && b.avg < 3 && b.total > 0).sort((a,b)=> {
            // severity: CRITICAL (avg<1) first, then WEAK (1-2), then FAIR
            const rank = s=> s.avg < 1 ? 0 : s.avg < 2 ? 1 : 2
            return rank(a) - rank(b) || a.avg - b.avg
          }).map(b=> (
            <div key={b.id} className="attentionItem">
              <div className="left">
                <div style={{display:'flex',alignItems:'center'}}>
                  <div className="attentionBadge" style={{background: b.avg < 1 ? 'var(--danger)' : b.avg < 2 ? 'var(--warn)' : '#ffcf67'}}></div>
                  <div style={{fontWeight:800,color:'#cfe9ff'}}>{b.name}</div>
                </div>
                <div style={{fontSize:12,color:'#93a3b8',marginTop:6}}>{b.avg < 1 ? 'CRITICAL' : b.avg < 2 ? 'WEAK' : 'FAIR'}</div>
                <div style={{fontSize:13,color:'#9fb0c4',marginTop:6}}>Signal: {b.avg} / 4 • {b.total} reports{b.deadCount? ` • ${b.deadCount} dead` : ''}</div>
                  <div className="attentionButtons">
                    <button onClick={()=>{ setHighlightedBuildingId && setHighlightedBuildingId(b.id); if(onSelectBuilding){ onSelectBuilding(b.id)} setMapOffset({tx:(width/2)-(b.x + Math.round(b.box.width/2)), ty:(height/2)-(b.y + Math.round(b.box.height/2))}); setMapScale(1.14); setTimeout(()=> setMapScale(1),1800)}} style={{padding:'6px 10px'}}>VIEW ON MAP</button>
                    <button onClick={()=>{ setDeadDetail(b) }} style={{padding:'6px 10px'}}>DETAILS</button>
                  </div>
              </div>
            </div>
          ))}
          {buildingStats.filter(b=> b.avg!=null && b.avg < 3 && b.total > 0).length === 0 && (
            <div style={{padding:10,color:'#9fb0c4'}}>✓ NO CRITICAL DEAD ZONES
              <div style={{fontSize:12,color:'#93a3b8',marginTop:6}}>Campus Wi-Fi coverage is currently healthy.</div>
            </div>
          )}
        </div>
        {/* Layer controls */}
        <div style={{position:'absolute',left:12,top:12,zIndex:30,background:'rgba(2,6,23,0.85)',padding:8,borderRadius:8,border:'1px solid rgba(255,255,255,0.03)'}}>
          <div style={{display:'flex',flexDirection:'column',gap:6}}>
            <label style={{fontSize:13}}><input type="checkbox" checked={showHeat} onChange={e=>setShowHeat(e.target.checked)} /> <span style={{marginLeft:8}}>Heatmap</span></label>
            <label style={{fontSize:13}}><input type="checkbox" checked={showBuildings} onChange={e=>setShowBuildings(e.target.checked)} /> <span style={{marginLeft:8}}>Buildings</span></label>
            <label style={{fontSize:13}}><input type="checkbox" checked={showReports} onChange={e=>setShowReports(e.target.checked)} /> <span style={{marginLeft:8}}>Reports</span></label>
            <label style={{fontSize:13}}><input type="checkbox" checked={showDeadZones} onChange={e=>setShowDeadZones(e.target.checked)} /> <span style={{marginLeft:8}}>Dead Zones</span></label>
          </div>
        </div>

        {/* Heatmap canvas overlay (draw first so buildings/labels stay above) */}
        {showHeat && (
          <div style={{position:'absolute',left:0,top:0,width:'100%',height:'100%',pointerEvents:'none',opacity: heatmapOpacity, zIndex: 10001}} className="heatmapOverlayDebug">
            <HeatmapCanvas readings={readings} width={width} height={height} opacity={heatmapOpacity} />
          </div>
        )}

        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{position:'absolute',left:0,top:0,transform:`translate(${mapOffset.tx}px, ${mapOffset.ty}px) scale(${mapScale})`,transition:'transform 600ms cubic-bezier(.2,.9,.2,1)', zIndex:10002}} onClick={(e)=>{
          const rect = e.currentTarget.getBoundingClientRect()
          const x = Math.round(e.clientX - rect.left)
          const y = Math.round(e.clientY - rect.top)
          if(!user){ onAuthPrompt && onAuthPrompt(); return }
          setModal({x,y,buildingLabel:null})
        }}>
          <rect x="0" y="0" width={width} height={height} fill="#021116" />
          {showBuildings && buildings.map(b=> {
            const bs = buildingStats.find(bb=> bb.name === b.name)
            const isCritical = bs && bs.avg!=null && bs.avg < 1
            const dim = viewMode === 'problems' ? (isCritical ? 1.0 : 0.28) : 1.0
            const fill = highlightedBuildingId===b.id? 'rgba(14,165,164,0.16)' : `rgba(8,32,42,${0.9*dim})`
            const stroke = highlightedBuildingId===b.id? 'var(--accent)' : '#12313b'
            return (
            <g key={b.id}>
              <rect x={b.x} y={b.y} width={b.width} height={b.height} rx="6" fill={fill} stroke={stroke} strokeWidth={highlightedBuildingId===b.id? 2.2 : 1}
                className={highlightedBuildingId===b.id? 'pulsingBuilding' : ''}
                onMouseEnter={()=>{
                  const bReadings = readings.filter(r=> r.buildingLabel === b.name)
                  const total = bReadings.length
                  const avg = total? (bReadings.reduce((s,r)=>s + (Number(r.bars)||0),0)/total).toFixed(2): '—'
                  const status = total ? (avg < 1 ? 'Critical' : avg < 2 ? 'Weak' : avg < 3 ? 'Fair' : 'Good') : 'Unknown'
                  setHoverInfo({x: b.x + b.width/2, y: b.y - 8, name: b.name, avg, total, status})
                }}
                onMouseLeave={()=>setHoverInfo(null)}
                onClick={()=>{
                  if(onSelectBuilding) onSelectBuilding(b.id)
                  if((user) && (window.event && (window.event.ctrlKey || window.event.metaKey))){
                    setModal({x: b.x + Math.round(b.width/2), y: b.y + Math.round(b.height/2), buildingLabel: b.name})
                  }
                }}
              />
              {/* building label and small status */}
              <text x={b.x+8} y={b.y+18} className="buildingLabel" style={{fill:'#cfe9ff',fontSize:12,fontFamily:'var(--mono)'}}>{b.name}</text>
              {bs && (
                <g>
                  <foreignObject x={b.x+8} y={b.y+b.height-28} width={b.width-16} height={24} style={{pointerEvents:'none'}}>
                    <div style={{fontFamily:'var(--mono)',fontSize:12,color:'#cfe9ff',background:'rgba(2,6,23,0.55)',padding:'4px 6px',borderRadius:6,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                      <div style={{display:'flex',gap:8,alignItems:'center'}}>
                        <div style={{width:10,height:10,borderRadius:12,background: bs.avg==null? '#6b7280' : bs.avg < 1 ? 'var(--danger)' : bs.avg < 2 ? 'var(--warn)' : bs.avg < 3 ? '#ffcf67' : bs.avg < 3.5 ? 'var(--ok)' : 'var(--ok)'}}></div>
                        <div style={{fontWeight:700}}>{bs.name}</div>
                      </div>
                      <div style={{fontSize:12,color:'#9fb0c4'}}>{bs.avg!=null? `${bs.avg} / 4` : '—'}</div>
                    </div>
                  </foreignObject>
                </g>
              )}
            </g>)
          })}

          {showDeadZones && buildingStats.filter(b=> b.avg!=null && b.avg < 1 && b.total >=5).map(d=> {
            // collect weak/dead report coords for this building
            const coords = readings.filter(r=> r.buildingLabel === d.name && (Number(r.bars)||0) <= 1).map(r=> ({x:r.x,y:r.y}))
            const hull = convexHull(coords)
            const pointsAttr = hull.map(p=> `${p.x},${p.y}`).join(' ')
            return (
            <g key={d.id}>
              {hull && hull.length >= 3 ? (
                <polygon points={pointsAttr} fill="rgba(255,77,77,0.16)" stroke="rgba(255,77,77,0.45)" strokeWidth={2} />
              ) : (
                <ellipse cx={d.x} cy={d.y} rx={Math.max(d.box.width, d.box.height) * 0.9} ry={Math.max(d.box.width, d.box.height) * 0.5} fill="rgba(255,77,77,0.16)" stroke="rgba(255,77,77,0.45)" />
              )}
              <g onClick={()=>{ setSelectedReading(null); setPulse({x:d.x,y:d.y}); setTimeout(()=> setPulse(null),3000); setDeadDetail(d); }} style={{cursor:'pointer'}}>
                <circle cx={d.x} cy={d.y} r={20} fill="rgba(255,77,77,0.98)" className="deadPulse" />
                <text x={d.x} y={d.y+6} textAnchor="middle" style={{fontSize:13,fontWeight:900,fill:'#07121a'}}>⚠</text>
              </g>
              {/* label below marker */}
              <g>
                <rect x={d.x - 60} y={d.y + 26} width={120} height={54} rx={8} fill="rgba(2,6,23,0.9)" stroke="rgba(255,77,77,0.22)" />
                <text x={d.x} y={d.y + 44} textAnchor="middle" style={{fontSize:12,fontWeight:800,fill:'#ffc7c0'}}>DEAD ZONE</text>
                <text x={d.x} y={d.y + 58} textAnchor="middle" style={{fontSize:12,fontWeight:700,fill:'#cfe9ff'}}>{d.name}</text>
                <text x={d.x} y={d.y + 72} textAnchor="middle" style={{fontSize:11,fill:'#9fb0c4'}}>{d.avg} / 4</text>
              </g>
            </g>
          )})}

          {showReports && readings.map(r=> (
            r.x!=null && r.y!=null ? (
              // show only weak/dead prominently in problems mode
              <circle key={r.id} cx={r.x} cy={r.y} r={ (viewMode==='problems' && (r.bars<=1)) ? 7 : 4 } fill={r.bars<=1? '#ff4d4f': r.bars==2? '#ff9f43': '#21c65b'} opacity={ viewMode==='problems' ? (r.bars<=1 ? 0.95 : 0.18) : 0.95 } onClick={(e)=>{ e.stopPropagation(); setSelectedReading(r); onReadingClick && onReadingClick(r.id); setPulse({x:r.x,y:r.y}); setTimeout(()=> setPulse(null),2500)}} />
            ) : null
          ))}

          {pulse && (
            <g>
              <circle cx={pulse.x} cy={pulse.y} r={12} fill="none" stroke="#0ea5a4" strokeWidth={2} className="pulseCircle" />
            </g>
          )}
        </svg>

        {/* (heatmap already drawn above) */}

        {hoverInfo && (
          <div style={{position:'absolute',left:hoverInfo.x,top:hoverInfo.y,transform:'translate(-50%,-100%)',background:'rgba(2,6,23,0.85)',padding:8,borderRadius:6,border:'1px solid rgba(14,165,164,0.12)'}}>
            <div style={{fontSize:13,fontWeight:700,color:'#cfe9ff'}}>{hoverInfo.name}</div>
            <div style={{fontSize:12,color:'#93a3b8'}}>Avg: {hoverInfo.avg} • Reports: {hoverInfo.total}</div>
            <div style={{fontSize:12,marginTop:4}}>Status: <strong style={{color: hoverInfo.status==='Critical'? '#ff4d4f': hoverInfo.status==='Weak'? '#ff9f43': hoverInfo.status==='Fair'? '#ffcf67':'#21c65b'}}>{hoverInfo.status}</strong></div>
          </div>
        )}

        {selectedReading && (
          <div style={{position:'absolute',left:selectedReading.x,top:selectedReading.y,transform:'translate(12px,-50%)',background:'rgba(2,6,23,0.95)',padding:8,borderRadius:8,border:'1px solid rgba(255,255,255,0.03)'}}>
            <div style={{fontWeight:700,color:'#cfe9ff'}}>{selectedReading.buildingLabel || 'On Campus'}</div>
            <div style={{fontSize:13,color:'#93a3b8'}}>Signal: {['dead','weak','fair','good','excellent'][selectedReading.bars] || selectedReading.bars} • {selectedReading.bars} / 4</div>
            <div style={{fontSize:12,color:'#93a3b8',marginTop:6}}>{selectedReading.reporterEmail? `By: ${selectedReading.reporterEmail}`: 'By: Guest'} • {new Date(selectedReading.timestamp).toLocaleString()}</div>
            <div style={{display:'flex',gap:8,marginTop:8}}>
              <button onClick={()=>{ setModal({x:selectedReading.x,y:selectedReading.y,buildingLabel:selectedReading.buildingLabel}); setSelectedReading(null)}} style={{padding:'6px 10px'}}>Report Here</button>
              <button onClick={()=> setSelectedReading(null)} style={{padding:'6px 10px'}}>Close</button>
            </div>
          </div>
        )}

        {deadDetail && (
          <div className="authModalOverlay" onClick={()=> setDeadDetail(null)}>
            <div className="authModalCard" onClick={(e)=> e.stopPropagation()} style={{maxWidth:520}}>
              <button className="authModalClose" onClick={()=> setDeadDetail(null)}>&times;</button>
              <h3 style={{color:'#ffc7c0'}}>⚠ CRITICAL WIFI ISSUE</h3>
              <h2 style={{marginTop:6,color:'#cfe9ff'}}>{deadDetail.name}</h2>
              <div style={{display:'flex',gap:16,marginTop:12}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,color:'#93a3b8'}}>Average Signal</div>
                  <div style={{fontWeight:800,color:'#cfe9ff',fontSize:18}}>{deadDetail.avg} / 4</div>
                  <div style={{fontSize:13,color:'#93a3b8',marginTop:8}}>Total Reports: <strong style={{color:'#cfe9ff'}}>{deadDetail.total}</strong></div>
                  <div style={{fontSize:13,color:'#93a3b8'}}>Dead Reports: <strong style={{color:'#ff7a76'}}>{deadDetail.deadCount}</strong></div>
                  <div style={{fontSize:13,color:'#93a3b8'}}>Weak Reports: <strong style={{color:'#ffcf67'}}>{deadDetail.weak}</strong></div>
                  <div style={{fontSize:12,color:'#93a3b8',marginTop:8}}>Last Report: {deadDetail.last ? new Date(deadDetail.last).toLocaleString() : '—'}</div>
                </div>
                <div style={{width:260}}>
                  <div style={{fontWeight:700,color:'#ffc7c0'}}>WHY FLAGGED?</div>
                  <div style={{fontSize:13,color:'#9fb0c4',marginTop:8}}>Average signal &lt; 1.0 AND Reports ≥ 5</div>
                  <div style={{fontWeight:700,color:'#ffc7c0',marginTop:12}}>RECOMMENDED ACTION</div>
                  <ul style={{color:'#9fb0c4',marginTop:6}}>
                    <li>Inspect nearest access point</li>
                    <li>Check Wi‑Fi interference/congestion</li>
                    <li>Verify AP coverage and placement</li>
                    <li>Consider adding additional APs</li>
                  </ul>
                  <div style={{marginTop:12,fontWeight:800,color:'#ff6b6b'}}>Priority: 🔴 HIGH</div>
                </div>
              </div>
                  <div style={{display:'flex',gap:8,marginTop:16}}>
                <button onClick={()=>{ if(onSelectBuilding){ const b = buildings.find(bb=> bb.name === deadDetail.name); if(b){ onSelectBuilding(b.id); setHighlightedBuildingId && setHighlightedBuildingId(b.id); setMapOffset({tx:(width/2)-(b.x + Math.round(b.width/2)), ty:(height/2)-(b.y + Math.round(b.height/2))}); setMapScale(1.14); setTimeout(()=> setMapScale(1),1800) } } }} className="viewBtn">FOCUS ON MAP</button>
                <button onClick={()=>{ alert(`Create IT issue for ${deadDetail.name}`) }} className="createIssueBtn">CREATE IT ISSUE</button>
                <button onClick={()=> setDeadDetail(null)} style={{padding:'10px 12px',background:'none',border:'1px solid rgba(255,255,255,0.06)',borderRadius:6}}>CLOSE</button>
              </div>
            </div>
          </div>
        )}

      </div>

      <div className="heatmapLegend" style={{position:'absolute',right:12,top:12}}>
        <div className="legendTitle">WiFi Signal</div>
        <div className="legendBar"></div>
        <div className="legendLabels">
          <span>Low</span>
          <span>Moderate</span>
          <span>High</span>
        </div>
      </div>

      {modal && <ReportWifiModal x={modal.x} y={modal.y} buildingLabel={modal.buildingLabel} onClose={()=>setModal(null)} onSubmit={(data)=>{
        // attach id and timestamp and call onReport
        const r = { id: uuidv4(), x: data.x, y: data.y, bars: data.bars, buildingLabel: data.buildingLabel || '', timestamp: new Date().toISOString(), reporterEmail: (user && user.email) || null, issue: data.issue }
        onReport && onReport(r)
      }} />}

      {openReportFor && (()=>{
        // find building center and open modal
        const b = buildings.find(bb=>bb.id === openReportFor)
        if(b){
          setTimeout(()=> setModal({x: b.x + Math.round(b.width/2), y: b.y + Math.round(b.height/2), buildingLabel: b.name}), 50)
        }
      })()}

    </div>
  )
}
