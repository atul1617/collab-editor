'use client';


import { useState, useRef } from 'react';
import { X, Sparkles, FileText, RefreshCw, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AISidebarProps {
  getContent: () => string;      
  getSelection: () => string;     
  onInsert: (text: string) => void; 
}

type Mode = 'summarize' | 'rewrite';
type Tone = 'formal' | 'casual' | 'concise' | 'detailed';

export function AISidebar({ getContent, getSelection, onInsert }: AISidebarProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>('summarize');
  const [tone, setTone] = useState<Tone>('formal');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  const streamResponse = async (url: string, body: object) => {
   
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setLoading(true);
    setResult('');
    setError('');

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? 'Something went wrong');
        setLoading(false);
        return;
      }

       const reader = res.body!.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        setResult((prev) => prev + decoder.decode(value));
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setError('Request failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSummarize = () => {
    const content = getContent();
    if (!content.trim()) {
      setError('Document is empty.');
      return;
    }
    streamResponse('/api/ai/summarize', { content });
  };

  const handleRewrite = () => {
    const text = getSelection() || getContent();
    if (!text.trim()) {
      setError('Nothing to rewrite. Select some text or write something first.');
      return;
    }
    streamResponse('/api/ai/rewrite', { text, tone });
  };

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const insertIntoEditor = () => {
    onInsert(result);
    setOpen(false);
  };

  return (
    <>
     <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-sm text-purple-600 hover:text-purple-800 transition-colors px-2 py-1 rounded hover:bg-purple-50"
      >
        <Sparkles className="h-4 w-4" />
        AI
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex">
          <div
            className="flex-1 bg-black/20"
            onClick={() => setOpen(false)}
          />

           <div className="w-96 bg-white h-full shadow-xl flex flex-col">
            <div className="flex items-center justify-between px-4 py-4 border-b border-gray-200">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-purple-500" />
                AI Assistant
              </h2>
              <button
                onClick={() => setOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex border-b border-gray-200">
              {(['summarize', 'rewrite'] as Mode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => { setMode(m); setResult(''); setError(''); }}
                  className={`flex-1 py-2.5 text-sm font-medium capitalize transition-colors ${
                    mode === m
                      ? 'border-b-2 border-purple-600 text-purple-600'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {m === 'summarize' ? (
                    <span className="flex items-center justify-center gap-1.5">
                      <FileText className="h-3.5 w-3.5" /> Summarize
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-1.5">
                      <RefreshCw className="h-3.5 w-3.5" /> Rewrite
                    </span>
                  )}
                </button>
              ))}
            </div>

            <div className="px-4 py-4 border-b border-gray-100">
              {mode === 'summarize' ? (
                <div>
                  <p className="text-sm text-gray-500 mb-3">
                    Generate a structured summary of your entire document.
                  </p>
                  <Button
                    onClick={handleSummarize}
                    disabled={loading}
                    className="w-full"
                  >
                    <Sparkles className="h-4 w-4 mr-2" />
                    {loading ? 'Summarizing…' : 'Summarize Document'}
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <p className="text-sm text-gray-500">
                    Select text in the editor to rewrite it, or rewrites the whole document.
                  </p>
                  {/* Tone selector */}
                  <div>
                    <label className="text-xs font-medium text-gray-700 mb-1.5 block">
                      Tone
                    </label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {(['formal', 'casual', 'concise', 'detailed'] as Tone[]).map((t) => (
                        <button
                          key={t}
                          onClick={() => setTone(t)}
                          className={`py-1.5 text-xs rounded-lg capitalize font-medium border transition-colors ${
                            tone === t
                              ? 'bg-purple-600 text-white border-purple-600'
                              : 'border-gray-200 text-gray-600 hover:border-gray-400'
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                  <Button
                    onClick={handleRewrite}
                    disabled={loading}
                    className="w-full"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    {loading ? 'Rewriting…' : 'Rewrite'}
                  </Button>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4">
              {error && (
                <div className="bg-red-50 text-red-600 text-sm px-3 py-2 rounded-lg mb-3">
                  {error}
                </div>
              )}

              {result && (
                <div className="flex flex-col gap-3">
                 <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                    {result}
                    {loading && (
                      <span className="inline-block w-0.5 h-4 bg-gray-600 ml-0.5 animate-pulse" />
                    )}
                  </div>

                  {!loading && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={copyToClipboard}
                        className="flex-1"
                      >
                        {copied ? (
                          <><Check className="h-3.5 w-3.5 mr-1.5 text-green-500" /> Copied</>
                        ) : (
                          <><Copy className="h-3.5 w-3.5 mr-1.5" /> Copy</>
                        )}
                      </Button>
                      {mode === 'rewrite' && (
                        <Button
                          size="sm"
                          onClick={insertIntoEditor}
                          className="flex-1"
                        >
                          Insert into doc
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {!result && !error && !loading && (
                <div className="flex flex-col items-center justify-center h-full text-center text-gray-400 py-12">
                  <Sparkles className="h-8 w-8 mb-2 opacity-30" />
                  <p className="text-sm">Results will appear here</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}