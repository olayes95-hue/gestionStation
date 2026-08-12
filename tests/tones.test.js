import { describe, it, expect } from 'vitest'
import { ALERT_TONES } from '../src/lib/tones.js'

const VALID_TONES = ['ok', 'warn', 'alarm', 'info']

describe('ALERT_TONES', () => {
  it('expose exactement les 15 types d’alerte connus', () => {
    expect(Object.keys(ALERT_TONES)).toHaveLength(15)
  })

  it('inclut les types compteur/cuve ajoutés (v35, v37)', () => {
    expect(ALERT_TONES.RELEVE_COMPTEUR_MANQUANT).toBeDefined()
    expect(ALERT_TONES.RELEVE_COMPTEUR_MANQUANT.label).toMatch(/compteur/i)
    expect(ALERT_TONES.DONNEES_INCOHERENTES).toBeDefined()
    expect(ALERT_TONES.DONNEES_INCOHERENTES.label).toMatch(/vérifier/i)
  })

  it('associe libellé et ton OCTANE valide à chaque type', () => {
    for (const [key, val] of Object.entries(ALERT_TONES)) {
      expect(typeof val.label, key).toBe('string')
      expect(val.label.length, key).toBeGreaterThan(0)
      expect(VALID_TONES, key).toContain(val.tone)
    }
  })

  it('contient les types critiques attendus', () => {
    expect(ALERT_TONES.VERSEMENT_MANQUANT.label).toBe('Versement manquant')
    expect(ALERT_TONES.VERSEMENT_MANQUANT.tone).toBe('alarm')
    expect(ALERT_TONES.STOCK_BAS.label).toBe('Stock bas carburant')
    expect(ALERT_TONES.ECART_STOCK.label).toContain('coulage')
  })
})
