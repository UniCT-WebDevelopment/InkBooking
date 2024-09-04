import pkg from 'pg'; // Importa l'intero pacchetto 'pg'
const { Pool } = pkg; // Destruttura Pool

// Configura la connessione a PostgreSQL
const pool = new Pool({
    user: 'postgres.ffyjdadrlxsbfdxlvooo',
    host: 'aws-0-eu-central-1.pooler.supabase.com',
    database: 'postgres',
    password: 'Qwebnm2701?',
    port: 5432,
});

export { pool }; // Esporta pool
