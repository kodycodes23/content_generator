"use client";

import { useEffect, useState } from "react";
import { ImageOff, Loader2, Search, X } from "lucide-react";
import { logClientError } from "@/lib/log-client-error";

interface ImageResult {
  id: string;
  url: string;
  thumb_url: string;
  photographer_name: string;
  unsplash_page_url: string;
}

export function ImageSearchPanel({
  requestId,
  initialQuery,
  onClose,
  onSelected,
}: {
  requestId: string;
  initialQuery: string;
  onClose: () => void;
  onSelected: (url: string) => void;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [searching, setSearching] = useState(false);
  const [searchedFor, setSearchedFor] = useState<string | null>(null);
  const [results, setResults] = useState<ImageResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectingId, setSelectingId] = useState<string | null>(null);

  // `auto` (only on first mount) omits the query entirely, so the server picks its own
  // default (topic/title) and runs its fallback chain if that comes up empty. Any explicit
  // search from here on — the user hitting the Search button — sends exactly what's typed,
  // with no fallback logic applied server-side.
  async function runSearch(auto: boolean) {
    setSearching(true);
    setError(null);
    try {
      const res = await fetch(`/api/content-requests/${requestId}/search-images`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(auto ? {} : { query }),
      });
      const data = await res.json();
      if (!res.ok) {
        const message = data.error ?? "Could not search for images.";
        setError(message);
        logClientError("action_failed", new Error(message), {
          path: `/api/content-requests/${requestId}/search-images`,
          status: res.status,
        });
        setSearching(false);
        return;
      }
      setResults(data.results ?? []);
      setSearchedFor(data.query ?? query);
      setSearching(false);
    } catch (err) {
      setError("Could not reach the server.");
      logClientError("action_failed", err, { path: `/api/content-requests/${requestId}/search-images` });
      setSearching(false);
    }
  }

  useEffect(() => {
    // Deferred to a microtask — runSearch's first line sets state, and calling that
    // synchronously within the effect body itself isn't allowed.
    void Promise.resolve().then(() => runSearch(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function selectImage(result: ImageResult) {
    setSelectingId(result.id);
    setError(null);
    try {
      const res = await fetch(`/api/content-requests/${requestId}/set-image`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ featured_image_url: result.url }),
      });
      const data = await res.json();
      if (!res.ok) {
        const message = data.error ?? "Could not set this image.";
        setError(message);
        logClientError("action_failed", new Error(message), {
          path: `/api/content-requests/${requestId}/set-image`,
          status: res.status,
        });
        setSelectingId(null);
        return;
      }
      onSelected(result.url);
    } catch (err) {
      setError("Could not reach the server.");
      logClientError("action_failed", err, { path: `/api/content-requests/${requestId}/set-image` });
      setSelectingId(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl border border-slate-200 bg-white p-4 shadow-xl scrollbar-thin"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900">Change featured image</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") runSearch(false);
            }}
            placeholder="Search Unsplash photos"
            className="flex-1 rounded-md border border-slate-200 px-3 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none"
          />
          <button
            type="button"
            disabled={searching || !query.trim()}
            onClick={() => runSearch(false)}
            className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {searching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
            Search
          </button>
        </div>

        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

        <div className="mt-3">
          {searching ? (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-xs text-slate-400">
              <Loader2 className="h-5 w-5 animate-spin" />
              Searching…
            </div>
          ) : searchedFor === null ? (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-center text-xs text-slate-400">
              <Search className="h-5 w-5" />
              Search for a photo to get started.
            </div>
          ) : results.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-center text-xs text-slate-400">
              <ImageOff className="h-5 w-5" />
              No results for &quot;{searchedFor}&quot; — try a different search.
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {results.map((result) => (
                <button
                  key={result.id}
                  type="button"
                  disabled={selectingId !== null}
                  onClick={() => selectImage(result)}
                  className="group relative aspect-square overflow-hidden rounded-md border border-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={result.thumb_url}
                    alt=""
                    className="h-full w-full object-cover transition-transform group-hover:scale-105"
                  />
                  {selectingId === result.id && (
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-900/50">
                      <Loader2 className="h-4 w-4 animate-spin text-white" />
                    </div>
                  )}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-900/80 to-transparent px-1.5 py-1">
                    <p className="truncate text-[9px] text-white">Photo by {result.photographer_name}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
