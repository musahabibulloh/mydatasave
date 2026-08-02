/**
 * Setup Database - Jalankan sekali untuk membuat tabel di Supabase
 * 
 * Cara pakai:
 *   node setup-db.js <SUPABASE_URL> <SERVICE_ROLE_KEY>
 * 
 * Contoh:
 *   node setup-db.js https://xxxxx.supabase.co eyJhbGciOiJIUzI1NiIs...
 */

const SUPABASE_URL = process.argv[2];
const SERVICE_KEY = process.argv[3];

if (!SUPABASE_URL || !SERVICE_KEY) {
    console.log('');
    console.log('=== SETUP DATABASE BUKU HARIAN ===');
    console.log('');
    console.log('Cara pakai:');
    console.log('  node setup-db.js <SUPABASE_URL> <SERVICE_ROLE_KEY>');
    console.log('');
    console.log('Contoh:');
    console.log('  node setup-db.js https://abcdef.supabase.co eyJhbGciOiJIUzI1NiIs...');
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
