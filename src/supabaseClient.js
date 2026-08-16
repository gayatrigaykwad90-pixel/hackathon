import { createClient } from '@supabase/supabase-js'
import { v4 as uuidv4 } from 'uuid'

const url = import.meta.env.VITE_SUPABASE_URL || null
const key = import.meta.env.VITE_SUPABASE_ANON_KEY || null
let supabase = null
if(url && key){
  supabase = createClient(url, key)
}

export const hasSupabase = !!supabase

export function initRealtime(){
  // noop: kept for compatibility
}

export async function submitReading(r){
  if(supabase){
    try{
      const { reporterEmail, ...payload } = r
      const { error } = await supabase.from('readings').insert(payload)
      if(error) console.error('Supabase insert error', error)
      return
    }catch(e){
      console.error('Supabase submit failed', e)
    }
  }
  // fallback to localStorage
  const ls = JSON.parse(localStorage.getItem('signal_readings')||'[]')
  ls.push(r)
  localStorage.setItem('signal_readings', JSON.stringify(ls))
  // trigger storage event for other windows
  try{ window.dispatchEvent(new Event('storage')) }catch(e){}
}

export function subscribeToReadings(onChange){
  if(supabase){
    // initial fetch
    supabase.from('readings').select('*').then(({data,error})=>{
      if(error) console.error('fetch error', error)
      onChange(data || [])
    })
    // realtime PostgreSQL changes channel
    const channel = supabase.channel('public:readings')
      .on('postgres_changes', {event:'INSERT', schema:'public', table:'readings'}, payload=>{
        // fetch full set when new insert arrives (simple for demo)
        supabase.from('readings').select('*').then(({data})=> onChange(data || []))
      }).subscribe()
    return ()=> channel && supabase.removeChannel(channel)
  }
  // localStorage fallback
  const data = JSON.parse(localStorage.getItem('signal_readings')||'[]')
  onChange(data)
  const handler = ()=> onChange(JSON.parse(localStorage.getItem('signal_readings')||'[]'))
  window.addEventListener('storage', handler)
  return ()=> window.removeEventListener('storage', handler)
}

export async function fetchSeeded(){
  if(supabase){
    const {data} = await supabase.from('readings').select('*')
    return data || []
  }
  let ls = JSON.parse(localStorage.getItem('signal_readings')||'[]')
  if(!ls || ls.length===0){
    // auto-seed local demo data for offline/demo mode
    const sample = []
    const count = 40
    for(let i=0;i<count;i++){
      const x = Math.round(20 + Math.random()*520)
      const y = Math.round(20 + Math.random()*540)
      const r = Math.random()
      const bars = r < 0.08 ? 0 : (r < 0.2 ? 1 : (r < 0.6 ? 3 : (r < 0.85 ? 2 : 4)))
      const daysAgo = Math.floor(Math.random()*14)
      const ts = new Date(Date.now() - daysAgo*24*60*60*1000 - Math.floor(Math.random()*3600*1000)).toISOString()
      sample.push({id: uuidv4(), x,y,buildingLabel:'Seed', bars, timestamp: ts})
    }
    ls = sample
    localStorage.setItem('signal_readings', JSON.stringify(ls))
  }
  return ls
}

let authListeners = []

export function onAuthStateChange(callback){
  if(supabase){
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      callback(session?.user || null)
    })
    return () => subscription.unsubscribe()
  }
  // offline fallback
  authListeners.push(callback)
  getCurrentUser().then(user => callback(user))
  return () => {
    authListeners = authListeners.filter(l => l !== callback)
  }
}

export async function signUp(email, password){
  if(supabase){
    const { data, error } = await supabase.auth.signUp({ email, password })
    if(error) throw error
    return data.user
  }
  // offline fallback
  const user = { id: uuidv4(), email }
  localStorage.setItem('session_user', JSON.stringify(user))
  authListeners.forEach(l => l(user))
  return user
}

export async function signIn(email, password){
  if(supabase){
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if(error) throw error
    return data.user
  }
  // offline fallback
  const user = { id: uuidv4(), email }
  localStorage.setItem('session_user', JSON.stringify(user))
  authListeners.forEach(l => l(user))
  return user
}

export async function signOut(){
  if(supabase){
    const { error } = await supabase.auth.signOut()
    if(error) throw error
    return
  }
  // offline fallback
  localStorage.removeItem('session_user')
  authListeners.forEach(l => l(null))
}

export async function getCurrentUser(){
  if(supabase){
    const { data: { session } } = await supabase.auth.getSession()
    return session?.user || null
  }
  try {
    return JSON.parse(localStorage.getItem('session_user') || 'null')
  } catch(e) {
    return null
  }
}
