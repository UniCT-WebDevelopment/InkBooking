import express from 'express';
import pkg from 'pg';
import session from 'express-session';

const { Pool } = pkg;

const router = express.Router();

// Configurazione del pool di connessione PostgreSQL
const pool = new Pool({
    user: 'postgres.ffyjdadrlxsbfdxlvooo',
    host: 'aws-0-eu-central-1.pooler.supabase.com',
    database: 'postgres',
    password: 'Qwebnm2701?',
    port: 5432,
});

// Middleware di autenticazione
const authenticate = (req, res, next) => {
    if (req.session.userId) {
        next();
    } else {
        res.status(401).json({ message: 'Not authenticated' });
    }
};

// Rotta per inviare un messaggio
router.post('/send-message', authenticate, async (req, res) => {
    const { chatSessionId, message } = req.body;
    const senderId = req.session.userId;
    const timeStamp = new Date(); // Usa il timestamp corrente

    console.log('Dati del messaggio:', { senderId, timeStamp, chatSessionId, message });

    try {
        // Verifica che la chat esista
        const chatExists = await pool.query(
            'SELECT id FROM chats WHERE id = $1',
            [chatSessionId]
        );

        if (chatExists.rows.length === 0) {
            console.error(`Chat con ID ${chatSessionId} non esiste`);
            return res.status(400).json({ message: 'Chat non trovata.' });
        }

        // Inserisci il messaggio nella tabella messages
        const result = await pool.query(
            'INSERT INTO messages (sender_id, time_stamp, chat_id, content) VALUES ($1, $2, $3, $4) RETURNING id',
            [senderId, timeStamp, chatSessionId, message]
        );

        const messageId = result.rows[0].id;
        console.log(`Messaggio inserito con ID ${messageId}`);

        res.status(200).json({ message: 'Messaggio inviato con successo', messageId });
    } catch (error) {
        console.error('Errore durante l\'invio del messaggio:', error);
        res.status(500).json({ message: 'Errore durante l\'invio del messaggio' });
    }
});

// Rotta per ottenere i messaggi tra un cliente e un tatuatore
router.get('/get-messages', authenticate, async (req, res) => {
    const userId = req.session.userId;
    const { chatSessionId } = req.query;

    console.log('Dati per recupero messaggi:', { userId, chatSessionId });

    try {
        // Recupera i messaggi per la chat specificata
        const result = await pool.query(
            'SELECT * FROM messages WHERE chat_id = $1 ORDER BY time_stamp ASC',
            [chatSessionId]
        );
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Errore durante il recupero dei messaggi:', error);
        res.status(500).json({ message: 'Errore durante il recupero dei messaggi' });
    }
});

export default router;
