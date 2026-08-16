import React, { useState } from 'react'

export default function ReportWifiModal({x,y,buildingLabel,defaultBars,onClose,onSubmit}){
  const [bars,setBars] = useState(defaultBars!=null?defaultBars:3)
  const [issue,setIssue] = useState('')
  const options = [
    {v:0,label:'Dead'},
    {v:1,label:'Weak'},
    {v:2,label:'Fair'},
    {v:3,label:'Good'},
    {v:4,label:'Excellent'}
  ]

  const submit = ()=>{
    onSubmit && onSubmit({x,y,bars,buildingLabel,issue})
    onClose && onClose()
  }

  return (
    <div className="reportModalOverlay" onClick={onClose}>
      <div className="reportModalCard" onClick={(e)=>e.stopPropagation()} style={{width:380}}>
        <button className="authModalClose" onClick={onClose}>&times;</button>
        <h3>Report WiFi</h3>
        <div style={{fontSize:13,color:'#93a3b8',marginBottom:8}}>{buildingLabel || 'On Campus'}</div>
        <div style={{display:'flex',gap:8,marginBottom:8}}>
          {options.map(o=> (
            <button key={o.v} onClick={()=>setBars(o.v)} className={bars===o.v? 'activeRating':''} style={{flex:1,padding:8}}>{o.label}</button>
          ))}
        </div>
        <div style={{marginBottom:8}}>
          <label style={{fontSize:13,color:'#93a3b8'}}>Optional issue</label>
          <select value={issue} onChange={(e)=>setIssue(e.target.value)} style={{width:'100%',padding:8,marginTop:6}}>
            <option value="">(none)</option>
            <option value="no-internet">No Internet</option>
            <option value="slow">Slow</option>
            <option value="disconnecting">Disconnecting</option>
            <option value="cannot-connect">Cannot Connect</option>
          </select>
        </div>
        <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
          <button onClick={onClose} style={{padding:'8px 12px'}}>Cancel</button>
          <button onClick={submit} style={{padding:'8px 12px',background:'#0ea5a4',color:'#001'}}>Submit Report</button>
        </div>
      </div>
    </div>
  )
}
