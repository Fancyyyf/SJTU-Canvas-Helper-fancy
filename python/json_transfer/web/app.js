const $ = (id) => document.getElementById(id);
const state = { items: [], course: 'web2', stem: null, lesson: null, language: 'res', size: 17, query: '', job: null };

async function getJSON(url, options) {
  const response = await fetch(url, options);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
  return data;
}

function label(item) {
  if (item.lesson === null) return item.stem;
  return `第 ${item.lesson} 次课 · ${item.part === 1 ? '上半节' : '下半节'}`;
}

function groupLabel(item) {
  return item.lesson === null ? '其他文件' : `第 ${item.lesson} 次课`;
}

function selectedItems() {
  return state.items.filter(item => item.course === state.course);
}

async function refreshLibrary(initial = false) {
  const data = await getJSON('/api/library');
  state.items = data.items;
  $('libraryTotal').textContent = `${data.items.length} 份字幕`;
  if (initial && !$('urlInput').value) $('urlInput').value = data.defaultUrl;
  const courses = [...new Set(data.items.map(item => item.course))];
  if (!courses.includes(state.course)) state.course = courses[0] || '';
  $('courseSelect').replaceChildren(...courses.map(course => {
    const option = document.createElement('option');
    option.value = course;
    option.textContent = course === '其他课程' ? course : `${course} · ${data.items.filter(item => item.course === course).length} 节`;
    return option;
  }));
  $('courseSelect').value = state.course;
  renderCatalog();
  if ((initial || !state.stem) && selectedItems().length) await selectLesson(selectedItems()[0].stem);
}

function renderCatalog() {
  const items = selectedItems();
  $('courseCount').textContent = items.length;
  const list = $('lessonList');
  list.replaceChildren();
  const groups = new Map();
  for (const item of items) {
    const title = groupLabel(item);
    if (!groups.has(title)) groups.set(title, []);
    groups.get(title).push(item);
  }
  for (const [title, group] of groups) {
    const section = document.createElement('section'); section.className = 'lesson-group';
    const heading = document.createElement('h3'); heading.className = 'group-title'; heading.textContent = title; section.append(heading);
    for (const item of group) {
      const button = document.createElement('button');
      button.type = 'button'; button.className = `lesson-link${item.stem === state.stem ? ' active' : ''}`;
      button.setAttribute('aria-current', item.stem === state.stem ? 'page' : 'false');
      const number = document.createElement('span'); number.className = 'lesson-number'; number.textContent = item.part || '·';
      const copy = document.createElement('span');
      const strong = document.createElement('strong'); strong.textContent = item.lesson === null ? item.stem : item.part === 1 ? '上半节' : '下半节';
      const small = document.createElement('small'); small.textContent = item.hasText ? 'JSON + TXT 已就绪' : 'JSON 已就绪';
      copy.append(strong, small); button.append(number, copy);
      button.addEventListener('click', () => selectLesson(item.stem));
      section.append(button);
    }
    list.append(section);
  }
}

function formatTime(ms) {
  if (typeof ms !== 'number') return '--:--';
  const seconds = Math.floor(ms / 1000);
  const h = Math.floor(seconds / 3600), m = Math.floor((seconds % 3600) / 60), s = seconds % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

async function selectLesson(stem) {
  state.stem = stem; state.query = ''; $('searchInput').value = '';
  renderCatalog();
  $('lessonTitle').textContent = '正在加载字幕…';
  try {
    state.lesson = await getJSON(`/api/lesson?stem=${encodeURIComponent(stem)}`);
    const item = state.items.find(entry => entry.stem === stem);
    $('lessonTitle').textContent = item ? label(item) : stem;
    $('lessonMeta').textContent = `${stem}.json · 课程 ID ${state.lesson.courseId ?? '未知'}`;
    $('downloadBtn').href = `/api/download?stem=${encodeURIComponent(stem)}`;
    $('downloadBtn').classList.toggle('hidden', !state.lesson.textAvailable);
    const last = state.lesson.segments.at(-1);
    $('durationText').textContent = last ? `时长 ${formatTime(last.ed)}` : '';
    renderSegments();
    $('segments').scrollTop = 0;
    updateStepper();
  } catch (error) {
    $('lessonTitle').textContent = '读取失败';
    $('lessonMeta').textContent = error.message;
  }
}

function segmentValue(segment) {
  return segment[state.language] || (state.language === 'res' ? '' : segment.res) || '';
}

function highlight(node, value, query) {
  if (!query) { node.textContent = value; return; }
  const lower = value.toLocaleLowerCase(), needle = query.toLocaleLowerCase();
  let start = 0, index;
  while ((index = lower.indexOf(needle, start)) !== -1) {
    node.append(document.createTextNode(value.slice(start, index)));
    const mark = document.createElement('mark'); mark.textContent = value.slice(index, index + query.length); node.append(mark);
    start = index + query.length;
  }
  node.append(document.createTextNode(value.slice(start)));
}

function renderSegments() {
  if (!state.lesson) return;
  const query = state.query.trim();
  const entries = state.lesson.segments.filter(segment => segmentValue(segment).toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  $('resultCount').textContent = query ? `${entries.length} / ${state.lesson.segments.length} 段匹配` : `${entries.length} 段字幕`;
  const root = $('segments'); root.replaceChildren();
  if (!entries.length) {
    const empty = document.createElement('div'); empty.className = 'empty-state'; empty.textContent = query ? '没有找到匹配的字幕' : '这节课暂无字幕内容'; root.append(empty); return;
  }
  const fragment = document.createDocumentFragment();
  for (const segment of entries) {
    const row = document.createElement('article'); row.className = 'segment';
    const time = document.createElement('span'); time.className = 'segment-time'; time.textContent = formatTime(segment.bg);
    const content = document.createElement('div'); content.className = 'segment-text';
    highlight(content, segmentValue(segment), query);
    row.append(time, content); fragment.append(row);
  }
  root.append(fragment);
}

function updateStepper() {
  const items = selectedItems(); const index = items.findIndex(item => item.stem === state.stem);
  $('prevBtn').disabled = index <= 0;
  $('nextBtn').disabled = index < 0 || index >= items.length - 1;
}

function moveLesson(delta) {
  const items = selectedItems(); const index = items.findIndex(item => item.stem === state.stem);
  if (items[index + delta]) selectLesson(items[index + delta].stem);
}

function renderJob(job) {
  state.job = job;
  const running = job.status === 'running';
  const names = { idle: '待运行', running: '进行中', done: '已完成', error: '有异常', stopped: '已停止' };
  $('statusBadge').textContent = names[job.status] || job.status;
  $('statusBadge').className = `status-badge ${job.status}`;
  $('statusText').textContent = job.message;
  $('progressRatio').textContent = `${job.done} / ${job.total}`;
  $('currentStem').textContent = job.current || '尚未开始';
  $('progressFill').style.width = job.total ? `${Math.min(100, job.done / job.total * 100)}%` : '0%';
  $('startBtn').disabled = running;
  $('stopBtn').hidden = !running;
  $('confirmLoginBtn').hidden = !(running && job.phase === 'login');
  $('failureList').replaceChildren(...job.failures.map(failure => {
    const item = document.createElement('li'); item.textContent = `${failure.stem}: ${failure.error}`; return item;
  }));
}

async function pollJob() {
  try {
    const previous = state.job;
    const next = await getJSON('/api/job');
    renderJob(next);
    if (next.done !== previous?.done || next.status !== previous?.status) await refreshLibrary();
  } catch (error) { $('statusText').textContent = error.message; }
}

$('courseSelect').addEventListener('change', async event => {
  state.course = event.target.value;
  state.stem = null;
  renderCatalog();
  if (selectedItems().length) await selectLesson(selectedItems()[0].stem);
});
$('refreshBtn').addEventListener('click', () => refreshLibrary().catch(error => alert(error.message)));
$('prevBtn').addEventListener('click', () => moveLesson(-1));
$('nextBtn').addEventListener('click', () => moveLesson(1));
$('searchInput').addEventListener('input', event => { state.query = event.target.value; renderSegments(); });
$('languageSelect').addEventListener('change', event => { state.language = event.target.value; renderSegments(); });
$('smallerBtn').addEventListener('click', () => { state.size = Math.max(14, state.size - 1); $('segments').style.setProperty('--reading-size', `${state.size}px`); });
$('largerBtn').addEventListener('click', () => { state.size = Math.min(24, state.size + 1); $('segments').style.setProperty('--reading-size', `${state.size}px`); });
$('copyBtn').addEventListener('click', async () => {
  if (!state.lesson) return;
  await navigator.clipboard.writeText(state.lesson.segments.map(segmentValue).join(''));
  $('copyBtn').textContent = '已复制'; setTimeout(() => $('copyBtn').textContent = '复制', 1700);
});
$('fetchForm').addEventListener('submit', async event => {
  event.preventDefault();
  try {
    const job = await getJSON('/api/start', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: $('urlInput').value.trim(), name: $('nameInput').value.trim() }) });
    renderJob(job);
  } catch (error) { $('statusText').textContent = error.message; }
});
$('stopBtn').addEventListener('click', async () => { await getJSON('/api/stop', { method: 'POST' }); $('statusText').textContent = '正在停止…'; });
$('confirmLoginBtn').addEventListener('click', async () => {
  try { renderJob(await getJSON('/api/confirm-login', { method: 'POST' })); }
  catch (error) { $('statusText').textContent = error.message; }
});
document.addEventListener('keydown', event => {
  if (event.altKey && event.key === 'ArrowLeft') { event.preventDefault(); moveLesson(-1); }
  if (event.altKey && event.key === 'ArrowRight') { event.preventDefault(); moveLesson(1); }
});

Promise.all([refreshLibrary(true), pollJob()]).catch(error => $('statusText').textContent = error.message);
setInterval(pollJob, 2000);
