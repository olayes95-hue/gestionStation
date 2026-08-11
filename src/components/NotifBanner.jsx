import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useStation } from '../lib/station.jsx'

export default function NotifBanner() {
  const { stationId } = useStation()
  const [notifs, setNotifs] = useState([])

  async function load() {
    if (!stationId) { setNotifs([]); return }
    const { data } = await supabase.from('notifications').select('*')
      .eq('station_id', stationId).eq('resolved', false).order('created_at', { ascending: false })
    setNotifs(data || [])
  }
  useEffect(() => { load() }, [stationId])
  // rafraîchit à l'ouverture + toutes les 5 min (les notifs sont créées par le planificateur 9h/17h)
  useEffect(() => { const t = setInterval(load, 300000); return () => clearInterval(t) }, [stationId])

  async function resolve(id) {
    await supabase.from('notifications').update({ resolved: true }).eq('id', id)
    setNotifs(p => p.filter(n => n.id !== id))
  }

  if (!notifs.length) return null
  return (
    <div style={{ marginBottom: 14 }}>
      {notifs.map(n => (
        <div key={n.id} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--warn-soft)',
          border: '1px solid #f4d9a8', color: '#8a5300', padding: '11px 14px', borderRadius: 11, marginBottom: 8, fontSize: 14 }}>
          <span style={{ flex: 1 }}>{n.message}</span>
          <button className="btn sec small" onClick={() => resolve(n.id)}>Traité</button>
        </div>
      ))}
    </div>
  )
}
