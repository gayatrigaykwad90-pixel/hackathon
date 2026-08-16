import React from 'react'

export default function BuildingDetails({building, stats, onRequestReport, onFocus}){
  if(!building) return null
  const { name } = building
  const total = stats ? stats.total : 0
  const avg = stats ? stats.avg : '—'
  const dead = stats ? stats.dead : 0
  const last = stats && stats.last ? new Date(stats.last).toLocaleString() : '—'

  const status = stats ? (stats.avg < 1 ? 'CRITICAL' : stats.avg < 2 ? 'WEAK' : stats.avg < 3 ? 'FAIR' : stats.avg < 3.5 ? 'GOOD' : 'EXCELLENT') : 'Unknown'

  return (
    <div style={{padding:12,background:'rgba(14,165,164,0.04)',border:'1px solid rgba(14,165,164,0.06)',borderRadius:8}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <strong style={{fontSize:15,color:'#cfe9ff'}}>{name}</strong>
        <div style={{fontSize:12,color:'#93a3b8'}}>Status: <span style={{color: status==='Critical'? '#ff4d4f': status==='Weak'? '#ff9f43' : status==='Fair'? '#ffcf67' : '#21c65b', marginLeft:6}}>{status}</span></div>
      </div>
      <div style={{marginTop:8,fontSize:13}}>
        <div><strong>Average Signal:</strong> {avg} / 4</div>
        <div><strong>Reports:</strong> {total}</div>
        <div><strong>Dead Reports:</strong> {dead}</div>
        <div><strong>Last Report:</strong> {last}</div>
      </div>
      <div style={{display:'flex',gap:8,marginTop:12}}>
        <button onClick={()=> onRequestReport && onRequestReport(building.id)} style={{padding:'8px 12px',background:'#0ea5a4',color:'#001'}}>Report WiFi Problem</button>
        <button onClick={()=> onFocus && onFocus(building.id)} style={{padding:'8px 12px',background:'none',border:'1px solid rgba(255,255,255,0.06)'}}>Show on Map</button>
      </div>
    </div>
  )
}
