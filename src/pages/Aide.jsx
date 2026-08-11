export default function Aide() {
  return (
    <div>
      <div className="card">
        <h2>❓ Comment utiliser l'application</h2>
        <p className="hint">3 moments dans la journée. On ne t'affiche que ce qu'il faut remplir. Envoie à chaque fois.</p>
      </div>

      <div className="card">
        <div className="step-head"><div className="step-num">🌅</div><h2>Matin (8h) — le stock</h2></div>
        <ul style={{ lineHeight: 1.9, fontSize: 14, margin: 0, paddingLeft: 18 }}>
          <li><b>Stock en cuve</b> : litres d'essence et de gasoil restants.</li>
          <li><b>Relevés compteurs à l'ouverture</b> : l'index de chaque pompe <b>+ la photo</b> (bouton 📷).</li>
          <li><b>Bouteilles de gaz</b> (boutons − / +) et <b>lubrifiants</b>.</li>
          <li>Appuie sur <b>✅ Envoyer (Matin)</b>.</li>
        </ul>
      </div>

      <div className="card">
        <div className="step-head"><div className="step-num">🕓</div><h2>16 h — ventes & compteurs</h2></div>
        <ul style={{ lineHeight: 1.9, fontSize: 14, margin: 0, paddingLeft: 18 }}>
          <li><b>Ventes carburant de la veille</b> : litres, puis sépare <b>Bon</b> / <b>Espèces</b>.</li>
          <li><b>Relevés 16 h</b> : index de chaque pompe <b>+ photo</b>. ⚠️ <b>Obligatoire</b> pour envoyer.</li>
          <li><b>Gaz vendu</b> et recettes espèces des autres pôles.</li>
        </ul>
      </div>

      <div className="card">
        <div className="step-head"><div className="step-num">🌙</div><h2>Soir — clôture</h2></div>
        <ul style={{ lineHeight: 1.9, fontSize: 14, margin: 0, paddingLeft: 18 }}>
          <li><b>Réception carburant</b> : si une commande arrive, <b>Réceptionner</b> → cuve avant / après.</li>
          <li><b>Achats hors carburant</b> (gaz, lubrifiant, supérette) + fournisseur.</li>
          <li><b>Dépenses</b> : montant + motif + <b>coche « J'ai le justificatif »</b> (obligatoire).</li>
          <li><b>Versement banque</b> : montant + <b>photo du bordereau</b> (obligatoire).</li>
          <li>Vérifie <b>À verser / Versé / Écart</b> puis <b>✅ Envoyer (Soir)</b>.</li>
        </ul>
      </div>

      <div className="card" style={{ background: 'var(--warn-soft)', borderColor: '#f4d9a8' }}>
        <h2>⚠️ À retenir</h2>
        <ul style={{ lineHeight: 1.9, fontSize: 14, margin: 0, paddingLeft: 18 }}>
          <li><b>Photos obligatoires</b> (l'envoi est bloqué sans elles) :
            <ul style={{ marginTop: 4 }}>
              <li>📷 <b>Chaque compteur</b> (matin + 16 h)</li>
              <li>📷 <b>Chaque dépense</b> (le justificatif)</li>
              <li>📷 <b>Chaque versement</b> (le bordereau)</li>
              <li>📷 <b>Chaque réception</b> carburant (bon / jauge)</li>
            </ul></li>
          <li>Relevés <b>16 h</b> : les 8 index sont obligatoires.</li>
          <li>Tu corriges <b>aujourd'hui et hier</b> ; au-delà, c'est la direction.</li>
          <li>Rien envoyé à <b>8 h</b> ou <b>17 h</b> ? Une alerte part à toi et à la direction.</li>
        </ul>
      </div>

      <div className="card">
        <h2>Questions fréquentes</h2>
        <details style={{ marginBottom: 8 }}><summary style={{ fontWeight: 600, cursor: 'pointer' }}>Je me suis trompé sur un chiffre ?</summary>
          <p className="hint">Rouvre la même date, corrige et ré-envoie (possible aujourd'hui et hier).</p></details>
        <details style={{ marginBottom: 8 }}><summary style={{ fontWeight: 600, cursor: 'pointer' }}>« Journée verrouillée »</summary>
          <p className="hint">La journée a plus de 2 jours : demande à la direction de la corriger.</p></details>
        <details style={{ marginBottom: 8 }}><summary style={{ fontWeight: 600, cursor: 'pointer' }}>« Relevés 16 h obligatoires »</summary>
          <p className="hint">Remplis les 8 index (E1→E4, G1→G4) avant d'envoyer le point de 16 h.</p></details>
        <details style={{ marginBottom: 8 }}><summary style={{ fontWeight: 600, cursor: 'pointer' }}>Réceptionner une livraison de carburant ?</summary>
          <p className="hint">Soir → bloc Réception carburant → Réceptionner → cuve avant puis après. Le stock se met à jour seul.</p></details>
        <details><summary style={{ fontWeight: 600, cursor: 'pointer' }}>Mot de passe oublié ?</summary>
          <p className="hint">Préviens la direction, elle le réinitialise.</p></details>
      </div>

      <div className="card" style={{ textAlign: 'center', background: 'var(--primary-soft)' }}>
        <b>Matin : stock + compteurs. 16 h : ventes + compteurs (obligatoire). Soir : dépenses + versement. Envoie à chaque fois.</b>
      </div>
    </div>
  )
}
