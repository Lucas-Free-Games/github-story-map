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
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 w-full max-w-md p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">GitHub Story Map</h1>
        <p className="text-gray-500 text-sm mb-6">
          Sign in with your GitHub account to manage your story map.
        </p>

        <button
          type="button"
          onClick={handleClick}
          disabled={busy}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <path d="M8 0C3.58 0 0 3.58 0 8a8 8 0 005.47 7.59c.4.07.55-.17.55-.38v-1.34c-2.23.49-2.7-1.07-2.7-1.07-.36-.92-.89-1.17-.89-1.17-.73-.5.06-.49.06-.49.8.06 1.23.83 1.23.83.72 1.23 1.88.87 2.34.67.07-.52.28-.87.5-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.22 2.2.82a7.65 7.65 0 014 0c1.54-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.28.82 2.15 0 3.07-1.87 3.74-3.65 3.94.29.25.54.74.54 1.49v2.21c0 .21.15.46.55.38A8 8 0 0016 8c0-4.42-3.58-8-8-8z" />
          </svg>
          {busy ? 'Signing in…' : 'Sign in with GitHub'}
        </button>

        {authError && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
            {authError}
          </div>
        )}

        <p className="text-xs text-gray-400 mt-6">
          We request the <code>repo</code> and <code>project</code> scopes so the app can read & write
          issues, milestones, labels, and Projects v2 fields on your behalf.
        </p>
      </div>
    </div>
  );
}
