import { useState } from 'react';
import { useAppStore } from '../store/appStore';
import { loadGeminiSettings, saveGeminiSettings, testGeminiConnection, DEFAULT_GEMINI_MODEL } from '../lib/gemini';

type LedState = 'idle' | 'testing' | 'success' | 'error';

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
      title={state === 'idle' ? 'Click to test connection' : state === 'testing' ? 'Testing…' : state === 'success' ? 'Connected' : 'Connection failed — click to retry'}
      className="flex items-center gap-1.5 group"
    >
      <span className={`w-2.5 h-2.5 rounded-full shrink-0 transition-colors ${colors[state]}`} />
      <span className="text-xs text-gray-400 group-hover:text-gray-600 transition-colors">
        {state === 'idle' ? 'Test' : state === 'testing' ? 'Testing…' : state === 'success' ? 'Connected' : 'Failed'}
      </span>
    </button>
  );
}

export default function SettingsView() {
  const { issues } = useAppStore();
  const saved = loadGeminiSettings();

  const [apiKey, setApiKey] = useState(saved.apiKey);
  const [model, setModel] = useState(saved.model);
  const [exampleNumbers, setExampleNumbers] = useState<number[]>(saved.exampleIssueNumbers);
  const [extraInstructions, setExtraInstructions] = useState(saved.extraInstructions);
  const [search, setSearch] = useState('');
  const [ledState, setLedState] = useState<LedState>('idle');
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

  function handleSave() {
    saveGeminiSettings({ apiKey, model, exampleIssueNumbers: exampleNumbers, extraInstructions });
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

  const filtered = issues
    .filter((i) => i.state === 'open')
    .filter((i) =>
      i.title.toLowerCase().includes(search.toLowerCase()) ||
      String(i.number).includes(search),
    );

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50">
      <div className="max-w-lg mx-auto py-8 px-4 space-y-6">
        {/* Gemini API Key */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-sm font-medium text-gray-700">Gemini API Key</label>
            <Led state={ledState} onClick={handleTest} />
          </div>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => { setApiKey(e.target.value); setLedState('idle'); }}
            placeholder="AIza…"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-400 mt-1">
            Stored in localStorage only. Used to auto-generate issue descriptions via Gemini.
          </p>
        </div>

        {/* Model */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Model</label>
          <input
            type="text"
            value={model}
            onChange={(e) => { setModel(e.target.value); setLedState('idle'); }}
            placeholder={DEFAULT_GEMINI_MODEL}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
          />
        </div>

        {/* Example Issues */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Example Issues{' '}
            <span className="text-gray-400 font-normal">(up to 3 — sent as style references)</span>
          </label>

          {exampleNumbers.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {exampleNumbers.map((num) => {
                const issue = issues.find((i) => i.number === num);
                return (
                  <span
                    key={num}
                    className="flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-full border border-blue-200"
                  >
                    #{num}{issue ? ` · ${issue.title.slice(0, 28)}…` : ''}
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
                    <span className="text-gray-400 tabular-nums shrink-0 text-xs">#{issue.number}</span>
                    <span className="truncate">{issue.title}</span>
                    {selected && <span className="ml-auto text-blue-500 shrink-0 text-xs">✓</span>}
                  </button>
                </li>
              );
            })}
            {filtered.length === 0 && (
              <li className="px-3 py-3 text-sm text-gray-400">No issues found.</li>
            )}
          </ul>
        </div>

        {/* Additional Instructions */}
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

        <div className="flex justify-end">
          <button
            onClick={handleSave}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              saved_
                ? 'bg-green-600 text-white'
                : 'bg-gray-900 text-white hover:bg-gray-700'
            }`}
          >
            {saved_ ? 'Saved!' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
