/// <reference path="../types.js" />

const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MONTHS_FULL = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

function fmtDate(y, m, d) {
  const date = new Date(Date.UTC(y, m, d));
  return date.toISOString().slice(0, 10);
}

function getColumnIndex(date) {
  const d = date.getUTCDay();
  return d === 0 ? 6 : d - 1;
}

export function getWeekRange(date) {
  const d = date.getUTCDay();
  const mondayOffset = d === 0 ? -6 : 1 - d;
  const monday = new Date(date);
  monday.setUTCDate(date.getUTCDate() + mondayOffset);

  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);

  return {
    startStr: fmtDate(monday.getUTCFullYear(), monday.getUTCMonth(), monday.getUTCDate()),
    endStr: fmtDate(sunday.getUTCFullYear(), sunday.getUTCMonth(), sunday.getUTCDate()),
  };
}

function formatWeekLabel(startStr, endStr) {
  const [sy, sm, sd] = startStr.split('-').map(Number);
  const [ey, em, ed] = endStr.split('-').map(Number);
  if (sm === em) {
    return `${sd} \u2014 ${ed} ${MONTHS_SHORT[sm - 1]} ${sy}`;
  }
  return `${sd} ${MONTHS_SHORT[sm - 1]} \u2014 ${ed} ${MONTHS_SHORT[em - 1]} ${ey}`;
}

function isInWeek(dateStr, startStr, endStr) {
  if (!startStr || !endStr) return false;
  return dateStr >= startStr && dateStr <= endStr;
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export function renderWeekPickerButton(selectedStart, selectedEnd) {
  const label = selectedStart && selectedEnd ? formatWeekLabel(selectedStart, selectedEnd) : '';
  const pickerContent = label
    ? `<span class="week-picker-icon">\uD83D\uDCC5</span><span class="week-picker-label">${label}</span>`
    : `<span class="week-picker-icon">\uD83D\uDCC5</span><span class="week-picker-placeholder">Seleccionar semana</span>`;
  const clearBtn = label
    ? `<button type="button" class="btn-week-clear" aria-label="Limpiar filtro de semana">\u2715</button>`
    : '';

  return `
    <span class="week-picker-wrapper">
      <input type="hidden" class="filter-week-start" value="${selectedStart || ''}">
      <input type="hidden" class="filter-week-end" value="${selectedEnd || ''}">
      <button type="button" class="btn btn-secondary btn-week-picker" aria-label="Seleccionar semana">${pickerContent}</button>
      ${clearBtn}
    </span>`;
}

function updateButtonDisplay(wrapper, startStr, endStr) {
  const picker = wrapper.querySelector('.btn-week-picker');
  if (!picker) return;
  const label = startStr && endStr ? formatWeekLabel(startStr, endStr) : '';
  picker.innerHTML = label
    ? `<span class="week-picker-icon">\uD83D\uDCC5</span><span class="week-picker-label">${label}</span>`
    : `<span class="week-picker-icon">\uD83D\uDCC5</span><span class="week-picker-placeholder">Seleccionar semana</span>`;

  let clearBtn = wrapper.querySelector('.btn-week-clear');
  if (label) {
    if (!clearBtn) {
      clearBtn = document.createElement('button');
      clearBtn.type = 'button';
      clearBtn.className = 'btn-week-clear';
      clearBtn.setAttribute('aria-label', 'Limpiar filtro de semana');
      clearBtn.textContent = '\u2715';
      picker.after(clearBtn);
    }
  } else {
    if (clearBtn) clearBtn.remove();
  }
}

export function resetWeekPicker() {
  const wrapper = document.querySelector('.week-picker-wrapper');
  if (!wrapper) return;
  const ws = wrapper.querySelector('.filter-week-start');
  const we = wrapper.querySelector('.filter-week-end');
  if (ws) ws.value = '';
  if (we) we.value = '';
  updateButtonDisplay(wrapper, '', '');
}

// ─── Calendar panel ──────────────────────────────────────────────────────────

export function toggleCalendarPanel(buttonEl) {
  const existing = document.querySelector('.calendar-panel');
  if (existing) {
    closeCalendarPanel();
    return;
  }
  openCalendarPanel(buttonEl);
}

function openCalendarPanel(buttonEl) {
  closeCalendarPanel();

  const wrapper = buttonEl.closest('.week-picker-wrapper');
  const startVal = wrapper.querySelector('.filter-week-start').value;
  const endVal = wrapper.querySelector('.filter-week-end').value;

  let displayYear, displayMonth;
  if (startVal) {
    const d = new Date(startVal + 'T12:00:00');
    displayYear = d.getFullYear();
    displayMonth = d.getMonth();
  } else {
    const now = new Date();
    displayYear = now.getFullYear();
    displayMonth = now.getMonth();
  }

  const panel = document.createElement('div');
  panel.className = 'calendar-panel';
  panel.dataset.year = displayYear;
  panel.dataset.month = displayMonth;
  renderPanelContent(panel, displayYear, displayMonth, startVal, endVal);
  wrapper.appendChild(panel);

  requestAnimationFrame(() => {
    const rect = panel.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
      panel.style.left = 'auto';
      panel.style.right = '0';
    }
    if (rect.bottom > window.innerHeight) {
      panel.style.top = 'auto';
      panel.style.bottom = '100%';
    }
  });

  panel.addEventListener('click', (e) => handlePanelClick(e, panel, wrapper));

  const close = (e) => {
    if (!panel.contains(e.target) && e.target !== buttonEl && !buttonEl.contains(e.target)) {
      closeCalendarPanel();
    }
  };
  const onKey = (e) => {
    if (e.key === 'Escape') { closeCalendarPanel(); }
  };
  setTimeout(() => {
    document.addEventListener('click', close);
    document.addEventListener('keydown', onKey);
    panel._closeListeners = { close, onKey };
  }, 0);
}

export function closeCalendarPanel() {
  const panel = document.querySelector('.calendar-panel');
  if (!panel) return;
  if (panel._closeListeners) {
    document.removeEventListener('click', panel._closeListeners.close);
    document.removeEventListener('keydown', panel._closeListeners.onKey);
  }
  panel.remove();
}

function handlePanelClick(e, panel, wrapper) {
  const navBtn = e.target.closest('.calendar-nav');
  if (navBtn) {
    e.stopPropagation();
    const dir = navBtn.dataset.dir;
    let year = parseInt(panel.dataset.year);
    let month = parseInt(panel.dataset.month);
    if (dir === 'prev') {
      month--;
      if (month < 0) { month = 11; year--; }
    } else {
      month++;
      if (month > 11) { month = 0; year++; }
    }
    panel.dataset.year = year;
    panel.dataset.month = month;
    const startVal = wrapper.querySelector('.filter-week-start').value;
    const endVal = wrapper.querySelector('.filter-week-end').value;
    renderPanelContent(panel, year, month, startVal, endVal);
    return;
  }

  const dayBtn = e.target.closest('.calendar-day');
  if (dayBtn && dayBtn.dataset.date) {
    e.stopPropagation();
    const date = new Date(dayBtn.dataset.date + 'T12:00:00');
    const { startStr, endStr } = getWeekRange(date);

    const startInput = wrapper.querySelector('.filter-week-start');
    const endInput = wrapper.querySelector('.filter-week-end');
    startInput.value = startStr;
    endInput.value = endStr;

    updateButtonDisplay(wrapper, startStr, endStr);
    closeCalendarPanel();

    startInput.dispatchEvent(new Event('change', { bubbles: true }));
    return;
  }
}

function renderPanelContent(panel, year, month, startVal, endVal) {
  const firstDay = new Date(Date.UTC(year, month, 1));
  const lastDay = new Date(Date.UTC(year, month + 1, 0));
  const daysInMonth = lastDay.getUTCDate();
  const startCol = getColumnIndex(firstDay);

  const prevMDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const today = todayStr();

  let html = `
    <div class="calendar-header">
      <button type="button" class="calendar-nav calendar-nav-prev" data-dir="prev" aria-label="Mes anterior">\u2190</button>
      <span class="calendar-month-year">${MONTHS_FULL[month]} ${year}</span>
      <button type="button" class="calendar-nav calendar-nav-next" data-dir="next" aria-label="Mes siguiente">\u2192</button>
    </div>
    <div class="calendar-weekdays">
      ${WEEKDAYS.map(w => `<span class="calendar-weekday">${w}</span>`).join('')}
    </div>
    <div class="calendar-grid">`;

  let cellCount = 0;

  for (let i = startCol - 1; i >= 0; i--) {
    const day = prevMDay - i;
    const dateStr = fmtDate(year, month - 1, day);
    const inWeek = isInWeek(dateStr, startVal, endVal);
    html += `<button type="button" class="calendar-day calendar-day--other${inWeek ? ' calendar-day--in-week' : ''}" data-date="${dateStr}">${day}</button>`;
    cellCount++;
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = fmtDate(year, month, day);
    const isToday = dateStr === today;
    const inWeek = isInWeek(dateStr, startVal, endVal);
    html += `<button type="button" class="calendar-day${isToday ? ' calendar-day--today' : ''}${inWeek ? ' calendar-day--in-week' : ''}" data-date="${dateStr}">${day}</button>`;
    cellCount++;
  }

  const remaining = 42 - cellCount;
  for (let day = 1; day <= remaining; day++) {
    const dateStr = fmtDate(year, month + 1, day);
    const inWeek = isInWeek(dateStr, startVal, endVal);
    html += `<button type="button" class="calendar-day calendar-day--other${inWeek ? ' calendar-day--in-week' : ''}" data-date="${dateStr}">${day}</button>`;
    cellCount++;
  }

  html += `</div>`;

  panel.innerHTML = html;
}
