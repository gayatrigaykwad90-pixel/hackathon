import React from 'react'

export default function DeadZonePanel({deadZones = [], onFocus}){
  return (
    <div style={{padding:12,background:'rgba(255,20,20,0.02)',border:'1px solid rgba(255,77,77,0.06)',borderRadius:8}}>
      <div style={{fontWeight:800,color:'#ffc7c0',marginBottom:8}}>⚠ ATTENTION REQUIRED</div>
      {deadZones.length===0 && <div style={{color:'#93a3b8'}}>No attention items. Campus coverage looks healthy.</div>}
      {deadZones.map((d,idx)=> (
        <div key={d.id} style={{padding:10,display:'flex',flexDirection:'column',gap:6,borderBottom: idx<deadZones.length-1 ? '1px solid rgba(255,255,255,0.03)':''}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div style={{display:'flex',alignItems:'center',gap:10}}>
              <div style={{width:10,height:10,background: d.avg < 1 ? 'var(--danger)' : d.avg < 2 ? 'var(--warn)' : '#ffcf67',borderRadius:12}}></div>
              <div style={{fontWeight:700}}>{d.name}</div>
            </div>
            <div style={{fontSize:13,color:'#93a3b8'}}>{d.avg} / 4 • {d.total} reports</div>
          </div>
          <div style={{display:'flex',gap:8}}>
            <button onClick={()=> onFocus && onFocus(d.id)} className="viewBtn">Show on Map</button>
            <button onClick={()=> alert(`Create issue: ${d.name}`)} className="createIssueBtn">Create IT Issue</button>
          </div>
        </div>
      ))}
    </div>
  )
}
