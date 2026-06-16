'use client';

import { useRef, useState } from 'react';
import type { ChatMessage } from '@/lib/types';

interface Props {
  contractId: string;
}

export default function ChatWithContract({ contractId }: Props) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function scrollToBottom() {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  }

  async function sendMessage() {
    const text = input.trim();
    if (!text || streaming) return;
    setInput('');

    const updated: ChatMessage[] = [...messages, { role: 'user', content: text }];
    setMessages([...updated, { role: 'assistant', content: '' }]);
    setStreaming(true);
    scrollToBottom();

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contractId, messages: updated }),
      });

      if (!res.ok || !res.body) {
        throw new Error('Chat failed');
      }

      const reader = res.body.getReader();
      const dec = new TextDecoder();

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = dec.decode(value, { stream: true });
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          return [
            ...prev.slice(0, -1),
            { role: 'assistant', content: last.content + chunk },
          ];
        });
        scrollToBottom();
      }
    } catch {
      setMessages((prev) => [
        ...prev.slice(0, -1),
        { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' },
      ]);
    } finally {
      setStreaming(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
    }
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {!open ? (
        /* Floating button */
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-full shadow-lg transition-colors font-medium"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
          Ask about contract
        </button>
      ) : (
        /* Chat panel */
        <div className="w-96 max-w-[calc(100vw-2rem)] h-[480px] flex flex-col bg-white border border-gray-200 rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-blue-600 text-white">
            <span className="font-semibold text-sm">Contract Assistant</span>
            <button
              onClick={() => setOpen(false)}
              className="text-blue-200 hover:text-white transition-colors"
              aria-label="Close chat"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 thin-scroll">
            {messages.length === 0 && (
              <p className="text-sm text-gray-400 text-center mt-8">
                Ask anything about this contract
              </p>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                    m.role === 'user'
                      ? 'bg-blue-600 text-white rounded-br-sm'
                      : 'bg-gray-100 text-gray-800 rounded-bl-sm'
                  }`}
                >
                  {m.content || (streaming && m.role === 'assistant' ? (
                    <span className="inline-flex gap-1">
                      <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </span>
                  ) : null)}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="border-t border-gray-200 px-3 py-2.5 flex gap-2 items-end">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              disabled={streaming}
              placeholder="Ask about a clause…"
              rows={1}
              className="flex-1 resize-none text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-50 max-h-28 overflow-y-auto"
            />
            <button
              onClick={() => void sendMessage()}
              disabled={!input.trim() || streaming}
              className="flex-shrink-0 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 text-white disabled:text-gray-400 p-2 rounded-xl transition-colors"
              aria-label="Send"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
