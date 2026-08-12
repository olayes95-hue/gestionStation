import { useState } from 'react'
import { useAuth } from '../lib/auth.jsx'
import { Viewport } from '../ds/octane/components/core/Viewport.jsx'
import { Panel } from '../ds/octane/components/core/Panel.jsx'
import { Button } from '../ds/octane/components/core/Button.jsx'
import { Icon } from '../ds/octane/components/core/Icon.jsx'
import { Field } from '../ds/octane/components/forms/Field.jsx'
import { Input } from '../ds/octane/components/forms/Input.jsx'
import { AlertBanner } from '../ds/octane/components/feedback/AlertBanner.jsx'

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
    <Viewport>
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--sp-6)', background: 'var(--bg-canvas)' }}>
        <div style={{ maxWidth: 400, width: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--sp-5)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-4)' }}>
            <span style={{ width: 36, height: 36, borderRadius: 'var(--radius-1)', background: 'var(--accent-quiet)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}>
              <Icon name="factory" size={18} />
            </span>
            <div>
              <h1 style={{ font: 'var(--fw-semibold) 16px/1.2 var(--font-ui)', color: 'var(--text-primary)', margin: 0 }}>Outil de gestion de station</h1>
              <p style={{ font: '400 12px/1.3 var(--font-ui)', color: 'var(--text-muted)', margin: 'var(--sp-2) 0 0' }}>Suivi quotidien, stocks, commandes &amp; versements</p>
            </div>
          </div>

          {err && <AlertBanner tone="alarm" title="Erreur">{err}</AlertBanner>}
          {msg && <AlertBanner tone="ok" title="Succès">{msg}</AlertBanner>}

          <Panel>
            <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
              {mode === 'signup' && (
                <Field label="Nom complet" required>
                  <Input value={name} onChange={e => setName(e.target.value)} required />
                </Field>
              )}
              <Field label="Email" required>
                <Input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
              </Field>
              <Field label="Mot de passe" required>
                <Input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />
              </Field>
              <Button type="submit" tone="primary" block disabled={busy}>
                {busy ? '…' : mode === 'login' ? 'Se connecter' : 'Créer le compte'}
              </Button>
            </form>
          </Panel>

          <p style={{ font: '400 12px/1.3 var(--font-ui)', color: 'var(--text-muted)', textAlign: 'center', margin: 0 }}>
            {mode === 'login'
              ? <>Pas de compte ? <a onClick={() => setMode('signup')} style={{ cursor: 'pointer', color: 'var(--accent)' }}>Créer un compte</a></>
              : <>Déjà un compte ? <a onClick={() => setMode('login')} style={{ cursor: 'pointer', color: 'var(--accent)' }}>Se connecter</a></>}
          </p>
        </div>
      </div>
    </Viewport>
  )
}

function traduire(m) {
  if (/Invalid login/i.test(m)) return 'Email ou mot de passe incorrect.'
  if (/already registered/i.test(m)) return 'Cet email a déjà un compte.'
  if (/Email not confirmed/i.test(m)) return 'Email non confirmé — vérifie ta boîte mail.'
  return m
}
