import express from 'express';
import pkg from 'pg';
const { Pool } = pkg;

const router = express.Router();

// Configurazione della connessione al database
const pool = new Pool({
    user: 'postgres.ffyjdadrlxsbfdxlvooo',
    host: 'aws-0-eu-central-1.pooler.supabase.com',
    database: 'postgres',
    password: 'Qwebnm2701?',
    port: 5432,
});

// Endpoint per ottenere i tatuatori in base alla città e al CAP
router.get('/', async (req, res) => {
    const { city, postalCode } = req.query;

    if (!city || !postalCode) {
        return res.status(400).json({ message: 'City and postalCode are required.' });
    }

    try {
        const { rows } = await pool.query(
            'SELECT * FROM users WHERE studio_city = $1 AND studio_postal_code = $2 AND account_type = $3',
            [city, postalCode, 'Tatuatore']
        );

        // Verifica se sono stati trovati tatuatori
        if (rows.length === 0) {
            return res.status(404).json({ message: 'No tattoo artists found.' });
        }

        res.status(200).json(rows);
    } catch (error) {
        console.error('Error fetching tattoo artists:', error);
        res.status(500).json({ message: 'An error occurred while fetching tattoo artists.' });
    }
});

router.get('/:tattooerId/bookings', async (req, res) => {
    const { tattooerId } = req.params;

    try {
        const { rows } = await pool.query(
            'SELECT b.id, b.date, b.time, u.name AS clientName ' +
            'FROM bookings b ' +
            'JOIN users u ON b.user_id = u.id ' +
            'WHERE b.tattooer_id = $1',
            [tattooerId]
        );

        if (rows.length === 0) {
            return res.status(404).json({ message: 'No bookings found for this tattooer.' });
        }

        res.status(200).json(rows);
    } catch (error) {
        console.error('Error fetching bookings:', error);
        res.status(500).json({ message: 'An error occurred while fetching bookings.' });
    }
});


export default router;
