import express from 'express';
import bcrypt from 'bcrypt';
import { pool } from '../dbConfig.js'; // Assicurati che la configurazione del pool sia corretta
import fetch from 'node-fetch';

const router = express.Router();

// Funzione per ottenere latitudine e longitudine
async function getLatLong(address) {
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        if (data.length > 0) {
            return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
        }
        throw new Error('Unable to get coordinates');
    } catch (error) {
        console.error('Error during geocoding fetch:', error);
        throw error;
    }
}

// Gestisci la registrazione
router.post('/register', async (req, res) => {
    const { name, username, password, accountType, studioName, studioAddress, studioCity, studioPostalCode, openingHours, closingHours } = req.body;

    try {
        const client = await pool.connect();
        try {
            // Verifica se l'username esiste già
            const userCheck = await client.query('SELECT id FROM users WHERE username = $1', [username]);
            if (userCheck.rows.length > 0) {
                return res.status(400).json({ message: 'Username già esistente.' });
            }

            const hashedPassword = await bcrypt.hash(password, 10);

            let latitude = null;
            let longitude = null;

            if (accountType === 'Tatuatore') {
                const address = `${studioAddress}, ${studioCity}, ${studioPostalCode}`;
                const coordinates = await getLatLong(address);
                latitude = coordinates.lat;
                longitude = coordinates.lon;
            }

            await client.query(
                'INSERT INTO users (name, username, password, account_type, studio_name, studio_address, studio_city, studio_postal_code, opening_hours, closing_hours, latitude, longitude) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)',
                [name, username, hashedPassword, accountType, studioName, studioAddress, studioCity, studioPostalCode, openingHours, closingHours, latitude, longitude]
            );

            res.status(201).json({ message: 'User registered successfully!' });
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Error registering user:', error);
        res.status(500).json({ message: 'An error occurred while registering.' });
    }
});


// Gestisci il login
router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        const client = await pool.connect();
        try {
            const result = await client.query('SELECT id, password, account_type FROM users WHERE username = $1', [username]);
            const user = result.rows[0];

            if (user && await bcrypt.compare(password, user.password)) {
                // Imposta la sessione utente
                req.session.userId = user.id;
                req.session.accountType = user.account_type;

                // Salva la sessione e gestisci eventuali errori di salvataggio
                req.session.save((err) => {
                    if (err) {
                        console.error('Errore durante il salvataggio della sessione:', err);
                        return res.status(500).json({ message: 'Errore durante il salvataggio della sessione.' });
                    }

                    res.status(200).json({ 
                        message: 'Login successful', 
                        userId: user.id,
                        accountType: user.account_type 
                    });
                });

            } else {
                res.status(401).json({ message: 'Invalid username or password' });
            }
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Error logging in:', error);
        res.status(500).json({ message: 'An error occurred while logging in.' });
    }
});


// Gestisci il logout
router.post('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).json({ message: 'An error occurred while logging out.' });
        }
        res.status(200).json({ message: 'Logout successful' });
    });
});

export default router;
