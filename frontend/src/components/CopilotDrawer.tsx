import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bot,
  X,
  Send,
  Maximize2,
  Minimize2,
  Sparkles,
  User,
  RotateCcw,
  BookOpen,
  Calendar,
  GraduationCap,
  Users,
  ExternalLink,
  ArrowRight,
} from 'lucide-react';
import { api } from '../lib/api';

interface CopilotMessage {
  sender: 'user' | 'copilot';
  text: string;
  tool_call?: string;
  data?: any[];
  nav_link?: {
    path: string;
    label: string;
    description?: string;
  };
  timestamp?: string;
}

// Clean Formatted Message Renderer supporting bold, bullets, paragraphs
const FormattedMessage: React.FC<{ text: string }> = ({ text }) => {
  if (!text) return null;

  // Split into paragraphs
  const paragraphs = text.split(/\n\n+/);

  return (
    <div className="space-y-2 text-xs sm:text-[13px] leading-relaxed">
      {paragraphs.map((para, pIdx) => {
        const lines = para.split(/\n/).filter((l) => l.trim().length > 0);

        // Check if paragraph is a bullet list
        const isBulletList = lines.every((l) => /^[\•\-\*]\s+/.test(l.trim()));
        if (isBulletList) {
          return (
            <ul key={pIdx} className="space-y-1.5 my-1.5 pl-1">
              {lines.map((line, lIdx) => {
                const cleanLine = line.replace(/^[\•\-\*]\s+/, '');
                return (
                  <li key={lIdx} className="flex items-start gap-2 text-slate-800 dark:text-slate-200">
                    <span className="h-1.5 w-1.5 rounded-full bg-cyan-500 shrink-0 mt-1.5 shadow-xs" />
                    <span dangerouslySetInnerHTML={{ __html: formatInline(cleanLine) }} />
                  </li>
                );
              })}
            </ul>
          );
        }

        // Check if paragraph is numbered list
        const isNumList = lines.every((l) => /^\d+[\.\)]\s+/.test(l.trim()));
        if (isNumList) {
          return (
            <div key={pIdx} className="space-y-2 my-1.5">
              {lines.map((line, lIdx) => {
                const numMatch = line.match(/^(\d+)[\.\)]\s*(.*)/);
                if (numMatch) {
                  return (
                    <div key={lIdx} className="flex items-start gap-2.5 text-slate-800 dark:text-slate-200">
                      <span className="h-5 w-5 rounded-full bg-cyan-100 dark:bg-cyan-950 text-cyan-700 dark:text-cyan-300 font-extrabold text-[11px] flex items-center justify-center shrink-0 mt-0.5 border border-cyan-200 dark:border-cyan-800 shadow-2xs">
                        {numMatch[1]}
                      </span>
                      <span
                        className="flex-1 font-sans"
                        dangerouslySetInnerHTML={{ __html: formatInline(numMatch[2]) }}
                      />
                    </div>
                  );
                }
                return (
                  <p key={lIdx} dangerouslySetInnerHTML={{ __html: formatInline(line) }} />
                );
              })}
            </div>
          );
        }

        return (
          <p key={pIdx} className="text-slate-800 dark:text-slate-200">
            {lines.map((l, lIdx) => (
              <span key={lIdx} className="block leading-relaxed" dangerouslySetInnerHTML={{ __html: formatInline(l) }} />
            ))}
          </p>
        );
      })}
    </div>
  );
};

// Inline Markdown Helper (bold, code)
function formatInline(str: string): string {
  if (!str) return '';
  return str
    .replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-slate-900 dark:text-white">$1</strong>')
    .replace(/\*(.*?)\*/g, '<em class="italic text-slate-700 dark:text-slate-300">$1</em>')
    .replace(/`(.*?)`/g, '<code class="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-cyan-700 dark:text-cyan-300 font-mono text-[11px] border border-slate-200 dark:border-slate-700">$1</code>');
}

// Clean Structured Data Table Renderer for Database results
const StructuredDataTable: React.FC<{ data: any[] }> = ({ data }) => {
  if (!data || data.length === 0) return null;

  // Filter out any internal info metadata
  const validRows = data.filter((row) => !row.info);
  if (validRows.length === 0) return null;

  const firstRow = validRows[0];
  const keys = Object.keys(firstRow);

  const formatHeader = (key: string) => {
    return key
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  };

  return (
    <div className="mt-3 overflow-x-auto rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-950">
      <table className="w-full text-left text-xs border-collapse">
        <thead>
          <tr className="bg-slate-50/80 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-[10px] uppercase font-bold text-slate-600 dark:text-slate-400 tracking-wider">
            {keys.map((k) => (
              <th key={k} className="py-2.5 px-3 whitespace-nowrap">
                {formatHeader(k)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
          {validRows.map((row, rIdx) => (
            <tr key={rIdx} className="hover:bg-slate-50/60 dark:hover:bg-slate-900/50 transition-colors">
              {keys.map((k) => {
                const val = row[k];
                if (typeof val === 'boolean') {
                  return (
                    <td key={k} className="py-2.5 px-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-extrabold border ${
                          val
                            ? 'bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                            : 'bg-amber-50 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                        }`}
                      >
                        {val ? 'Active / Yes' : 'Locked / No'}
                      </span>
                    </td>
                  );
                }

                if (k === 'status') {
                  return (
                    <td key={k} className="py-2.5 px-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase bg-cyan-50 dark:bg-cyan-950/80 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800">
                        {String(val)}
                      </span>
                    </td>
                  );
                }

                return (
                  <td key={k} className="py-2.5 px-3 font-medium">
                    {String(val ?? '—')}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export const CopilotDrawer: React.FC = () => {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [messages, setMessages] = useState<CopilotMessage[]>([
    {
      sender: 'copilot',
      text: 'Hello! I am your **Lexicon MILE Academic Assistant**. You can ask me about class schedules, faculty allocations, attendance records, syllabus topics, or course activities.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const handleSend = async (queryText?: string) => {
    const textToSubmit = queryText || prompt;
    if (!textToSubmit.trim()) return;

    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    setMessages((prev) => [...prev, { sender: 'user', text: textToSubmit, timestamp: time }]);
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
          nav_link: copilotData.nav_link,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } catch (err: any) {
      const errDetail = err.response?.data?.detail || err.message || '';
      setMessages((prev) => [
        ...prev,
        {
          sender: 'copilot',
          text: `I encountered an issue processing your request (${errDetail || 'Connection error'}). Please verify your query or try again.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setMessages([
      {
        sender: 'copilot',
        text: 'Conversation cleared. How else can I assist you with your academic operations today?',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

  const quickPrompts = [
    { label: 'Attendance Report', icon: GraduationCap, query: 'Give me student wise subject wise attendance' },
    { label: 'Active Faculty', icon: Users, query: 'Show active faculty list' },
    { label: 'Classroom Sessions', icon: Calendar, query: 'Show scheduled sessions' },
    { label: 'Course Activities', icon: Sparkles, query: 'What course activities and assignments are active?' },
    { label: 'Subject List', icon: BookOpen, query: 'Show all academic subjects' },
    { label: 'Student Roster', icon: Users, query: 'Show student roster' },
  ];

  return (
    <>
      {/* Step-based Launcher Logic */}
      {!isOpen && (
        <div className="fixed bottom-6 right-0 z-40 flex items-center">
          {isCollapsed ? (
            <button
              onClick={() => setIsCollapsed(false)}
              className="h-16 w-5 bg-blue-600 hover:w-6 transition-all duration-300 rounded-l-lg shadow-lg cursor-pointer border border-l-0 border-white/20 flex items-center justify-center"
              title="Show Copilot"
            >
              <span className="text-white font-bold text-[9px] uppercase tracking-tighter [writing-mode:vertical-lr] rotate-180">
                Copilot
              </span>
            </button>
          ) : (
            <div className="flex items-center gap-0 animate-in slide-in-from-right duration-300">
               <button
                onClick={() => setIsOpen(true)}
                className="px-4 py-3 rounded-l-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white shadow-xl shadow-indigo-500/25 hover:scale-105 transition-all duration-200 flex items-center gap-2.5 group cursor-pointer border border-white/20 border-r-0"
              >
                <div className="h-6 w-6 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
                  <Bot className="h-4 w-4 group-hover:rotate-12 transition-transform" />
                </div>
                <span className="font-bold text-sm tracking-wide whitespace-nowrap">Ask Copilot</span>
              </button>
              <button 
                onClick={() => setIsCollapsed(true)}
                className="bg-blue-600 text-white p-1 rounded-r-lg border border-l-0 border-white/20 cursor-pointer"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Slide-out / Expandable Drawer */}
      {isOpen && (
        <div
          className={`fixed z-50 transition-all duration-300 ease-out flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl rounded-3xl overflow-hidden ${
            isExpanded
              ? 'bottom-4 right-4 sm:bottom-6 sm:right-6 w-[calc(100vw-32px)] sm:w-[840px] h-[86vh] max-h-[900px]'
              : 'bottom-4 right-4 sm:bottom-6 sm:right-6 w-[calc(100vw-32px)] sm:w-[440px] h-[620px] max-h-[82vh]'
          }`}
        >
          {/* Header */}
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-950/80 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-cyan-500/20">
                <Bot className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  Academic AI Copilot
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  AI Academic Assistant
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleClear}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                title="Restart Conversation"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                title={isExpanded ? 'Collapse Window' : 'Expand to Large View'}
              >
                {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                title="Close Window"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Quick Action Suggestion Chips */}
          <div className="px-4 py-2.5 bg-slate-50/50 dark:bg-slate-950/40 border-b border-slate-100 dark:border-slate-800/80 flex items-center gap-2 overflow-x-auto no-scrollbar text-xs">
            {quickPrompts.map((item, idx) => {
              const Icon = item.icon;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSend(item.query)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-cyan-50 dark:hover:bg-cyan-950/40 text-slate-700 dark:text-slate-300 hover:text-cyan-700 dark:hover:text-cyan-300 font-semibold whitespace-nowrap border border-slate-200 dark:border-slate-700 shadow-2xs transition-all cursor-pointer text-[11px]"
                >
                  <Icon className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>

          {/* Messages Feed */}
          <div className="flex-1 p-4 overflow-y-auto space-y-4 font-sans text-xs">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex gap-2.5 ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {m.sender === 'copilot' && (
                  <div className="h-7 w-7 rounded-lg bg-cyan-100 dark:bg-cyan-950/80 text-cyan-700 dark:text-cyan-300 flex items-center justify-center shrink-0 mt-0.5 border border-cyan-200 dark:border-cyan-800">
                    <Bot className="h-4 w-4" />
                  </div>
                )}

                <div className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'} max-w-[90%]`}>
                  <div
                    className={`p-3.5 rounded-2xl ${
                      m.sender === 'user'
                        ? 'bg-gradient-to-r from-cyan-600 to-indigo-600 text-white rounded-br-xs shadow-sm font-medium'
                        : 'bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 text-slate-800 dark:text-slate-200 rounded-bl-xs shadow-xs w-full'
                    }`}
                  >
                    {m.sender === 'copilot' ? (
                      <div>
                        <FormattedMessage text={m.text} />
                        {m.data && m.data.length > 0 && (
                          <StructuredDataTable data={m.data} />
                        )}
                        {m.nav_link && (
                          <div className="mt-3 pt-3 border-t border-slate-200/80 dark:border-slate-700/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-gradient-to-r from-cyan-50/70 to-indigo-50/70 dark:from-cyan-950/40 dark:to-indigo-950/40 p-3 rounded-2xl border border-cyan-200/80 dark:border-cyan-800/60 shadow-2xs">
                            <div className="space-y-0.5">
                              <div className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                                <ExternalLink className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400" />
                                <span>{m.nav_link.label}</span>
                              </div>
                              {m.nav_link.description && (
                                <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-snug">
                                  {m.nav_link.description}
                                </p>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                navigate(m.nav_link!.path);
                              }}
                              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-700 hover:to-indigo-700 text-white font-bold text-xs shadow-sm transition-all cursor-pointer shrink-0"
                            >
                              <span>Open Page</span>
                              <ArrowRight className="h-3 w-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="leading-relaxed">{m.text}</p>
                    )}
                  </div>
                  {m.timestamp && (
                    <span className="text-[10px] text-slate-400 mt-1 px-1">{m.timestamp}</span>
                  )}
                </div>

                {m.sender === 'user' && (
                  <div className="h-7 w-7 rounded-lg bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 flex items-center justify-center shrink-0 mt-0.5 border border-indigo-200 dark:border-indigo-800">
                    <User className="h-4 w-4" />
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex items-center gap-2.5 text-slate-500 dark:text-slate-400 py-2 animate-pulse">
                <div className="h-7 w-7 rounded-lg bg-cyan-50 dark:bg-cyan-950 text-cyan-600 flex items-center justify-center">
                  <Bot className="h-4 w-4 animate-spin" />
                </div>
                <span className="text-xs font-medium">Analyzing records and composing answer...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Footer */}
          <div className="p-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/80">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                placeholder="Ask about faculty, schedules, activities, students..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                disabled={loading}
                className="flex-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={loading || !prompt.trim()}
                className="p-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-700 hover:to-indigo-700 text-white shadow-md disabled:opacity-40 transition-all cursor-pointer"
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
