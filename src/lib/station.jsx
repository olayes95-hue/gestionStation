import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase'
import { useAuth } from './auth.jsx'

const Ctx = createContext(null)
export const useStation = () => useContext(Ctx)

export function StationProvider({ children }) {
  const { profile, isAdmin } = useAuth()
  const [stations, setStations] = useState([])
  const [stationId, setStationId] = useState(null)

  useEffect(() => {
    supabase.from('stations').select('*').order('id').then(({ data }) => {
      const list = data || []
      setStations(list)
      setStationId(prev => {
        if (!isAdmin) return profile?.station_id ?? (list[0]?.id ?? null)
        return prev || (list[0]?.id ?? null)
      })
    })
  }, [profile, isAdmin])

  const current = stations.find(s => s.id === stationId) || null
  return (
    <Ctx.Provider value={{ stations, stationId, setStationId, current, isAdmin }}>
      {children}
    </Ctx.Provider>
  )
}
