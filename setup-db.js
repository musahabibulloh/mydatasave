/**
 * Setup Database - Jalankan sekali untuk membuat tabel di Supabase
 * 
 * Cara pakai:
 *   node setup-db.js <SUPABASE_URL> <SERVICE_ROLE_KEY>
 *   atau cukup buat file .env lalu jalankan:
 *   node setup-db.js
 */

const fs = require('fs');
const path = require('path');

let SUPABASE_URL = process.argv[2];
let SERVICE_KEY = process.argv[3];

// Jika argumen tidak ada, coba baca dari file .env
if (!SUPABASE_URL || !SERVICE_KEY) {
    try {
        const envPath = path.join(__dirname, '.env');
        if (fs.existsSync(envPath)) {
            const envContent = fs.readFileSync(envPath, 'utf-8');
            const envLines = envContent.split('\n');
            const env = {};
            for (const line of envLines) {
                const parts = line.split('=');
                if (parts.length >= 2) {
                    const key = parts[0].trim();
                    const val = parts.slice(1).join('=').trim();
                    env[key] = val;
                }
            }
            SUPABASE_URL = SUPABASE_URL || env.SUPABASE_URL;
            // Gunakan SERVICE_ROLE_KEY dari env jika ada, fallback ke SUPABASE_ANON_KEY jika tidak ada
            SERVICE_KEY = SERVICE_KEY || env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY;
        }
    } catch (err) {
        console.warn('Gagal membaca file .env:', err.message);
    }
}

if (!SUPABASE_URL || !SERVICE_KEY) {
    console.log('');
    console.log('=== SETUP DATABASE BUKU HARIAN ===');
    console.log('');
    console.log('Cara pakai:');
    console.log('  node setup-db.js <SUPABASE_URL> <SERVICE_ROLE_KEY>');
    console.log('  atau isi file .env di folder ini dan jalankan: node setup-db.js');
    console.log('');
    console.log('Service Role Key bisa ditemukan di:');
    console.log('  Supabase Dashboard > Settings > API > service_role (klik Reveal)');
    console.log('');
    process.exit(1);
}

const sqlStatements = [
    {
        name: 'Membuat tabel catatan_harian',
        sql: `CREATE TABLE IF NOT EXISTS catatan_harian (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            tanggal DATE NOT NULL,
            judul TEXT NOT NULL,
            isi TEXT NOT NULL,
            suasana TEXT DEFAULT '😊',
            foto_urls TEXT[] DEFAULT '{}',
            created_at TIMESTAMPTZ DEFAULT NOW()
        )`
    },
    {
        name: 'Mengaktifkan RLS',
        sql: `ALTER TABLE catatan_harian ENABLE ROW LEVEL SECURITY`
    },
    {
        name: 'Membuat policy Allow all',
        sql: `DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'catatan_harian' AND policyname = 'Allow all') THEN
                CREATE POLICY "Allow all" ON catatan_harian FOR ALL USING (true);
            END IF;
        END $$`
    },
    {
        name: 'Membuat bucket foto-harian',
        sql: `INSERT INTO storage.buckets (id, name, public)
              VALUES ('foto-harian', 'foto-harian', true)
              ON CONFLICT (id) DO NOTHING`
    },
    {
        name: 'Policy upload foto',
        sql: `DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Allow public upload') THEN
                CREATE POLICY "Allow public upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'foto-harian');
            END IF;
        END $$`
    },
    {
        name: 'Policy read foto',
        sql: `DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Allow public read') THEN
                CREATE POLICY "Allow public read" ON storage.objects FOR SELECT USING (bucket_id = 'foto-harian');
            END IF;
        END $$`
    },
    {
        name: 'Policy delete foto',
        sql: `DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Allow public delete') THEN
                CREATE POLICY "Allow public delete" ON storage.objects FOR DELETE USING (bucket_id = 'foto-harian');
            END IF;
        END $$`
    }
];

async function executeSql(sql) {
    const response = await fetch(`${SUPABASE_URL}/pg/query`, {
        method: 'POST',
        headers: {
            'apikey': SERVICE_KEY,
            'Authorization': `Bearer ${SERVICE_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query: sql })
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`HTTP ${response.status}: ${text}`);
    }

    return await response.json();
}

async function main() {
    console.log('');
    console.log('=== SETUP DATABASE BUKU HARIAN ===');
    console.log(`URL: ${SUPABASE_URL}`);
    console.log('');

    let success = 0;
    let failed = 0;

    for (const stmt of sqlStatements) {
        process.stdout.write(`  ${stmt.name}... `);
        try {
            await executeSql(stmt.sql);
            console.log('✓');
            success++;
        } catch (err) {
            console.log('✗ ' + err.message);
            failed++;
        }
    }

    console.log('');
    console.log(`Selesai! Berhasil: ${success}, Gagal: ${failed}`);

    if (success > 0 && failed === 0) {
        console.log('');
        console.log('Database siap digunakan! Buka aplikasi dan mulai menulis.');
    } else if (failed > 0) {
        console.log('');
        console.log('Ada beberapa yang gagal. Pastikan Service Role Key benar.');
    }
}

main().catch(err => {
    console.error('Error fatal:', err.message);
    process.exit(1);
});
