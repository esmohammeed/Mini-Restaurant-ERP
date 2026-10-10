'use client';

import { useState, useTransition } from 'react';
import { askAssistant } from './actions';

const QUICK_QUESTIONS = [
  "Today's Sales",
  'Pending Orders',
  'Top Selling Products',
  'Low Stock Products',
];

type Message = { role: 'user' | 'assistant'; text: string };

export default function AiAssistantPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      text: "Hi! Ask me about today's sales, pending orders, top selling products, or low stock items.",
    },
  ]);
  const [input, setInput] = useState('');
  const [isPending, startTransition] = useTransition();

  function send(question: string) {
    if (!question.trim()) return;
    setMessages((prev) => [...prev, { role: 'user', text: question }]);
    setInput('');

    startTransition(async () => {
      const answer = await askAssistant(question);
      setMessages((prev) => [...prev, { role: 'assistant', text: answer }]);
    });
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="card">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">
          AI Assistant
        </h2>

        <div className="space-y-3 mb-4 max-h-96 overflow-y-auto">
          {messages.map((m, i) => (
            <div
              key={i}
              className={`rounded-lg px-3 py-2 text-sm whitespace-pre-line ${
                m.role === 'user'
                  ? 'bg-brand-50 text-brand-800 ml-8'
                  : 'bg-gray-50 text-gray-700 mr-8'
              }`}
            >
              {m.text}
            </div>
          ))}
          {isPending && (
            <div className="rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-400 mr-8">
              Thinking…
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2 mb-3">
          {QUICK_QUESTIONS.map((q) => (
            <button
              key={q}
              onClick={() => send(q)}
              disabled={isPending}
              className="rounded-full border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50"
            >
              {q}
            </button>
          ))}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="flex gap-2"
        >
          <input
            className="input-field"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question…"
          />
          <button type="submit" className="btn-primary" disabled={isPending}>
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
