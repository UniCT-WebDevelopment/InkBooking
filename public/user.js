import express from 'express';
import pkg from 'pg';
import mongoose from 'mongoose'; // Add this line to import mongoose

const { Pool } = pkg;

const router = express.Router();
const { Schema } = mongoose; // Updated to ES6 destructuring syntax

const UserSchema = new Schema({
    username: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    },
    accountType: {
        type: String,
        required: true
    },
    studioName: {
        type: String
    },
    studioAddress: {
        type: String
    },
    studioCity: {
        type: String
    },
    studioPostalCode: {
        type: String
    }
});

// Updated to ES6 export syntax
const User = mongoose.model('User', UserSchema); // Changed 'user' to 'User' for proper naming convention
export { User };

// Configura la connessione al database PostgreSQL con Supabase
const pool = new Pool({
    user: 'postgres.ffyjdadrlxsbfdxlvooo',
    host: 'aws-0-eu-central-1.pooler.supabase.com',
    database: 'postgres',
    password: 'Qwebnm2701?',
    port: 5432,
});

router.get('/', async (req, res) => {
    try {
        // Esegui la query per selezionare utenti
        const result = await pool.query('SELECT id, username FROM users');
        // Invia i dati degli utenti come JSON
        res.json(result.rows);
    } catch (err) {
        console.error('Errore nel recupero degli utenti:', err);
        res.status(500).send('Errore nel recupero degli utenti');
    }
});

export default router;
