import { pool } from './dbConfig.js';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';

export default function socketHandlers(io) {
    const pgSession = connectPgSimple(session);

    // Configurazione del middleware di sessione
    const sessionMiddleware = session({
        store: new pgSession({
            pool: pool,
            tableName: 'session',
        }),
        secret: 'your_secret_key', // Dovrebbe essere più sicura e memorizzata in una variabile d'ambiente
        resave: false,
        saveUninitialized: false,
        cookie: {
            maxAge: 2592000000, // 30 giorni in millisecondi
        },
    });

    // Applicazione del middleware di sessione a Socket.IO
    io.use((socket, next) => {
        sessionMiddleware(socket.request, {}, next);
    });

    // Gestione delle connessioni Socket.IO
io.on('connection', (socket) => {
    console.log('Nuova connessione socket:', socket.id);

    socket.on('sendMessage', async ({ chatSessionId, message }) => {
        if (!socket.request.session || !socket.request.session.userId) {
            return;
        }

        const senderId = socket.request.session.userId;
        const timeStamp = new Date();

        console.log('Tentativo di inserimento del messaggio');
        console.log('Dati del messaggio:', { senderId, timeStamp, chatSessionId, message });

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
                message // Includi il messaggio nel payload
            });

            console.log(`Messaggio inviato alla chat ${chatSessionId} da ${senderId}: ${message}`);
        } catch (error) {
            console.error('Errore durante l\'invio del messaggio:', error);
        }
    });

    socket.on('disconnect', () => {
        console.log('Utente disconnesso:', socket.id);
    });
});

}
