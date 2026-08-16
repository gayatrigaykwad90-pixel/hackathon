import React from 'react'

export default function ITActionView({readings, maxItems=3, onView, onCreateIssue}){
  if(!readings || readings.length===0) return <div style={{color:'#93a3b8'}}>No data</div>

  const groups = {}
  for(const r of readings){
    const b = r.buildingLabel || 'Unknown'
    if(!groups[b]) groups[b] = {count:0, dead:0, sum:0}
    groups[b].count += 1
    if((Number(r.bars)||0) <= 1) groups[b].dead += 1
    groups[b].sum += Number(r.bars)||0
  }

  const rows = Object.entries(groups).map(([k,v])=>({
    name:k,
    count:v.count,
    dead:v.dead,
    avg:(v.sum / v.count)
  }))

  // rank by dead reports descending, then by lowest avg
  rows.sort((a,b)=>{
    if(b.dead !== a.dead) return b.dead - a.dead
    return a.avg - b.avg
  })

  const top = rows.slice(0, maxItems)

  function suggestionFor(avg, dead){
    if(avg < 1.0 && dead >= 5) return 'Investigate access-point coverage and signal interference.'
    if(avg >= 1.0 && avg < 2.0) return 'Check AP placement and evening network load.'
    if(avg >= 2.0 && avg < 3.0) return 'Monitor usage patterns and plan minor tuning.'
    return 'Coverage looks acceptable; continue monitoring.'
  }

  return (
    <div style={{marginTop:12}}>
      <h4 style={{margin:'6px 0'}}>IT Action Center — Top {top.length} Priorities</h4>
      <div style={{display:'flex',flexDirection:'column',gap:10}}>
        {top.map((r,idx)=> (
          <div key={r.name} style={{padding:10,background:'rgba(255,255,255,0.02)',borderRadius:8,border:'1px solid rgba(255,255,255,0.03)'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div>
                <div style={{fontWeight:700,color: r.avg < 1 ? '#ff4d4f' : r.avg < 2 ? '#ff9f43' : '#ffcf67'}}>{idx+1}. {r.name}</div>
                <div style={{fontSize:12,color:'#93a3b8'}}>Avg: {r.avg.toFixed(2)} • Reports: {r.count} • Dead: {r.dead}</div>
              </div>
              <div style={{display:'flex',flexDirection:'column',gap:6}}>
                <button onClick={()=> onView && onView(r.name)} style={{padding:'6px 10px'}}>View Location</button>
                <button onClick={()=> onCreateIssue && onCreateIssue(r.name)} style={{padding:'6px 10px'}}>Create Issue</button>
              </div>
            </div>
            <div style={{marginTop:8,fontSize:13}}><strong>Suggested Action:</strong> {suggestionFor(r.avg, r.dead)}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
