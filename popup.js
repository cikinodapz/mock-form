// mock-form - popup.js
// ============================================================

const $ = id => document.getElementById(id);

// ── Tab switching ──────────────────────────────────────────
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.content').forEach(c => c.classList.remove('active'));
    tab.classList.add('active');
    $('tab-' + tab.dataset.tab).classList.add('active');
  });
});

$('toggle-key').addEventListener('click', () => {
  const input = $('api-key');
  input.type = input.type === 'password' ? 'text' : 'password';
});

// ── Load settings ──────────────────────────────────────────
chrome.storage.local.get(['apiKey', 'model', 'fillMode', 'profiles', 'displayMode'], data => {
  if (data.apiKey) $('api-key').value = data.apiKey;
  if (data.model) $('model-select').value = data.model;
  if (data.fillMode) $('fill-mode').value = data.fillMode;
  if (data.displayMode) $('display-mode').value = data.displayMode;
  renderProfiles(data.profiles || []);
  updateFooter(data.model);
});

// ── Save settings ──────────────────────────────────────────
$('btn-save-settings').addEventListener('click', () => {
  const apiKey = $('api-key').value.trim();
  const model = $('model-select').value;
  const fillMode = $('fill-mode').value;
  const displayMode = $('display-mode').value || 'sidepanel';
  if (!apiKey) { showStatus('settings-status', 'error', 'Masukkan API Key terlebih dahulu.'); return; }
  chrome.storage.local.set({ apiKey, model, fillMode, displayMode }, () => {
    showStatus('settings-status', 'success', 'Setelan berhasil disimpan!');
    updateFooter(model);
  });
});

function updateFooter(model) {
  const names = {
    'gemini-3.1-flash-lite-preview': 'Gemini 3.1 Flash Lite',
    'gemini-3-flash-preview': 'Gemini 3 Flash',
    'gemini-2.5-flash': 'Gemini 2.5 Flash',
    'gemini-2.5-flash-lite': 'Gemini 2.5 Flash Lite',
    'gemini-2.0-flash': 'Gemini 2.0 Flash',
    'gemini-1.5-flash': 'Gemini 1.5 Flash',
  };
  $('footer-model').textContent = names[model] || 'Gemini Flash';
}

// ── Scan form ──────────────────────────────────────────────
$('btn-scan').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  chrome.tabs.sendMessage(tab.id, { action: 'scanFields' }, response => {
    if (chrome.runtime.lastError || !response) {
      showStatus('fill-status', 'error', 'Gagal memindai. Coba refresh halaman.');
      return;
    }
    const fields = response.fields || [];
    if (fields.length === 0) {
      showStatus('fill-status', 'info', 'Tidak ada field form di halaman ini.');
      $('detected-info').style.display = 'none';
      return;
    }
    renderFieldPreview(fields);
    showStatus('fill-status', 'success', `Ditemukan ${fields.length} field.`);
  });
});

function renderFieldPreview(fields) {
  $('field-count').textContent = `${fields.length} field terdeteksi`;

  const TYPE_ICONS = {
    text: 'Teks', email: 'Email', tel: 'Telp', url: 'URL', number: 'Angka',
    password: 'Sandi', search: 'Cari', textarea: 'Teks', date: 'Tgl',
    time: 'Waktu', 'datetime-local': 'Waktu', month: 'Bulan', week: 'Minggu',
    color: 'Warna', range: 'Range', checkbox: 'Centang', radio: 'Pilih',
    select: 'Opsi', 'select-multiple': 'Opsi', file: 'File',
    combobox: 'Opsi', contenteditable: 'Teks',
  };

  $('fields-preview').innerHTML = fields.map(f => {
    const icon = TYPE_ICONS[f.type] || 'Input';
    const labelText = f.label || f.name || f.placeholder || '(tanpa label)';
    const extra = f.options ? ` [${f.options.length} opsi]` : (f.required ? ' *' : '');
    return `
      <div class="field-item">
        <span class="field-badge">${icon}</span>
        <span style="color:var(--text-secondary);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${labelText}">${labelText}${extra}</span>
        ${f.required ? '<span style="color:var(--danger);font-size:10px;font-weight:600;">REQ</span>' : ''}
      </div>`;
  }).join('');
  $('detected-info').style.display = 'block';
}

// ── Inject Photos Only ─────────────────────────────────────
$('btn-inject-photos').addEventListener('click', async () => {
  chrome.storage.local.get(['profiles', 'activeProfileIndex'], async data => {
    const profiles = data.profiles || [];
    const activeIdx = data.activeProfileIndex || 0;
    
    // 1. Coba ambil dari profil aktif dulu
    let imageData = profiles[activeIdx]?.image;
    
    // 2. Kalau profil aktif nggak punya foto, baru cari di profil lain
    if (!imageData || imageData.length < 100) {
      const pWithImg = profiles.find(p => p.image && p.image.length > 100);
      imageData = pWithImg ? pWithImg.image : null;
    }
    
    if (!imageData) {
      showStatus('fill-status', 'error', 'Tidak ada foto di profil manapun. Silakan upload ulang foto di tab Profil.');
      return;
    }

    const btn = $('btn-inject-photos');
    btn.disabled = true;
    const oldHtml = btn.innerHTML;
    btn.innerHTML = '<div class="loader"></div>';

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const res = await sendMessage(tab.id, { action: 'injectPhotos', imageData });
      showStatus('fill-status', 'success', `Berhasil menyuntik ${res?.filled || 0} foto!`);
    } catch (err) {
      showStatus('fill-status', 'error', `Error: ${err.message}`);
    } finally {
      btn.disabled = false;
      btn.innerHTML = oldHtml;
    }
  });
});

// ── Fill form ──────────────────────────────────────────────
$('btn-fill').addEventListener('click', async () => {
  const instruction = $('instruction').value.trim();

  chrome.storage.local.get(['apiKey', 'model', 'fillMode', 'profiles', 'activeProfileIndex'], async data => {
    if (!data.apiKey) { showStatus('fill-status', 'error', 'API Key belum diatur. Buka tab Setelan.'); return; }
    
    let finalInstruction = instruction;
    if (!finalInstruction) {
      const activeIdx = data.activeProfileIndex || 0;
      if (data.profiles && data.profiles[activeIdx]) {
        finalInstruction = `Isi form menggunakan data profil "${data.profiles[activeIdx].name}":\n${data.profiles[activeIdx].data}`;
      } else if (data.profiles && data.profiles.length > 0) {
        finalInstruction = `Isi form menggunakan data profil "${data.profiles[0].name}":\n${data.profiles[0].data}`;
      } else {
        finalInstruction = "Isi form ini dengan data dummy yang masuk akal dan realistis.";
      }
    }

    const btn = $('btn-fill');
    btn.disabled = true;
    btn.innerHTML = '<div class="loader"></div>';
    showStatus('fill-status', 'info', 'Memindai form dan menghubungi Gemini AI...');

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      const scanResult = await sendMessage(tab.id, { action: 'scanFields' });
      const fields = scanResult?.fields || [];

      if (fields.length === 0) {
        showStatus('fill-status', 'error', 'Tidak ada field form di halaman ini.');
        return;
      }

      renderFieldPreview(fields);
      const logMsg = instruction ? 'Meminta Gemini mengisi field...' : (data.profiles?.[0] ? `Menggunakan profil "${data.profiles[0].name}"...` : 'Menggunakan data dummy...');
      showStatus('fill-status', 'info', logMsg);

      const fillData = await askGemini(data.apiKey, data.model, finalInstruction, fields);
      if (!fillData) {
        showStatus('fill-status', 'error', 'Gagal mendapatkan respons dari Gemini. Periksa API Key.');
        return;
      }

      // Add image data from the selected profile if it exists
      const currentProfile = instruction ? null : (data.profiles?.[0] || null);
      const imageData = currentProfile?.image || null;

      const fillResult = await sendMessage(tab.id, { 
        action: 'fillFields', 
        data: fillData,
        imageData: imageData // Pass image data to content script
      });
      const filled = fillResult?.filled || 0;
      showStatus('fill-status', 'success', `Berhasil mengisi ${filled} dari ${fields.length} field!`);

    } catch (err) {
      showStatus('fill-status', 'error', `Error: ${err.message}`);
    } finally {
      btn.disabled = false;
      btn.innerHTML = 'Isi Otomatis';
    }
  });
});

// ── GEMINI PROMPT — type-aware ─────────────────────────────
async function askGemini(apiKey, model, instruction, fields) {
  const modelId = model || 'gemini-2.5-flash-lite';

  // Build rich field description with type-specific hints
  const fieldLines = fields.map((f, i) => {
    let line = `[${i}] type="${f.type}" label="${f.label || f.placeholder || f.name || ''}"`;
    if (f.name) line += ` name="${f.name}"`;
    if (f.required) line += ` REQUIRED`;

    // Type-specific context
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

  // Robust JSON extraction
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

// ── Profiles ───────────────────────────────────────────────
function renderProfiles(profiles, activeIdx = -1) {
  const list = $('profile-list');
  
  // Jika activeIdx tidak dikirim, ambil dari storage dulu
  if (activeIdx === -1) {
    chrome.storage.local.get(['activeProfileIndex'], data => {
      renderProfiles(profiles, data.activeProfileIndex || 0);
    });
    return;
  }

  if (!profiles?.length) {
    list.innerHTML = `<div class="empty-state"><div>Belum ada profil.<br>Tambah profil untuk mengisi form lebih cepat.</div></div>`;
    return;
  }
  list.innerHTML = profiles.map((p, i) => `
    <div class="profile-card ${i === activeIdx ? 'active' : ''}" data-index="${i}">
      <div class="profile-avatar">${p.image ? `<img src="${p.image}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">` : p.name.charAt(0).toUpperCase()}</div>
      <div class="profile-info">
        <div class="profile-name">${p.name}</div>
        <div class="profile-desc">${p.data.split('\n')[0]}</div>
      </div>
      <div class="profile-actions">
        <button class="icon-btn edit" data-action="edit" data-index="${i}" title="Edit">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
        </button>
        <button class="icon-btn use" data-action="use" data-index="${i}" title="Gunakan">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
        </button>
        <button class="icon-btn delete" data-action="delete" data-index="${i}" title="Hapus">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
        </button>
      </div>
    </div>`).join('');

  list.querySelectorAll('.icon-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const idx = parseInt(btn.dataset.index);
      chrome.storage.local.get(['profiles'], data => {
        const profiles = data.profiles || [];
        const action = btn.dataset.action;

        if (action === 'use') {
          chrome.storage.local.set({ activeProfileIndex: idx }, () => {
            $('instruction').value = profiles[idx].data;
            document.querySelector('[data-tab="fill"]').click();
            showStatus('fill-status', 'success', `Profil "${profiles[idx].name}" aktif!`);
            renderProfiles(profiles, idx);
          });
        } else if (action === 'edit') {
          const p = profiles[idx];
          $('profile-name').value = p.name;
          $('profile-data').value = p.data;
          $('edit-index').value = idx;
          $('form-title').innerText = 'Edit Profil: ' + p.name;
          $('btn-save-profile').innerText = 'Update Profil';
          $('btn-cancel-edit').style.display = 'block';
          
          if (p.image) {
            $('image-preview').style.display = 'block';
            $('image-preview').querySelector('img').src = p.image;
          } else {
            $('image-preview').style.display = 'none';
          }
          $('profile-name').scrollIntoView({ behavior: 'smooth' });
        } else {
          profiles.splice(idx, 1);
          chrome.storage.local.set({ profiles }, () => {
            renderProfiles(profiles);
          });
        }
      });
    });
  });
}

$('profile-image').addEventListener('change', e => {
  const file = e.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = e => {
      // Resize image using Canvas to avoid chrome.storage limits
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800;
        const MAX_HEIGHT = 800;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
        } else {
          if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        
        // Convert to high-quality JPEG
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        
        $('image-preview').style.display = 'block';
        $('image-preview').querySelector('img').src = dataUrl;
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  } else {
    $('image-preview').style.display = 'none';
  }
});

$('btn-save-profile').addEventListener('click', () => {
  const name = $('profile-name').value.trim();
  const profileData = $('profile-data').value.trim();
  const imagePreview = $('image-preview').querySelector('img').src;
  const editIdx = parseInt($('edit-index').value);

  if (!name || !profileData) { showStatus('profile-status', 'error', 'Nama dan data profil harus diisi.'); return; }
  
  chrome.storage.local.get(['profiles'], data => {
    const profiles = data.profiles || [];
    const newProfile = { 
      name, 
      data: profileData, 
      image: imagePreview.startsWith('data:') ? imagePreview : null 
    };

    if (editIdx >= 0) {
      profiles[editIdx] = newProfile;
    } else {
      profiles.push(newProfile);
    }

    chrome.storage.local.set({ profiles }, () => {
      if (chrome.runtime.lastError) {
        showStatus('profile-status', 'error', 'Gagal menyimpan (ukuran foto terlalu besar).');
        return;
      }
      resetProfileForm();
      renderProfiles(profiles);
      showStatus('profile-status', 'success', editIdx >= 0 ? `Profil "${name}" diupdate!` : `Profil "${name}" disimpan!`);
    });
  });
});

$('btn-cancel-edit').addEventListener('click', resetProfileForm);

function resetProfileForm() {
  $('profile-name').value = '';
  $('profile-data').value = '';
  $('profile-image').value = '';
  $('edit-index').value = '-1';
  $('form-title').innerText = 'Tambah Profil Baru';
  $('btn-save-profile').innerText = 'Simpan Profil';
  $('btn-cancel-edit').style.display = 'none';
  $('image-preview').style.display = 'none';
  $('image-preview').querySelector('img').src = '';
}

// ── Clear form ─────────────────────────────────────────────
$('btn-clear-all').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  chrome.tabs.sendMessage(tab.id, { action: 'clearFields' }, res => {
    showStatus('fill-status', 'info', `${res?.cleared || 0} field telah dibersihkan.`);
  });
});

// ── Utilities ──────────────────────────────────────────────
function showStatus(id, type, msg) {
  const el = $(id);
  if (!el) return;
  
  let iconSvg = '';
  if (type === 'success') {
    iconSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>';
  } else if (type === 'error') {
    iconSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>';
  } else if (type === 'info') {
    iconSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>';
  }

  el.className = `status show ${type}`;
  el.innerHTML = `${iconSvg}<span>${msg}</span>`;
  if (type === 'success') setTimeout(() => el.classList.remove('show'), 4000);
}

function sendMessage(tabId, message) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, res => {
      if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
      else resolve(res);
    });
  });
}
