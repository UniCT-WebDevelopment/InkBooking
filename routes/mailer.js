import nodemailer from 'nodemailer';

// Configura il trasportatore SMTP per Nodemailer
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'inkbookingr@gmail.com',  // Sostituisci con la tua email Gmail
        pass: 'qkfu kghq buzc mxwe'      // Sostituisci con la password per l'app generata
    }
});

// Funzione per inviare email
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

export { sendEmail };
