import { useState } from 'react';
import { useAppStore } from '../store/appStore';
import { loadGeminiSettings, saveGeminiSettings } from '../lib/gemini';

interface Props {
  onClose: () => void;
}

export default function SettingsModal({ onClose }: Props) {
  const { issues } = useAppStore();
  const saved = loadGeminiSettings();

  const [apiKey, setApiKey] = useState(saved.apiKey);
  const [exampleNumbers, setExampleNumbers] = useState<number[]>(saved.exampleIssueNumbers);
  const [extraInstructions, setExtraInstructions] = useState(saved.extraInstructions);
  const [search, setSearch] = useState('');

  function handleSave() {
    saveGeminiSettings({ apiKey, exampleIssueNumbers: exampleNumbers, extraInstructions });
    onClose();
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
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100 shrink-0">
          <h2 className="font-semibold text-gray-900">Settings</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-6">

          {/* Gemini API Key */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Gemini API Key
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="AIza…"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-400 mt-1">
              Stored in localStorage only. Used to auto-generate issue descriptions via Gemini.
            </p>
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

            <ul className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-44 overflow-y-auto">
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
        </div>

        <div className="px-6 py-4 border-t border-gray-100 shrink-0 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-sm font-medium bg-gray-900 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
