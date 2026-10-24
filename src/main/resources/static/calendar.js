// ================================================================
//  Календарь (FullCalendar) — общается с Spring Boot через /api/events
// ================================================================

const COLORS = ['#039be5', '#7986cb', '#33b679', '#8e24aa', '#e67c73',
                '#f6bf26', '#f4511e', '#0b8043', '#3f51b5', '#d50000', '#616161'];
const TASK_COLOR = '#8e24aa';

const isMobile = () => window.matchMedia('(max-width: 800px)').matches;

// ---------- Утилиты для дат ----------

const pad = n => String(n).padStart(2, '0');
const toDateStr = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const toTimeStr = d => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const toLocalIso = d => `${toDateStr(d)}T${toTimeStr(d)}:00`;   // без часового пояса
const addMinutes = (d, m) => new Date(d.getTime() + m * 60000);
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

async function request(url, options = {}) {
    const res = await fetch(url, {
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

function toast(msg) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove('show'), 2500);
}

// ---------- Источники данных для календаря ----------

// 1) События из /api/events
async function loadEvents(info, success, failure) {
    try {
        const list = await request(
            `/api/events?start=${toLocalIso(info.start)}&end=${toLocalIso(info.end)}`);
        success(list.map(e => ({
            id: String(e.id),
            title: e.title,
            start: e.start,
            end: e.end,
            allDay: e.allDay,
            backgroundColor: e.color,
            borderColor: e.color,
            extendedProps: { type: 'event', description: e.description || '', color: e.color }
        })));
    } catch (err) {
        toast('Не удалось загрузить события: ' + err.message);
        failure(err);
    }
}

// 2) Дедлайны задач из /api/tasks (только просмотр)
async function loadTaskDeadlines(info, success, failure) {
    if (!document.getElementById('showTasks').checked) { success([]); return; }
    try {
        const tasks = await request('/api/tasks');
        success(tasks
            .filter(t => t.deadline)
            .map(t => ({
                id: 'task-' + t.id,
                title: (t.status === 'DONE' ? '✔ ' : '📌 ') + t.title,
                start: t.deadline,
                allDay: true,
                editable: false,
                backgroundColor: TASK_COLOR,
                borderColor: TASK_COLOR,
                classNames: t.status === 'DONE' ? ['task-done'] : [],
                extendedProps: { type: 'task' }
            })));
    } catch (err) {
        failure(err);
    }
}

// ---------- Сам календарь ----------

const calendar = new FullCalendar.Calendar(document.getElementById('calendar'), {
    locale: 'ru',
    firstDay: 1,
    height: 'auto',
    initialView: isMobile() ? 'listWeek' : 'timeGridWeek',
    headerToolbar: isMobile()
        ? { left: 'prev,next today', center: '', right: 'title' }
        : { left: 'today prev,next title', center: '', right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek' },
    footerToolbar: isMobile() ? { center: 'timeGridDay,listWeek,dayGridMonth' } : false,
    buttonText: { today: 'Сегодня', month: 'Месяц', week: 'Неделя', day: 'День', list: 'Список' },
    nowIndicator: true,
    navLinks: true,
    selectable: true,
    selectMirror: true,
    editable: true,
    dayMaxEvents: true,
    longPressDelay: 350,
    slotDuration: '00:30:00',
    scrollTime: '08:00:00',
    allDayText: 'Весь день',
    noEventsText: 'Нет событий',
    eventTimeFormat: { hour: '2-digit', minute: '2-digit', hour12: false },
    slotLabelFormat: { hour: '2-digit', minute: '2-digit', hour12: false },
    eventSources: [
        { id: 'events', events: loadEvents },
        { id: 'tasks', events: loadTaskDeadlines }
    ],

    // выделили промежуток → новое событие
    select: info => {
        openDialog(null, info.start, info.end, info.allDay);
        calendar.unselect();
    },

    // клик по событию → редактирование
    eventClick: info => {
        info.jsEvent.preventDefault();
        const ev = info.event;
        if (ev.extendedProps.type === 'task') {
            toast('Это дедлайн задачи — откройте вкладку «Задачи», чтобы изменить');
            return;
        }
        openDialog(ev);
    },

    // перетащили или растянули → сохраняем
    eventDrop: info => saveMoved(info),
    eventResize: info => saveMoved(info),

    // при повороте телефона / изменении окна
    windowResize: () => {
        if (isMobile() && calendar.view.type === 'timeGridWeek') calendar.changeView('timeGridDay');
    }
});
calendar.render();

async function saveMoved(info) {
    const ev = info.event;
    const start = ev.start;
    let end = ev.end;
    if (!end) end = ev.allDay ? addDays(start, 1) : addMinutes(start, 60);
    try {
        await request(`/api/events/${ev.id}`, {
            method: 'PUT',
            body: JSON.stringify({
                title: ev.title,
                description: ev.extendedProps.description,
                start: toLocalIso(start),
                end: toLocalIso(end),
                allDay: ev.allDay,
                color: ev.extendedProps.color
            })
        });
        toast('Перенесено');
    } catch (err) {
        info.revert();
        toast(err.message);
    }
}

// ================================================================
//  Диалог события
// ================================================================

const dlg = document.getElementById('eventDialog');
const $ = id => document.getElementById(id);
let editingId = null;
let selectedColor = COLORS[0];

// палитра цветов
const colorsBox = $('colors');
COLORS.forEach(c => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'color-dot';
    b.style.background = c;
    b.title = c;
    b.addEventListener('click', () => selectColor(c));
    colorsBox.appendChild(b);
});

function selectColor(c) {
    selectedColor = c;
    colorsBox.querySelectorAll('.color-dot').forEach(b =>
        b.classList.toggle('selected', b.title === c));
}

function toggleTimeInputs() {
    const allDay = $('evAllDay').checked;
    $('evStartTime').classList.toggle('hidden', allDay);
    $('evEndTime').classList.toggle('hidden', allDay);
}
$('evAllDay').addEventListener('change', toggleTimeInputs);

// при изменении начала сдвигаем конец, чтобы длительность сохранилась
let lastStart = null;
['evStartDate', 'evStartTime'].forEach(id => $(id).addEventListener('change', () => {
    const newStart = readDate('evStartDate', 'evStartTime');
    const end = readDate('evEndDate', 'evEndTime');
    if (lastStart && newStart && end) {
        const moved = new Date(end.getTime() + (newStart - lastStart));
        $('evEndDate').value = toDateStr(moved);
        $('evEndTime').value = toTimeStr(moved);
    }
    lastStart = newStart;
}));

function readDate(dateId, timeId) {
    const d = $(dateId).value;
    if (!d) return null;
    const t = $('evAllDay').checked ? '00:00' : ($(timeId).value || '00:00');
    return new Date(`${d}T${t}:00`);
}

/**
 * Открыть окно. ev — существующее событие FullCalendar или null для нового.
 */
function openDialog(ev, start, end, allDay) {
    if (ev) {
        editingId = ev.id;
        start = ev.start;
        allDay = ev.allDay;
        end = ev.end || (allDay ? addDays(start, 1) : addMinutes(start, 60));
        $('evTitle').value = ev.title;
        $('evDesc').value = ev.extendedProps.description || '';
        selectColor(ev.extendedProps.color || COLORS[0]);
        $('dlgTitle').textContent = 'Изменить событие';
        $('evDelete').classList.remove('hidden');
    } else {
        editingId = null;
        if (!start) {
            // кнопка «Создать»: ближайший час
            start = new Date();
            start.setMinutes(0, 0, 0);
            start = addMinutes(start, 60);
            end = addMinutes(start, 60);
            allDay = false;
        }
        // в месячном виде клик по дню → по умолчанию 9:00–10:00
        if (allDay && calendar.view.type === 'dayGridMonth' && end - start === 86400000) {
            allDay = false;
            start = new Date(start); start.setHours(9, 0, 0, 0);
            end = addMinutes(start, 60);
        }
        $('evTitle').value = '';
        $('evDesc').value = '';
        selectColor(COLORS[0]);
        $('dlgTitle').textContent = 'Новое событие';
        $('evDelete').classList.add('hidden');
    }

    $('evAllDay').checked = !!allDay;
    // для «весь день» FullCalendar хранит конец как следующий день — показываем включительно
    const shownEnd = allDay ? addDays(end, -1) : end;
    $('evStartDate').value = toDateStr(start);
    $('evStartTime').value = toTimeStr(start);
    $('evEndDate').value = toDateStr(shownEnd);
    $('evEndTime').value = toTimeStr(shownEnd);
    lastStart = readDate('evStartDate', 'evStartTime');
    toggleTimeInputs();

    dlg.showModal();
    if (!isMobile()) $('evTitle').focus();
}

function closeDialog() { dlg.close(); }
$('dlgClose').addEventListener('click', closeDialog);
$('evCancel').addEventListener('click', closeDialog);
dlg.addEventListener('click', e => { if (e.target === dlg) closeDialog(); }); // клик по фону

$('eventForm').addEventListener('submit', async e => {
    e.preventDefault();
    const allDay = $('evAllDay').checked;
    const start = readDate('evStartDate', 'evStartTime');
    let end = readDate('evEndDate', 'evEndTime');
    if (allDay) end = addDays(end, 1);           // обратно в формат «до следующего дня»
    if (end <= start) { toast('Окончание должно быть позже начала'); return; }

    const body = JSON.stringify({
        title: $('evTitle').value.trim(),
        description: $('evDesc').value.trim(),
        start: toLocalIso(start),
        end: toLocalIso(end),
        allDay,
        color: selectedColor
    });
    try {
        if (editingId) {
            await request(`/api/events/${editingId}`, { method: 'PUT', body });
            toast('Сохранено');
        } else {
            await request('/api/events', { method: 'POST', body });
            toast('Событие создано');
        }
        closeDialog();
        calendar.getEventSourceById('events').refetch();
    } catch (err) {
        toast(err.message);
    }
});

$('evDelete').addEventListener('click', async () => {
    if (!editingId || !confirm('Удалить событие?')) return;
    try {
        await request(`/api/events/${editingId}`, { method: 'DELETE' });
        closeDialog();
        calendar.getEventSourceById('events').refetch();
        toast('Удалено');
    } catch (err) {
        toast(err.message);
    }
});

// ---------- Кнопки «Создать» и галочка задач ----------

$('createBtn').addEventListener('click', () => openDialog(null));
$('fab').addEventListener('click', () => openDialog(null));
$('showTasks').addEventListener('change', () => calendar.getEventSourceById('tasks').refetch());
