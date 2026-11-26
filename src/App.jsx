import React, { useEffect, useMemo, useRef, useState } from 'react';
import { USERS, PROJECT, COMPONENTS, TASK_COLORS, seedState } from './data.js';

/* ---------- helpers ---------- */
const STORE_KEY = 'flowdesk-proto-v1';
const loadState = () => {
  try { const raw = localStorage.getItem(STORE_KEY); if (raw) return JSON.parse(raw); } catch (e) { /* ignore */ }
  return seedState();
};
const saveState = s => { try { localStorage.setItem(STORE_KEY, JSON.stringify(s)); } catch (e) { /* ignore */ } };

const nowTime = () => { const d = new Date(); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
let uidC = 0;
const newId = p => `${p}${Date.now().toString(36)}${(uidC++).toString(36)}`;
const uname = id => (USERS[id] ? USERS[id].name : id);

const DAYS = ['ne', 'po', 'ut', 'st', 'št', 'pi', 'so'];
const fmtDate = d => `${DAYS[d.getDay()]} ${d.getDate()}. ${d.getMonth() + 1}.`;
function parseDue(tok) {
  const t = tok.toLowerCase();
  const d = new Date();
  if (t === 'dnes') return fmtDate(d);
  if (t === 'zajtra') { d.setDate(d.getDate() + 1); return fmtDate(d); }
  const idx = DAYS.indexOf(t === 'sr' ? 'st' : t);
  if (idx >= 0) { let delta = (idx - d.getDay() + 7) % 7; if (delta === 0) delta = 7; d.setDate(d.getDate() + delta); return fmtDate(d); }
  const m = t.match(/^(\d{1,2})\.(\d{1,2})\.?$/);
  if (m) { const x = new Date(d.getFullYear(), Number(m[2]) - 1, Number(m[1])); return fmtDate(x); }
  return null;
}

const STATUS = {
  open: { label: 'Otvorená', cls: 'open' },
  review: { label: 'Na kontrolu', cls: 'review' },
  closed: { label: 'Uzavretá', cls: 'closed' },
};

const rootId = t => t.parentId || t.id;
const childrenOf = (s, id) => Object.values(s.tasks).filter(t => t.parentId === id).sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
function closerOf(t, s) {
  const topic = s.topics[t.topicId];
  let c = t.parentId ? s.tasks[t.parentId].owner : t.creator;
  if (!topic.members.includes(c)) c = topic.founder;
  return c;
}
const findMember = (name, members) => members.find(id => uname(id).toLowerCase() === name.toLowerCase());

/* ---------- timeline: day separators, grouping ---------- */
const DAYS_LONG = ['nedeľa', 'pondelok', 'utorok', 'streda', 'štvrtok', 'piatok', 'sobota'];
const sameDay = (a, b) => a.toDateString() === b.toDateString();
function dayLabel(at) {
  const d = new Date(at); const today = new Date(); const yday = new Date(); yday.setDate(today.getDate() - 1);
  if (sameDay(d, today)) return 'Dnes';
  if (sameDay(d, yday)) return 'Včera';
  return `${DAYS_LONG[d.getDay()]} ${d.getDate()}. ${d.getMonth() + 1}.`;
}
const minutesOf = time => { const [h, m] = time.split(':').map(Number); return h * 60 + m; };
const GROUP_MS = 5 * 60 * 1000;
const isNear = (a, b) => (a.at && b.at ? Math.abs(b.at - a.at) <= GROUP_MS : Math.abs(minutesOf(b.time) - minutesOf(a.time)) <= 5);
const plural = (n, one, few, many) => (n === 1 ? one : n >= 2 && n <= 4 ? few : many);

/* turns raw messages into rows: day separators, merged task events, grouped messages */
function buildTimeline(msgs) {
  const rows = [];
  let lastDay = null;
  let prevMsg = null;
  for (const m of msgs) {
    const day = m.at ? new Date(m.at).toDateString() : 'old';
    if (day !== lastDay) {
      if (m.at) rows.push({ type: 'day', key: 'day-' + day, label: dayLabel(m.at) });
      lastDay = day; prevMsg = null;
    }
    const last = rows[rows.length - 1];
    if (m.kind === 'created') {
      if (last && last.type === 'created' && last.author === m.author && isNear(last.items[last.items.length - 1], m)) last.items.push(m);
      else rows.push({ type: 'created', key: m.id, author: m.author, items: [m] });
      prevMsg = null;
    } else if (m.kind === 'system') {
      rows.push({ type: 'system', key: m.id, m });
      prevMsg = null;
    } else {
      rows.push({ type: 'msg', key: m.id, m, cont: !!(prevMsg && prevMsg.author === m.author && isNear(prevMsg, m)) });
      prevMsg = m;
    }
  }
  return rows;
}

const STATUS_ORDER = { review: 0, open: 1, closed: 2 };
const byKey = (a, b) => a.id.localeCompare(b.id, undefined, { numeric: true });

/* ---------- small UI pieces ---------- */
function Avatar({ id, size = 28 }) {
  const u = USERS[id];
  if (!u) return null;
  return <span className="avatar" title={u.name} style={{ width: size, height: size, background: u.color, fontSize: size * 0.42 }}>{u.name[0]}</span>;
}
function StatusPill({ status }) {
  const s = STATUS[status];
  return <span className={`pill pill-${s.cls}`}>{s.label}</span>;
}
function StatusDot({ status }) {
  return <span className={`sdot st-${status}`} title={STATUS[status].label} />;
}
function Icon({ name, size = 16 }) {
  const p = {
    hash: 'M5 9h14M5 15h14M10 3 8 21M16 3l-2 18',
    check: 'M5 12l5 5L20 7',
    close: 'M6 6l12 12M18 6 6 18',
    bell: 'M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10 21h4',
    tasks: 'M9 6h11M9 12h11M9 18h11M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2',
    review: 'M12 8v4l3 2M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18',
    plus: 'M12 5v14M5 12h14',
    back: 'M15 6l-6 6 6 6',
    menu: 'M4 7h16M4 12h16M4 17h16',
    send: 'M4 12l16-8-6 16-2-7-8-1z',
    ret: 'M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3',
    help: 'M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14M12 17.5v.01M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18',
    folder: 'M3 7h6l2 2h10v10H3z',
    calendar: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  }[name];
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={p} /></svg>;
}

/* renders text with @mentions and #task links */
function RichText({ text, tasks, onTask }) {
  const parts = text.split(/(@[\p{L}]+|#FD-\d+(?:\.\d+)?)/u);
  return parts.map((p, i) => {
    if (/^@[\p{L}]+$/u.test(p)) return <span key={i} className="mention">{p}</span>;
    if (/^#FD-/.test(p)) {
      const id = p.slice(1); const t = tasks[id];
      if (t) return <button key={i} className="tasklink" style={{ '--c': t.color }} onClick={() => onTask(id)}>{p}</button>;
    }
    return <React.Fragment key={i}>{p}</React.Fragment>;
  });
}

/* ---------- composer ---------- */
function Composer({ members, taskList, draft, setDraft, onSend, context, contextFixed, onClearContext, placeholder, disabled, inputRef }) {
  const [caret, setCaret] = useState(0);
  const [sel, setSel] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  const trig = useMemo(() => {
    const before = draft.slice(0, caret);
    const m = before.match(/(^|\s)([@#])([\p{L}\d.\-]*)$/u);
    if (!m) return null;
    return { ch: m[2], q: m[3], start: before.length - m[3].length - 1 };
  }, [draft, caret]);

  const items = useMemo(() => {
    if (!trig || dismissed) return [];
    const q = trig.q.toLowerCase();
    if (trig.ch === '@') return members.filter(id => uname(id).toLowerCase().startsWith(q)).map(id => ({ key: id, user: id, label: uname(id), insert: '@' + uname(id) }));
    return taskList.filter(t => t.id.toLowerCase().includes(q) || t.title.toLowerCase().includes(q)).slice(0, 8)
      .map(t => ({ key: t.id, label: t.id, sub: t.title, color: t.color, status: t.status, insert: '#' + t.id }));
  }, [trig, dismissed, members, taskList]);

  useEffect(() => { setSel(0); }, [trig && trig.ch, trig && trig.q]);
  useEffect(() => {
    const el = inputRef.current; if (!el) return;
    el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 140) + 'px';
  }, [draft, inputRef]);

  const setCaretTo = pos => requestAnimationFrame(() => { const el = inputRef.current; if (el) { el.focus(); el.setSelectionRange(pos, pos); setCaret(pos); } });

  const pick = it => {
    const before = draft.slice(0, trig.start);
    const after = draft.slice(caret).replace(/^[\p{L}\d.\-]*/u, '').trimStart();
    const nt = before + it.insert + ' ' + after;
    setDraft(nt);
    setCaretTo((before + it.insert + ' ').length);
  };

  const insertChar = ch => {
    if (ch === '+') {
      const nt = draft.startsWith('+') ? draft : '+ ' + draft;
      setDraft(nt); setDismissed(false); setCaretTo(nt.length); return;
    }
    const el = inputRef.current; const pos = el ? el.selectionStart : draft.length;
    const pre = draft.slice(0, pos); const needSpace = pre && !/\s$/.test(pre);
    const nt = pre + (needSpace ? ' ' : '') + ch + draft.slice(pos);
    setDraft(nt); setDismissed(false); setCaretTo(pre.length + (needSpace ? 1 : 0) + 1);
  };

  const send = () => { if (onSend(draft)) { setDraft(''); setCaret(0); } };

  const onKeyDown = e => {
    if (items.length) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setSel((sel + 1) % items.length); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setSel((sel - 1 + items.length) % items.length); return; }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); pick(items[sel]); return; }
      if (e.key === 'Escape') { e.preventDefault(); setDismissed(true); return; }
    }
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); return; }
    if (e.key === 'Escape' && !contextFixed && onClearContext) onClearContext();
  };

  return (
    <div className={`composer ${disabled ? 'is-disabled' : ''}`}>
      {items.length > 0 && (
        <div className="suggest" role="listbox">
          <div className="suggest-head">{trig.ch === '@' ? 'Členovia témy' : 'Úlohy v téme'}</div>
          {items.map((it, i) => (
            <button key={it.key} className={`suggest-item ${i === sel ? 'is-sel' : ''}`} onMouseDown={e => { e.preventDefault(); pick(it); }} onMouseEnter={() => setSel(i)}>
              {it.user ? <Avatar id={it.user} size={22} /> : <span className="dot" style={{ background: it.color }} />}
              <span className={it.user ? '' : 'mono'}>{it.label}</span>
              {it.sub && <span className="muted ellipsis">{it.sub}</span>}
              {it.status && <StatusPill status={it.status} />}
            </button>
          ))}
        </div>
      )}
      {context && (
        <div className="ctx-row">
          <span className="ctx-chip" style={{ '--c': context.color }}>
            → <span className="mono">{context.id}</span> {context.title}
            {!contextFixed && <button aria-label="Zrušiť kontext" onClick={onClearContext}><Icon name="close" size={12} /></button>}
          </span>
          {!contextFixed && <span className="hint">Správy idú k úlohe · Esc zruší</span>}
        </div>
      )}
      <div className="composer-box">
        <textarea
          ref={inputRef} rows={1} value={draft} disabled={disabled} placeholder={placeholder}
          onChange={e => { setDraft(e.target.value); setCaret(e.target.selectionStart); setDismissed(false); }}
          onKeyDown={onKeyDown}
          onKeyUp={e => { if (!['ArrowUp', 'ArrowDown'].includes(e.key)) setCaret(e.target.selectionStart); }}
          onClick={e => setCaret(e.target.selectionStart)}
        />
        <div className="composer-tools">
          <button title="Označiť člena" onClick={() => insertChar('@')}>@</button>
          <button title="Odkaz na úlohu" onClick={() => insertChar('#')}>#</button>
          <button title={contextFixed ? 'Nová podúloha' : 'Nová úloha'} onClick={() => insertChar('+')}>+</button>
          <button className="send" title="Odoslať (Enter)" onClick={send} disabled={disabled}><Icon name="send" size={16} /></button>
        </div>
      </div>
    </div>
  );
}

/* ---------- main app ---------- */
export default function App() {
  const [data, setData] = useState(loadState);
  const [view, setView] = useState('topic');
  const [activeTopic, setActiveTopic] = useState('spm');
  const [panelId, setPanelId] = useState(null);
  const [ctxId, setCtxId] = useState(null);
  const [draft, setDraft] = useState('');
  const [panelDraft, setPanelDraft] = useState('');
  const [toasts, setToasts] = useState([]);
  const [modal, setModal] = useState(null);
  const [menu, setMenu] = useState(null);
  const [drawer, setDrawer] = useState(false);
  const [flash, setFlash] = useState(null);
  const [showClosed, setShowClosed] = useState(false);
  const mainInput = useRef(null);
  const panelInput = useRef(null);
  const listRef = useRef(null);

  useEffect(() => { saveState(data); }, [data]);
  useEffect(() => { if (!data.helpSeen) setModal({ type: 'help' }); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const me = data.me;
  const topic = data.topics[activeTopic];
  const isMember = topic && topic.members.includes(me);
  const panelTask = panelId ? data.tasks[panelId] : null;
  const ctxTask = ctxId ? data.tasks[ctxId] : null;

  const update = fn => setData(prev => { const d = JSON.parse(JSON.stringify(prev)); fn(d); return d; });
  const toast = (text, kind = 'info') => {
    const id = newId('t');
    setToasts(ts => [...ts.slice(-2), { id, text, kind }]);
    setTimeout(() => setToasts(ts => ts.filter(t => t.id !== id)), 3800);
  };
  const notify = (d, userId, actor, text, topicId, taskId) => {
    if (!userId || userId === actor) return;
    d.notifications.push({ id: newId('n'), userId, text, topicId, taskId, read: false, time: nowTime() });
  };
  const addSystem = (d, topicId, text, taskId = null) => {
    d.messages.push({ id: newId('m'), topicId, author: 'system', time: nowTime(), at: Date.now(), text, taskId, kind: 'system' });
  };

  /* --- navigation --- */
  const myTopics = Object.values(data.topics).filter(t => t.members.includes(me));
  const openTopic = id => { setActiveTopic(id); setView('topic'); setPanelId(null); setCtxId(null); setDrawer(false); setShowClosed(false); };
  const openTask = (id, opts = {}) => {
    const t = data.tasks[id]; if (!t) return;
    const r = rootId(t);
    if (t.topicId !== activeTopic) { setActiveTopic(t.topicId); setCtxId(null); }
    setView('topic'); setPanelId(r); setDrawer(false);
    if (data.topics[t.topicId].members.includes(me) && !opts.noCtx) setCtxId(r);
    if (t.parentId) { setFlash(t.id); setTimeout(() => setFlash(null), 1600); }
  };

  useEffect(() => {
    if (view === 'topic' && listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [data.messages.length, activeTopic, view]);

  const switchUser = id => {
    update(d => { d.me = id; });
    setMenu(null); setPanelId(null); setCtxId(null); setDraft(''); setPanelDraft('');
    const t = data.topics[activeTopic];
    if (!t.members.includes(id)) {
      const first = Object.values(data.topics).find(x => x.members.includes(id));
      if (first) setActiveTopic(first.id);
    }
    toast(`Teraz si ${uname(id)}`);
  };

  /* --- actions --- */
  function createTask(topicId, title, owner, due, parentId) {
    // the id is computed up front: React runs the state updater later, so it cannot report back
    const id = parentId
      ? `${parentId}.${Object.values(data.tasks).filter(t => t.parentId === parentId).length + 1}`
      : `FD-${data.seq}`;
    update(d => {
      let color;
      if (parentId) {
        color = d.tasks[parentId].color;
      } else {
        d.seq += 1; color = TASK_COLORS[d.colorIdx % TASK_COLORS.length]; d.colorIdx += 1;
      }
      d.tasks[id] = { id, topicId, title, owner, creator: d.me, status: 'open', due, parentId: parentId || null, color, returnReason: null, returnedBy: null };
      d.messages.push({ id: newId('m'), topicId, author: d.me, time: nowTime(), at: Date.now(), text: '', taskId: parentId || id, kind: 'created', refId: id });
      notify(d, owner, d.me, `${uname(d.me)} ti priradil(a) ${id} ${title}`, topicId, id);
    });
    return id;
  }

  function markDone(id) {
    const t = data.tasks[id];
    if (!t) return;
    if (t.owner !== me || t.status !== 'open') { toast('Hotovo môže označiť len vlastník alebo riešiteľ otvorenej položky.', 'warn'); return; }
    const closer = closerOf(t, data);
    if (closer === me) { closeItem(id); return; }
    update(d => {
      const x = d.tasks[id]; x.status = 'review'; x.returnReason = null; x.returnedBy = null;
      addSystem(d, x.topicId, `${x.id} ${x.title} → na kontrolu · ${uname(me)}`, rootId(x));
      notify(d, closer, me, `${uname(me)} posiela na kontrolu ${x.id} ${x.title}`, x.topicId, x.id);
    });
    toast(`${id} je na kontrole. Uzatvára ${uname(closer)}.`, 'ok');
  }

  function closeItem(id, force = false) {
    const t = data.tasks[id];
    const closer = closerOf(t, data);
    const allowed = (t.status === 'review' && closer === me) || (t.status === 'open' && t.owner === me && closer === me);
    if (!allowed) { toast(`Uzavrieť môže len ${uname(closer)} – ten, kto položku zadal.`, 'warn'); return; }
    const openKids = childrenOf(data, id).filter(c => c.status !== 'closed');
    if (openKids.length && !force) { setModal({ type: 'confirmClose', id, count: openKids.length }); return; }
    update(d => {
      Object.values(d.tasks).filter(c => c.parentId === id).forEach(c => { c.status = 'closed'; c.returnReason = null; });
      const x = d.tasks[id]; x.status = 'closed'; x.returnReason = null; x.returnedBy = null;
      addSystem(d, x.topicId, `✔ ${x.id} ${x.title} uzavretá · ${uname(me)}`, x.parentId ? x.parentId : null);
    });
    setModal(null);
    toast(`${id} uzavretá.${!t.parentId ? ' Zakladateľ témy uvidí stopu v chate.' : ''}`, 'ok');
  }

  function returnItem(id, to, reason) {
    update(d => {
      const x = d.tasks[id]; x.status = 'open'; x.owner = to; x.returnReason = reason; x.returnedBy = me;
      addSystem(d, x.topicId, `↩ ${x.id} vrátená (${uname(to)}): „${reason}“ · ${uname(me)}`, rootId(x));
      notify(d, to, me, `${uname(me)} ti vrátil(a) ${x.id}: ${reason}`, x.topicId, x.id);
    });
    setModal(null);
    toast(`${id} vrátená – rieši ${uname(to)}.`, 'ok');
  }

  /* parses and sends a composer line; returns true when consumed */
  function handleSend(raw, ctx, inPanel) {
    let text = raw.trim();
    if (!text) return false;
    // allow "@Jana + názov" as well as "+ názov @Jana"
    const lead = text.match(/^((?:@[\p{L}]+\s+)+)\+\s*/u);
    if (lead) text = '+ ' + text.slice(lead[0].length) + ' ' + lead[1].trim();
    if (!isMember) { toast('Nie si členom tejto témy.', 'warn'); return false; }
    const members = topic.members;

    if (text.startsWith('+')) {
      let body = text.slice(1).trim();
      let owner = me;
      const m = body.match(/@([\p{L}]+)/u);
      if (m) {
        const found = findMember(m[1], members);
        if (!found) { toast(`${m[1]} nie je členom témy – vlastník musí byť člen.`, 'warn'); return false; }
        owner = found; body = body.replace(m[0], ' ');
      }
      let due = null;
      const words = body.trim().split(/\s+/);
      const last = words[words.length - 1];
      if (words.length > 1 && parseDue(last)) { due = parseDue(last); words.pop(); }
      const title = words.join(' ').trim();
      if (!title) { toast('Napíš názov úlohy, napr. „+ Pripraviť ponuku @Jana pi“.', 'warn'); return false; }
      if (inPanel) {
        const parent = data.tasks[ctx];
        if (parent.owner !== me) { toast(`Podúlohy vytvára vlastník úlohy (${uname(parent.owner)}).`, 'warn'); return false; }
        const id = createTask(topic.id, title, owner, due, parent.id);
        toast(`Podúloha ${id} vytvorená – rieši ${uname(owner)}.`, 'ok');
      } else {
        const id = createTask(topic.id, title, owner, due, null);
        toast(`Úloha ${id} vytvorená – vlastník ${uname(owner)}.`, 'ok');
      }
      return true;
    }

    if (/^(\/hotovo|✅)/i.test(text)) {
      const ref = text.match(/#(FD-\d+(?:\.\d+)?)/);
      const target = ref ? ref[1] : ctx;
      if (!target || !data.tasks[target]) { toast('Nie je jasné, ktorá položka je hotová. Otvor úlohu alebo pridaj #FD-…', 'warn'); return false; }
      const t = data.tasks[target];
      if (t.status === 'review') closeItem(target); else markDone(target);
      return true;
    }

    if (/^(↩|\/vrat)/i.test(text)) {
      const ref = text.match(/#(FD-\d+(?:\.\d+)?)/);
      const target = ref ? ref[1] : ctx;
      const t = target && data.tasks[target];
      if (!t) { toast('Pridaj #FD-… alebo otvor úlohu, ktorú vraciaš.', 'warn'); return false; }
      if (t.status !== 'review' || closerOf(t, data) !== me) { toast('Vrátiť môže len ten, kto položku uzatvára, keď je na kontrole.', 'warn'); return false; }
      const m = text.match(/@([\p{L}]+)/u);
      const to = m ? findMember(m[1], members) : t.owner;
      const reason = text.replace(/^(↩|\/vrat)/i, '').replace(/@[\p{L}]+/u, '').replace(/#FD-\d+(?:\.\d+)?/, '').trim();
      if (!to) { toast('Tento človek nie je členom témy.', 'warn'); return false; }
      if (!reason) { toast('Pri vrátení napíš dôvod.', 'warn'); return false; }
      returnItem(t.id, to, reason);
      return true;
    }

    update(d => {
      d.messages.push({ id: newId('m'), topicId: topic.id, author: me, time: nowTime(), at: Date.now(), text, taskId: ctx || null, kind: 'msg' });
      const mentioned = new Set();
      for (const mm of text.matchAll(/@([\p{L}]+)/gu)) {
        const u = findMember(mm[1], members);
        if (u && u !== me && !mentioned.has(u)) {
          mentioned.add(u);
          notify(d, u, me, `${uname(me)} ťa označil(a)${ctx ? ' v ' + ctx : ' v ' + topic.name}`, topic.id, ctx);
        }
      }
      if (ctx) {
        const t = d.tasks[ctx];
        const rec = new Set([t.owner, ...Object.values(d.tasks).filter(c => c.parentId === ctx && c.status !== 'closed').map(c => c.owner)]);
        rec.forEach(u => { if (!mentioned.has(u)) notify(d, u, me, `Nová správa v ${ctx} ${t.title}`, topic.id, ctx); });
      }
    });
    return true;
  }

  /* --- derived --- */
  const myNotifs = data.notifications.filter(n => n.userId === me).slice().reverse();
  const unread = myNotifs.filter(n => !n.read).length;
  const unreadByTopic = id => myNotifs.filter(n => !n.read && n.topicId === id).length;
  const topicTasks = topic ? Object.values(data.tasks).filter(t => t.topicId === topic.id).sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true })) : [];
  const topicMessages = topic ? data.messages.filter(m => m.topicId === topic.id) : [];

  const visibleTasks = Object.values(data.tasks).filter(t => data.topics[t.topicId].members.includes(me));
  const col = {
    working: visibleTasks.filter(t => t.owner === me && t.status === 'open' && !t.returnReason),
    review: visibleTasks.filter(t => t.status === 'review' && closerOf(t, data) === me),
    returned: visibleTasks.filter(t => t.owner === me && t.status === 'open' && t.returnReason),
    waiting: visibleTasks.filter(t => t.owner === me && t.status === 'review'),
  };

  const markNotifRead = n => { update(d => { const x = d.notifications.find(y => y.id === n.id); if (x) x.read = true; }); setMenu(null); if (n.taskId && data.tasks[n.taskId]) openTask(n.taskId); else openTopic(n.topicId); };
  const markAllRead = () => update(d => d.notifications.forEach(n => { if (n.userId === me) n.read = true; }));

  // mark topic notifications read when viewing
  useEffect(() => {
    if (view !== 'topic' || !topic) return;
    if (myNotifs.some(n => !n.read && n.topicId === topic.id && !n.taskId)) {
      update(d => d.notifications.forEach(n => { if (n.userId === me && n.topicId === topic.id && !n.taskId) n.read = true; }));
    }
  }, [activeTopic, view, me]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!panelId) return;
    const ids = new Set([panelId, ...childrenOf(data, panelId).map(c => c.id)]);
    if (myNotifs.some(n => !n.read && ids.has(n.taskId))) {
      update(d => d.notifications.forEach(n => { if (n.userId === me && ids.has(n.taskId)) n.read = true; }));
    }
  }, [panelId, me, data.notifications.length]); // eslint-disable-line react-hooks/exhaustive-deps

  /* --- render pieces --- */
  const ItemActions = ({ t, compact }) => {
    const closer = closerOf(t, data);
    const btns = [];
    if (t.status === 'open' && t.owner === me) {
      btns.push(<button key="d" className="btn btn-primary btn-sm" onClick={e => { e.stopPropagation(); markDone(t.id); }}><Icon name="check" size={14} /> {closer === me ? 'Hotovo a uzavrieť' : 'Hotovo'}</button>);
    }
    if (t.status === 'review' && closer === me) {
      btns.push(<button key="c" className="btn btn-good btn-sm" onClick={e => { e.stopPropagation(); closeItem(t.id); }}><Icon name="check" size={14} /> Uzavrieť</button>);
      btns.push(<button key="r" className="btn btn-sm" onClick={e => { e.stopPropagation(); setModal({ type: 'return', id: t.id }); }}><Icon name="ret" size={14} /> Vrátiť</button>);
    }
    if (!btns.length) {
      if (compact) return null;
      let note = null;
      if (t.status === 'review') note = `Čaká na kontrolu – uzatvára ${uname(closer)}`;
      else if (t.status === 'open') note = `Rieši ${uname(t.owner)}`;
      return note ? <span className="muted small">{note}</span> : null;
    }
    return <div className="actions">{btns}</div>;
  };

  /* task chip used inside event rows */
  const EventTask = ({ t, withTitle }) => (
    <button className="ev-task" style={{ '--c': t.color }} onClick={() => openTask(t.id)}>
      <StatusDot status={t.status} /><span className="mono">{t.id}</span>{withTitle && <span className="ev-title">{t.title}</span>}
    </button>
  );

  /* one row of the main chat timeline */
  const TimelineRow = ({ row, focus }) => {
    if (row.type === 'day') return <div className="day-sep"><span>{row.label}</span></div>;

    if (row.type === 'created') {
      const tasks = row.items.map(m => data.tasks[m.refId]).filter(Boolean);
      if (!tasks.length) return null;
      const dim = focus && row.items.every(m => m.taskId !== focus);
      const first = tasks[0];
      return (
        <div className={`event ${dim ? 'is-dim' : ''}`}>
          <span className="ev-ic ev-ic-new"><Icon name="plus" size={12} /></span>
          <div className="ev-body">
            {tasks.length === 1 ? (
              <>
                <span>{uname(row.author)} vytvoril(a)</span> <EventTask t={first} withTitle />
                <span className="ev-meta">{first.parentId ? 'rieši' : 'vlastník'} {uname(first.owner)}{first.due ? ` · do ${first.due}` : ''}</span>
              </>
            ) : (
              <>
                <span>{uname(row.author)} vytvoril(a) {tasks.length} {plural(tasks.length, 'úlohu', 'úlohy', 'úloh')}:</span>{' '}
                {tasks.map(t => <EventTask key={t.id} t={t} withTitle />)}
              </>
            )}
          </div>
          <span className="ev-time">{row.items[0].time}</span>
        </div>
      );
    }

    if (row.type === 'system') {
      const m = row.m;
      const dim = focus && m.taskId !== focus;
      const kind = m.text.startsWith('✔') ? 'closed' : m.text.startsWith('↩') ? 'returned' : 'review';
      const icon = { closed: 'check', returned: 'ret', review: 'review' }[kind];
      const t = m.taskId ? data.tasks[m.taskId] : null;
      return (
        <div className={`event ${dim ? 'is-dim' : ''} ${t ? 'is-link' : ''}`} onClick={t ? () => openTask(t.id) : undefined}>
          <span className={`ev-ic ev-ic-${kind}`}><Icon name={icon} size={12} /></span>
          <div className="ev-body">{m.text.replace(/^(✔|↩)\s*/, '')}</div>
          <span className="ev-time">{m.time}</span>
        </div>
      );
    }

    const { m, cont } = row;
    const dim = focus && m.taskId !== focus;
    const t = m.taskId ? data.tasks[m.taskId] : null;
    const text = <div className="msg-text"><RichText text={m.text} tasks={data.tasks} onTask={openTask} /></div>;
    return (
      <div className={`msg ${cont ? 'is-cont' : ''} ${dim ? 'is-dim' : ''}`}>
        {cont ? <span className="av-space" /> : <Avatar id={m.author} />}
        <div className="msg-body">
          {!cont && <div className="msg-meta"><b>{uname(m.author)}</b> <span className="muted">{m.time}</span></div>}
          {t ? (
            <div className="linked" style={{ '--c': t.color }}>
              <button className="task-label" onClick={() => openTask(t.id)}><span className="mono">{t.id}</span> <span className="ellipsis">{t.title}</span></button>
              {text}
            </div>
          ) : text}
        </div>
        {isMember && !t && !panelId && (
          <button className="msg-action" title="Vytvoriť z tejto správy úlohu" onClick={() => { setDraft('+ ' + m.text.replace(/@[\p{L}]+/gu, '').trim() + ' '); requestAnimationFrame(() => mainInput.current && mainInput.current.focus()); }}>+ úloha</button>
        )}
      </div>
    );
  };

  /* strip of the topic's tasks under the header + progress (closed / all tasks) */
  const TaskStrip = () => {
    const roots = topicTasks.filter(t => !t.parentId);
    if (!roots.length) return null;
    const closed = roots.filter(t => t.status === 'closed').length;
    const shown = roots.filter(t => showClosed || t.status !== 'closed')
      .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || byKey(a, b));
    return (
      <div className="task-strip">
        <button className={`strip-progress ${showClosed ? 'is-on' : ''}`} onClick={() => setShowClosed(v => !v)}
          title={showClosed ? 'Skryť uzavreté' : 'Zobraziť aj uzavreté'}>
          <span className="prog"><span style={{ width: `${Math.round((closed / roots.length) * 100)}%` }} /></span>
          {closed}/{roots.length}
        </button>
        {shown.map(t => (
          <button key={t.id} className={`strip-chip ${panelId === t.id ? 'is-active' : ''} ${t.status === 'closed' ? 'is-closed' : ''}`}
            style={{ '--c': t.color }} onClick={() => openTask(t.id)}>
            <StatusDot status={t.status} /><span className="mono">{t.id}</span><span className="strip-title">{t.title}</span>
          </button>
        ))}
        {!shown.length && <span className="strip-empty">Všetko uzavreté</span>}
      </div>
    );
  };

  const TaskCard = ({ t, kind }) => {
    const tp = data.topics[t.topicId];
    const comp = COMPONENTS.find(c => c.id === tp.componentId);
    return (
      <div className={`card card-${kind}`} style={{ '--c': t.color }} onClick={() => openTask(t.id)} role="button" tabIndex={0} onKeyDown={e => { if (e.key === 'Enter') openTask(t.id); }}>
        <div className="card-top">
          <div>
            <div className="card-title"><span className="mono key">{t.id}</span> {t.title}</div>
            <div className="muted small">{comp.name} / {tp.name}</div>
          </div>
          <Avatar id={t.owner} size={26} />
        </div>
        {t.parentId && <div className="muted small">Podúloha k {t.parentId} {data.tasks[t.parentId].title}</div>}
        {t.due && <div className="muted small row-ic"><Icon name="calendar" size={13} /> {t.due}</div>}
        {kind === 'returned' && <div className="reason">↩ {t.returnReason} <span className="muted">– {uname(t.returnedBy)}</span></div>}
        {kind === 'waiting' && <div className="muted small">Uzatvára {uname(closerOf(t, data))}</div>}
        {(kind === 'review' || kind === 'working' || kind === 'returned') && <ItemActions t={t} compact />}
      </div>
    );
  };

  const focus = panelId;
  const memberIds = topic ? topic.members : [];

  return (
    <div className={`app ${panelTask ? 'with-panel' : ''}`}>
      {/* ---------- sidebar ---------- */}
      <aside className={`sidebar ${drawer ? 'is-open' : ''}`}>
        <div className="brand"><span className="logo">F</span> FlowDesk</div>
        <div className="side-label">Projekt</div>
        <div className="project"><span className="proj-badge">{PROJECT.short}</span> {PROJECT.name}</div>
        <nav className="tree">
          {COMPONENTS.map(c => {
            const ts = myTopics.filter(t => t.componentId === c.id);
            if (!ts.length) return null;
            return (
              <div key={c.id} className="comp">
                <div className="comp-name"><Icon name="folder" size={14} /> {c.name}</div>
                {ts.map(t => {
                  const n = unreadByTopic(t.id);
                  return (
                    <button key={t.id} className={`topic-link ${view === 'topic' && activeTopic === t.id ? 'is-active' : ''}`} onClick={() => openTopic(t.id)}>
                      <Icon name="hash" size={14} /> <span className="ellipsis">{t.name}</span>
                      {n > 0 && <span className="badge">{n}</span>}
                    </button>
                  );
                })}
              </div>
            );
          })}
          <button className="new-topic" onClick={() => setModal({ type: 'topic' })}><Icon name="plus" size={14} /> Nová téma</button>
        </nav>
        <div className="side-bottom">
          <button className={`filter ${view === 'mytasks' ? 'is-active' : ''}`} onClick={() => { setView('mytasks'); setPanelId(null); setDrawer(false); }}>
            <Icon name="tasks" /> Moje úlohy <span className="count">{col.working.length + col.returned.length}</span>
          </button>
          <button className="filter" onClick={() => { setView('mytasks'); setPanelId(null); setDrawer(false); }}>
            <Icon name="review" /> Na moju kontrolu {col.review.length > 0 && <span className="badge badge-amber">{col.review.length}</span>}
          </button>
        </div>
      </aside>
      {drawer && <div className="scrim" onClick={() => setDrawer(false)} />}

      {/* ---------- main ---------- */}
      <main className="main">
        <header className="topbar">
          <button className="icon-btn only-mobile" aria-label="Menu" onClick={() => setDrawer(true)}><Icon name="menu" /></button>
          {view === 'topic' && topic ? (
            <div className="title-block">
              <div className="crumb">{PROJECT.name} / {COMPONENTS.find(c => c.id === topic.componentId).name}</div>
              <h1>{topic.name}</h1>
            </div>
          ) : (
            <div className="title-block"><div className="crumb">Naprieč všetkými témami</div><h1>Moje úlohy</h1></div>
          )}
          <div className="topbar-right">
            {view === 'topic' && topic && (
              <div className="members" title={`Zakladateľ: ${uname(topic.founder)}`}>
                {topic.members.map(id => <Avatar key={id} id={id} size={28} />)}
              </div>
            )}
            <button className="icon-btn" aria-label="Pomocník" onClick={() => setModal({ type: 'help' })}><Icon name="help" /></button>
            <div className="menu-wrap">
              <button className="icon-btn" aria-label="Notifikácie" onClick={() => setMenu(menu === 'bell' ? null : 'bell')}>
                <Icon name="bell" />{unread > 0 && <span className="bell-dot">{unread}</span>}
              </button>
              {menu === 'bell' && (
                <div className="dropdown notif-dd">
                  <div className="dd-head"><b>Notifikácie · {uname(me)}</b>{unread > 0 && <button className="link" onClick={markAllRead}>Označiť prečítané</button>}</div>
                  {myNotifs.length === 0 && <div className="muted small pad">Zatiaľ nič.</div>}
                  {myNotifs.slice(0, 12).map(n => (
                    <button key={n.id} className={`notif ${n.read ? '' : 'is-unread'}`} onClick={() => markNotifRead(n)}>
                      <span>{n.text}</span><span className="muted small">{data.topics[n.topicId].name} · {n.time}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="menu-wrap">
              <button className="user-btn" onClick={() => setMenu(menu === 'user' ? null : 'user')}>
                <Avatar id={me} size={28} /><span className="hide-mobile">{uname(me)}</span>
              </button>
              {menu === 'user' && (
                <div className="dropdown">
                  <div className="dd-head"><b>Prepnúť používateľa</b></div>
                  {Object.values(USERS).map(u => (
                    <button key={u.id} className={`dd-item ${u.id === me ? 'is-active' : ''}`} onClick={() => switchUser(u.id)}>
                      <Avatar id={u.id} size={22} /> {u.name}
                      <span className="muted small">{data.notifications.filter(n => n.userId === u.id && !n.read).length || ''}</span>
                    </button>
                  ))}
                  <div className="dd-sep" />
                  <button className="dd-item" onClick={() => { setMenu(null); setModal({ type: 'reset' }); }}>Resetovať demo dáta</button>
                </div>
              )}
            </div>
          </div>
        </header>
        {menu && <div className="menu-scrim" onClick={() => setMenu(null)} />}

        {view === 'topic' && topic && (
          <section className="chat">
            <TaskStrip />
            {focus && panelTask && (
              <div className="focus-bar" style={{ '--c': panelTask.color }}>
                Fokus: <span className="mono">{panelTask.id}</span> {panelTask.title}
                <button className="link" onClick={() => setPanelId(null)}>Zobraziť všetko</button>
              </div>
            )}
            <div className="messages" ref={listRef}>
              {buildTimeline(topicMessages).map(row => <TimelineRow key={row.key} row={row} focus={focus} />)}
            </div>
            {isMember ? (
              <Composer
                members={memberIds} taskList={topicTasks} draft={draft} setDraft={setDraft} inputRef={mainInput}
                context={ctxTask} onClearContext={() => setCtxId(null)}
                placeholder={ctxTask ? `Píšeš k ${ctxTask.id}…` : 'Napíš správu…'}
                onSend={txt => handleSend(txt, ctxId, false)}
              />
            ) : (
              <div className="readonly">Nie si členom tejto témy, môžeš ju len čítať.</div>
            )}
          </section>
        )}

        {view === 'mytasks' && (
          <section className="mytasks">
            <div className="columns">
              <div className="column">
                <div className="col-head"><span className="dot" style={{ background: 'var(--teal)' }} /> Riešim <span className="muted">{col.working.length}</span></div>
                {col.working.map(t => <TaskCard key={t.id} t={t} kind="working" />)}
                {!col.working.length && <div className="empty">Nič otvorené.</div>}
              </div>
              <div className="column">
                <div className="col-head"><span className="dot" style={{ background: 'var(--amber)' }} /> Na moju kontrolu <span className="muted">{col.review.length}</span></div>
                {col.review.map(t => <TaskCard key={t.id} t={t} kind="review" />)}
                {!col.review.length && <div className="empty">Nič nečaká na tvoju kontrolu.</div>}
              </div>
              <div className="column">
                <div className="col-head"><span className="dot" style={{ background: 'var(--violet)' }} /> Vrátené mne <span className="muted">{col.returned.length}</span></div>
                {col.returned.map(t => <TaskCard key={t.id} t={t} kind="returned" />)}
                {!col.returned.length && <div className="empty">Nič vrátené.</div>}
                {col.waiting.length > 0 && <>
                  <div className="col-head sub"><span className="dot" style={{ background: 'var(--muted)' }} /> Čakám na iných <span className="muted">{col.waiting.length}</span></div>
                  {col.waiting.map(t => <TaskCard key={t.id} t={t} kind="waiting" />)}
                </>}
              </div>
            </div>
          </section>
        )}
      </main>

      {/* ---------- task panel ---------- */}
      {panelTask && (() => {
        const t = panelTask;
        const kids = childrenOf(data, t.id);
        const conv = data.messages.filter(m => m.topicId === t.topicId && m.taskId === t.id);
        const closer = closerOf(t, data);
        const canAddSub = t.owner === me && t.status !== 'closed';
        return (
          <aside className="panel" style={{ '--c': t.color }}>
            <div className="panel-head">
              <button className="icon-btn only-mobile" aria-label="Späť" onClick={() => setPanelId(null)}><Icon name="back" /></button>
              <span className="swatch" />
              <div className="panel-title"><span className="mono">{t.id}</span> {t.title}</div>
              <button className="icon-btn hide-mobile" aria-label="Zavrieť" onClick={() => setPanelId(null)}><Icon name="close" /></button>
            </div>
            <div className="panel-scroll">
              <div className="facts">
                <div><div className="fact-l">Stav</div><StatusPill status={t.status} /></div>
                <div><div className="fact-l">Termín</div><div className="row-ic"><Icon name="calendar" size={14} /> {t.due || '—'}</div></div>
                <div><div className="fact-l">Vlastník</div><div className="row-ic"><Avatar id={t.owner} size={22} /> {uname(t.owner)}</div></div>
                <div><div className="fact-l">Zadal(a) a uzatvára</div><div className="row-ic"><Avatar id={closer} size={22} /> {uname(closer)}</div></div>
              </div>
              {t.returnReason && t.status === 'open' && <div className="reason big">↩ Vrátené: {t.returnReason} <span className="muted">– {uname(t.returnedBy)}</span></div>}
              <div className="panel-actions"><ItemActions t={t} /></div>

              <div className="sec-head">
                <span>Podúlohy ({kids.length})</span>
                {canAddSub && <button className="link" onClick={() => { setPanelDraft('+ '); requestAnimationFrame(() => panelInput.current && panelInput.current.focus()); }}><Icon name="plus" size={13} /> Pridať</button>}
              </div>
              {kids.length === 0 && <div className="muted small">Žiadne podúlohy. {canAddSub ? 'Napíš „+ názov @meno“ do poľa nižšie.' : ''}</div>}
              <div className="subs">
                {kids.map(k => (
                  <div key={k.id} className={`sub ${k.status === 'closed' ? 'is-closed' : ''} ${flash === k.id ? 'is-flash' : ''}`}>
                    <span className={`sub-ic st-${k.status}`}>{k.status === 'closed' ? <Icon name="check" size={12} /> : null}</span>
                    <div className="sub-main">
                      <div className="sub-title"><span className="mono">{k.id}</span> {k.title}</div>
                      <div className="muted small">@{uname(k.owner)}{k.due ? ` · do ${k.due}` : ''}</div>
                      {k.returnReason && k.status === 'open' && <div className="reason">↩ {k.returnReason} <span className="muted">– {uname(k.returnedBy)}</span></div>}
                      <ItemActions t={k} compact />
                    </div>
                    <StatusPill status={k.status} />
                  </div>
                ))}
              </div>

              <div className="sec-head"><span>Konverzácia</span></div>
              <div className="conv">
                {conv.length === 0 && <div className="muted small">Zatiaľ bez správ.</div>}
                {conv.map(m => {
                  if (m.kind === 'system') return <div key={m.id} className="sysline small">{m.time} · {m.text}</div>;
                  if (m.kind === 'created') {
                    const c = data.tasks[m.refId];
                    return <div key={m.id} className="sysline small">{m.time} · {uname(m.author)} vytvoril(a) {c.id} {c.title} → {uname(c.owner)}</div>;
                  }
                  return (
                    <div key={m.id} className="conv-msg">
                      <Avatar id={m.author} size={24} />
                      <div><div className="msg-meta"><b>{uname(m.author)}</b> <span className="muted">{m.time}</span></div>
                        <div className="msg-text"><RichText text={m.text} tasks={data.tasks} onTask={openTask} /></div></div>
                    </div>
                  );
                })}
              </div>
            </div>
            {isMember && t.status !== 'closed' && (
              <Composer
                members={memberIds} taskList={topicTasks} draft={panelDraft} setDraft={setPanelDraft} inputRef={panelInput}
                context={t} contextFixed
                placeholder={`Napíš k ${t.id}…`}
                onSend={txt => handleSend(txt, t.id, true)}
              />
            )}
          </aside>
        );
      })()}

      {/* ---------- modals ---------- */}
      {modal && modal.type === 'return' && <ReturnModal t={data.tasks[modal.id]} members={data.topics[data.tasks[modal.id].topicId].members} onCancel={() => setModal(null)} onReturn={(to, r) => returnItem(modal.id, to, r)} />}
      {modal && modal.type === 'confirmClose' && (
        <Modal onClose={() => setModal(null)} title={`Uzavrieť ${modal.id}?`}>
          <p>Úloha má {modal.count} {modal.count === 1 ? 'otvorenú podúlohu' : 'otvorené podúlohy'}. Uzavretím sa uzavrú aj {modal.count === 1 ? 'ona' : 'ony'}.</p>
          <div className="modal-actions"><button className="btn" onClick={() => setModal(null)}>Zrušiť</button><button className="btn btn-good" onClick={() => closeItem(modal.id, true)}>Uzavrieť všetko</button></div>
        </Modal>
      )}
      {modal && modal.type === 'reset' && (
        <Modal onClose={() => setModal(null)} title="Resetovať demo?">
          <p>Všetky zmeny sa zmažú a prototyp sa vráti do pôvodného stavu.</p>
          <div className="modal-actions"><button className="btn" onClick={() => setModal(null)}>Zrušiť</button>
            <button className="btn btn-primary" onClick={() => { const s = seedState(); s.helpSeen = true; setData(s); setModal(null); setView('topic'); setActiveTopic('spm'); setPanelId(null); setCtxId(null); toast('Demo dáta obnovené.'); }}>Resetovať</button></div>
        </Modal>
      )}
      {modal && modal.type === 'topic' && <TopicModal me={me} onCancel={() => setModal(null)} onCreate={(name, comp, members) => {
        const id = newId('tp');
        update(d => {
          d.topics[id] = { id, name, componentId: comp, members, founder: d.me };
          members.forEach(u => notify(d, u, d.me, `${uname(d.me)} ťa pridal(a) do témy ${name}`, id, null));
        });
        setModal(null); setActiveTopic(id); setView('topic'); setPanelId(null); setCtxId(null);
        toast(`Téma „${name}“ vytvorená.`, 'ok');
      }} />}
      {modal && modal.type === 'help' && (
        <Modal wide onClose={() => { setModal(null); if (!data.helpSeen) update(d => { d.helpSeen = true; }); }} title="Ako vyskúšať prototyp">
          <ol className="steps">
            <li><b>Si Michal.</b> V lište úloh pod názvom témy ťukni na <span className="mono">FD-12</span>. Otvorí sa panel úlohy a ostatné správy sa stlmia (fokus). Číslo vľavo v lište (napr. 1/3) je pokrok témy – ťuknutím zobrazíš aj uzavreté úlohy.</li>
            <li>Napíš do hlavného chatu: <code>+ Pripraviť harmonogram @Jana pi</code>. Vznikne úloha s vlastníkom Jana a termínom piatok.</li>
            <li><b>Prepni sa na Janu</b> (avatar vpravo hore). V paneli FD-12 je podúloha FD-12.1 na kontrole. Uzavri ju, alebo ju vráť Petrovi s dôvodom.</li>
            <li><b>Prepni sa na Petra.</b> V „Moje úlohy“ uvidíš vrátenú podúlohu aj s dôvodom. Označ ju „Hotovo“ a ide znova Jane na kontrolu.</li>
            <li>Ako Jana vytvor v paneli podúlohu: <code>+ Preklad do angličtiny @Michal zajtra</code>.</li>
          </ol>
          <table className="cheat"><tbody>
            <tr><td><code>@</code></td><td>označí člena témy, dostane notifikáciu</td></tr>
            <tr><td><code>#</code></td><td>odkaz na úlohu</td></tr>
            <tr><td><code>+ názov @meno pi</code></td><td>nová úloha (v paneli podúloha); termín: dnes, zajtra, po–ne, 20.11.</td></tr>
            <tr><td><code>/hotovo</code></td><td>riešiteľ: pošle na kontrolu · zadávateľ: uzavrie</td></tr>
            <tr><td><code>↩ @meno dôvod</code></td><td>vráti položku na kontrole (alebo <code>/vrat</code>)</td></tr>
            <tr><td><code>Esc</code></td><td>zruší lepkavý kontext úlohy</td></tr>
          </tbody></table>
          <p className="muted small">Dáta sa ukladajú len v tvojom prehliadači. Reset nájdeš v menu používateľa.</p>
          <div className="modal-actions"><button className="btn btn-primary" onClick={() => { setModal(null); if (!data.helpSeen) update(d => { d.helpSeen = true; }); }}>Začať</button></div>
        </Modal>
      )}

      <div className="toasts">{toasts.map(t => <div key={t.id} className={`toast toast-${t.kind}`}>{t.text}</div>)}</div>
    </div>
  );
}

function Modal({ title, children, onClose, wide }) {
  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="modal-scrim" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true">
        <div className="modal-head"><h2>{title}</h2><button className="icon-btn" aria-label="Zavrieť" onClick={onClose}><Icon name="close" /></button></div>
        {children}
      </div>
    </div>
  );
}

function ReturnModal({ t, members, onCancel, onReturn }) {
  const [to, setTo] = useState(t.owner);
  const [reason, setReason] = useState('');
  return (
    <Modal title={`Vrátiť ${t.id} ${t.title}`} onClose={onCancel}>
      <label className="field"><span>Komu</span>
        <div className="chips">{members.map(id => (
          <button key={id} className={`chip ${to === id ? 'is-sel' : ''}`} onClick={() => setTo(id)}><Avatar id={id} size={20} /> {uname(id)}</button>
        ))}</div>
      </label>
      <label className="field"><span>Dôvod (povinný)</span>
        <textarea autoFocus rows={3} value={reason} onChange={e => setReason(e.target.value)} placeholder="Napr. chýba DPH v cenníku" />
      </label>
      <div className="modal-actions"><button className="btn" onClick={onCancel}>Zrušiť</button>
        <button className="btn btn-primary" disabled={!reason.trim()} onClick={() => onReturn(to, reason.trim())}><Icon name="ret" size={14} /> Vrátiť</button></div>
    </Modal>
  );
}

function TopicModal({ me, onCancel, onCreate }) {
  const [name, setName] = useState('');
  const [comp, setComp] = useState(COMPONENTS[0].id);
  const [members, setMembers] = useState([me]);
  const toggle = id => { if (id === me) return; setMembers(m => (m.includes(id) ? m.filter(x => x !== id) : [...m, id])); };
  return (
    <Modal title="Nová téma" onClose={onCancel}>
      <label className="field"><span>Názov</span><input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="Napr. Napojenie na NASES" onKeyDown={e => { if (e.key === 'Enter' && name.trim()) onCreate(name.trim(), comp, members); }} /></label>
      <label className="field"><span>Komponent</span>
        <div className="chips">{COMPONENTS.map(c => <button key={c.id} className={`chip ${comp === c.id ? 'is-sel' : ''}`} onClick={() => setComp(c.id)}>{c.name}</button>)}</div>
      </label>
      <label className="field"><span>Členovia</span>
        <div className="chips">{Object.values(USERS).map(u => <button key={u.id} className={`chip ${members.includes(u.id) ? 'is-sel' : ''}`} onClick={() => toggle(u.id)}><Avatar id={u.id} size={20} /> {u.name}{u.id === me ? ' (ty)' : ''}</button>)}</div>
      </label>
      <div className="modal-actions"><button className="btn" onClick={onCancel}>Zrušiť</button><button className="btn btn-primary" disabled={!name.trim()} onClick={() => onCreate(name.trim(), comp, members)}>Vytvoriť tému</button></div>
    </Modal>
  );
}
