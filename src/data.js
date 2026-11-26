export const USERS = {
  michal: { id: 'michal', name: 'Michal', color: '#2F6F9F' },
  jana: { id: 'jana', name: 'Jana', color: '#B5536B' },
  peter: { id: 'peter', name: 'Peter', color: '#7A5BB5' },
  lucia: { id: 'lucia', name: 'Lucia', color: '#C47A2C' },
};

export const PROJECT = { id: 'or', name: 'Obchodný register', short: 'OR' };

export const COMPONENTS = [
  { id: 'int', name: 'Integrácie' },
  { id: 'por', name: 'Portál' },
];

export const TASK_COLORS = ['#0F9D8A', '#7C5CC4', '#2D7FD3', '#D9822B', '#C2477A', '#4C9A2A', '#B8860B', '#3A8E9E'];

const task = (id, topicId, title, owner, creator, status, due, extra = {}) => ({
  id, topicId, title, owner, creator, status, due, parentId: null, returnReason: null, returnedBy: null, ...extra,
});

const todayAt = time => { const [h, m] = time.split(':').map(Number); const d = new Date(); d.setHours(h, m, 0, 0); return d.getTime(); };

const msg = (i, topicId, author, time, text, taskId = null, kind = 'msg', refId = null) => ({
  id: 'seed' + i, topicId, author, time, at: todayAt(time), text, taskId, kind, refId,
});

export function seedState() {
  const topics = {
    spm: { id: 'spm', name: 'Migrácia Slovenskej pošty', componentId: 'int', members: ['michal', 'jana', 'peter'], founder: 'michal' },
    pay: { id: 'pay', name: 'Platobná brána', componentId: 'int', members: ['michal', 'jana', 'lucia'], founder: 'jana' },
    rep: { id: 'rep', name: 'Reporty', componentId: 'por', members: ['michal', 'jana', 'peter', 'lucia'], founder: 'michal' },
    ui: { id: 'ui', name: 'UI úpravy', componentId: 'por', members: ['michal', 'peter', 'lucia'], founder: 'lucia' },
  };

  const tasks = {};
  const add = t => { tasks[t.id] = t; };
  add(task('FD-12', 'spm', 'Ponuka pre Poštu', 'jana', 'michal', 'open', 'pi 20. 11.', { color: TASK_COLORS[0] }));
  add(task('FD-12.1', 'spm', 'Cenník', 'peter', 'jana', 'review', 'št 19. 11.', { parentId: 'FD-12', color: TASK_COLORS[0] }));
  add(task('FD-12.2', 'spm', 'Logo do ponuky', 'michal', 'jana', 'closed', 'št 19. 11.', { parentId: 'FD-12', color: TASK_COLORS[0] }));
  add(task('FD-13', 'spm', 'API endpoint', 'peter', 'jana', 'closed', 'ut 17. 11.', { color: TASK_COLORS[1] }));
  add(task('FD-14', 'spm', 'Testovacie dáta', 'peter', 'michal', 'open', 'pi 20. 11.', { color: TASK_COLORS[2] }));
  add(task('FD-15', 'rep', 'Export dát za október', 'michal', 'jana', 'open', 'št 19. 11.', { color: TASK_COLORS[3], returnReason: 'Chýba DPH v exporte', returnedBy: 'jana' }));
  add(task('FD-16', 'pay', 'Napojenie platobnej brány', 'jana', 'michal', 'review', 'po 23. 11.', { color: TASK_COLORS[4] }));
  add(task('FD-17', 'ui', 'Mobilné zobrazenie tabuliek', 'michal', 'lucia', 'open', 'ut 24. 11.', { color: TASK_COLORS[5] }));

  let i = 0;
  const messages = [
    msg(i++, 'spm', 'jana', '09:24', 'Migračné okno je potvrdené na budúci víkend.'),
    msg(i++, 'spm', 'michal', '09:25', '', 'FD-12', 'created', 'FD-12'),
    msg(i++, 'spm', 'michal', '09:26', '@Jana priprav prosím ponuku pre Poštu, termín piatok.', 'FD-12'),
    msg(i++, 'spm', 'jana', '09:27', 'Jasné. @Peter doplníš do nej cenník?', 'FD-12'),
    msg(i++, 'spm', 'jana', '09:27', '', 'FD-12', 'created', 'FD-12.1'),
    msg(i++, 'spm', 'peter', '09:31', 'Endpoint je nasadený na stagingu.', 'FD-13'),
    msg(i++, 'spm', 'system', '09:33', '✔ FD-13 API endpoint uzavretá · Jana', null, 'system'),
    msg(i++, 'spm', 'michal', '09:35', '', 'FD-14', 'created', 'FD-14'),
    msg(i++, 'spm', 'peter', '09:40', 'Cenník je hotový, posielam na kontrolu.', 'FD-12'),
    msg(i++, 'spm', 'system', '09:40', 'FD-12.1 Cenník → na kontrolu · Peter', 'FD-12', 'system'),
    msg(i++, 'spm', 'jana', '09:44', 'Vďaka, pozriem sa po obede. Migrácia stojí aj na #FD-14.'),

    msg(i++, 'pay', 'michal', '08:50', 'Testovacie prostredie od banky je pripravené.'),
    msg(i++, 'pay', 'michal', '08:52', '', 'FD-16', 'created', 'FD-16'),
    msg(i++, 'pay', 'jana', '09:10', 'Napojenie je hotové, posielam na kontrolu.', 'FD-16'),
    msg(i++, 'pay', 'system', '09:10', 'FD-16 Napojenie platobnej brány → na kontrolu · Jana', 'FD-16', 'system'),
    msg(i++, 'pay', 'lucia', '09:15', 'Super, otestujem aj platbu kartou.'),

    msg(i++, 'rep', 'jana', '08:30', '', 'FD-15', 'created', 'FD-15'),
    msg(i++, 'rep', 'michal', '10:02', 'Export je hotový.', 'FD-15'),
    msg(i++, 'rep', 'system', '10:20', '↩ FD-15 vrátená Michalovi: „Chýba DPH v exporte“ · Jana', 'FD-15', 'system'),
    msg(i++, 'rep', 'peter', '10:25', 'Mesačný report pôjde v pondelok.'),

    msg(i++, 'ui', 'lucia', '11:00', '', 'FD-17', 'created', 'FD-17'),
    msg(i++, 'ui', 'lucia', '11:02', '@Michal pozri prosím, ako sa tabuľky lámu na mobile.', 'FD-17'),
  ];

  const notifications = [
    { id: 'n1', userId: 'michal', text: 'Jana posiela na kontrolu FD-16 Napojenie platobnej brány', topicId: 'pay', taskId: 'FD-16', read: false, time: '09:10' },
    { id: 'n2', userId: 'michal', text: 'Jana ti vrátila FD-15: Chýba DPH v exporte', topicId: 'rep', taskId: 'FD-15', read: false, time: '10:20' },
    { id: 'n3', userId: 'michal', text: 'Lucia ťa označila v FD-17', topicId: 'ui', taskId: 'FD-17', read: false, time: '11:02' },
    { id: 'n4', userId: 'jana', text: 'Peter posiela na kontrolu FD-12.1 Cenník', topicId: 'spm', taskId: 'FD-12.1', read: false, time: '09:40' },
    { id: 'n5', userId: 'peter', text: 'Michal ti priradil FD-14 Testovacie dáta', topicId: 'spm', taskId: 'FD-14', read: false, time: '09:35' },
  ];

  return { topics, tasks, messages, notifications, seq: 18, colorIdx: 6, me: 'michal', helpSeen: false };
}
