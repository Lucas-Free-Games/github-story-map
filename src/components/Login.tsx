import { useState } from 'react';
import { useAppStore } from '../store/appStore';

export default function Login() {
  const { signInWithGithub, authError, clearAuthError } = useAppStore();
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    setBusy(true);
    clearAuthError();
    try {
      await signInWithGithub();
    } catch {
      // store already captured authError
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--n-sidebar)' }}>
      <div
        className="w-full max-w-sm p-8 rounded-xl"
        style={{ background: 'var(--n-bg)', border: '1px solid var(--n-border)', boxShadow: 'var(--n-shadow-lg)' }}
      >
        {/* Logo mark */}
        <div className="mb-6 flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm"
            style={{ background: 'var(--n-blue)' }}
          >
            G
          </div>
          <div>
            <h1 className="text-base font-semibold" style={{ color: 'var(--n-text)' }}>
              GitHub Story Map
            </h1>
            <p className="text-xs" style={{ color: 'var(--n-text-3)' }}>
              Issue planning, your way
            </p>
          </div>
        </div>

        <p className="text-sm mb-6" style={{ color: 'var(--n-text-2)' }}>
          Sign in with GitHub to get started.
        </p>

        <button
          type="button"
          onClick={handleClick}
          disabled={busy}
          className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-md text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ background: 'var(--n-text)', color: '#fff' }}
          onMouseEnter={(e) => { if (!busy) e.currentTarget.style.opacity = '0.88'; }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
        >
          <svg className="w-4 h-4 shrink-0" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <path d="M8 0C3.58 0 0 3.58 0 8a8 8 0 005.47 7.59c.4.07.55-.17.55-.38v-1.34c-2.23.49-2.7-1.07-2.7-1.07-.36-.92-.89-1.17-.89-1.17-.73-.5.06-.49.06-.49.8.06 1.23.83 1.23.83.72 1.23 1.88.87 2.34.67.07-.52.28-.87.5-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.22 2.2.82a7.65 7.65 0 014 0c1.54-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.28.82 2.15 0 3.07-1.87 3.74-3.65 3.94.29.25.54.74.54 1.49v2.21c0 .21.15.46.55.38A8 8 0 0016 8c0-4.42-3.58-8-8-8z" />
          </svg>
          {busy ? 'Signing in…' : 'Continue with GitHub'}
        </button>

        {authError && (
          <div
            className="mt-4 px-3 py-2.5 rounded-md text-xs"
            style={{ background: '#FFF2F2', border: '1px solid #FFD5D5', color: '#E03E3E' }}
          >
            {authError}
          </div>
        )}

        <p className="text-xs mt-6" style={{ color: 'var(--n-text-3)' }}>
          Requests <code style={{ fontFamily: 'monospace' }}>repo</code> and{' '}
          <code style={{ fontFamily: 'monospace' }}>project</code> scopes to read and write
          issues, milestones, labels, and Projects v2 fields.
        </p>
      </div>
    </div>
  );
}
