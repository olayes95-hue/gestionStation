import { useState } from 'react'
import { useAuth } from '../lib/auth.jsx'

export default function Login() {
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault(); setErr(''); setMsg(''); setBusy(true)
    try {
      if (mode === 'login') {
        const { error } = await signIn(email, password)
        if (error) setErr(traduire(error.message))
      } else {
        const { error } = await signUp(email, password, name)
        if (error) setErr(traduire(error.message))
        else setMsg('Compte créé. Vérifie tes emails si une confirmation est demandée, puis connecte-toi.')
      }
    } finally { setBusy(false) }
  }

  return (
    <div className="center">
      <div className="card auth-box">
        <h1 style={{ color: 'var(--primary)', marginTop: 0 }}>🛠️ Outil de gestion de station</h1>
        <p className="muted" style={{ marginTop: -8 }}>Suivi quotidien, stocks, commandes & versements</p>
        {err && <div className="err">{err}</div>}
        {msg && <div className="ok">{msg}</div>}
        <form onSubmit={submit}>
          {mode === 'signup' && (
            <>
              <label>Nom complet</label>
              <input value={name} onChange={e => setName(e.target.value)} required />
            </>
          )}
          <label>Email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
          <label>Mot de passe</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />
          <div style={{ height: 12 }} />
          <button className="btn" disabled={busy}>
            {busy ? '…' : mode === 'login' ? 'Se connecter' : 'Créer le compte'}
          </button>
        </form>
        <p className="muted" style={{ fontSize: 13, textAlign: 'center', marginTop: 14 }}>
          {mode === 'login'
            ? <>Pas de compte ? <a onClick={() => setMode('signup')} style={{ cursor: 'pointer' }}>Créer un compte</a></>
            : <>Déjà un compte ? <a onClick={() => setMode('login')} style={{ cursor: 'pointer' }}>Se connecter</a></>}
        </p>
      </div>
    </div>
  )
}

function traduire(m) {
  if (/Invalid login/i.test(m)) return 'Email ou mot de passe incorrect.'
  if (/already registered/i.test(m)) return 'Cet email a déjà un compte.'
  if (/Email not confirmed/i.test(m)) return 'Email non confirmé — vérifie ta boîte mail.'
  return m
}
