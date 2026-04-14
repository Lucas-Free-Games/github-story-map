import { useState } from 'react';
import { useAppStore } from '../store/appStore';

interface Props {
  onClose: () => void;
}

function LabelSection({
  title,
  prefix,
  color,
  items,
  onAdd,
}: {
  title: string;
  prefix: string;
  color: string;
  items: string[];
  onAdd: (name: string) => Promise<void>;
}) {
  const [input, setInput] = useState('');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');

  async function handleAdd() {
    const name = input.trim();
    if (!name) return;
    if (items.includes(name)) { setError('Already exists'); return; }
    setAdding(true);
    setError('');
    try {
      await onAdd(name);
      setInput('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create');
    } finally {
      setAdding(false);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <span
          className="px-2 py-0.5 rounded text-xs font-medium"
          style={{ backgroundColor: `${color}28`, color, border: `1px solid ${color}50` }}
        >
          {prefix}…
        </span>
        <h3 className="font-semibold text-gray-800 text-sm">{title}</h3>
      </div>

      {/* Existing items */}
      <div className="flex flex-wrap gap-2 mb-3 min-h-8">
        {items.length === 0 && (
          <span className="text-xs text-gray-400 italic">No {title.toLowerCase()}s yet</span>
        )}
        {items.map((item) => (
          <span
            key={item}
            className="px-2.5 py-1 rounded-full text-xs font-medium"
            style={{ backgroundColor: `${color}18`, color, border: `1px solid ${color}40` }}
          >
            {item}
          </span>
        ))}
      </div>

      {/* Add new */}
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => { setInput(e.target.value); setError(''); }}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder={`New ${title.toLowerCase()}…`}
          className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={handleAdd}
          disabled={adding || !input.trim()}
          className="px-3 py-1.5 text-sm font-medium bg-gray-900 text-white rounded-lg hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {adding ? '…' : 'Add'}
        </button>
      </div>
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
      {input.trim() && !error && (
        <p className="text-xs text-gray-400 mt-1">
          Will create label <span className="font-mono">{prefix}{input.trim()}</span> on GitHub
        </p>
      )}
    </div>
  );
}

export default function LabelsManagerModal({ onClose }: Props) {
  const { statusLabels, addStatusLabel } = useAppStore();

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Manage Statuses</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="px-6 py-5">
          <LabelSection
            title="Statuses"
            prefix="s_"
            color="#0e8a16"
            items={statusLabels}
            onAdd={addStatusLabel}
          />
        </div>

        <div className="px-6 pb-5 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
