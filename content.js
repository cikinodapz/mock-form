// mock-form - content.js (v2 — Full HTML Input Support)
// ============================================================
// Supports: text, email, tel, url, number, password, search,
//   date, time, datetime-local, month, week, color, range,
//   checkbox, radio, select (single & multiple), textarea,
//   file (info-only), contenteditable, custom combobox/ARIA
// ============================================================

(function () {
  if (window.__mockFormLoaded) return;
  window.__mockFormLoaded = true;

  const SKIP_TYPES = new Set(['hidden', 'submit', 'button', 'reset', 'image']);
  const SKIP_CLASSES = ['captcha', 'honeypot', 'recaptcha', 'g-recaptcha', 'h-captcha'];

  // ============================================================
  // LABEL DETECTION
  // ============================================================
  function findLabel(el) {
    // 1. <label for="id">
    if (el.id) {
      try {
        const lbl = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
        if (lbl) return cleanText(lbl);
      } catch { }
    }
    // 2. Ancestor <label>
    const ancestorLabel = el.closest('label');
    if (ancestorLabel) return cleanText(ancestorLabel, el);
    // 3. aria-label
    const ariaLabel = el.getAttribute('aria-label');
    if (ariaLabel) return ariaLabel.trim();
    // 4. aria-labelledby
    const labelledBy = el.getAttribute('aria-labelledby');
    if (labelledBy) {
      const lblEl = document.getElementById(labelledBy);
      if (lblEl) return cleanText(lblEl);
    }
    // 5. Walk up DOM looking for label-like siblings
    let node = el.parentElement;
    for (let i = 0; i < 4 && node; i++, node = node.parentElement) {
      const candidates = node.querySelectorAll('label, .label, .form-label, legend, dt');
      for (const c of candidates) {
        if (!c.contains(el)) {
          const txt = cleanText(c);
          if (txt && txt.length < 120) return txt;
        }
      }
    }
    // 6. Previous sibling
    const prev = el.previousElementSibling;
    if (prev) {
      const txt = cleanText(prev);
      if (txt && txt.length < 80) return txt;
    }
    return el.placeholder || el.title || el.name || '';
  }

  function cleanText(el, skipChild) {
    const clone = el.cloneNode(true);
    clone.querySelectorAll('input,select,textarea,button,svg').forEach(c => c.remove());
    return clone.innerText?.replace(/[\r\n]+/g, ' ').replace(/\s{2,}/g, ' ').trim() || '';
  }

  // ============================================================
  // FIELD SCANNING
  // ============================================================
  function isVisible(el) {
    const s = window.getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return s.display !== 'none' && s.visibility !== 'hidden' && s.opacity !== '0'
      && (r.width > 0 || r.height > 0);
  }

  function shouldSkip(el) {
    const classStr = (el.className || '').toLowerCase();
    const idStr = (el.id || '').toLowerCase();
    return SKIP_CLASSES.some(c => classStr.includes(c) || idStr.includes(c));
  }

  function getNormalizedType(el) {
    const tag = el.tagName;
    const type = (el.type || '').toLowerCase();
    const role = (el.getAttribute('role') || '').toLowerCase();
    if (tag === 'TEXTAREA') return 'textarea';
    if (tag === 'SELECT') return el.multiple ? 'select-multiple' : 'select';
    if (el.getAttribute('contenteditable') === 'true') return 'contenteditable';
    if (role === 'combobox' || role === 'listbox') return 'combobox';
    if (role === 'switch') return 'checkbox';
    if (role === 'slider' || role === 'spinbutton') return 'number';
    if (tag === 'INPUT') {
      if (SKIP_TYPES.has(type)) return null;
      return type || 'text';
    }
    return null;
  }

  function getFormFields() {
    const fields = [];
    const seenEls = new WeakSet();
    const radioGroupsSeen = new Set();

    const selector = [
      'input:not([disabled])',
      'textarea:not([disabled])',
      'select:not([disabled])',
      '[contenteditable="true"]',
      '[role="combobox"]:not([disabled])',
      '[role="listbox"]:not([disabled])',
    ].join(',');

    document.querySelectorAll(selector).forEach(el => {
      if (seenEls.has(el)) return;
      if (!isVisible(el)) return;
      if (shouldSkip(el)) return;

      const normalizedType = getNormalizedType(el);
      if (!normalizedType) return;

      const type = (el.type || '').toLowerCase();

      // Group radio by name
      if (type === 'radio' && el.name) {
        if (radioGroupsSeen.has(el.name)) {
          seenEls.add(el); // skip duplicates
          return;
        }
        radioGroupsSeen.add(el.name);
      }

      seenEls.add(el);

      const label = findLabel(el);
      const field = {
        index: fields.length,
        id: el.id || '',
        name: el.name || el.getAttribute('name') || '',
        type: normalizedType,
        label,
        placeholder: el.placeholder || '',
        required: el.required || el.getAttribute('aria-required') === 'true',
        currentValue: getCurrentValue(el),
      };

      // SELECT options
      if (el.tagName === 'SELECT') {
        field.options = Array.from(el.options)
          .filter(o => o.value !== '' || o.text.trim() !== '')
          .map(o => ({ value: o.value, label: o.text.trim() }));
        field.multiple = el.multiple;
      }

      // RADIO options
      if (type === 'radio' && el.name) {
        const allRadios = document.querySelectorAll(`input[type="radio"][name="${el.name}"]`);
        field.options = Array.from(allRadios).map(r => ({
          value: r.value,
          label: findLabel(r) || r.value,
        }));
        const legend = el.closest('fieldset')?.querySelector('legend');
        if (legend) field.label = cleanText(legend);
        allRadios.forEach(r => seenEls.add(r));
      }

      // CHECKBOX
      if (type === 'checkbox') {
        field.checked = el.checked;
      }

      // RANGE
      if (type === 'range') {
        field.min = el.min || '0';
        field.max = el.max || '100';
        field.step = el.step || '1';
      }

      // NUMBER
      if (type === 'number') {
        if (el.min) field.min = el.min;
        if (el.max) field.max = el.max;
      }

      // FILE
      if (type === 'file') {
        field.accept = el.accept || '*';
        field.multiple = el.multiple;
      }

      // DATALIST suggestions
      if (el.list) {
        field.suggestions = Array.from(el.list.options).map(o => o.value).filter(Boolean);
      }

      // COMBOBOX aria
      if (normalizedType === 'combobox') {
        const listId = el.getAttribute('aria-controls') || el.getAttribute('aria-owns') || el.getAttribute('list');
        if (listId) {
          const list = document.getElementById(listId);
          if (list) {
            field.options = Array.from(list.querySelectorAll('option,[role="option"],li'))
              .map(o => ({ value: o.getAttribute('data-value') || o.value || o.textContent.trim(), label: o.textContent.trim() }));
          }
        }
      }

      fields.push(field);
    });

    return fields;
  }

  function getCurrentValue(el) {
    const type = (el.type || '').toLowerCase();
    if (type === 'checkbox' || type === 'radio') return el.checked ? 'true' : 'false';
    if (el.getAttribute('contenteditable') === 'true') return el.innerText || '';
    return el.value || '';
  }

  // ============================================================
  // ELEMENT MAP (index -> DOM element)
  // ============================================================
  function buildElementMap(fields) {
    const map = new Map();
    const seenEls = new WeakSet();
    const radioGroupsAdded = new Set();

    const selector = [
      'input:not([disabled])',
      'textarea:not([disabled])',
      'select:not([disabled])',
      '[contenteditable="true"]',
      '[role="combobox"]:not([disabled])',
    ].join(',');

    const domEls = Array.from(document.querySelectorAll(selector)).filter(el => {
      if (!isVisible(el)) return false;
      if (shouldSkip(el)) return false;
      if (!getNormalizedType(el)) return false;
      return true;
    });

    let domIdx = 0;

    for (let i = 0; i < fields.length; i++) {
      const field = fields[i];

      if (field.type === 'radio') {
        // Find the first radio in the group
        const radio = domEls.find(el =>
          (el.type || '').toLowerCase() === 'radio' &&
          el.name === field.name &&
          !seenEls.has(el)
        );
        if (radio) {
          map.set(i, radio);
          domEls.filter(el => (el.type || '').toLowerCase() === 'radio' && el.name === field.name)
            .forEach(el => seenEls.add(el));
        }
      } else {
        while (domIdx < domEls.length && seenEls.has(domEls[domIdx])) domIdx++;
        if (domIdx < domEls.length) {
          map.set(i, domEls[domIdx]);
          seenEls.add(domEls[domIdx]);
          domIdx++;
        }
      }
    }

    return map;
  }

  // ============================================================
  // FILL ENGINE
  // ============================================================
  async function fillFields(fillData, imageData) {
    const allFields = getFormFields();
    const elementMap = buildElementMap(allFields);
    let filled = 0;

    // 1. OTOMATIS: Suntik foto ke SEMUA input file yang terdeteksi
    // Ini supaya nggak nunggu instruksi AI (kayak copas langsung)
    if (imageData) {
      for (let i = 0; i < allFields.length; i++) {
        const field = allFields[i];
        if (field.type === 'file') {
          const el = elementMap.get(i);
          if (el) {
            const ok = await fillFile(el, imageData);
            if (ok) {
              filled++;
              highlightElement(el);
            }
          }
        }
      }
    }

    // 2. PROSES AI: Untuk field teks, select, dll.
    for (const item of fillData) {
      const { index, value } = item;
      if (value === '' || value === null || value === undefined || index === undefined) continue;

      const field = allFields[index];
      // Skip jika ini file (sudah diisi di langkah 1)
      if (!field || field.type === 'file') continue;

      const el = elementMap.get(index);
      if (!el) continue;

      try {
        const ok = await fillElement(el, field, value, item, imageData);
        if (ok) {
          filled++;
          highlightElement(el);
        }
      } catch (e) {
        console.warn('[MockForm] Error filling field', index, e);
      }
    }

    return filled;
  }

  async function fillElement(el, field, value, item, imageData) {
    const tag = el.tagName;
    const type = (el.type || '').toLowerCase();

    // SELECT single
    if (tag === 'SELECT' && !el.multiple) return fillSelect(el, value);

    // SELECT multiple
    if (tag === 'SELECT' && el.multiple) return fillSelectMultiple(el, value);

    // CHECKBOX / switch
    if (type === 'checkbox' || el.getAttribute('role') === 'switch') return fillCheckbox(el, value);

    // RADIO
    if (type === 'radio') return fillRadio(el, field, value);

    // DATE
    if (type === 'date') return fillDate(el, value);

    // TIME
    if (type === 'time') return fillTime(el, value);

    // DATETIME-LOCAL
    if (type === 'datetime-local') return fillDatetimeLocal(el, value);

    // MONTH
    if (type === 'month') return setNative(el, normalizeMonth(value));

    // WEEK
    if (type === 'week') return setNative(el, String(value));

    // COLOR
    if (type === 'color') {
      const hex = toHexColor(value);
      return hex ? setNative(el, hex) : false;
    }

    // RANGE
    if (type === 'range') {
      const min = parseFloat(el.min) || 0;
      const max = parseFloat(el.max) || 100;
      const num = parseFloat(value);
      if (!isNaN(num)) return setNative(el, String(Math.min(max, Math.max(min, num))));
      return false;
    }

    // NUMBER / spinbutton
    if (type === 'number' || el.getAttribute('role') === 'spinbutton') {
      const clean = String(value).replace(/[^\d.\-]/g, '');
      return setNative(el, clean);
    }

    // FILE
    if (type === 'file') {
      if (imageData) {
        return fillFile(el, imageData);
      }
      el.title = `💡 Suggested file: ${value}`;
      highlightElement(el, '#f59e0b');
      return false;
    }

    // CONTENTEDITABLE
    if (el.getAttribute('contenteditable') === 'true') {
      el.focus();
      el.innerText = value;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }

    // ARIA COMBOBOX
    if (el.getAttribute('role') === 'combobox' || el.getAttribute('role') === 'listbox') {
      return fillCombobox(el, value);
    }

    // TEXTAREA
    if (tag === 'TEXTAREA') return setNative(el, value, true);

    // TEXT / EMAIL / TEL / URL / SEARCH / PASSWORD / etc.
    return setNative(el, value);
  }

  // ── SELECT single ─────────────────────────────────────────
  function fillSelect(el, value) {
    const opts = Array.from(el.options).filter(o => o.value !== '' || o.text.trim() !== '');
    const v = String(value).toLowerCase().trim();

    // Exact value
    let m = opts.find(o => o.value.toLowerCase() === v);
    // Exact text
    if (!m) m = opts.find(o => o.text.toLowerCase().trim() === v);
    // Value contains
    if (!m) m = opts.find(o => o.value.toLowerCase().includes(v));
    // Text contains query
    if (!m) m = opts.find(o => o.text.toLowerCase().includes(v));
    // Query contains text
    if (!m) m = opts.find(o => o.text.trim().length > 0 && v.includes(o.text.toLowerCase().trim()));
    // Fuzzy Dice
    if (!m) {
      const scored = opts.map(o => ({
        o,
        score: Math.max(similarity(v, o.value.toLowerCase()), similarity(v, o.text.toLowerCase().trim()))
      })).sort((a, b) => b.score - a.score);
      if (scored.length && scored[0].score >= 0.45) m = scored[0].o;
    }

    if (m) {
      el.value = m.value;
      triggerAll(el);
      return true;
    }
    return false;
  }

  // ── SELECT multiple ───────────────────────────────────────
  function fillSelectMultiple(el, value) {
    const vals = String(value).split(/[,;|]/).map(v => v.trim().toLowerCase()).filter(Boolean);
    let any = false;
    Array.from(el.options).forEach(o => {
      const t = o.text.toLowerCase().trim();
      const v2 = o.value.toLowerCase();
      o.selected = vals.some(v => v2 === v || t === v || t.includes(v) || v.includes(t));
      if (o.selected) any = true;
    });
    if (any) triggerAll(el);
    return any;
  }

  // ── CHECKBOX ──────────────────────────────────────────────
  function fillCheckbox(el, value) {
    const v = String(value).toLowerCase().trim();
    const yes = ['true', '1', 'yes', 'ya', 'on', 'checked', 'benar', 'setuju', 'agree', 'iya'].includes(v);
    el.checked = yes;
    el.setAttribute('aria-checked', String(yes));
    triggerAll(el, ['input', 'change', 'click']);
    return true;
  }

  // ── RADIO ─────────────────────────────────────────────────
  function fillRadio(el, field, value) {
    const radios = Array.from(document.querySelectorAll(`input[type="radio"][name="${el.name}"]`));
    const v = String(value).toLowerCase().trim();

    let target = radios.find(r => r.value.toLowerCase() === v);
    if (!target) target = radios.find(r => findLabel(r).toLowerCase() === v);
    if (!target) target = radios.find(r => r.value.toLowerCase().includes(v) || v.includes(r.value.toLowerCase()));
    if (!target) target = radios.find(r => findLabel(r).toLowerCase().includes(v));
    // Fuzzy
    if (!target) {
      const scored = radios.map(r => ({
        r,
        score: Math.max(similarity(v, r.value.toLowerCase()), similarity(v, findLabel(r).toLowerCase()))
      })).sort((a, b) => b.score - a.score);
      if (scored.length && scored[0].score >= 0.4) target = scored[0].r;
    }

    if (target) {
      target.checked = true;
      triggerAll(target, ['input', 'change', 'click']);
      highlightElement(target);
      return true;
    }
    return false;
  }

  // ── DATE ──────────────────────────────────────────────────
  function fillDate(el, value) {
    const n = normalizeDate(String(value));
    if (n) return setNative(el, n);
    return false;
  }

  function normalizeDate(v) {
    v = v.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;

    // DD/MM/YYYY or DD-MM-YYYY
    let m = v.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (m) return `${m[3]}-${pad(m[2])}-${pad(m[1])}`;

    // YYYY/MM/DD
    m = v.match(/^(\d{4})[\/\.](\d{1,2})[\/\.](\d{1,2})$/);
    if (m) return `${m[1]}-${pad(m[2])}-${pad(m[3])}`;

    // Natural: "25 Januari 2024", "Jan 25 2024", "25 Jan 2024"
    const MONTHS = {
      jan: 1, januari: 1, january: 1, feb: 2, februari: 2, february: 2,
      mar: 3, maret: 3, march: 3, apr: 4, april: 4,
      mei: 5, may: 5, jun: 6, juni: 6, june: 6,
      jul: 7, juli: 7, july: 7, agu: 8, agustus: 8, august: 8, aug: 8,
      sep: 9, september: 9, okt: 10, oktober: 10, oct: 10, october: 10,
      nov: 11, november: 11, des: 12, desember: 12, dec: 12, december: 12,
    };
    const vl = v.toLowerCase();
    m = vl.match(/(\d{1,2})\s+([a-z]+)\s+(\d{4})/);
    if (m && MONTHS[m[2]]) return `${m[3]}-${pad(MONTHS[m[2]])}-${pad(m[1])}`;
    m = vl.match(/([a-z]+)\s+(\d{1,2})[,\s]+(\d{4})/);
    if (m && MONTHS[m[1]]) return `${m[3]}-${pad(MONTHS[m[1]])}-${pad(m[2])}`;

    // Fallback Date.parse
    try {
      const d = new Date(v);
      if (!isNaN(d.getTime())) return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    } catch { }
    return null;
  }

  // ── TIME ──────────────────────────────────────────────────
  function fillTime(el, value) {
    const n = normalizeTime(String(value));
    if (n) return setNative(el, n);
    return false;
  }

  function normalizeTime(v) {
    v = v.trim().toLowerCase().replace(/\s*(wib|wita|wit|utc[+\-\d]*|gmt[+\-\d]*)\s*/gi, '').trim();

    if (/^\d{2}:\d{2}(:\d{2})?$/.test(v)) return v.slice(0, 5);

    // HH.MM
    let m = v.match(/^(\d{1,2})\.(\d{2})$/);
    if (m) return `${pad(m[1])}:${m[2]}`;

    // 2:30pm / 14:30
    m = v.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
    if (m) {
      let h = parseInt(m[1]);
      const min = m[2] || '00';
      if (m[3] === 'pm' && h < 12) h += 12;
      if (m[3] === 'am' && h === 12) h = 0;
      return `${pad(h)}:${min}`;
    }

    // "1430"
    m = v.match(/^(\d{3,4})$/);
    if (m) {
      const s = m[1].padStart(4, '0');
      return `${s.slice(0, 2)}:${s.slice(2, 4)}`;
    }

    return null;
  }

  // ── DATETIME-LOCAL ────────────────────────────────────────
  function fillDatetimeLocal(el, value) {
    const v = String(value).trim();
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v)) return setNative(el, v.slice(0, 16));

    // "2024-06-15 14:30" or "15/06/2024 14:30"
    const parts = v.split(/[T\s]+/);
    if (parts.length >= 2) {
      const dp = normalizeDate(parts[0]);
      const tp = normalizeTime(parts.slice(1).join(' '));
      if (dp && tp) return setNative(el, `${dp}T${tp}`);
    }
    try {
      const d = new Date(v);
      if (!isNaN(d.getTime())) return setNative(el, d.toISOString().slice(0, 16));
    } catch { }
    return false;
  }

  function normalizeMonth(v) {
    if (/^\d{4}-\d{2}$/.test(v)) return v;
    const d = normalizeDate(v);
    if (d) return d.slice(0, 7);
    return v;
  }

  // ── COLOR ─────────────────────────────────────────────────
  function toHexColor(v) {
    v = String(v).trim().toLowerCase();
    if (/^#[0-9a-f]{6}$/i.test(v)) return v;
    if (/^#[0-9a-f]{3}$/i.test(v)) return '#' + v[1] + v[1] + v[2] + v[2] + v[3] + v[3];
    const COLORS = {
      red: '#ff0000', green: '#008000', blue: '#0000ff', yellow: '#ffff00',
      orange: '#ffa500', purple: '#800080', pink: '#ffc0cb', black: '#000000',
      white: '#ffffff', gray: '#808080', grey: '#808080', brown: '#a52a2a',
      cyan: '#00ffff', magenta: '#ff00ff', lime: '#00ff00', navy: '#000080',
      teal: '#008080', gold: '#ffd700', silver: '#c0c0c0', coral: '#ff7f50',
      merah: '#ff0000', hijau: '#008000', biru: '#0000ff', kuning: '#ffff00',
      ungu: '#800080', hitam: '#000000', putih: '#ffffff', abu: '#808080',
      oranye: '#ffa500', coklat: '#a52a2a', emas: '#ffd700', perak: '#c0c0c0',
    };
    if (COLORS[v]) return COLORS[v];
    const rgb = v.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (rgb) return '#' + [rgb[1], rgb[2], rgb[3]].map(n => parseInt(n).toString(16).padStart(2, '0')).join('');
    return null;
  }

  // ── COMBOBOX (aria) ───────────────────────────────────────
  async function fillCombobox(el, value) {
    // Set input value first
    setNative(el, value);
    el.focus();
    el.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true }));
    el.dispatchEvent(new Event('input', { bubbles: true }));

    // Try clicking on option in revealed list
    setTimeout(() => {
      const listId = el.getAttribute('aria-controls') || el.getAttribute('aria-owns');
      if (listId) {
        const list = document.getElementById(listId);
        if (list) {
          const vl = String(value).toLowerCase();
          const opts = list.querySelectorAll('[role="option"],li,option');
          for (const opt of opts) {
            const t = opt.textContent.toLowerCase().trim();
            const v2 = (opt.getAttribute('data-value') || opt.value || t).toLowerCase();
            if (v2 === vl || t === vl || t.includes(vl) || vl.includes(t)) {
              opt.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
              opt.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
              opt.click();
              break;
            }
          }
        }
      }
    }, 100);

    return true;
  }

  // ── FILE INJECTION ────────────────────────────────────────
  async function fillFile(el, base64Data) {
    try {
      if (!base64Data || !base64Data.startsWith('data:')) {
        console.error('[MockForm] Invalid image data');
        return false;
      }
      
      const res = await fetch(base64Data);
      const blob = await res.blob();
      const extension = blob.type.split('/')[1] || 'jpg';
      const filename = `upload_${Date.now()}.${extension}`;
      const file = new File([blob], filename, { type: blob.type });

      const dt = new DataTransfer();
      dt.items.add(file);
      el.files = dt.files;

      // Trigger standard events
      triggerAll(el, ['input', 'change', 'blur']);
      
      // Dispatch drop event specifically for custom uploaders
      const dropEvent = new DragEvent('drop', { 
        bubbles: true, 
        cancelable: true,
        dataTransfer: dt
      });
      el.dispatchEvent(dropEvent);

      // Try to notify parents (for some drag-and-drop libs)
      let parent = el.parentElement;
      for (let i = 0; i < 3 && parent; i++) {
        parent.dispatchEvent(new DragEvent('drop', { bubbles: true, dataTransfer: dt }));
        parent = parent.parentElement;
      }

      return true;
    } catch (e) {
      console.error('[MockForm] File injection failed:', e);
      return false;
    }
  }

  // ── NATIVE VALUE SETTER ───────────────────────────────────
  function setNative(el, value, isTA = false) {
    const tag = el.tagName;
    const isTextarea = isTA || tag === 'TEXTAREA';
    const proto = isTextarea ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
    const desc = Object.getOwnPropertyDescriptor(proto, 'value');
    if (desc?.set) desc.set.call(el, value);
    else el.value = value;
    triggerAll(el);
    return true;
  }

  function triggerAll(el, events = ['input', 'change', 'blur']) {
    events.forEach(type => {
      el.dispatchEvent(new Event(type, { bubbles: true, cancelable: true }));
    });
    try {
      el.dispatchEvent(new InputEvent('input', { bubbles: true, data: el.value }));
    } catch {}

    // Special handling for file inputs (custom uploaders often need ini)
    if (el.type === 'file') {
      // Dispatch drop event on the input itself AND its immediate parent
      const dropEvent = new DragEvent('drop', { bubbles: true, cancelable: true });
      el.dispatchEvent(dropEvent);
      
      const parent = el.parentElement;
      if (parent) parent.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true }));

      // If the input is hidden, try to find a visible container to highlight
      const container = el.parentElement.closest('div, label, section, [class*="upload"], [class*="drop"]');
      if (container && (window.getComputedStyle(el).display === 'none' || window.getComputedStyle(el).visibility === 'hidden')) {
        highlightElement(container);
      }
    }
  }

  function highlightElement(el, color = 'rgba(124,106,247,0.75)') {
    const prev = el.style.cssText;
    el.style.transition = 'box-shadow .3s, outline .3s';
    el.style.boxShadow = `0 0 0 2.5px ${color}`;
    el.style.outline = `2px solid ${color}`;
    setTimeout(() => { el.style.boxShadow = ''; el.style.outline = ''; }, 2500);
  }

  // ── DICE SIMILARITY ───────────────────────────────────────
  function similarity(a, b) {
    if (a === b) return 1;
    if (a.length < 2 || b.length < 2) return 0;
    const bigrams = new Map();
    for (let i = 0; i < a.length - 1; i++) {
      const bg = a.substr(i, 2);
      bigrams.set(bg, (bigrams.get(bg) || 0) + 1);
    }
    let intersect = 0;
    for (let i = 0; i < b.length - 1; i++) {
      const bg = b.substr(i, 2);
      const cnt = bigrams.get(bg) || 0;
      if (cnt > 0) { bigrams.set(bg, cnt - 1); intersect++; }
    }
    return (2 * intersect) / (a.length + b.length - 2);
  }

  function pad(n) { return String(n).padStart(2, '0'); }

  // ============================================================
  // CLEAR FIELDS
  // ============================================================
  function clearFields() {
    const fields = getFormFields();
    const map = buildElementMap(fields);
    let cleared = 0;
    map.forEach((el) => {
      try {
        const type = (el.type || '').toLowerCase();
        if (type === 'checkbox' || type === 'radio') {
          if (el.checked) { el.checked = false; triggerAll(el, ['change']); cleared++; }
        } else if (el.tagName === 'SELECT') {
          el.selectedIndex = 0;
          triggerAll(el, ['change']); cleared++;
        } else if (el.getAttribute('contenteditable') === 'true') {
          if (el.innerText) { el.innerText = ''; el.dispatchEvent(new Event('input', { bubbles: true })); cleared++; }
        } else {
          if (el.value) { setNative(el, '', el.tagName === 'TEXTAREA'); cleared++; }
        }
      } catch { }
    });
    return cleared;
  }

  // ============================================================
  // MESSAGE LISTENER
  // ============================================================
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'injectPhotos') {
      (async () => {
        let filled = 0;
        // BRUTE FORCE: Cari SEMUA input file di halaman, bodo amat dia sembunyi atau nggak
        const allFileInputs = document.querySelectorAll('input[type="file"]');
        
        for (const el of allFileInputs) {
          try {
            const ok = await fillFile(el, message.imageData);
            if (ok) filled++;
          } catch (e) {
            console.warn('[MockForm] Failed to inject into input:', e);
          }
        }
        sendResponse({ filled });
      })();
      return true;
    }

    if (message.action === 'scanFields') {
      sendResponse({ fields: getFormFields() });
      return false;
    } 

    if (message.action === 'fillFields') {
      fillFields(message.data || [], message.imageData)
        .then(filled => sendResponse({ filled }))
        .catch(err => sendResponse({ error: err.message }));
      return true; // Keep channel open for async response
    }

    if (message.action === 'clearFields') {
      sendResponse({ cleared: clearFields() });
      return false;
    }

    if (message.action === 'toggleWidget') {
      toggleWidget();
      sendResponse({ status: 'ok' });
      return false;
    }

    if (message.action === 'triggerAutofillShortcut') {
      triggerDirectAutofill();
      sendResponse({ status: 'started' });
      return false;
    }

    sendResponse({ error: 'Unknown action' });
    return false;
  });

  // ============================================================
  // WIDGET INJECTION
  // ============================================================
  let widgetContainer = null;

  function toggleWidget(options = {}) {
    if (widgetContainer) {
      widgetContainer.remove();
      widgetContainer = null;
      return;
    }

    widgetContainer = document.createElement('div');
    widgetContainer.id = 'mockform-widget-container';
    
    // Styling for draggable floating widget
    Object.assign(widgetContainer.style, {
      position: options.position || 'fixed',
      top: options.top || '20px',
      right: options.right || '20px',
      left: options.left || 'auto',
      width: '360px',
      height: '600px',
      backgroundColor: 'white',
      border: '1px solid #e2e8f0',
      borderRadius: '12px',
      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
      zIndex: '2147483647', // max z-index
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    });

    const dragHandle = document.createElement('div');
    Object.assign(dragHandle.style, {
      height: '28px',
      backgroundColor: '#f8fafc',
      borderBottom: '1px solid #e2e8f0',
      cursor: 'move',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: '0'
    });
    dragHandle.innerHTML = '<div style="width: 40px; height: 5px; background: #cbd5e1; border-radius: 3px;"></div><div style="position:absolute; right:10px; cursor:pointer; font-family:sans-serif; font-size:14px; font-weight:bold; color:#94a3b8;" id="mockform-widget-close">✕</div>';

    const iframe = document.createElement('iframe');
    iframe.src = chrome.runtime.getURL('popup.html');
    Object.assign(iframe.style, {
      width: '100%',
      height: '100%',
      border: 'none',
      flex: '1'
    });

    widgetContainer.appendChild(dragHandle);
    widgetContainer.appendChild(iframe);
    document.body.appendChild(widgetContainer);

    // Close button logic
    widgetContainer.querySelector('#mockform-widget-close').addEventListener('click', (e) => {
      e.stopPropagation();
      toggleWidget();
    });

    // Draggable logic
    let isDragging = false;
    let currentX;
    let currentY;
    let initialX;
    let initialY;
    let xOffset = 0;
    let yOffset = 0;

    dragHandle.addEventListener('mousedown', dragStart);
    document.addEventListener('mouseup', dragEnd);
    document.addEventListener('mousemove', drag);

    function dragStart(e) {
      if (e.target.id === 'mockform-widget-close') return;
      initialX = e.clientX - xOffset;
      initialY = e.clientY - yOffset;
      isDragging = true;
      
      // prevent iframe from capturing mouse events while dragging
      iframe.style.pointerEvents = 'none'; 
    }

    function dragEnd(e) {
      initialX = currentX;
      initialY = currentY;
      isDragging = false;
      iframe.style.pointerEvents = 'auto';
    }

    function drag(e) {
      if (isDragging) {
        e.preventDefault();
        currentX = e.clientX - initialX;
        currentY = e.clientY - initialY;
        xOffset = currentX;
        yOffset = currentY;
        widgetContainer.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;
      }
    }
  }

  // ============================================================
  // CONTEXTUAL MODE LOGIC
  // ============================================================
  let isContextualMode = false;
  let activeInput = null;
  let contextIcon = null;
  let contextToast = null;
  let contextToastTimer = null;
  let isContextFilling = false;

  chrome.storage.local.get(['displayMode'], (data) => {
    isContextualMode = (data.displayMode === 'contextual');
    if (isContextualMode) initContextualMode();
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.displayMode) {
      isContextualMode = (changes.displayMode.newValue === 'contextual');
      if (isContextualMode) initContextualMode();
      else destroyContextualMode();
    }
  });

  function initContextualMode() {
    if (!document.getElementById('mockform-style')) {
      const style = document.createElement('style');
      style.id = 'mockform-style';
      style.textContent = `
        @keyframes mockform-spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `;
      document.head.appendChild(style);
    }

    if (contextIcon) return;
    
    contextIcon = document.createElement('div');
    contextIcon.id = 'mockform-context-icon';
    Object.assign(contextIcon.style, {
      position: 'absolute',
      width: '28px',
      height: '28px',
      display: 'none',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      zIndex: '2147483646',
      filter: 'drop-shadow(0 2px 5px rgba(0,0,0,0.2))'
    });
    setContextIconState('default');
    
    document.body.appendChild(contextIcon);

    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('mousedown', handleMouseDown);
    contextIcon.addEventListener('click', handleIconClick);
  }

  function destroyContextualMode() {
    if (contextIcon) {
      contextIcon.remove();
      contextIcon = null;
    }
    if (contextToast) {
      contextToast.remove();
      contextToast = null;
    }
    document.removeEventListener('focusin', handleFocusIn);
    document.removeEventListener('mousedown', handleMouseDown);
  }

  function showContextToast(msg, type = 'info', durationMs = 3000) {
    if (!contextToast) {
      contextToast = document.createElement('div');
      contextToast.id = 'mockform-context-toast';
      Object.assign(contextToast.style, {
        position: 'fixed',
        zIndex: '2147483647',
        padding: '8px 16px',
        borderRadius: '20px',
        fontSize: '12.5px',
        fontWeight: '500',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
        pointerEvents: 'none',
        whiteSpace: 'nowrap',
        transition: 'all 0.2s ease',
        display: 'none'
      });
      document.body.appendChild(contextToast);
    }

    if (contextToastTimer) clearTimeout(contextToastTimer);

    const colors = {
      info: { bg: '#0f172a', text: '#f8fafc', border: '#334155' },
      success: { bg: '#064e3b', text: '#ecfdf5', border: '#059669' },
      error: { bg: '#7f1d1d', text: '#fef2f2', border: '#dc2626' }
    };
    const c = colors[type] || colors.info;

    contextToast.textContent = msg;
    contextToast.style.backgroundColor = c.bg;
    contextToast.style.color = c.text;
    contextToast.style.border = `1px solid ${c.border}`;

    if (contextIcon && contextIcon.style.display !== 'none' && contextIcon.isConnected) {
      const rect = contextIcon.getBoundingClientRect();
      const scrollX = window.scrollX || window.pageXOffset;
      const scrollY = window.scrollY || window.pageYOffset;
      contextToast.style.position = 'absolute';
      contextToast.style.top = `${rect.top + scrollY - 36}px`;
      contextToast.style.left = `${rect.left + scrollX}px`;
      contextToast.style.transform = 'none';
      contextToast.style.display = 'block';
    } else {
      contextToast.style.position = 'fixed';
      contextToast.style.top = '24px';
      contextToast.style.left = '50%';
      contextToast.style.transform = 'translateX(-50%)';
      contextToast.style.display = 'block';
    }

    if (durationMs > 0) {
      contextToastTimer = setTimeout(() => {
        if (contextToast) contextToast.style.display = 'none';
      }, durationMs);
    }
  }

  function setContextIconState(state) {
    if (!contextIcon) return;
    const iconUrl = chrome.runtime.getURL('icons/logo-ui.png');
    if (state === 'loading') {
      contextIcon.innerHTML = `
        <svg style="width: 20px; height: 20px; animation: mockform-spin 1s linear infinite;" viewBox="0 0 24 24" fill="none" stroke="#6366f1" stroke-width="3" stroke-linecap="round">
          <circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle>
          <path d="M12 2 a10 10 0 0 1 10 10"></path>
        </svg>`;
    } else if (state === 'success') {
      contextIcon.innerHTML = `
        <svg style="width: 22px; height: 22px; color: #09090b;" viewBox="0 0 24 24" fill="none" stroke="#09090b" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>`;
    } else {
      contextIcon.innerHTML = `<img src="${iconUrl}" style="width: 28px; height: 28px; object-fit: contain;" />`;
    }
  }

  function handleFocusIn(e) {
    if (!isContextualMode) return;
    const el = e.target;
    const tag = el.tagName;
    const type = (el.type || '').toLowerCase();
    
    const isTextInput = (tag === 'INPUT' && !['radio', 'checkbox', 'submit', 'button', 'hidden', 'file'].includes(type)) || tag === 'TEXTAREA' || tag === 'SELECT' || el.getAttribute('contenteditable') === 'true';

    if (isTextInput) {
      activeInput = el;
      showContextIcon(el);
    }
  }

  function handleMouseDown(e) {
    if (!isContextualMode) return;
    if (activeInput && e.target !== activeInput && e.target !== contextIcon && !contextIcon.contains(e.target)) {
      if (widgetContainer && widgetContainer.contains(e.target)) return;
      contextIcon.style.display = 'none';
      if (contextToast) contextToast.style.display = 'none';
      activeInput = null;
      if (widgetContainer) {
        toggleWidget(); // close if clicked outside everything
      }
    }
  }

  function showContextIcon(el) {
    const rect = el.getBoundingClientRect();
    const scrollX = window.scrollX || window.pageXOffset;
    const scrollY = window.scrollY || window.pageYOffset;
    
    contextIcon.style.display = 'flex';
    contextIcon.style.top = `${rect.top + scrollY + (rect.height / 2) - 14}px`;
    contextIcon.style.left = `${rect.right + scrollX + 8}px`;
  }

  async function askGeminiForContentScript(apiKey, model, instruction, fields) {
    const modelId = model || 'gemini-2.5-flash-lite';

    const fieldLines = fields.map((f, i) => {
      let line = `[${i}] type="${f.type}" label="${f.label || f.placeholder || f.name || ''}"`;
      if (f.name) line += ` name="${f.name}"`;
      if (f.required) line += ` REQUIRED`;

      switch (f.type) {
        case 'select':
        case 'select-multiple':
        case 'radio':
        case 'combobox':
          if (f.options?.length) {
            const optStr = f.options.slice(0, 20).map(o => `"${o.label || o.value}"`).join(', ');
            line += `\n    OPSI TERSEDIA: ${optStr}${f.options.length > 20 ? ` ... (+${f.options.length - 20} lagi)` : ''}`;
            line += `\n    → Wajib pilih SALAH SATU opsi di atas yang paling cocok (gunakan LABEL opsi persis)`;
          }
          if (f.type === 'select-multiple') line += `\n    → Boleh pilih lebih dari satu, pisahkan dengan koma`;
          break;
        case 'checkbox':
          line += `\n    → Nilai: "true" (centang) atau "false" (tidak centang)`;
          break;
        case 'date':
          line += `\n    → Format output WAJIB: YYYY-MM-DD (contoh: 2024-06-25)`;
          break;
        case 'time':
          line += `\n    → Format output WAJIB: HH:MM dalam 24 jam (contoh: 14:30)`;
          break;
        case 'datetime-local':
          line += `\n    → Format output WAJIB: YYYY-MM-DDTHH:MM (contoh: 2024-06-25T14:30)`;
          break;
        case 'month':
          line += `\n    → Format output WAJIB: YYYY-MM (contoh: 2024-06)`;
          break;
        case 'week':
          line += `\n    → Format output WAJIB: YYYY-Www (contoh: 2024-W26)`;
          break;
        case 'color':
          line += `\n    → Format output WAJIB: hex warna #RRGGBB (contoh: #ff5733)`;
          break;
        case 'range':
          line += `\n    → Nilai angka antara ${f.min || 0} sampai ${f.max || 100} (step: ${f.step || 1})`;
          break;
        case 'number':
          if (f.min !== undefined) line += `\n    → Nilai angka min:${f.min}${f.max ? ` max:${f.max}` : ''}`;
          break;
        case 'file':
          line += `\n    → Input file tidak bisa diisi otomatis. Kembalikan nilai "" (string kosong)`;
          break;
        case 'email':
          line += `\n    → Harus berformat email valid`;
          break;
        case 'tel':
          line += `\n    → Format nomor telepon`;
          break;
        case 'url':
          line += `\n    → Harus berformat URL valid (mulai dengan https://)`;
          break;
        case 'textarea':
          line += `\n    → Isi dengan teks paragraf yang sesuai konteks`;
          break;
        case 'password':
          line += `\n    → Isi dengan password yang sesuai instruksi (atau buat yang kuat)`;
          break;
      }

      if (f.suggestions?.length) {
        line += `\n    SARAN: ${f.suggestions.slice(0, 5).join(', ')}`;
      }

      if (f.currentValue && f.currentValue !== '' && f.currentValue !== 'false') {
        line += `\n    (nilai saat ini: "${f.currentValue}")`;
      }

      return line;
    }).join('\n\n');

    const prompt = `Kamu adalah asisten AI yang mengisi form web secara otomatis dan cerdas.

INSTRUKSI DARI PENGGUNA:
"""
${instruction}
"""

DAFTAR FIELD FORM (${fields.length} field):
${fieldLines}

ATURAN PENGISIAN:
1. Gunakan data dari instruksi pengguna untuk mengisi field yang relevan
2. Untuk field yang tidak ada datanya, buat nilai yang masuk akal dan realistis sesuai konteks label
3. Untuk SELECT/RADIO/COMBOBOX: WAJIB pilih dari opsi yang tersedia, gunakan nilai label yang persis sama
4. Untuk DATE/TIME: Gunakan format yang sudah ditentukan
5. Untuk FILE: selalu kembalikan "" (kosong)
6. Jika instruksi tidak menyebutkan suatu field, isi dengan nilai default yang wajar berdasarkan konteks label
7. Field yang bertanda REQUIRED HARUS diisi (tidak boleh kosong "")

BALAS HANYA dengan JSON array murni (tanpa markdown, tanpa penjelasan, langsung array):
[
  {"index": 0, "value": "nilai"},
  {"index": 1, "value": "nilai"},
  ...
]

Sertakan semua ${fields.length} field dalam array (index 0 sampai ${fields.length - 1}).`;

    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 4096,
          }
        })
      }
    );

    if (!resp.ok) {
      const err = await resp.json();
      throw new Error(err.error?.message || `HTTP ${resp.status}`);
    }

    const data = await resp.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    try {
      const clean = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
      return JSON.parse(clean);
    } catch {}

    const match = text.match(/\[\s*\{[\s\S]*\}\s*\]/);
    if (match) {
      try { return JSON.parse(match[0]); } catch {}
    }

    console.error('[mock-form] Failed to parse Gemini response:', text);
    return null;
  }

  async function handleIconClick(e) {
    e.preventDefault();
    e.stopPropagation();

    if (isContextFilling) return;

    chrome.storage.local.get(['apiKey', 'model', 'profiles', 'activeProfileIndex'], async (data) => {
      if (!data.apiKey) {
        showContextToast('API Key belum diatur. Silakan atur di Setelan.', 'error', 4000);
        return;
      }

      const fields = getFormFields();
      if (!fields || fields.length === 0) {
        showContextToast('Tidak ada field form terdeteksi', 'error', 3000);
        return;
      }

      isContextFilling = true;
      setContextIconState('loading');
      showContextToast('Mengisi otomatis...', 'info', 0);

      try {
        const activeIdx = data.activeProfileIndex || 0;
        const profiles = data.profiles || [];
        const activeProfile = profiles[activeIdx] || profiles[0] || null;

        let instruction = '';
        if (activeProfile && activeProfile.data) {
          instruction = `Isi form menggunakan data profil "${activeProfile.name}":\n${activeProfile.data}`;
        } else {
          instruction = 'Isi form ini dengan data dummy yang masuk akal dan realistis.';
        }

        let imageData = activeProfile?.image || null;
        if (!imageData || imageData.length < 100) {
          const pWithImg = profiles.find(p => p.image && p.image.length > 100);
          imageData = pWithImg ? pWithImg.image : null;
        }

        const fillData = await askGeminiForContentScript(data.apiKey, data.model, instruction, fields);
        if (!fillData) {
          showContextToast('Gagal mendapatkan respon dari Gemini', 'error', 3000);
          setContextIconState('default');
          isContextFilling = false;
          return;
        }

        const filledCount = await fillFields(fillData, imageData);
        showContextToast(`Berhasil mengisi ${filledCount} dari ${fields.length} field! ✓`, 'success', 3000);
        setContextIconState('success');

        setTimeout(() => {
          setContextIconState('default');
          isContextFilling = false;
        }, 2000);

      } catch (err) {
        console.error('[mock-form] Contextual fill error:', err);
        showContextToast(`Gagal: ${err.message}`, 'error', 4000);
        setContextIconState('default');
        isContextFilling = false;
      }
    });
  }

  async function triggerDirectAutofill() {
    if (isContextFilling) return;

    // Pastikan icon kontekstual disembunyikan saat shortcut berjalan
    if (contextIcon) {
      contextIcon.style.display = 'none';
    }

    chrome.storage.local.get(['apiKey', 'model', 'profiles', 'activeProfileIndex'], async (data) => {
      if (!data.apiKey) {
        showContextToast('API Key belum diatur. Silakan atur di Setelan.', 'error', 4000);
        return;
      }

      const fields = getFormFields();
      if (!fields || fields.length === 0) {
        showContextToast('Tidak ada field form terdeteksi', 'error', 3000);
        return;
      }

      isContextFilling = true;
      showContextToast('Mengisi otomatis...', 'info', 0);

      try {
        const activeIdx = data.activeProfileIndex || 0;
        const profiles = data.profiles || [];
        const activeProfile = profiles[activeIdx] || profiles[0] || null;

        let instruction = '';
        if (activeProfile && activeProfile.data) {
          instruction = `Isi form menggunakan data profil "${activeProfile.name}":\n${activeProfile.data}`;
        } else {
          instruction = 'Isi form ini dengan data dummy yang masuk akal dan realistis.';
        }

        let imageData = activeProfile?.image || null;
        if (!imageData || imageData.length < 100) {
          const pWithImg = profiles.find(p => p.image && p.image.length > 100);
          imageData = pWithImg ? pWithImg.image : null;
        }

        const fillData = await askGeminiForContentScript(data.apiKey, data.model, instruction, fields);
        if (!fillData) {
          showContextToast('Gagal mendapatkan respon dari Gemini', 'error', 3000);
          isContextFilling = false;
          if (contextIcon) contextIcon.style.display = 'none';
          return;
        }

        const filledCount = await fillFields(fillData, imageData);
        showContextToast(`Berhasil mengisi ${filledCount} dari ${fields.length} field! ✓`, 'success', 3000);

        setTimeout(() => {
          isContextFilling = false;
          if (contextIcon) contextIcon.style.display = 'none';
        }, 1500);

      } catch (err) {
        console.error('[mock-form] Shortcut autofill error:', err);
        showContextToast(`Gagal: ${err.message}`, 'error', 4000);
        isContextFilling = false;
        if (contextIcon) contextIcon.style.display = 'none';
      }
    });
  }

  console.log('[mock-form] Loaded successfully ✓');
})();

