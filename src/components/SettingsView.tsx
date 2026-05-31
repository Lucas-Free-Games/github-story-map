import { useState, useEffect } from 'react';
import { useAppStore } from '../store/appStore';
import { loadGeminiSettings, saveGeminiSettings, testGeminiConnection, DEFAULT_GEMINI_MODEL, GEMINI_MODELS } from '../lib/gemini';
import { loadAnthropicSettings, saveAnthropicSettings, testAnthropicConnection } from '../lib/anthropic';
import { loadUserProfile, saveUserProfile } from '../lib/firebase';

type Tab = 'general' | 'describing' | 'coding';
type LedState = 'idle' | 'testing' | 'success' | 'error';

const TABS: { key: Tab; label: string }[] = [
  { key: 'general', label: 'General' },
  { key: 'describing', label: 'Describing' },
  { key: 'coding', label: 'Coding' },
];

function Led({ state, onClick }: { state: LedState; onClick: () => void }) {
  const colors: Record<LedState, string> = {
    idle: 'bg-gray-300',
    testing: 'bg-green-400 animate-pulse',
    success: 'bg-green-500',
    error: 'bg-red-500',
  };
  return (
    <button
      type="button"
      onClick={onClick}
      title={
        state === 'idle'
          ? 'Click to test connection'
          : state === 'testing'
          ? 'Testing…'
          : state === 'success'
          ? 'Connected'
          : 'Connection failed — click to retry'
      }
      className="flex items-center gap-1.5 group"
    >
      <span className={`w-2.5 h-2.5 rounded-full shrink-0 transition-colors ${colors[state]}`} />
      <span className="text-xs text-gray-400 group-hover:text-gray-600 transition-colors">
        {state === 'idle'
          ? 'Test'
          : state === 'testing'
          ? 'Testing…'
          : state === 'success'
          ? 'Connected'
          : 'Failed'}
      </span>
    </button>
  );
}

export default function SettingsView() {
  const {
    token,
    owner,
    repo,
    issues,
    setCredentials,
    fetchIssues,
    fetchLabels,
    fetchProjects,
    fetchMilestones,
    fetchAllProjectStatuses,
  } = useAppStore();

  const [activeTab, setActiveTab] = useState<Tab>('general');

  // General tab state
  const [ghToken, setGhToken] = useState(token);
  const [ghOwner, setGhOwner] = useState(owner);
  const [ghRepo, setGhRepo] = useState(repo);

  // User details state
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [signupDate, setSignupDate] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    loadUserProfile().then((profile) => {
      if (!profile) return;
      if (profile.address) setAddress(profile.address);
      if (profile.phone) setPhone(profile.phone);
      if (profile.signupDate) setSignupDate(profile.signupDate);
      if (profile.dateOfBirth) setDateOfBirth(profile.dateOfBirth);
      if (profile.notes) setNotes(profile.notes);
    }).catch(() => {});
  }, []);

  const calculatedAge = (() => {
    if (!dateOfBirth) return null;
    const today = new Date();
    const dob = new Date(dateOfBirth);
    let age = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
    return age >= 0 ? age : null;
  })();

  // Describing tab state
  const savedGemini = loadGeminiSettings();
  const [apiKey, setApiKey] = useState(savedGemini.apiKey);
  const [model, setModel] = useState(savedGemini.model || DEFAULT_GEMINI_MODEL);
  const [exampleNumbers, setExampleNumbers] = useState<number[]>(savedGemini.exampleIssueNumbers);
  const [extraInstructions, setExtraInstructions] = useState(savedGemini.extraInstructions);
  const [search, setSearch] = useState('');
  const [ledState, setLedState] = useState<LedState>('idle');

  // Coding tab state
  const savedAnthropic = loadAnthropicSettings();
  const [anthropicKey, setAnthropicKey] = useState(savedAnthropic.apiKey);
  const [agentId, setAgentId] = useState(savedAnthropic.agentId);
  const [envId, setEnvId] = useState(savedAnthropic.envId);
  const [vaultId, setVaultId] = useState(savedAnthropic.vaultId);
  const [anthropicLedState, setAnthropicLedState] = useState<LedState>('idle');
  const [anthropicError, setAnthropicError] = useState<string | null>(null);

  const [saved_, setSaved_] = useState(false);

  async function handleTest() {
    if (!apiKey.trim()) return;
    saveGeminiSettings({ apiKey, model, exampleIssueNumbers: exampleNumbers, extraInstructions });
    setLedState('testing');
    try {
      await testGeminiConnection();
      setLedState('success');
    } catch {
      setLedState('error');
    }
  }

  async function handleAnthropicTest() {
    if (!anthropicKey.trim()) return;
    setAnthropicLedState('testing');
    setAnthropicError(null);
    try {
      await testAnthropicConnection(anthropicKey.trim());
      setAnthropicLedState('success');
    } catch (e) {
      setAnthropicLedState('error');
      setAnthropicError(e instanceof Error ? e.message : 'Unknown error');
    }
  }

  function handleSave() {
    if (activeTab === 'general') {
      const credentialsChanged = ghToken !== token || ghOwner !== owner || ghRepo !== repo;
      if (credentialsChanged) {
        setCredentials(ghToken.trim(), ghOwner.trim(), ghRepo.trim());
        fetchIssues();
        fetchLabels();
        fetchProjects().then(() => fetchAllProjectStatuses());
        fetchMilestones();
      }
      saveUserProfile({
        address: address.trim() || undefined,
        phone: phone.trim() || undefined,
        signupDate: signupDate || undefined,
        dateOfBirth: dateOfBirth || undefined,
        age: calculatedAge ?? undefined,
        notes: notes.trim() || undefined,
      }).catch(() => {});
    } else if (activeTab === 'describing') {
      saveGeminiSettings({ apiKey, model, exampleIssueNumbers: exampleNumbers, extraInstructions });
    } else if (activeTab === 'coding') {
      saveAnthropicSettings({ apiKey: anthropicKey, agentId, envId, vaultId });
    }
    setSaved_(true);
    setTimeout(() => setSaved_(false), 2000);
  }

  function toggleExample(num: number) {
    setExampleNumbers((prev) => {
      if (prev.includes(num)) return prev.filter((n) => n !== num);
      if (prev.length >= 3) return prev;
      return [...prev, num];
    });
  }

  const filtered = issues.filter(
    (i) =>
      i.title.toLowerCase().includes(search.toLowerCase()) || String(i.number).includes(search),
  );

  return (
    <div className="flex-1 overflow-hidden flex">
      {/* Sidebar */}
      <nav className="w-48 border-r border-gray-200 bg-white py-6 px-3 shrink-0 flex flex-col gap-1">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === key
                ? 'bg-gray-100 text-gray-900'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            {label}
          </button>
        ))}
      </nav>

      {/* Content */}
      <div className="flex-1 overflow-y-auto bg-gray-50">
        <div className="max-w-lg mx-auto py-8 px-4 space-y-6">
          {/* General Tab */}
          {activeTab === 'general' && (
            <>
              <div>
                <h2 className="text-base font-semibold text-gray-900 mb-4">GitHub Connection</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Personal Access Token
                    </label>
                    <input
                      type="password"
                      value={ghToken}
                      onChange={(e) => setGhToken(e.target.value)}
                      placeholder="ghp_…"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      Classic PAT with <code>repo</code> and <code>project</code> scopes. Stored in
                      localStorage only.
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Owner</label>
                    <input
                      type="text"
                      value={ghOwner}
                      onChange={(e) => setGhOwner(e.target.value)}
                      placeholder="github-username-or-org"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Repository</label>
                    <input
                      type="text"
                      value={ghRepo}
                      onChange={(e) => setGhRepo(e.target.value)}
                      placeholder="repo-name"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-200 pt-6">
                <h2 className="text-base font-semibold text-gray-900 mb-2">Firestore Sync</h2>
                <p className="text-sm text-gray-500">
                  Layout data (user activity order, wave order, story positions) is automatically synced to
                  Firestore when available. No configuration required.
                </p>
              </div>

              <div className="border-t border-gray-200 pt-6">
                <h2 className="text-base font-semibold text-gray-900 mb-4">User Details</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                    <input
                      type="text"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="123 Main St, City, Country"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+1 555 000 0000"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Signup Date</label>
                      <input
                        type="date"
                        value={signupDate}
                        onChange={(e) => setSignupDate(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
                      <input
                        type="date"
                        value={dateOfBirth}
                        onChange={(e) => setDateOfBirth(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="w-24">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Age</label>
                      <div className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-500 h-[38px] flex items-center">
                        {calculatedAge !== null ? calculatedAge : '—'}
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={3}
                      placeholder="Any additional notes…"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    />
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Describing Tab */}
          {activeTab === 'describing' && (
            <>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-gray-700">Gemini API Key</label>
                  <Led state={ledState} onClick={handleTest} />
                </div>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => {
                    setApiKey(e.target.value);
                    setLedState('idle');
                  }}
                  placeholder="AIza…"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Stored in localStorage only. Used to auto-generate issue descriptions via Gemini.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Default Model</label>
                <select
                  value={model}
                  onChange={(e) => {
                    setModel(e.target.value);
                    setLedState('idle');
                  }}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white font-mono"
                >
                  {GEMINI_MODELS.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-400 mt-1">
                  The default model used for AI generation. Can be overridden per-request in the issue modal.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Example Issues{' '}
                  <span className="text-gray-400 font-normal">(up to 3 — sent as style references)</span>
                </label>

                {exampleNumbers.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {exampleNumbers.map((num) => {
                      const issue = issues.find((i) => i.number === num);
                      const isClosed = issue?.state === 'closed';
                      return (
                        <span
                          key={num}
                          className="flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-full border border-blue-200"
                        >
                          {isClosed && (
                            <svg className="w-3 h-3 text-purple-600 shrink-0" viewBox="0 0 16 16" fill="currentColor" aria-label="Closed">
                              <path d="M11.28 6.78a.75.75 0 0 0-1.06-1.06L7.25 8.69 5.78 7.22a.75.75 0 0 0-1.06 1.06l2 2a.75.75 0 0 0 1.06 0l3.5-3.5Z"/>
                              <path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0Zm-1.5 0a6.5 6.5 0 1 0-13 0 6.5 6.5 0 0 0 13 0Z"/>
                            </svg>
                          )}
                          #{num}
                          {issue ? ` · ${issue.title.slice(0, 28)}…` : ''}
                          <button
                            onClick={() => toggleExample(num)}
                            className="hover:text-red-500 leading-none ml-0.5"
                          >
                            ×
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}

                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search issues…"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-1"
                />

                <ul className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-44 overflow-y-auto bg-white">
                  {filtered.slice(0, 50).map((issue) => {
                    const selected = exampleNumbers.includes(issue.number);
                    const disabled = !selected && exampleNumbers.length >= 3;
                    const isClosed = issue.state === 'closed';
                    return (
                      <li key={issue.number}>
                        <button
                          onClick={() => !disabled && toggleExample(issue.number)}
                          disabled={disabled}
                          className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors ${
                            selected
                              ? 'bg-blue-50 text-blue-700'
                              : disabled
                              ? 'opacity-40 cursor-not-allowed text-gray-700'
                              : 'hover:bg-gray-50 text-gray-700'
                          }`}
                        >
                          {isClosed ? (
                            <svg className="w-3.5 h-3.5 text-purple-600 shrink-0" viewBox="0 0 16 16" fill="currentColor" aria-label="Closed">
                              <path d="M11.28 6.78a.75.75 0 0 0-1.06-1.06L7.25 8.69 5.78 7.22a.75.75 0 0 0-1.06 1.06l2 2a.75.75 0 0 0 1.06 0l3.5-3.5Z"/>
                              <path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0Zm-1.5 0a6.5 6.5 0 1 0-13 0 6.5 6.5 0 0 0 13 0Z"/>
                            </svg>
                          ) : (
                            <svg className="w-3.5 h-3.5 text-green-600 shrink-0" viewBox="0 0 16 16" fill="currentColor" aria-label="Open">
                              <path d="M8 9.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z"/>
                              <path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Z"/>
                            </svg>
                          )}
                          <span className="text-gray-400 tabular-nums shrink-0 text-xs">
                            #{issue.number}
                          </span>
                          <span className="truncate">{issue.title}</span>
                          {selected && (
                            <span className="ml-auto text-blue-500 shrink-0 text-xs">✓</span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                  {filtered.length === 0 && (
                    <li className="px-3 py-3 text-sm text-gray-400">No issues found.</li>
                  )}
                </ul>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Additional Instructions
                </label>
                <textarea
                  value={extraInstructions}
                  onChange={(e) => setExtraInstructions(e.target.value)}
                  rows={3}
                  placeholder="e.g. Always write in Portuguese. Keep acceptance criteria concise."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
            </>
          )}

          {/* Coding Tab */}
          {activeTab === 'coding' && (
            <>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-base font-semibold text-gray-900">Code with AI</span>
                <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">
                  beta
                </span>
              </div>
              <p className="text-xs text-gray-400 -mt-2">
                Triggers a Claude Managed Agent session to implement an issue — creating a branch,
                writing code, and opening a PR. Requires a pre-configured agent with GitHub MCP access.
              </p>

              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-medium text-gray-700">
                      Anthropic API Key
                    </label>
                    <Led state={anthropicLedState} onClick={handleAnthropicTest} />
                  </div>
                  <input
                    type="password"
                    value={anthropicKey}
                    onChange={(e) => { setAnthropicKey(e.target.value); setAnthropicLedState('idle'); setAnthropicError(null); }}
                    placeholder="sk-ant-…"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 font-mono"
                  />
                  {anthropicError && (
                    <p className="text-xs text-red-600 mt-1 break-words">{anthropicError}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Agent ID</label>
                  <input
                    type="text"
                    value={agentId}
                    onChange={(e) => setAgentId(e.target.value)}
                    placeholder="agent_…"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Environment ID
                  </label>
                  <input
                    type="text"
                    value={envId}
                    onChange={(e) => setEnvId(e.target.value)}
                    placeholder="env_…"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Vault ID</label>
                  <input
                    type="text"
                    value={vaultId}
                    onChange={(e) => setVaultId(e.target.value)}
                    placeholder="vlt_…"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 font-mono"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    The vault holds your GitHub OAuth token — the agent uses it automatically via
                    GitHub MCP.
                  </p>
                </div>
              </div>
            </>
          )}

          <div className="flex justify-end pt-2">
            <button
              onClick={handleSave}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                saved_ ? 'bg-green-600 text-white' : 'bg-gray-900 text-white hover:bg-gray-700'
              }`}
            >
              {saved_ ? 'Saved!' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
