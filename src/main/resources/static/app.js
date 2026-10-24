// ================================================================
//  Тайм-менеджер — фронтенд. Общается с Spring Boot через /api/...
// ================================================================

const API = '/api';

let tasks = [];
let currentFilter = 'ALL';
let activeTaskId = null;      // задача, к которой привязан Pomodoro

// ---------- Работа с сервером ----------

async function request(url, options = {}) {
    const res = await fetch(API + url, {
        headers: { 'Content-Type': 'application/json' },
        ...options
    });
    if (!res.ok) {
        let msg = 'Ошибка ' + res.status;
        try { msg = (await res.json()).message || msg; } catch (e) { /* пусто */ }
        throw new Error(msg);
    }
    return res.status === 204 ? null : res.json();
}

async function loadTasks() {
    try {
        tasks = await request('/tasks');
        render();
        loadStats();
    } catch (e) {
        toast('Сервер недоступен: ' + e.message);
    }
}

async function loadStats() {
    const s = await request('/stats');
    document.getElementById('stats').textContent =
        `Задач: ${s.total} · выполнено: ${s.done} · всего времени: ${formatDuration(s.totalSeconds)}`;
}

// ---------- Отрисовка списка ----------

const PRIORITY_ORDER = { HIGH: 0, MEDIUM: 1, LOW: 2 };
const PRIORITY_LABEL = { HIGH: 'Высокий', MEDIUM: 'Средний', LOW: 'Низкий' };
const STATUS_LABEL = { TODO: 'К выполнению', IN_PROGRESS: 'В работе', DONE: 'Готово' };

function render() {
    const list = document.getElementById('taskList');
    const sort = document.getElementById('sort').value;

    let view = tasks.filter(t => currentFilter === 'ALL' || t.status === currentFilter);

    view.sort((a, b) => {
        if (sort === 'deadline') {
            return (a.deadline || '9999') .localeCompare(b.deadline || '9999');
        }
        if (sort === 'created') {
            return (b.createdAt || '').localeCompare(a.createdAt || '');
        }
        return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    });

    list.innerHTML = '';
    document.getElementById('empty').classList.toggle('hidden', view.length > 0);

    const today = new Date().toISOString().slice(0, 10);

    for (const t of view) {
        const li = document.createElement('li');
        li.className = `task p-${t.priority}`;
        if (t.status === 'DONE') li.classList.add('done');
        if (t.id === activeTaskId && pomo.running) li.classList.add('running');

        const overdue = t.deadline && t.deadline < today && t.status !== 'DONE';

        li.innerHTML = `
            <input type="checkbox" ${t.status === 'DONE' ? 'checked' : ''} title="Отметить выполненной">
            <div class="task-body">
                <div class="task-title"></div>
                ${t.description ? '<div class="task-desc"></div>' : ''}
                <div class="meta">
                    <span class="badge">${STATUS_LABEL[t.status]}</span>
                    <span>Приоритет: ${PRIORITY_LABEL[t.priority]}</span>
                    ${t.deadline ? `<span class="${overdue ? 'overdue' : ''}">📅 ${formatDate(t.deadline)}${overdue ? ' (просрочено)' : ''}</span>` : ''}
                    <span>⏱ ${formatDuration(t.spentSeconds)}</span>
                </div>
            </div>
            <div class="task-actions">
                <button class="focus" title="Работать над задачей с Pomodoro">▶</button>
                <button class="edit secondary" title="Редактировать">✎</button>
                <button class="del secondary" title="Удалить">✕</button>
            </div>`;

        // textContent — защита от вставки HTML пользователем
        li.querySelector('.task-title').textContent = t.title;
        if (t.description) li.querySelector('.task-desc').textContent = t.description;

        li.querySelector('input[type=checkbox]').addEventListener('change', e =>
            changeStatus(t.id, e.target.checked ? 'DONE' : 'TODO'));
        li.querySelector('.focus').addEventListener('click', () => focusTask(t));
        li.querySelector('.edit').addEventListener('click', () => startEdit(t));
        li.querySelector('.del').addEventListener('click', () => deleteTask(t));

        list.appendChild(li);
    }
}

// ---------- Действия с задачами ----------

async function changeStatus(id, status) {
    await request(`/tasks/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
    loadTasks();
}

async function deleteTask(t) {
    if (!confirm(`Удалить «${t.title}»?`)) return;
    await request(`/tasks/${t.id}`, { method: 'DELETE' });
    if (activeTaskId === t.id) setActiveTask(null);
    toast('Задача удалена');
    loadTasks();
}

function startEdit(t) {
    document.getElementById('taskId').value = t.id;
    document.getElementById('title').value = t.title;
    document.getElementById('description').value = t.description || '';
    document.getElementById('priority').value = t.priority;
    document.getElementById('deadline').value = t.deadline || '';
    document.getElementById('formTitle').textContent = 'Редактирование';
    document.getElementById('saveBtn').textContent = 'Сохранить';
    document.getElementById('cancelEdit').classList.remove('hidden');
    document.getElementById('title').focus();
}

function resetForm() {
    document.getElementById('taskForm').reset();
    document.getElementById('taskId').value = '';
    document.getElementById('formTitle').textContent = 'Новая задача';
    document.getElementById('saveBtn').textContent = 'Добавить';
    document.getElementById('cancelEdit').classList.add('hidden');
}

document.getElementById('taskForm').addEventListener('submit', async e => {
    e.preventDefault();
    const id = document.getElementById('taskId').value;
    const existing = tasks.find(t => String(t.id) === id);
    const body = {
        title: document.getElementById('title').value.trim(),
        description: document.getElementById('description').value.trim(),
        priority: document.getElementById('priority').value,
        deadline: document.getElementById('deadline').value || null,
        status: existing ? existing.status : 'TODO'
    };
    try {
        if (id) {
            await request(`/tasks/${id}`, { method: 'PUT', body: JSON.stringify(body) });
            toast('Сохранено');
        } else {
            await request('/tasks', { method: 'POST', body: JSON.stringify(body) });
            toast('Задача добавлена');
        }
        resetForm();
        loadTasks();
    } catch (err) {
        toast(err.message);
    }
});

document.getElementById('cancelEdit').addEventListener('click', resetForm);

document.querySelectorAll('.filter').forEach(btn =>
    btn.addEventListener('click', () => {
        document.querySelectorAll('.filter').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilter = btn.dataset.filter;
        render();
    }));

document.getElementById('sort').addEventListener('change', render);

// ================================================================
//  Pomodoro-таймер
// ================================================================

const pomo = {
    running: false,
    isBreak: false,
    remaining: 25 * 60,   // секунд осталось
    endAt: 0,             // время окончания (мс) — так таймер не "плывёт"
    unsaved: 0,           // секунд работы, ещё не отправленных на сервер
    intervalId: null
};

const clockEl = document.getElementById('pomoClock');
const modeEl = document.getElementById('pomoMode');
const startBtn = document.getElementById('pomoStart');

function minutes(id) {
    return Math.max(1, parseInt(document.getElementById(id).value, 10) || 1);
}

function updateClock() {
    const m = Math.floor(pomo.remaining / 60);
    const s = pomo.remaining % 60;
    const text = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    clockEl.textContent = text;
    modeEl.textContent = pomo.isBreak ? 'Отдых' : 'Работа';
    modeEl.classList.toggle('break', pomo.isBreak);
    document.title = pomo.running ? `${text} — ${pomo.isBreak ? 'Отдых' : 'Работа'}` : 'Тайм-менеджер';
}

function tick() {
    const left = Math.max(0, Math.round((pomo.endAt - Date.now()) / 1000));
    const passed = pomo.remaining - left;
    if (passed > 0 && !pomo.isBreak) pomo.unsaved += passed;
    pomo.remaining = left;
    updateClock();

    // Каждую минуту сохраняем время на сервер
    if (pomo.unsaved >= 60) saveTime();

    if (left === 0) finishPhase();
}

function startPomo() {
    pomo.running = true;
    pomo.endAt = Date.now() + pomo.remaining * 1000;
    pomo.intervalId = setInterval(tick, 250);
    startBtn.textContent = 'Пауза';
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
    render();
}

function pausePomo() {
    pomo.running = false;
    clearInterval(pomo.intervalId);
    startBtn.textContent = 'Старт';
    saveTime();
    updateClock();
    render();
}

function resetPomo() {
    if (pomo.running) pausePomo();
    pomo.isBreak = false;
    pomo.remaining = minutes('workMin') * 60;
    updateClock();
}

function finishPhase() {
    pausePomo();
    beep();
    if (!pomo.isBreak) {
        const r = document.getElementById('rounds');
        r.textContent = Number(r.textContent) + 1;
        saveRounds(Number(r.textContent));
        notify('Помидор завершён!', 'Время отдохнуть 🍅');
        pomo.isBreak = true;
        pomo.remaining = minutes('breakMin') * 60;
    } else {
        notify('Перерыв окончен', 'Возвращаемся к работе 💪');
        pomo.isBreak = false;
        pomo.remaining = minutes('workMin') * 60;
    }
    updateClock();
    startPomo(); // автоматически запускаем следующую фазу
}

async function saveTime() {
    if (!activeTaskId || pomo.unsaved <= 0) { pomo.unsaved = 0; return; }
    const seconds = pomo.unsaved;
    pomo.unsaved = 0;
    try {
        await request(`/tasks/${activeTaskId}/time`, {
            method: 'POST', body: JSON.stringify({ seconds })
        });
        loadTasks();
    } catch (e) {
        pomo.unsaved += seconds; // не получилось — попробуем позже
    }
}

function focusTask(t) {
    if (activeTaskId && activeTaskId !== t.id) saveTime();
    setActiveTask(t);
    if (!pomo.running) {
        pomo.isBreak = false;
        pomo.remaining = minutes('workMin') * 60;
        startPomo();
    }
    toast(`Работаем над «${t.title}»`);
}

function setActiveTask(t) {
    activeTaskId = t ? t.id : null;
    document.getElementById('activeTask').textContent = t ? '🎯 ' + t.title : 'Задача не выбрана';
    render();
}

startBtn.addEventListener('click', () => pomo.running ? pausePomo() : startPomo());
document.getElementById('pomoReset').addEventListener('click', resetPomo);
['workMin', 'breakMin'].forEach(id =>
    document.getElementById(id).addEventListener('change', () => { if (!pomo.running) resetPomo(); }));

// Сохраняем время при закрытии вкладки
window.addEventListener('beforeunload', () => {
    if (activeTaskId && pomo.unsaved > 0) {
        fetch(`${API}/tasks/${activeTaskId}/time`, {
            method: 'POST', keepalive: true,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ seconds: pomo.unsaved })
        });
    }
});

// Счётчик помидоров за сегодня хранится в браузере
function saveRounds(n) {
    try { localStorage.setItem('rounds-' + new Date().toDateString(), n); } catch (e) { /* пусто */ }
}
function loadRounds() {
    try {
        document.getElementById('rounds').textContent =
            localStorage.getItem('rounds-' + new Date().toDateString()) || 0;
    } catch (e) { /* пусто */ }
}

// ---------- Утилиты ----------

function beep() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        [0, 0.3, 0.6].forEach(delay => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.frequency.value = 880;
            gain.gain.setValueAtTime(0.3, ctx.currentTime + delay);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.25);
            osc.connect(gain).connect(ctx.destination);
            osc.start(ctx.currentTime + delay);
            osc.stop(ctx.currentTime + delay + 0.25);
        });
    } catch (e) { /* звук не поддерживается */ }
}

function notify(title, body) {
    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title, { body });
    }
    toast(title);
}

function toast(msg) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove('show'), 2500);
}

function formatDuration(sec) {
    sec = sec || 0;
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    if (h > 0) return `${h} ч ${m} мин`;
    return `${m} мин`;
}

function formatDate(iso) {
    const [y, m, d] = iso.split('-');
    return `${d}.${m}.${y}`;
}

// ---------- Старт ----------
loadRounds();
updateClock();
loadTasks();
