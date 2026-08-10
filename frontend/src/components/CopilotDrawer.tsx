import React, { useState } from 'react';
import { Bot, X, Send, Database } from 'lucide-react';
import { api } from '../lib/api';

export const CopilotDrawer: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [messages, setMessages] = useState<
    { sender: 'user' | 'copilot'; text: string; tool_call?: string; data?: any[] }[]
  >([
    {
      sender: 'copilot',
      text: 'Hello! I am your Operational Copilot. Ask me natural language questions like "Show active faculty" or "Check room availability".',
    },
  ]);
  const [loading, setLoading] = useState(false);

  const handleSend = async (queryText?: string) => {
    const textToSubmit = queryText || prompt;
    if (!textToSubmit.trim()) return;

    setMessages((prev) => [...prev, { sender: 'user', text: textToSubmit }]);
    if (!queryText) setPrompt('');
    setLoading(true);

    try {
      const res = await api.post('/copilot/query', { prompt: textToSubmit });
      const copilotData = res.data.data;
      setMessages((prev) => [
        ...prev,
        {
          sender: 'copilot',
          text: copilotData.summary,
          tool_call: copilotData.tool_call,
          data: copilotData.data,
        },
      ]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          sender: 'copilot',
          text: 'Sorry, I encountered an error querying the academic database.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Floating Launcher Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-40 p-4 rounded-2xl bg-gradient-to-r from-cyan-500 to-indigo-600 text-white shadow-2xl shadow-cyan-500/30 hover:scale-105 transition-all duration-200 flex items-center space-x-2.5 group"
        >
          <Bot className="h-6 w-6 group-hover:rotate-12 transition-transform" />
          <span className="font-semibold text-sm">Ask Copilot</span>
        </button>
      )}

      {/* Slide-out Drawer */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 w-96 h-[550px] glass-panel rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden bg-white dark:bg-slate-900 transition-colors duration-200">
          {/* Header */}
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="h-8 w-8 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-600 dark:text-cyan-400">
                <Bot className="h-4 w-4" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">Operational Copilot</h4>
                <p className="text-[10px] text-cyan-600 dark:text-cyan-400">Schema-Aware Agent Active</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Quick Suggestions */}
          <div className="px-4 py-2 bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800/80 flex items-center space-x-2 overflow-x-auto text-[11px]">
            <button
              onClick={() => handleSend('Show active faculty')}
              className="px-2.5 py-1 rounded-full bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 whitespace-nowrap border border-slate-200 dark:border-slate-700 shadow-xs"
            >
              Active Faculty
            </button>
            <button
              onClick={() => handleSend('Show scheduled sessions')}
              className="px-2.5 py-1 rounded-full bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 whitespace-nowrap border border-slate-200 dark:border-slate-700 shadow-xs"
            >
              Sessions
            </button>
          </div>

          {/* Messages Feed */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3 font-sans text-xs">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[85%] p-3 rounded-2xl ${
                    m.sender === 'user'
                      ? 'bg-gradient-to-r from-cyan-600 to-indigo-600 text-white rounded-br-none shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 rounded-bl-none'
                  }`}
                >
                  {m.tool_call && (
                    <div className="mb-1.5 flex items-center space-x-1 text-[10px] font-mono text-cyan-700 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-200 dark:border-cyan-500/20 w-fit">
                      <Database className="h-3 w-3" />
                      <span>Tool: {m.tool_call}</span>
                    </div>
                  )}
                  <p className="leading-relaxed">{m.text}</p>

                  {m.data && m.data.length > 0 && (
                    <div className="mt-2 text-[10px] font-mono bg-white dark:bg-slate-950/80 p-2 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-400 overflow-x-auto max-h-32">
                      <pre>{JSON.stringify(m.data.slice(0, 3), null, 2)}</pre>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="text-xs text-slate-500 dark:text-slate-400 italic">Copilot is executing query...</div>
            )}
          </div>

          {/* Input Footer */}
          <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex items-center space-x-2"
            >
              <input
                type="text"
                placeholder="Ask Copilot a question..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="flex-1 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-cyan-500"
              />
              <button
                type="submit"
                className="p-2 rounded-xl bg-cyan-600 hover:bg-cyan-700 dark:bg-cyan-500 dark:hover:bg-cyan-600 text-white shadow-md transition-colors"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
