// Simple seed script to push demo readings to Supabase. Configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in environment.
const { createClient } = require('@supabase/supabase-js')
const crypto = require('crypto')

const url = process.env.VITE_SUPABASE_URL
const key = process.env.VITE_SUPABASE_ANON_KEY
if(!url || !key){
  console.error('Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY env vars before running this script')
  process.exit(1)
}
const supabase = createClient(url,key)

const sample = []
for(let i=0;i<40;i++){
  const x = Math.round(20 + Math.random()*520)
  const y = Math.round(20 + Math.random()*540)
  const bars = Math.floor(Math.random()*5)
  sample.push({id: crypto.randomUUID(), x,y,buildingLabel:'Seed', bars, timestamp:new Date().toISOString()})
}

(async ()=>{
  const {error} = await supabase.from('readings').insert(sample)
  if(error) console.error('seed error', error)
  else console.log('seeded', sample.length)
  process.exit(0)
})()
