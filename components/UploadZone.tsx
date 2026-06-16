'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function UploadZone() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  function validateFile(file: File): string | null {
    if (file.type !== 'application/pdf') return 'Only PDF files are accepted';
    if (file.size > MAX_SIZE) return 'File must be under 10 MB';
    return null;
  }

  function handleFile(file: File) {
    const err = validateFile(file);
    if (err) { setError(err); return; }
    setError(null);
    setSelectedFile(file);
  }

  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
    setDragging(true);
  }

  function onDragLeave() { setDragging(false); }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  async function onUpload() {
    if (!selectedFile || uploading) return;
    setUploading(true);
    setError(null);

    // Fake progress: ease toward 90% until response arrives
    setProgress(0);
    const interval = setInterval(() => {
      setProgress((p) => {
        if (p >= 90) { clearInterval(interval); return 90; }
        return p + Math.random() * 8;
      });
    }, 200);

    try {
      const fd = new FormData();
      fd.append('file', selectedFile);
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      clearInterval(interval);

      if (!res.ok) {
        const json = await res.json().catch(() => ({ error: 'Upload failed' }));
        throw new Error((json as { error?: string }).error ?? 'Upload failed');
      }

      const data = await res.json() as { contractId: string };
      setProgress(100);
      setTimeout(() => router.push(`/review/${data.contractId}`), 300);
    } catch (err) {
      clearInterval(interval);
      setProgress(0);
      setUploading(false);
      setError(err instanceof Error ? err.message : 'Upload failed');
    }
  }

  return (
    <div className="w-full max-w-lg mx-auto">
      {/* Drop zone */}
      <div
        onClick={() => !uploading && inputRef.current?.click()}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={`
          relative flex flex-col items-center justify-center gap-3
          border-2 border-dashed rounded-xl p-10 cursor-pointer
          transition-colors duration-150
          ${dragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-gray-50 hover:border-blue-400 hover:bg-blue-50/40'}
          ${uploading ? 'pointer-events-none opacity-75' : ''}
        `}
      >
        <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>

        {selectedFile ? (
          <div className="text-center">
            <p className="font-medium text-gray-900">{selectedFile.name}</p>
            <p className="text-sm text-gray-500">{formatSize(selectedFile.size)}</p>
          </div>
        ) : (
          <div className="text-center">
            <p className="font-medium text-gray-700">Drop your contract PDF here</p>
            <p className="text-sm text-gray-500">or click to browse · PDF · max 10 MB</p>
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          onChange={onInputChange}
          className="hidden"
        />
      </div>

      {/* Progress bar */}
      {uploading && (
        <div className="mt-3 w-full bg-gray-200 rounded-full h-2 overflow-hidden">
          {/* 20 discrete cells to avoid inline styles (quality rule #7) */}
          <div className="flex h-full gap-px">
            {Array.from({ length: 20 }, (_, i) => (
              <div
                key={i}
                className={`flex-1 rounded-sm transition-colors duration-200 ${
                  progress >= (i + 1) * 5 ? 'bg-blue-500' : 'bg-transparent'
                }`}
              />
            ))}
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="mt-2 text-sm text-red-600 text-center">{error}</p>
      )}

      {/* Upload button */}
      {selectedFile && !uploading && (
        <button
          onClick={onUpload}
          className="mt-4 w-full py-3 px-6 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
        >
          Analyze Contract
        </button>
      )}
    </div>
  );
}
