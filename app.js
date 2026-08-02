/* ==========================================
   BUKU HARIAN DIGITAL - Application Logic
   ========================================== */

let db = null; // Supabase client instance

let globalConfig = { url: '', key: '' };

// ===== INITIALIZATION =====

document.addEventListener('DOMContentLoaded', async () => {
    await fetchConfig();
    detectPage();
});

async function fetchConfig() {
    try {
        const response = await fetch('/api/config');
        if (response.ok) {
            const data = await response.json();
            if (data.supabaseUrl && data.supabaseKey) {
                globalConfig.url = data.supabaseUrl;
                globalConfig.key = data.supabaseKey;
            }
        }
    } catch (err) {
        console.warn('Gagal memuat konfigurasi dari API, menggunakan fallback lokal:', err);
    }
}

function detectPage() {
    const path = window.location.pathname;
    const isLogin = !path.includes('dashboard');

    if (isLogin) {
        initLoginPage();
    } else {
        initDashboardPage();
    }
}

// ===== LOGIN PAGE INIT =====

function initLoginPage() {
    // Check if already logged in
    if (sessionStorage.getItem('bh_logged_in') === 'true') {
        window.location.href = 'dashboard.html';
        return;
    }

    // Setup login form
    const form = document.getElementById('form-login');
    if (form) {
        form.addEventListener('submit', handleLogin);
    }
    const btnLogin = document.getElementById('btn-login');
    if (btnLogin) {
        btnLogin.addEventListener('click', handleLogin);
    }

    // Toggle password visibility
    const btnToggle = document.getElementById('btn-toggle-password');
    if (btnToggle) {
        btnToggle.addEventListener('click', () => {
            const input = document.getElementById('input-password');
            if (input.type === 'password') {
                input.type = 'text';
                btnToggle.textContent = '🙈';
            } else {
                input.type = 'password';
                btnToggle.textContent = '👁️';
            }
        });
    }

    // Create background particles
    createParticles();
}

// ===== DASHBOARD PAGE INIT =====

function initDashboardPage() {
    // Check if logged in
    if (sessionStorage.getItem('bh_logged_in') !== 'true') {
        window.location.href = 'index.html';
        return;
    }

    // Set default date
    const dateInput = document.getElementById('input-tanggal');
    if (dateInput) {
        dateInput.value = new Date().toISOString().split('T')[0];
    }

    // Load saved settings into settings form
    const settings = getSettings();
    const passInput = document.getElementById('input-app-password');
    if (passInput && settings.password) passInput.value = settings.password;

    // Init Supabase
    if (initSupabase()) {
        loadAllEntries();
    }

    setupDashboardListeners();
}

function setupDashboardListeners() {
    // Save entry form
    const formCatatan = document.getElementById('form-catatan');
    if (formCatatan) formCatatan.addEventListener('submit', handleSaveEntry);
    const btnSimpan = document.getElementById('btn-simpan');
    if (btnSimpan) btnSimpan.addEventListener('click', handleSaveEntry);

    // Settings form
    const formSettings = document.getElementById('form-settings');
    if (formSettings) formSettings.addEventListener('submit', handleSaveSettings);
    const btnSaveSettings = document.getElementById('btn-save-settings');
    if (btnSaveSettings) btnSaveSettings.addEventListener('click', handleSaveSettings);

    // Edit form
    const formEdit = document.getElementById('form-edit');
    if (formEdit) formEdit.addEventListener('submit', handleUpdateEntry);
    const btnUpdate = document.getElementById('btn-update');
    if (btnUpdate) btnUpdate.addEventListener('click', handleUpdateEntry);

    // Photo preview
    const inputFoto = document.getElementById('input-foto');
    if (inputFoto) inputFoto.addEventListener('change', handlePhotoPreview);
}

// ===== BACKGROUND PARTICLES =====

function createParticles() {
    const container = document.getElementById('bg-particles');
    if (!container) return;
    for (let i = 0; i < 20; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        const size = Math.random() * 200 + 50;
        particle.style.width = size + 'px';
        particle.style.height = size + 'px';
        particle.style.left = Math.random() * 100 + '%';
        particle.style.top = Math.random() * 100 + '%';
        particle.style.animationDelay = Math.random() * 10 + 's';
        particle.style.animationDuration = (Math.random() * 15 + 15) + 's';
        container.appendChild(particle);
    }
}

// ===== SETTINGS MANAGEMENT =====

function getSettings() {
    // Hanya membaca kredensial Supabase dari API Config (Vercel/env), tidak menyimpan ke LocalStorage
    return {
        url: globalConfig.url || '',
        key: globalConfig.key || '',
        password: localStorage.getItem('bh_app_password') || ''
    };
}

function saveSettings(password) {
    // Hanya menyimpan password aplikasi untuk keamanan lokal
    if (password) {
        localStorage.setItem('bh_app_password', password);
    } else {
        localStorage.removeItem('bh_app_password');
    }
}

function handleSaveSettings(e) {
    e.preventDefault();
    const password = document.getElementById('input-app-password').value.trim();

    saveSettings(password);
    showStatus('settings-status', 'Pengaturan berhasil disimpan!', 'success');
}

// ===== SUPABASE CLIENT =====

function initSupabase() {
    const settings = getSettings();
    if (!settings.url || !settings.key) return false;

    try {
        const { createClient } = supabase;
        db = createClient(settings.url, settings.key);
        return true;
    } catch (err) {
        console.error('Gagal inisialisasi Supabase:', err);
        return false;
    }
}

// ===== LOGIN / LOGOUT =====

function handleLogin(e) {
    e.preventDefault();
    const password = document.getElementById('input-password').value;
    const savedPassword = getSettings().password;

    // If no password set, let them in and go to settings
    if (!savedPassword) {
        sessionStorage.setItem('bh_logged_in', 'true');
        window.location.href = 'dashboard.html';
        return;
    }

    if (password === savedPassword) {
        const errorEl = document.getElementById('login-error');
        if (errorEl) errorEl.style.display = 'none';
        sessionStorage.setItem('bh_logged_in', 'true');
        window.location.href = 'dashboard.html';
    } else {
        const errorEl = document.getElementById('login-error');
        if (errorEl) errorEl.style.display = 'flex';
    }
}

function logout() {
    sessionStorage.removeItem('bh_logged_in');
    window.location.href = 'index.html';
}

// ===== SECTION NAVIGATION =====

function showSection(sectionName) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    const section = document.getElementById('section-' + sectionName);
    if (section) section.classList.add('active');

    // Update sidebar nav buttons
    document.querySelectorAll('.sidebar-link').forEach(b => b.classList.remove('active'));
    const navBtn = document.getElementById('btn-nav-' + sectionName);
    if (navBtn) navBtn.classList.add('active');

    // Load entries when switching to arsip
    if (sectionName === 'arsip') {
        loadAllEntries();
    }

    // Close sidebar on mobile
    closeSidebar();
}

// ===== SIDEBAR TOGGLE (MOBILE) =====

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (sidebar) sidebar.classList.toggle('open');
    if (overlay) overlay.classList.toggle('open');
}

function closeSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (sidebar) sidebar.classList.remove('open');
    if (overlay) overlay.classList.remove('open');
}

// ===== PHOTO PREVIEW =====

function handlePhotoPreview(e) {
    const container = document.getElementById('preview-foto');
    container.innerHTML = '';

    const files = e.target.files;
    for (let i = 0; i < files.length; i++) {
        const reader = new FileReader();
        reader.onload = function (ev) {
            const img = document.createElement('img');
            img.src = ev.target.result;
            img.alt = 'Preview';
            container.appendChild(img);
        };
        reader.readAsDataURL(files[i]);
    }
}

// ===== SAVE ENTRY =====

async function handleSaveEntry(e) {
    e.preventDefault();

    if (!db) {
        showStatus('save-status', 'Supabase belum dikonfigurasi. Buka menu Pengaturan.', 'error');
        return;
    }

    const btn = document.getElementById('btn-simpan');
    btn.disabled = true;
    btn.innerHTML = '<span>⏳ Menyimpan...</span>';

    try {
        const tanggal = document.getElementById('input-tanggal').value;
        const judul = document.getElementById('input-judul').value.trim();
        const isi = document.getElementById('input-isi').value.trim();
        const suasana = document.getElementById('input-suasana').value;
        const fotoInput = document.getElementById('input-foto');

        if (!tanggal || !judul || !isi) {
            showStatus('save-status', 'Tanggal, judul, dan isi wajib diisi.', 'error');
            btn.disabled = false;
            btn.innerHTML = '<span>💾 Simpan Catatan</span>';
            return;
        }

        // Upload photos if any
        let fotoUrls = [];
        if (fotoInput.files.length > 0) {
            fotoUrls = await uploadPhotos(fotoInput.files, tanggal);
        }

        // Insert to database
        const { data, error } = await db
            .from('catatan_harian')
            .insert({
                tanggal: tanggal,
                judul: judul,
                isi: isi,
                suasana: suasana,
                foto_urls: fotoUrls
            })
            .select();

        if (error) throw error;

        showStatus('save-status', 'Catatan berhasil disimpan! ✓', 'success');

        // Reset form
        document.getElementById('input-judul').value = '';
        document.getElementById('input-isi').value = '';
        document.getElementById('input-suasana').value = '😊';
        fotoInput.value = '';
        document.getElementById('preview-foto').innerHTML = '';

    } catch (err) {
        console.error('Error saving:', err);
        showStatus('save-status', 'Gagal menyimpan: ' + err.message, 'error');
    }

    btn.disabled = false;
    btn.innerHTML = '<span>💾 Simpan Catatan</span>';
}

// ===== UPLOAD PHOTOS =====

async function uploadPhotos(files, tanggal) {
    const urls = [];

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const ext = file.name.split('.').pop();
        const fileName = `${tanggal}/${Date.now()}_${i}.${ext}`;

        const { data, error } = await db.storage
            .from('foto-harian')
            .upload(fileName, file, {
                cacheControl: '3600',
                upsert: false
            });

        if (error) {
            console.error('Upload error:', error);
            continue;
        }

        // Get public URL
        const { data: urlData } = db.storage
            .from('foto-harian')
            .getPublicUrl(fileName);

        if (urlData) {
            urls.push(urlData.publicUrl);
        }
    }

    return urls;
}

// ===== LOAD ENTRIES =====

async function loadAllEntries() {
    const filterInput = document.getElementById('filter-bulan');
    if (filterInput) filterInput.value = '';
    await fetchEntries();
}

async function loadEntries() {
    const bulan = document.getElementById('filter-bulan').value;
    if (!bulan) {
        await fetchEntries();
        return;
    }

    const [year, month] = bulan.split('-');
    const startDate = `${year}-${month}-01`;
    const endDate = new Date(year, month, 0).toISOString().split('T')[0];
    await fetchEntries(startDate, endDate);
}

async function fetchEntries(startDate, endDate) {
    const container = document.getElementById('daftar-catatan');
    if (!container) return;
    container.innerHTML = '<p class="placeholder-text">Memuat catatan... <span class="loading"></span></p>';

    if (!db) {
        container.innerHTML = '<p class="placeholder-text">Supabase belum dikonfigurasi.</p>';
        return;
    }

    try {
        let query = db
            .from('catatan_harian')
            .select('*')
            .order('tanggal', { ascending: false })
            .order('created_at', { ascending: false });

        if (startDate && endDate) {
            query = query.gte('tanggal', startDate).lte('tanggal', endDate);
        }

        const { data, error } = await query;

        if (error) throw error;

        if (!data || data.length === 0) {
            container.innerHTML = '<p class="placeholder-text">Belum ada catatan. Mulai menulis sekarang!</p>';
            return;
        }

        container.innerHTML = '';
        data.forEach(entry => {
            container.appendChild(createEntryCard(entry));
        });

    } catch (err) {
        console.error('Error loading entries:', err);
        container.innerHTML = `<p class="placeholder-text">Gagal memuat: ${err.message}</p>`;
    }
}

function createEntryCard(entry) {
    const card = document.createElement('div');
    card.className = 'entry-card';
    card.onclick = () => showEntryDetail(entry);

    const dateFormatted = formatDate(entry.tanggal);
    const preview = entry.isi.substring(0, 100);
    const hasPhotos = entry.foto_urls && entry.foto_urls.length > 0;

    card.innerHTML = `
        <span class="entry-mood">${entry.suasana || '😊'}</span>
        <div class="entry-date">${dateFormatted}</div>
        <div class="entry-title">${escapeHtml(entry.judul)}</div>
        <div class="entry-preview">${escapeHtml(preview)}${entry.isi.length > 100 ? '...' : ''}</div>
        ${hasPhotos ? `<div class="entry-photos-indicator">📷 ${entry.foto_urls.length} foto</div>` : ''}
    `;

    return card;
}

// ===== ENTRY DETAIL =====

function showEntryDetail(entry) {
    const container = document.getElementById('detail-content');
    const dateFormatted = formatDate(entry.tanggal);
    const hasPhotos = entry.foto_urls && entry.foto_urls.length > 0;

    let photosHtml = '';
    if (hasPhotos) {
        photosHtml = '<div class="detail-photos">';
        entry.foto_urls.forEach(url => {
            photosHtml += `<img src="${escapeHtml(url)}" alt="Foto" onclick="openImageModal('${escapeHtml(url)}')" loading="lazy">`;
        });
        photosHtml += '</div>';
    }

    container.innerHTML = `
        <h2>${entry.suasana || '😊'} ${escapeHtml(entry.judul)}</h2>
        <div class="detail-meta">📅 ${dateFormatted}</div>
        ${photosHtml}
        <div class="detail-body">${escapeHtml(entry.isi)}</div>
        <div class="detail-actions">
            <button onclick='openEditModal(${JSON.stringify(entry).replace(/'/g, "&#39;")})'>✏️ Edit</button>
            <button class="btn-danger" onclick="deleteEntry('${entry.id}')">🗑️ Hapus</button>
        </div>
    `;

    showSection('detail');
}

// ===== EDIT ENTRY =====

function openEditModal(entry) {
    document.getElementById('edit-id').value = entry.id;
    document.getElementById('edit-tanggal').value = entry.tanggal;
    document.getElementById('edit-judul').value = entry.judul;
    document.getElementById('edit-isi').value = entry.isi;
    document.getElementById('edit-suasana').value = entry.suasana || '😊';
    document.getElementById('modal-edit').style.display = 'flex';
}

function closeEditModal() {
    document.getElementById('modal-edit').style.display = 'none';
}

async function handleUpdateEntry(e) {
    e.preventDefault();

    if (!db) return;

    const id = document.getElementById('edit-id').value;
    const btn = document.getElementById('btn-update');
    btn.disabled = true;
    btn.textContent = '⏳ Memperbarui...';

    try {
        const { error } = await db
            .from('catatan_harian')
            .update({
                tanggal: document.getElementById('edit-tanggal').value,
                judul: document.getElementById('edit-judul').value.trim(),
                isi: document.getElementById('edit-isi').value.trim(),
                suasana: document.getElementById('edit-suasana').value
            })
            .eq('id', id);

        if (error) throw error;

        closeEditModal();
        showSection('arsip');
        loadAllEntries();

    } catch (err) {
        console.error('Error updating:', err);
        alert('Gagal memperbarui: ' + err.message);
    }

    btn.disabled = false;
    btn.textContent = '💾 Perbarui';
}

// ===== DELETE ENTRY =====

async function deleteEntry(id) {
    if (!confirm('Yakin ingin menghapus catatan ini?')) return;

    if (!db) return;

    try {
        // First get the entry to delete photos
        const { data: entry } = await db
            .from('catatan_harian')
            .select('foto_urls')
            .eq('id', id)
            .single();

        // Delete photos from storage
        if (entry && entry.foto_urls && entry.foto_urls.length > 0) {
            for (const url of entry.foto_urls) {
                try {
                    // Extract path from URL
                    const path = url.split('/foto-harian/')[1];
                    if (path) {
                        await db.storage.from('foto-harian').remove([decodeURIComponent(path)]);
                    }
                } catch (e) {
                    console.warn('Could not delete photo:', e);
                }
            }
        }

        // Delete the entry
        const { error } = await db
            .from('catatan_harian')
            .delete()
            .eq('id', id);

        if (error) throw error;

        showSection('arsip');
        loadAllEntries();

    } catch (err) {
        console.error('Error deleting:', err);
        alert('Gagal menghapus: ' + err.message);
    }
}

// ===== IMAGE MODAL =====

function openImageModal(url) {
    document.getElementById('modal-image-src').src = url;
    document.getElementById('modal-image').style.display = 'flex';
}

function closeImageModal() {
    document.getElementById('modal-image').style.display = 'none';
    document.getElementById('modal-image-src').src = '';
}

// ===== DATABASE INITIALIZATION =====

async function executeSql(sql) {
    const settings = getSettings();
    const serviceKey = settings.serviceKey;

    if (!serviceKey) {
        throw new Error('Service Role Key belum diisi. Buka Pengaturan dan isi Service Role Key.');
    }

    const response = await fetch(`${settings.url}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
            'apikey': serviceKey,
            'Authorization': `Bearer ${serviceKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query: sql })
    });

    // If exec_sql function doesn't exist, try creating it first
    if (response.status === 404 || !response.ok) {
        // Try creating the helper function via pg endpoint
        const pgResponse = await fetch(`${settings.url}/pg/query`, {
            method: 'POST',
            headers: {
                'apikey': serviceKey,
                'Authorization': `Bearer ${serviceKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ query: sql })
        });

        if (!pgResponse.ok) {
            const errText = await pgResponse.text();
            throw new Error(`Gagal eksekusi SQL (${pgResponse.status}): ${errText}`);
        }

        return await pgResponse.json();
    }

    return await response.json();
}

async function initDatabase() {
    const settings = getSettings();

    if (!settings.url || !settings.key) {
        showStatus('init-status', 'Supabase belum dikonfigurasi.', 'error');
        return;
    }

    if (!settings.serviceKey) {
        showStatus('init-status', 'Service Role Key wajib diisi untuk membuat tabel otomatis.', 'error');
        return;
    }

    const btn = document.getElementById('btn-init-db');
    btn.disabled = true;
    btn.textContent = '⏳ Membuat tabel...';

    const sqlStatements = [
        `CREATE TABLE IF NOT EXISTS catatan_harian (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            tanggal DATE NOT NULL,
            judul TEXT NOT NULL,
            isi TEXT NOT NULL,
            suasana TEXT DEFAULT '😊',
            foto_urls TEXT[] DEFAULT '{}',
            created_at TIMESTAMPTZ DEFAULT NOW()
        )`,
        `ALTER TABLE catatan_harian ENABLE ROW LEVEL SECURITY`,
        `DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'catatan_harian' AND policyname = 'Allow all') THEN
                CREATE POLICY "Allow all" ON catatan_harian FOR ALL USING (true);
            END IF;
        END $$`,
        `INSERT INTO storage.buckets (id, name, public)
         VALUES ('foto-harian', 'foto-harian', true)
         ON CONFLICT (id) DO NOTHING`,
        `DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Allow public upload') THEN
                CREATE POLICY "Allow public upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'foto-harian');
            END IF;
        END $$`,
        `DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Allow public read') THEN
                CREATE POLICY "Allow public read" ON storage.objects FOR SELECT USING (bucket_id = 'foto-harian');
            END IF;
        END $$`,
        `DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Allow public delete') THEN
                CREATE POLICY "Allow public delete" ON storage.objects FOR DELETE USING (bucket_id = 'foto-harian');
            END IF;
        END $$`
    ];

    try {
        let successCount = 0;
        let lastError = null;

        for (const sql of sqlStatements) {
            try {
                await executeSql(sql);
                successCount++;
            } catch (err) {
                lastError = err;
                console.warn('SQL step warning:', err.message);
            }
        }

        if (successCount >= 1) {
            // Verify table exists
            if (initSupabase()) {
                const { error } = await db.from('catatan_harian').select('id').limit(1);
                if (!error) {
                    showStatus('init-status', `Berhasil! Tabel dan storage siap digunakan. ✓`, 'success');
                } else {
                    showStatus('init-status', `Sebagian berhasil, tapi tabel belum terdeteksi. Coba jalankan SQL manual.`, 'error');
                }
            }
        } else {
            showStatus('init-status', 'Gagal membuat tabel: ' + (lastError ? lastError.message : 'Unknown error') + '. Coba jalankan SQL manual.', 'error');
        }

    } catch (err) {
        console.error('Init error:', err);
        showStatus('init-status', 'Error: ' + err.message, 'error');
    }

    btn.disabled = false;
    btn.textContent = '🔧 Buat Tabel';
}

// ===== UTILITY FUNCTIONS =====

function showStatus(elementId, message, type) {
    const el = document.getElementById(elementId);
    if (!el) return;
    el.textContent = message;
    el.className = 'status-text ' + type;
    el.style.display = 'block';

    if (type === 'success') {
        setTimeout(() => {
            el.style.display = 'none';
        }, 4000);
    }
}

function formatDate(dateStr) {
    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

    const date = new Date(dateStr + 'T00:00:00');
    const day = days[date.getDay()];
    const d = date.getDate();
    const month = months[date.getMonth()];
    const year = date.getFullYear();

    return `${day}, ${d} ${month} ${year}`;
}

function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
