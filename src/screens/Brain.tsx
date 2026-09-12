// ─── Brain: full AI chat over your screenshot library — and anything ──────
// Conversations · streaming · numbered citations · retry/copy/share · follow-ups

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../state/store';
import { Icon } from '../components/Icon';
import { Thumb } from '../components/Thumb';
import { Sheet, useConfirm, ConfirmDialog } from '../components/Ui';
import { retrieveForQuestion } from '../lib/search';
import { streamChatWithBrain, generateConvoTitle, generateFollowUps, GeminiError } from '../lib/gemini';
import type { ChatContextShot } from '../lib/gemini';
import {
  listConvos, convoById, createConvo, saveConvo, renameConvo, deleteConvo,
} from '../lib/repo';
import { uid, truncate, relTime } from '../lib/util';
import { haptic } from '../lib/haptics';
import type { ChatMsg, Conversation, Shot } from '../types';

const STARTERS = [
  'What university fees did I save?',
  'Find my travel information',
  'What products was I considering buying?',
  'What deadlines have I saved?',
  'Summarize my screenshots from this week',
  'Explain that React error I screenshotted',
];

// ── inline markdown-lite renderer ────────────────────────────────────────────
function renderInline(text: string, keyBase: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /(\*[^*\n]+\*|`[^`\n]+`)/g;
  let last = 0; let m: RegExpExecArray | null; let i = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith('*')) out.push(<b key={`${keyBase}-${i++}`}>{tok.slice(1, -1)}</b>);
    else out.push(<code key={`${keyBase}-${i++}`} className="bubble-code">{tok.slice(1, -1)}</code>);
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function BubbleText({ text }: { text: string }) {
  const lines = text.split('\n');
  return (
    <div className="bubble-text">
      {lines.map((line, i) => {
        const t = line.trimEnd();
        if (!t.trim()) return <div key={i} className="bubble-gap" />;
        if (/^-\s+/.test(t)) return <p key={i} className="bubble-li">{renderInline(t.replace(/^-\s+/, '·  '), `l${i}`)}</p>;
        if (/^\d+\.\s+/.test(t)) return <p key={i} className="bubble-li">{renderInline(t.replace(/^(\d+)\.\s+/, '$1.  '), `l${i}`)}</p>;
        return <p key={i}>{renderInline(t, `l${i}`)}</p>;
      })}
    </div>
  );
}

export function Brain() {
  const { shots, settings, online, navigate, toast, askPrefill, setAskPrefill, goTab } = useApp();
  const { spec, ask, close } = useConfirm();
  const [convo, setConvo] = useState<Conversation | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [convos, setConvos] = useState<Conversation[]>([]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);       // waiting for first token
  const [streaming, setStreaming] = useState(false);     // tokens flowing
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const key = settings.geminiKey.trim();
  const hasKey = Boolean(key);
  const msgs = convo?.messages ?? [];

  const loadHistory = useCallback(async () => setConvos(await listConvos()), []);

  useEffect(() => {
    void (async () => {
      const list = await listConvos();
      setConvos(list);
      setConvo(list[0] ?? null);
    })();
    return () => abortRef.current?.abort();
  }, []);

  // question queued from Detail ("Ask AI about this")
  useEffect(() => {
    if (askPrefill && hasKey && online && !thinking && !streaming) {
      const q = askPrefill;
      setAskPrefill('');
      void send(q);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [askPrefill]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: streaming ? 'auto' : 'smooth', block: 'end' });
  }, [msgs, thinking, streaming]);

  const patchConvo = useCallback((fn: (c: Conversation) => Conversation) => {
    setConvo((prev) => {
      if (!prev) return prev;
      const next = fn(prev);
      void saveConvo(next).then(loadHistory);
      return next;
    });
  }, [loadHistory]);

  const buildContext = useCallback((question: string): ChatContextShot[] => {
    const relevant = retrieveForQuestion(shots, question, 10);
    return relevant.map((s) => ({
      id: s.id,
      title: s.ai?.title ?? s.fileName,
      summary: s.ai?.summary ?? '',
      category: s.ai?.category ?? 'other',
      tags: s.ai?.tags ?? [],
      date: new Date(s.createdAt).toLocaleDateString(),
      ocrExcerpt: truncate(s.ocr ?? '', 550),
      prices: s.ai?.prices ?? [],
      orgs: s.ai?.orgs ?? [],
      deadlines: s.ai?.deadlines ?? [],
    }));
  }, [shots]);

  const runTurn = useCallback(async (convoId: string, question: string, history: ChatMsg[]) => {
    setThinking(true);
    setStreaming(false);
    const placeholder: ChatMsg = { id: uid('m_'), role: 'ai', text: '', cites: [], ts: Date.now(), streaming: true };
    patchConvo((c) => ({ ...c, messages: [...history, placeholder] }));

    const ac = new AbortController();
    abortRef.current = ac;
    let acc = '';
    let raf = 0;
    const flush = () => {
      raf = 0;
      setConvo((prev) => {
        if (!prev || prev.id !== convoId) return prev;
        const messages = prev.messages.map((m) => (m.id === placeholder.id ? { ...m, text: acc } : m));
        return { ...prev, messages };
      });
    };

    try {
      const ctx = buildContext(question);
      const { text, cites } = await streamChatWithBrain(
        settings.model, key, history, question, ctx,
        (display) => {
          acc = display;
          setThinking(false);
          setStreaming(true);
          if (!raf) raf = requestAnimationFrame(flush);
        },
        ac.signal,
      );
      if (raf) cancelAnimationFrame(raf);
      const finalMsg: ChatMsg = { ...placeholder, text: text || acc, cites, streaming: false };
      let suggestions: string[] = [];
      if (online) {
        suggestions = await generateFollowUps('gemini-2.0-flash-lite', key, question, finalMsg.text);
      }
      const doneMsg: ChatMsg = suggestions.length ? { ...finalMsg, suggestions } : finalMsg;
      setConvo((prev) => {
        if (!prev || prev.id !== convoId) return prev;
        const messages = prev.messages.map((m) => (m.id === placeholder.id ? doneMsg : m));
        const next: Conversation = { ...prev, messages };
        void saveConvo(next).then(loadHistory);
        return next;
      });
      // auto-title from the first exchange
      const fresh = await convoById(convoId);
      if (fresh && fresh.title === 'New chat') {
        const title = await generateConvoTitle(settings.model, key, question);
        await renameConvo(convoId, title);
        setConvo((prev) => (prev && prev.id === convoId ? { ...prev, title } : prev));
        void loadHistory();
      }
    } catch (e) {
      if (raf) cancelAnimationFrame(raf);
      const stopped = e instanceof GeminiError && e.message === 'Stopped.';
      const msg = stopped
        ? 'Stopped.'
        : e instanceof GeminiError ? e.message : 'Something went wrong. Try again.';
      setConvo((prev) => {
        if (!prev || prev.id !== convoId) return prev;
        const err: ChatMsg = { id: placeholder.id, role: 'ai', text: msg, cites: [], ts: Date.now(), error: !stopped };
        const messages = prev.messages.some((m) => m.id === placeholder.id)
          ? prev.messages.map((m) => (m.id === placeholder.id ? err : m))
          : [...prev.messages, err];
        const next = { ...prev, messages };
        void saveConvo(next).then(loadHistory);
        return next;
      });
      if (!stopped) void haptic('medium');
    } finally {
      abortRef.current = null;
      setThinking(false);
      setStreaming(false);
    }
  }, [buildContext, key, settings.model, online, patchConvo, loadHistory]);

  const send = async (raw: string) => {
    const question = raw.trim();
    if (!question || thinking || streaming) return;
    void haptic();

    if (!hasKey) {
      toast('Add a Gemini API key in Settings to chat', 'warn');
      goTab('home');
      navigate({ name: 'settings' });
      return;
    }
    if (!online) {
      toast('You are offline — chat needs internet. OCR, search and cleanup still work.', 'warn');
      return;
    }

    let target = convo;
    if (!target) {
      target = await createConvo();
      setConvo(target);
    }
    const userMsg: ChatMsg = { id: uid('m_'), role: 'user', text: question, cites: [], ts: Date.now() };
    const history = [...target.messages, userMsg];
    setConvo({ ...target, messages: history });
    setInput('');
    await runTurn(target.id, question, history);
  };

  const retry = async () => {
    if (!convo || thinking || streaming) return;
    const lastAi = [...convo.messages].reverse().find((m) => m.role === 'ai');
    if (!lastAi) return;
    const aiIdx = convo.messages.findIndex((m) => m.id === lastAi.id);
    const userQ = [...convo.messages.slice(0, aiIdx)].reverse().find((m) => m.role === 'user');
    if (!userQ) return;
    const history = convo.messages.filter((m) => m.id !== lastAi.id && m.id !== userQ.id);
    const userMsg: ChatMsg = { ...userQ, id: uid('m_'), ts: Date.now() };
    history.push(userMsg);
    setConvo({ ...convo, messages: history });
    await runTurn(convo.id, userMsg.text, history);
  };

  const stop = () => abortRef.current?.abort();

  const newChat = async () => {
    void haptic();
    if (streaming || thinking) return;
    setConvo(await createConvo());
    setHistoryOpen(false);
    inputRef.current?.focus();
  };

  const openConvo = async (id: string) => {
    if (streaming || thinking) return;
    const c = await convoById(id);
    setConvo(c ?? null);
    setHistoryOpen(false);
  };

  const doRename = async () => {
    if (!renaming) return;
    await renameConvo(renaming.id, renaming.name.trim() || 'Untitled chat');
    setRenaming(null);
    if (convo?.id === renaming.id) setConvo((prev) => (prev ? { ...prev, title: renaming.name.trim() || 'Untitled chat' } : prev));
    void loadHistory();
  };

  const doDeleteConvo = (id: string) => {
    ask({
      title: 'Delete this chat?',
      danger: true,
      confirmLabel: 'Delete chat',
      body: <p>The whole conversation will be removed from this device. Your screenshots are not affected.</p>,
      onConfirm: async () => {
        await deleteConvo(id);
        void loadHistory();
        setConvo((prev) => {
          if (prev?.id !== id) return prev;
          return null;
        });
        const list = await listConvos();
        setConvo(list[0] ?? null);
        toast('Chat deleted');
      },
    });
  };

  const copyMsg = async (text: string) => {
    try { await navigator.clipboard.writeText(text); toast('Response copied'); }
    catch { toast('Could not copy', 'err'); }
  };

  const shareMsg = async (text: string) => {
    try {
      const { Share } = await import('@capacitor/share');
      await Share.share({ text, dialogTitle: 'Share response' });
    } catch {
      await copyMsg(text);
    }
  };

  const empty = msgs.length === 0 && !thinking;

  const citeShots = useMemo(() => {
    const map = new Map<string, Shot>();
    for (const s of shots) map.set(s.id, s);
    return map;
  }, [shots]);

  return (
    <div className="screen brain-screen">
      <header className="topbar">
        <div className="topbar-title">
          <span className="brain-ico"><Icon name="brain" size={17} /></span>
          <div>
            <h1>{convo && convo.title !== 'New chat' ? truncate(convo.title, 26) : 'Ask Screenshot Brain'}</h1>
            <p>
              {streaming ? 'Responding…' : thinking ? 'Thinking…'
                : online ? (hasKey ? 'Grounded in your library — and open to any question' : 'Add a Gemini key in Settings to start')
                : 'Offline — AI chat needs internet'}
            </p>
          </div>
        </div>
        <div className="topbar-actions">
          <button className="iconbtn" onClick={() => { void loadHistory(); setHistoryOpen(true); }} aria-label="Chat history">
            <Icon name="layers" size={17} />
          </button>
          <button className="iconbtn" onClick={() => void newChat()} aria-label="New chat" disabled={thinking || streaming}>
            <Icon name="plus" size={18} />
          </button>
        </div>
      </header>

      <div className="chat-scroll">
        {empty && (
          <div className="chat-empty">
            <div className="chat-empty-mark"><Icon name="chat" size={26} strokeWidth={1.5} /></div>
            <h3>Ask anything.</h3>
            <p>
              Your screenshots give it memory — <b>“what was my fee deadline?”</b> — but you can also just chat:
              ideas, questions, writing help, anything. Answers about your screenshots cite them.
            </p>
            <div className="starter-grid">
              {STARTERS.map((s) => (
                <button key={s} className="starter" onClick={() => void send(s)}>
                  <Icon name="sparkles" size={13} /> {s}
                </button>
              ))}
            </div>
            <div className="chat-privacy">
              <Icon name="shield" size={13} />
              <span>Questions go to Gemini only when you send them. Your screenshots stay on this phone.</span>
            </div>
            <div className="made-line">made by <b>CIPHER</b></div>
          </div>
        )}

        {msgs.map((m, idx) => {
          const isLastAi = m.role === 'ai' && idx === msgs.length - 1;
          return (
            <div key={m.id} className={`bubble-row ${m.role}`}>
              <div className={`bubble ${m.role} ${m.error ? 'bubble-err' : ''}`}>
                {m.text ? <BubbleText text={m.text} /> : m.streaming ? (
                  <div className="bubble-text"><span className="dot" /><span className="dot" /><span className="dot" /></div>
                ) : null}
                {m.streaming && m.text && <span className="caret" aria-hidden="true" />}

                {m.role === 'ai' && m.cites.length > 0 && !m.streaming && (
                  <div className="bubble-cites">
                    <span className="cites-label">Sources</span>
                    <div className="cites-row">
                      {m.cites.map((id, ci) => {
                        const s = citeShots.get(id);
                        if (!s) return null;
                        return (
                          <button key={id} className="cite" onClick={() => navigate({ name: 'detail', id })} aria-label={`Source ${ci + 1}: ${s.ai?.title ?? s.fileName}`}>
                            <span className="cite-num">[{ci + 1}]</span>
                            <Thumb id={id} size="strip" />
                            <span className="cite-meta">
                              <b>{truncate(s.ai?.title ?? s.fileName, 30)}</b>
                              <i>{relTime(s.createdAt)}</i>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {m.role === 'ai' && m.suggestions && m.suggestions.length > 0 && !m.streaming && (
                  <div className="followups">
                    {m.suggestions.map((s) => (
                      <button key={s} className="starter starter-sm" onClick={() => void send(s)}>
                        <Icon name="sparkles" size={12} /> {truncate(s, 46)}
                      </button>
                    ))}
                  </div>
                )}

                {m.role === 'ai' && !m.streaming && m.text && (
                  <div className="bubble-actions">
                    {isLastAi && !m.error && (
                      <button className="bubact" onClick={() => void retry()} aria-label="Retry response">
                        <Icon name="refresh" size={14} /> Retry
                      </button>
                    )}
                    <button className="bubact" onClick={() => void copyMsg(m.text)} aria-label="Copy response">
                      <Icon name="copy" size={14} /> Copy
                    </button>
                    <button className="bubact" onClick={() => void shareMsg(m.text)} aria-label="Share response">
                      <Icon name="share" size={14} /> Share
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        <div ref={endRef} />
      </div>

      <div className="chat-inputbar">
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) void send(input); }}
          placeholder={online ? 'Ask about your screenshots — or anything' : 'Offline — reconnect to chat'}
          disabled={!online}
          aria-label="Message"
        />
        {(thinking || streaming) ? (
          <button className="sendbtn sendbtn-stop" onClick={stop} aria-label="Stop">
            <span className="stopblock" />
          </button>
        ) : (
          <button
            className="sendbtn"
            onClick={() => void send(input)}
            disabled={!input.trim() || !online || !hasKey}
            aria-label="Send"
          >
            <Icon name="send" size={18} />
          </button>
        )}
      </div>

      {historyOpen && (
        <Sheet title="Chats" onClose={() => setHistoryOpen(false)}>
          <div className="convo-list">
            <button className="btn btn-primary convo-new" onClick={() => void newChat()}>
              <Icon name="plus" size={16} /> New chat
            </button>
            {convos.length === 0 && <p className="muted-line">No conversations yet.</p>}
            {convos.map((c) => (
              <div key={c.id} className={`convo-row ${convo?.id === c.id ? 'convo-on' : ''}`}>
                {renaming?.id === c.id ? (
                  <>
                    <input
                      className="rename-input"
                      autoFocus value={renaming.name}
                      onChange={(e) => setRenaming({ ...renaming, name: e.target.value })}
                      onKeyDown={(e) => { if (e.key === 'Enter') void doRename(); if (e.key === 'Escape') setRenaming(null); }}
                    />
                    <button className="iconbtn" onClick={() => void doRename()} aria-label="Save name"><Icon name="check" size={16} /></button>
                  </>
                ) : (
                  <>
                    <button className="convo-open" onClick={() => void openConvo(c.id)}>
                      <span className="convo-main">
                        <b>{truncate(c.title, 34)}</b>
                        <i>{c.messages.length ? `${c.messages.length} message${c.messages.length === 1 ? '' : 's'} · ${relTime(c.updatedAt)}` : 'Empty'}</i>
                      </span>
                    </button>
                    <button className="iconbtn" onClick={() => setRenaming({ id: c.id, name: c.title })} aria-label="Rename chat"><Icon name="edit" size={15} /></button>
                    <button className="iconbtn" onClick={() => doDeleteConvo(c.id)} aria-label="Delete chat"><Icon name="trash" size={15} /></button>
                  </>
                )}
              </div>
            ))}
          </div>
        </Sheet>
      )}

      {spec && <ConfirmDialog spec={spec} onClose={close} />}
    </div>
  );
}
