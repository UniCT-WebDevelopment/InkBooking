import express from 'express';
import session from 'express-session';
import pgSession from 'connect-pg-simple';
import pkg from 'pg';
import nodemailer from 'nodemailer';

const router = express.Router();
const { Pool } = pkg;

// Configura la connessione al database PostgreSQL
const pool = new Pool({
    user: 'postgres.ffyjdadrlxsbfdxlvooo',
    host: 'aws-0-eu-central-1.pooler.supabase.com',
    database: 'postgres',
    password: 'Qwebnm2701?',
    port: 5432,
});

// Configura la sessione PostgreSQL
const PgSession = pgSession(session);

router.use(session({
    store: new PgSession({
        pool: pool,
        tableName: 'session'  // Nome della tabella per le sessioni
    }),
    secret: 'your_secret_key',  // Segreto della sessione
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 30 * 24 * 60 * 60 * 1000  // 30 giorni
    }
}));

// Configura il trasportatore SMTP per l'invio delle email tramite Gmail
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'inkbookingr@gmail.com',  // Email del mittente
        pass: 'ltvh satg afjk kpnk'  // Password dell'email (meglio usare OAuth2 o password per app specifica)
    }
});

// Funzione per inviare un'email
const sendEmail = async (to, subject, text) => {
    try {
        await transporter.sendMail({
            from: 'inkbookingr@gmail.com',  // Mittente
            to,  // Destinatario
            subject,  // Oggetto dell'email
            text  // Testo dell'email
        });
        console.log('Email inviata con successo');
    } catch (error) {
        console.error('Errore nell\'invio dell\'email:', error);
    }
};

// Middleware per autenticazione
const authenticate = (req, res, next) => {
    if (req.session.userId) {
        next();
    } else {
        res.status(401).json({ message: 'Non autenticato' });
    }
};

// Middleware per autorizzazione del tatuatore
const authorizeTattooer = (req, res, next) => {
    if (req.session.userId && req.session.accountType === 'Tatuatore') {
        next();
    } else {
        res.status(403).json({ message: 'Non autorizzato' });
    }
};

// Creare una prenotazione
router.post('/create', authenticate, async (req, res) => {
    const { date, time, tattooerId } = req.body;  // Dati dalla richiesta
    const userId = req.session.userId;  // ID utente dalla sessione

    if (!date || !time || !tattooerId) {
        return res.status(400).json({ message: 'Tutti i campi sono obbligatori.' });
    }

    try {
        // Inserisci la prenotazione nel database
        const result = await pool.query(
            'INSERT INTO bookings (user_id, date, time, tattooer_id) VALUES ($1, $2, $3, $4) RETURNING id',
            [userId, date, time, tattooerId]
        );
        const bookingId = result.rows[0].id;

        // Recupera i dettagli del tatuatore (incluso il suo username che è l'email)
        const tattooerResult = await pool.query(
            'SELECT studio_name, studio_address, username FROM users WHERE id = $1',
            [tattooerId]
        );
        const tattooer = tattooerResult.rows[0];

        // Recupera l'email del cliente (username)
        const userResult = await pool.query(
            'SELECT username FROM users WHERE id = $1',
            [userId]
        );
        const user = userResult.rows[0];

        // Componi l'email di conferma al cliente
        const emailTextToClient = `Ciao,\n\nHai prenotato un appuntamento con ${tattooer.studio_name} il ${date} alle ${time}. L'indirizzo dello studio è: ${tattooer.studio_address}. Grazie per aver scelto il nostro servizio!`;

        // Componi l'email di notifica al tatuatore
        const emailTextToTattooer = `Hai una nuova prenotazione:\n\nData: ${date}\nOra: ${time}\n\nCliente: ${user.username}`;

        // Invia l'email al cliente
        await sendEmail(user.username, 'Conferma Prenotazione', emailTextToClient);

        // Invia l'email al tatuatore
        await sendEmail(tattooer.username, 'Nuova Prenotazione', emailTextToTattooer);

        res.status(201).json({ id: bookingId, message: 'Prenotazione creata con successo!' });
    } catch (error) {
        console.error('Errore durante la creazione della prenotazione:', error);
        res.status(500).json({ message: 'Errore durante la creazione della prenotazione.' });
    }
});

// Ottenere le prenotazioni di un tatuatore specifico
router.get('/tattooer/:tattooerId/bookings', authenticate, authorizeTattooer, async (req, res) => {
    const tattooerId = req.params.tattooerId;

    try {
        const query = `
            SELECT b.id, b.date, b.time, u.username as clientEmail
            FROM bookings b
            JOIN users u ON b.user_id = u.id
            WHERE b.tattooer_id = $1
        `;
        const result = await pool.query(query, [tattooerId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Nessuna prenotazione trovata per questo tatuatore.' });
        }

        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Errore durante il recupero delle prenotazioni:', error);
        res.status(500).json({ message: 'Errore durante il recupero delle prenotazioni.' });
    }
});

// Funzione per formattare una data nel formato gg/mm/aaaa
const formatDate = (dateString) => {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0'); // I mesi sono basati su zero
    const year = date.getFullYear();

    return `${day}/${month}/${year}`;
};

const formatTime = (timeString) => {
    const [hours, minutes] = timeString.split(':');
    return `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}`;
};


// Cancellare una prenotazione
router.delete('/:bookingId', authenticate, async (req, res) => {
    const { bookingId } = req.params;

    try {
        // Recupera i dettagli della prenotazione e l'ID dell'utente (cliente)
        const bookingResult = await pool.query(
            'SELECT user_id, date, time ' +
            'FROM bookings ' +
            'WHERE id = $1',
            [bookingId]
        );

        if (bookingResult.rows.length === 0) {
            console.error('Prenotazione non trovata per ID:', bookingId);
            return res.status(404).json({ message: 'Prenotazione non trovata.' });
        }

        const booking = bookingResult.rows[0];
        const userId = booking.user_id;

        // Recupera l'email del cliente
        const userResult = await pool.query(
            'SELECT username FROM users WHERE id = $1',
            [userId]
        );

        if (userResult.rows.length === 0) {
            console.error('Email del cliente non trovata per user_id:', userId);
            return res.status(500).json({ message: 'Impossibile trovare l\'email del cliente.' });
        }

        const user = userResult.rows[0];
        const clientEmail = user.username;

        // Format the date and time
        const formattedDate = formatDate(booking.date);
        const formattedTime = formatTime(booking.time);

        // Cancella la prenotazione
        const deleteResult = await pool.query(
            'DELETE FROM bookings WHERE id = $1 RETURNING *',
            [bookingId]
        );

        if (deleteResult.rowCount === 0) {
            console.error('Prenotazione non trovata durante la cancellazione per ID:', bookingId);
            return res.status(404).json({ message: 'Prenotazione non trovata.' });
        }

        // Componi l'email al cliente
        const emailTextToClient = `Ciao,\n\nIl tatuatore ha cancellato la tua prenotazione per il ${formattedDate} alle ${formattedTime}. Ci scusiamo per l'inconveniente :(.\n\nCordiali saluti,\nIl team`;

        // Invia l'email al cliente
        await sendEmail(clientEmail, 'Cancellazione Prenotazione', emailTextToClient);

        res.status(200).json({ message: 'Prenotazione cancellata con successo e cliente avvisato.' });
    } catch (error) {
        console.error('Errore durante la cancellazione della prenotazione:', error);
        res.status(500).json({ message: 'Errore durante la cancellazione della prenotazione.' });
    }
});



// Controllare la disponibilità di uno slot
router.get('/check', async (req, res) => {
    const { tattooerId, date, time } = req.query;

    if (!tattooerId || !date || !time) {
        return res.status(400).json({ message: 'Parametri mancanti' });
    }

    try {
        const result = await pool.query(
            'SELECT * FROM bookings WHERE tattooer_id = $1 AND date = $2 AND time = $3 LIMIT 1',
            [tattooerId, date, time]
        );

        if (result.rows.length > 0) {
            return res.json({ isBooked: true });
        } else {
            return res.json({ isBooked: false });
        }
    } catch (error) {
        console.error('Errore durante il controllo dello slot:', error);
        return res.status(500).json({ message: 'Errore nel server' });
    }
});

export default router;
