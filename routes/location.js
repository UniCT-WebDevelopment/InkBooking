import express from 'express';
import fetch from 'node-fetch';

const router = express.Router();

// Funzione per ottenere latitudine e longitudine
router.get('/getLatLong', async (req, res) => {
    const address = req.query.address;

    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        if (data.length > 0) {
            res.json({ lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) });
        } else {
            res.status(404).json({ message: 'Location not found' });
        }
    } catch (error) {
        console.error('Error fetching coordinates:', error);
        res.status(500).json({ message: 'Error fetching coordinates' });
    }
});

export default router;
