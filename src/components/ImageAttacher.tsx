import { useState, useEffect, useRef, useCallback } from 'react';
import { uploadImageToRepo } from '../lib/github';
import Spinner from './Spinner';

export interface AttachedImage {
  url: string;
  name: string;
}

interface Props {
  images: AttachedImage[];
  onAdd?: (img: AttachedImage) => void;
  onRemove?: (idx: number) => void;
  /** When true, hide all upload controls — gallery only. */
  readOnly?: boolean;
  /** Images at indices 0..lockedCount-1 have no remove button (they're from the saved body). */
  lockedCount?: number;
  owner?: string;
  repo?: string;
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function ImageAttacher({
  images, onAdd, onRemove, readOnly = false, lockedCount = 0,
  owner = '', repo = '',
}: Props) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [hoverPos, setHoverPos] = useState({ x: 0.5, y: 0.5 });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const onAddRef = useRef(onAdd);
  useEffect(() => { onAddRef.current = onAdd; }, [onAdd]);

  const handleFiles = useCallback(async (files: File[]) => {
    if (readOnly || !onAddRef.current) return;
    const imageFiles = files.filter(f => f.type.startsWith('image/'));
    if (imageFiles.length === 0) return;
    setUploading(true);
    setUploadError('');
    try {
      for (const file of imageFiles) {
        const base64 = await fileToBase64(file);
        const url = await uploadImageToRepo(owner, repo, file.name, base64);
        onAddRef.current({ url, name: file.name });
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }, [owner, repo, readOnly]);

  const handleFilesRef = useRef(handleFiles);
  useEffect(() => { handleFilesRef.current = handleFiles; }, [handleFiles]);

  useEffect(() => {
    if (readOnly) return;
    function onPaste(e: ClipboardEvent) {
      const items = Array.from(e.clipboardData?.items ?? []);
      const imageItem = items.find(item => item.kind === 'file' && item.type.startsWith('image/'));
      if (!imageItem) return;
      e.preventDefault();
      const file = imageItem.getAsFile();
      if (file) handleFilesRef.current([file]);
    }
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }, [readOnly]);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    handleFiles(Array.from(e.dataTransfer.files));
  }

  function handleThumbMove(e: React.MouseEvent<HTMLDivElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    setHoverPos({
      x: (e.clientX - r.left) / r.width,
      y: (e.clientY - r.top) / r.height,
    });
  }

  function handleUrlAdd() {
    const trimmed = urlInput.trim();
    if (!trimmed || !onAdd) return;
    const name = trimmed.split('/').pop()?.split('?')[0] ?? 'image';
    onAdd({ url: trimmed, name });
    setUrlInput('');
    setShowUrlInput(false);
  }

  const hoveredImage = hoveredIdx !== null ? images[hoveredIdx] : null;

  return (
    <div className="space-y-2">
      {/* Upload controls — hidden in readOnly mode */}
      {!readOnly && (
        <>
          <div
            className={`border-2 border-dashed rounded-lg px-3 py-2 transition-colors ${
              dragOver ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
            }`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
          >
            <div className="flex items-center justify-center gap-2 text-xs text-gray-400">
              {uploading ? (
                <span className="flex items-center gap-1.5"><Spinner className="w-3 h-3" />Uploading…</span>
              ) : (
                <>
                  <span>Drop images here or</span>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-blue-500 hover:text-blue-700 underline"
                  >
                    pick file
                  </button>
                  <span>·</span>
                  <button
                    type="button"
                    onClick={() => setShowUrlInput(v => !v)}
                    className="text-blue-500 hover:text-blue-700 underline"
                  >
                    URL
                  </button>
                  <span>· or paste</span>
                </>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => { handleFiles(Array.from(e.target.files ?? [])); e.target.value = ''; }}
            />
          </div>

          {showUrlInput && (
            <div className="flex gap-2">
              <input
                autoFocus
                type="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); handleUrlAdd(); }
                  if (e.key === 'Escape') setShowUrlInput(false);
                }}
                placeholder="https://example.com/image.png"
                className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={handleUrlAdd}
                disabled={!urlInput.trim()}
                className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40"
              >
                Add
              </button>
              <button
                type="button"
                onClick={() => setShowUrlInput(false)}
                className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100"
              >
                Cancel
              </button>
            </div>
          )}

          {uploadError && <p className="text-red-500 text-xs">{uploadError}</p>}
        </>
      )}

      {/* Gallery */}
      {images.length > 0 && (
        <div className="relative" onMouseLeave={() => setHoveredIdx(null)}>
          {/* Preview — absolute overlay, square, full width of the content area */}
          {hoveredImage && (
            <a
              href={hoveredImage.url}
              target="_blank"
              rel="noreferrer"
              className="absolute bottom-full left-0 right-0 z-30 mb-1 block aspect-square rounded-lg border border-gray-200 shadow-2xl overflow-hidden"
              style={{
                backgroundImage: `url(${hoveredImage.url})`,
                backgroundSize: '300%',
                backgroundPosition: `${hoverPos.x * 100}% ${hoverPos.y * 100}%`,
                backgroundRepeat: 'no-repeat',
              }}
            />
          )}

          {/* Thumbnail row */}
          <div className="flex flex-wrap gap-2">
            {images.map((img, idx) => {
              const removable = !readOnly && onRemove != null && idx >= lockedCount;
              return (
                <div
                  key={idx}
                  className="relative group"
                  onMouseEnter={(e) => { setHoveredIdx(idx); handleThumbMove(e); }}
                  onMouseMove={handleThumbMove}
                >
                  <a href={img.url} target="_blank" rel="noreferrer">
                    <img
                      src={img.url}
                      alt={img.name}
                      className={`w-16 h-16 object-cover rounded-lg border bg-gray-50 transition-all duration-150 ${
                        hoveredIdx === idx ? 'border-blue-400 ring-2 ring-blue-200' : 'border-gray-200'
                      }`}
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = 'none';
                        (e.currentTarget.nextElementSibling as HTMLElement | null)?.style.setProperty('display', 'flex');
                      }}
                    />
                    <div
                      style={{ display: 'none' }}
                      className="w-16 h-16 rounded-lg border border-gray-200 bg-gray-50 flex-col items-center justify-center text-center px-1"
                    >
                      <svg className="w-5 h-5 text-gray-400 mb-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span className="text-gray-400 text-[9px] leading-tight break-all line-clamp-2">{img.name}</span>
                    </div>
                  </a>
                  {removable && (
                    <button
                      type="button"
                      onClick={() => onRemove(idx)}
                      className="absolute -top-1 -right-1 w-4 h-4 bg-gray-700 text-white rounded-full text-[10px] items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity leading-none hidden group-hover:flex"
                    >
                      ×
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
