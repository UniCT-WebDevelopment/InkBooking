import express from 'express';
import pkg from 'pg';
import http from 'http';
import { Server as socketIo } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcrypt';
import fetch from 'node-fetch';
import session from 'express-session';
import pgSession from 'connect-pg-simple';
import sharedSession from 'express-socket.io-session';
import authRoutes from './routes/auth.js';
import bookingRoutes from './routes/bookings.js';
import tattooArtistsRouter from './routes/tattoo-artists.js'; // Importa il router dei tatuatori
import chatRoutes from './routes/chat_routes.js';

// Estrazione Pool di PostgreSQL
const { Pool } = pkg;

// Percorsi per file e directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new socketIo(server);

// Configurazione del pool di connessione PostgreSQL
const pool = new Pool({
    user: 'postgres.ffyjdadrlxsbfdxlvooo',
    host: 'aws-0-eu-central-1.pooler.supabase.com',
    database: 'postgres',
    password: 'Qwebnm2701?',
    port: 5432,
});

async function createTables() {
    const client = await pool.connect();
  
    try {
      // Tabella 'users'
      await client.query(`
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          username VARCHAR NOT NULL,
          password VARCHAR NOT NULL,
          account_type VARCHAR,
          studio_name VARCHAR,
          studio_address VARCHAR,
          studio_city VARCHAR,
          studio_postal_code VARCHAR,
          name VARCHAR,
          latitude FLOAT,
          longitude FLOAT,
          opening_hours VARCHAR,
          closing_hours VARCHAR
        );
      `);
      console.log("Created or verified table 'users'");
  
      // Tabella 'chats'
      await client.query(`
        CREATE TABLE IF NOT EXISTS chats (
          id SERIAL PRIMARY KEY,
          user_id INT REFERENCES users(id),
          tattoo_artist_id INT REFERENCES users(id)
        );
      `);
      console.log("Created or verified table 'chats'");
  
      // Tabella 'messages'
      await client.query(`
        CREATE TABLE IF NOT EXISTS messages (
          id SERIAL PRIMARY KEY,
          sender_id INT REFERENCES users(id),
          time_stamp TIMESTAMPTZ,
          chat_id INT REFERENCES chats(id),
          content TEXT
        );
      `);
      console.log("Created or verified table 'messages'");
  
      // Tabella 'bookings'
      await client.query(`
        CREATE TABLE IF NOT EXISTS bookings (
          id SERIAL PRIMARY KEY,
          user_id INT REFERENCES users(id),
          date DATE,
          time TIME,
          tattooer_id INT REFERENCES users(id)
        );
      `);
      console.log("Created or verified table 'bookings'");
  
      // Tabella 'session'
      await client.query(`
        CREATE TABLE IF NOT EXISTS session (
          sid VARCHAR PRIMARY KEY,
          sess JSON,
          expire TIMESTAMP
        );
      `);
      console.log("Created or verified table 'session'");
  
    } catch (err) {
      console.error('Error creating tables:', err);
    } finally {
      client.release();
    }
  }
  
  // Esegui la funzione per creare le tabelle
  createTables().catch(console.error);
// Configurazione del middleware di sessione con PostgreSQL
const PgSession = pgSession(session);
const sessionMiddleware = session({
    store: new PgSession({
        pool: pool,
        tableName: 'session',
    }),
    secret: 'your_secret_key', // Usa una chiave segreta più sicura in produzione
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 giorni
        secure: false, // Imposta a true in produzione se usi HTTPS
        httpOnly: true, // Protegge i cookie dai tentativi di accesso tramite JavaScript
        sameSite: 'lax' // Assicura che il cookie venga inviato solo per le richieste nello stesso sito
    }
});

// Utilizzare il middleware della sessione in Express
app.use(sessionMiddleware);
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Applicare il middleware della sessione a Socket.IO
io.use(sharedSession(sessionMiddleware, {
    autoSave: true
}));

// Rotte API
app.use('/api/tattoo-artists', tattooArtistsRouter); // Usa il router per i tatuatori
app.use('/api/auth', authRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/chat', chatRoutes);

// Test della connessione al database
const testConnection = async () => {
    try {
        await pool.query('SELECT NOW()');
        console.log('Supabase connected');
    } catch (err) {
        console.error('Connection error:', err);
    }
};

testConnection();

// Funzione per ottenere latitudine e longitudine tramite un'API di geocoding
const getLatLong = async (address) => {
    try {
        const geocodeResponse = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`);
        if (!geocodeResponse.ok) {
            throw new Error(`Error in response: ${geocodeResponse.statusText}`);
        }
        const geocodeData = await geocodeResponse.json();
        if (geocodeData.length > 0) {
            return {
                latitude: parseFloat(geocodeData[0].lat),
                longitude: parseFloat(geocodeData[0].lon),
            };
        }
        return { latitude: null, longitude: null };
    } catch (error) {
        console.error('Error during geocoding fetch:', error);
        return { latitude: null, longitude: null };
    }
};

// Endpoint per ottenere latitudine e longitudine
app.get('/api/getLatLong', async (req, res) => {
    const address = req.query.address;
    if (!address) {
        return res.status(400).json({ message: 'Address parameter is required.' });
    }
    try {
        const { latitude, longitude } = await getLatLong(address);
        res.json({ latitude, longitude });
    } catch (error) {
        res.status(500).json({ message: 'Error during geocoding fetch.' });
    }
});

// Endpoint di registrazione utente
app.post('/api/auth/register', async (req, res) => {
    const { name, username, password, accountType, studioName, studioAddress, studioCity, studioPostalCode } = req.body;

    try {
        // Verifica se l'username esiste già
        const userCheckResult = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
        if (userCheckResult.rows.length > 0) {
            return res.status(400).json({ message: 'Username already exists.' });
        }

        let latitude = null;
        let longitude = null;

        if (accountType === 'Tatuatore') {
            const address = `${studioAddress}, ${studioCity}, ${studioPostalCode}`;
            const { latitude: lat, longitude: lon } = await getLatLong(address);
            latitude = lat;
            longitude = lon;
        }

        // Hash della password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Inserimento nel database
        const result = await pool.query(
            'INSERT INTO users (name, username, password, account_type, studio_name, studio_address, studio_city, studio_postal_code, latitude, longitude) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id',
            [name, username, hashedPassword, accountType, studioName, studioAddress, studioCity, studioPostalCode, latitude, longitude]
        );

        const userId = result.rows[0].id;
        req.session.userId = userId; // Crea una sessione per il nuovo utente

        res.status(201).json({ id: userId, message: 'Registrazione avvenuta con successo!' });
    } catch (error) {
        if (error.code === '23505') { // Violazione dell'unicità
            res.status(400).json({ message: 'Username already exists.' });
        } else if (error.code === '23502') { // Campo non nullo mancante
            res.status(400).json({ message: 'Some required fields are missing.' });
        } else {
            res.status(500).json({ message: 'Error during registration.' });
        }
    }
});

// Middleware di autenticazione
const authenticate = (req, res, next) => {
    if (req.session && req.session.userId) {
        next();
    } else {
        res.status(401).json({ message: 'Not authenticated' });
    }
};

// Creare una prenotazione
app.post('/api/bookings/create', authenticate, async (req, res) => {
    const { date, time } = req.body;
    const userId = req.session.userId;

    if (!date || !time) {
        return res.status(400).json({ message: 'All fields are required.' });
    }

    try {
        const result = await pool.query(
            'INSERT INTO bookings (user_id, date, time) VALUES ($1, $2, $3) RETURNING id',
            [userId, date, time]
        );
        res.status(201).json({ id: result.rows[0].id, message: 'Booking created successfully!' });
    } catch (error) {
        res.status(500).json({ message: 'Error during booking creation.' });
    }
});

// Socket.IO: gestione delle sessioni e dei messaggi
io.on('connection', (socket) => {
    console.log('Nuova connessione socket:', socket.id);

    if (!socket.request.session || !socket.request.session.userId) {
        socket.disconnect();
        return;
    }

    console.log('Sessione dell\'utente:', socket.request.session);

    socket.on('joinChat', (chatSessionId) => {
        console.log(`Utente ${socket.id} si è unito alla chat ${chatSessionId}`);
        socket.join(`chat_${chatSessionId}`);
        console.log(`Stanze dell'utente ${socket.id}: ${[...socket.rooms]}`);
    });

    socket.on('sendMessage', async ({ chatSessionId, message }) => {
        if (!socket.request.session || !socket.request.session.userId) {
            return;
        }

        const senderId = socket.request.session.userId;
        const timeStamp = new Date();

        try {
            // Verifica che la chat esista
            const chatExists = await pool.query(
                'SELECT id FROM chats WHERE id = $1',
                [chatSessionId]
            );

            if (chatExists.rows.length === 0) {
                console.error(`Chat con ID ${chatSessionId} non esiste`);
                return;
            }

            // Inserisci il messaggio nella tabella messages
            const result = await pool.query(
                'INSERT INTO messages (sender_id, chat_id, content, time_stamp) VALUES ($1, $2, $3, $4) RETURNING id',
                [senderId, chatSessionId, message, timeStamp]
            );

            const messageId = result.rows[0].id;
            console.log(`Messaggio inserito con ID ${messageId}`);

            // Invia il messaggio a tutti i partecipanti alla chat
            io.to(`chat_${chatSessionId}`).emit('receiveMessage', {
                senderId,
                chatSessionId,
                messageId,
                timeStamp,
                message
            });
        } catch (error) {
            console.error('Errore durante l\'invio del messaggio:', error);
        }
    });

    socket.on('disconnect', () => {
        console.log('Utente disconnesso:', socket.id);
    });
});

// Gestione degli errori generali
app.use((err, req, res, next) => {
    console.error('Errore:', err);
    res.status(500).json({ message: 'Internal server error.' });
});

// Avvio del server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server avviato sulla porta ${PORT}`);
});

export default app;
