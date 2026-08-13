import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth.jsx'
import { Panel } from '../ds/octane/components/core/Panel.jsx'
import { Icon } from '../ds/octane/components/core/Icon.jsx'
import { Button } from '../ds/octane/components/core/Button.jsx'

function StepNum({ n }) {
  return <span style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--accent-quiet)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto', font: 'var(--fw-semibold) 12px/1 var(--font-data)' }}>{n}</span>
}

function StepPanel({ n, title, action, children }) {
  return (
    <Panel>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-4)', marginBottom: 'var(--sp-4)', flexWrap: 'wrap' }}>
        <StepNum n={n} />
        <h2 style={{ font: 'var(--fw-semibold) 14px/1.2 var(--font-ui)', color: 'var(--text-primary)', margin: 0, flex: 1 }}>{title}</h2>
        {action}
      </div>
      <ul style={{ lineHeight: 1.9, fontSize: 13, margin: 0, paddingLeft: 18, color: 'var(--text-body)' }}>{children}</ul>
    </Panel>
  )
}

function Faq({ q, children }) {
  return (
    <details style={{ marginBottom: 'var(--sp-3)' }}>
      <summary style={{ font: 'var(--fw-semibold) 13px/1.3 var(--font-ui)', color: 'var(--text-primary)', cursor: 'pointer' }}>{q}</summary>
      <p style={{ font: '400 12px/1.4 var(--font-ui)', color: 'var(--text-muted)', marginTop: 'var(--sp-2)' }}>{children}</p>
    </details>
  )
}

export default function Aide() {
  const nav = useNavigate()
  const { isPompiste } = useAuth()
  const [jours, setJours] = useState(2)
  useEffect(() => {
    supabase.from('settings').select('jours_correction_gerant').eq('id', 1).maybeSingle()
      .then(({ data }) => { if (data?.jours_correction_gerant) setJours(data.jours_correction_gerant) })
  }, [])
  const joursTxt = jours === 1 ? "aujourd'hui" : `les ${jours} derniers jours`

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-5)' }}>
      <Panel>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-4)', marginBottom: 'var(--sp-3)' }}>
          <Icon name="circle-question-mark" size={18} color="var(--accent)" />
          <h2 style={{ font: 'var(--fw-semibold) 14px/1.2 var(--font-ui)', color: 'var(--text-primary)', margin: 0 }}>Comment utiliser l'application</h2>
        </div>
        <p style={{ font: '400 12px/1.4 var(--font-ui)', color: 'var(--text-muted)', margin: 0 }}>3 moments dans la journée. On ne t'affiche que ce qu'il faut remplir. Envoie à chaque fois.</p>
      </Panel>

      <StepPanel n={1} title="Matin (8h) — le stock" action={<Button size="sm" onClick={() => nav('/saisie?moment=matin')}>Aller à Saisie du jour</Button>}>
        <li><b>Stock en cuve</b> : litres d'essence et de gasoil restants.</li>
        <li><b>Relevés compteurs à l'ouverture</b> : l'index de chaque pompe <b>+ la photo</b>.</li>
        <li><b>Bouteilles de gaz</b> (boutons − / +) et <b>lubrifiants</b>.</li>
        <li>Appuie sur <b>Envoyer (Matin)</b>.</li>
      </StepPanel>

      <StepPanel n={2} title="16 h — ventes & compteurs" action={<Button size="sm" onClick={() => nav('/saisie?moment=apres-midi')}>Aller à Saisie du jour</Button>}>
        <li><b>Ventes carburant de la veille</b> : litres, puis sépare <b>Bon</b> / <b>Espèces</b>.</li>
        <li><b>Relevés 16 h</b> : index de chaque pompe <b>+ photo</b>. <b>Obligatoire</b> pour envoyer.</li>
        <li><b>Gaz vendu</b> et recettes espèces des autres pôles.</li>
      </StepPanel>

      <StepPanel n={3} title="Soir — clôture" action={<Button size="sm" onClick={() => nav('/saisie?moment=soir')}>Aller à Saisie du jour</Button>}>
        <li><b>Achats hors carburant</b> (gaz, lubrifiant, supérette) + fournisseur.</li>
        <li><b>Dépenses</b> : montant + motif + <b>coche « J'ai le justificatif »</b> (obligatoire).</li>
        <li><b>Versement banque</b> : montant + <b>photo du bordereau</b> (obligatoire).</li>
        <li>Vérifie <b>À verser / Versé / Écart</b> puis <b>Envoyer (Soir)</b>.</li>
      </StepPanel>

      <Panel title="Réception d'une commande" actions={!isPompiste && <Button size="sm" onClick={() => nav('/commandes')}>Aller aux Commandes</Button>}>
        <p style={{ font: '400 13px/1.5 var(--font-ui)', color: 'var(--text-body)', margin: 0 }}>
          Une commande peut arriver <b>à n'importe quel moment de la journée</b>, pas seulement le soir. Sur Saisie du jour, appuie sur <b>« J'ai reçu une commande »</b> en haut de la page : la liste des commandes en attente apparaît, tu choisis <b>Réceptionner</b> → cuve avant puis après. Le stock se met à jour seul.
        </p>
      </Panel>

      <Panel status="warn">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-4)', marginBottom: 'var(--sp-3)' }}>
          <Icon name="triangle-alert" size={16} color="var(--state-warn)" />
          <h2 style={{ font: 'var(--fw-semibold) 14px/1.2 var(--font-ui)', color: 'var(--text-primary)', margin: 0 }}>À retenir</h2>
        </div>
        <ul style={{ lineHeight: 1.9, fontSize: 13, margin: 0, paddingLeft: 18, color: 'var(--text-body)' }}>
          <li><b>Photos obligatoires</b> (l'envoi est bloqué sans elles) :
            <ul style={{ marginTop: 4 }}>
              <li><b>Chaque compteur</b> (matin + 16 h)</li>
              <li><b>Chaque dépense</b> (le justificatif)</li>
              <li><b>Chaque versement</b> (le bordereau)</li>
              <li><b>Chaque réception</b> carburant (bon / jauge)</li>
            </ul></li>
          <li>Relevés <b>16 h</b> : l'index de chaque pompe est obligatoire.</li>
          <li>Tu crées ou corriges une journée dans <b>{joursTxt}</b> ; au-delà, c'est la direction.</li>
          <li>Rien envoyé à <b>8 h</b> ou <b>17 h</b> ? Une alerte part à toi et à la direction.</li>
        </ul>
      </Panel>

      <Panel title="Questions fréquentes">
        <Faq q="Je me suis trompé sur un chiffre ?">Rouvre la même date, corrige et ré-envoie (possible dans {joursTxt}).</Faq>
        <Faq q="« Journée verrouillée »">La journée est en dehors de la fenêtre autorisée ({joursTxt}) : demande à la direction de la corriger.</Faq>
        <Faq q="« Relevés 16 h obligatoires »">Remplis l'index de chaque pompe avant d'envoyer le point de 16 h.</Faq>
        <Faq q="Réceptionner une livraison de carburant ?">À tout moment : sur Saisie du jour, bouton « J'ai reçu une commande » en haut de page → Réceptionner → cuve avant puis après. Le stock se met à jour seul.</Faq>
        <Faq q="Mot de passe oublié ?">Préviens la direction, elle le réinitialise.</Faq>
      </Panel>

      <Panel status="accent">
        <p style={{ font: 'var(--fw-semibold) 13px/1.5 var(--font-ui)', color: 'var(--text-primary)', textAlign: 'center', margin: 0 }}>
          Matin : stock + compteurs. 16 h : ventes + compteurs (obligatoire). Soir : dépenses + versement. Envoie à chaque fois.
        </p>
      </Panel>
    </div>
  )
}
