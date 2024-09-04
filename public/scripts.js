document.addEventListener('DOMContentLoaded', () => {
    let map; // Variabile globale per la mappa
    const socket = io();


    // Elementi della pagina
    const registerForm = document.getElementById('registerForm');
    const loginForm = document.getElementById('loginForm');
    const chatDiv = document.getElementById('chat');
    const showLoginFormButton = document.getElementById('showLoginForm');
    const showRegisterFormButton = document.getElementById('showRegisterForm');
    const registerContainer = document.getElementById('registerContainer');
    const loginContainer = document.getElementById('loginContainer');
    const accountTypeSelect = document.getElementById('accountType');
    const tatuatoreFields = document.getElementById('tatuatoreFields');
    const clientDashboard = document.getElementById('clientDashboard');
    const tatuatoreDashboard = document.getElementById('tatuatoreDashboard');
    const messageInput = document.getElementById('messageInput');
    const sendButton = document.getElementById('sendButton');
    const messagesDiv = document.getElementById('messages');
    const searchTattooArtistsButton = document.getElementById('searchTattooArtists');
    const bookingMenu = document.getElementById('bookingMenu');
    const bookingTimeSelect = document.getElementById('bookingTime');
    const bookingForm = document.getElementById('bookingForm');
    const showBookingMenuButton = document.getElementById('showBookingMenu');
    const closeBookingMenuButton = document.getElementById('closeBookingMenu');
    const welcomeTitle = document.querySelector('.welcome-title'); // Selettore per il titolo di benvenuto
    const appointmentsDashboard = document.getElementById('appointmentsDashboard');
    const backToClientDashboard = document.getElementById('backToClientDashboard');
    const receiverIdInput = document.getElementById('receiverId');
    const tatuatoreAppointmentsElement = document.getElementById('tatuatoreAppointments');


    // Orari fissi dalle 9:00 alle 18:00 con intervallo di 30 minuti
    const fixedHours = [];
    for (let hour = 9; hour < 18; hour++) {
        fixedHours.push(`${hour}:00`);
        fixedHours.push(`${hour}:30`);
    }
    fixedHours.push('18:00'); // Ultimo orario

    const availableTimes = ['10:00', '11:00', '12:00', '14:00', '15:00'];

    availableTimes.forEach(time => {
        const option = document.createElement('option');
        option.value = time;
        option.textContent = time;
        bookingTimeSelect.appendChild(option);
    });
    
    

    // Gestione dei campi per il tatuatore
    if (accountTypeSelect) {
        accountTypeSelect.addEventListener('change', (e) => {
            tatuatoreFields.style.display = e.target.value === 'Tatuatore' ? 'block' : 'none';
        });
    }

    // Gestione del modulo di registrazione
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
    
            const name = registerForm.name.value;
            const username = registerForm.username.value;
            const password = registerForm.password.value;
            const accountType = registerForm.accountType.value;
    
            const studioData = accountType === 'Tatuatore' ? {
                studioName: registerForm.studioName.value,
                studioAddress: registerForm.studioAddress.value,
                studioCity: registerForm.studioCity.value,
                studioPostalCode: registerForm.studioPostalCode.value
            } : {};
    
            // Funzione di validazione della password
            function validatePassword(password) {
                const minLength = 8;
                const hasNumber = /[0-9]/.test(password);
                const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
                return password.length >= minLength && hasNumber && hasSpecialChar;
            }
    
            if (!validatePassword(password)) {
                alert('La password deve essere lunga almeno 8 caratteri e contenere almeno un numero e un carattere speciale.');
                return;
            }
    
            try {
                let latitude = null;
                let longitude = null;
    
                if (accountType === 'Tatuatore') {
                    const address = `${studioData.studioAddress}, ${studioData.studioCity}, ${studioData.studioPostalCode}`;
                    const coordinatesResponse = await fetch(`/api/getLatLong?address=${encodeURIComponent(address)}`);
                    if (!coordinatesResponse.ok) {
                        throw new Error(`Errore nella risposta: ${coordinatesResponse.statusText}`);
                    }
                    const coordinates = await coordinatesResponse.json();
                    latitude = coordinates.lat;
                    longitude = coordinates.lon;
                }
    
                const response = await fetch('/api/auth/register', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        name,
                        username,
                        password,
                        accountType,
                        latitude,
                        longitude,
                        ...studioData
                    }),
                });
    
                const data = await response.json();
                if (response.ok) {
                    alert('Registrazione avvenuta con successo!\nAdesso puoi effettuare il login per continuare');
                    registerForm.reset();
                } else {
                    alert('Errore nella registrazione: ' + (data.message || 'Errore sconosciuto'));
                }
            } catch (error) {
                console.error('Errore:', error);
                alert('Si è verificato un errore durante la registrazione.');
            }

        });
    }
    

    // Gestione del modulo di login
    // Funzione per gestire il login
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const username = loginForm.loginUsername.value;
            const password = loginForm.loginPassword.value;

            try {
                const response = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ username, password }),
                });

                const data = await response.json();

                if (response.ok) {
                    
                    localStorage.setItem('userId', data.userId); // Memorizza l'ID utente nel localStorage
                    loginForm.reset();
                    loginContainer.style.display = 'none'; // Nasconde il contenitore di login

                    // Nascondi il titolo di benvenuto
                    if (welcomeTitle) {
                        welcomeTitle.style.display = 'none';
                    }

                    if (data.accountType === 'Tatuatore') {
                        tatuatoreDashboard.style.display = 'flex'; // Mostra la dashboard del tatuatore
                        clientDashboard.style.display = 'none'; // Nasconde la dashboard del cliente
                        loadTatuatoreAppointments(); // Carica le prenotazioni del tatuatore
                    } else {
                        clientDashboard.style.display = 'flex'; // Mostra la dashboard del cliente
                        tatuatoreDashboard.style.display = 'none'; // Nasconde la dashboard del tatuatore
                    }

                    chatDiv.style.display = 'none'; // Nascondi la chat (se necessario)

                    // Inizializza la mappa solo se non è stata già inizializzata
                    if (!map) {
                        initMap();
                    } else {
                        // Altrimenti, invalida la dimensione della mappa per ridisegnarla correttamente
                        setTimeout(() => {
                            map.invalidateSize();
                        }, 0);
                    }
                } else {
                    alert('Errore nel login: ' + (data.message || 'Errore sconosciuto'));
                }
            } catch (error) {
                console.error('Errore:', error);
                alert('Si è verificato un errore durante il login.');
            }
        });
    }
    
  


    // Assicurati che il bottone di invio esista prima di aggiungere l'event listener
    // Assicurati che sendButton sia definito
// Assicurati che sendButton sia definito
if (sendButton) {
    sendButton.addEventListener('click', () => {
        // Ottieni il messaggio e l'ID del destinatario
        const message = messageInput.value.trim();
        const receiverId = receiverIdInput.value.trim(); // Usa la variabile già dichiarata

        // Log per debug
        console.log('Tentativo di invio messaggio:', message);
        console.log('Receiver ID:', receiverId);

        // Verifica che il messaggio e l'ID del destinatario non siano vuoti
        if (message && receiverId) {
            // Invia il messaggio al server tramite Socket.IO
            socket.emit('sendMessage', { chatSessionId: receiverId, message });

            // Pulisce il campo di input dopo l'invio del messaggio
            messageInput.value = '';
            console.log('Messaggio inviato al server'); // Conferma che il messaggio è stato inviato
        } else {
            console.error('Messaggio vuoto o receiverId mancante');
        }
    });
}


    
    
    socket.on('receiveMessage', (msg) => {
        console.log('Messaggio ricevuto dal server:', msg);
    
        // Crea un nuovo elemento div per il messaggio in arrivo
        const item = document.createElement('div');
    
        // Imposta il contenuto del div come il testo del messaggio ricevuto
        item.textContent = msg.message || msg;
    
        // Aggiungi il div al contenitore dei messaggi
        if (messagesDiv) {
            messagesDiv.appendChild(item);
            messagesDiv.scrollTop = messagesDiv.scrollHeight; // Scorri verso il basso per vedere l'ultimo messaggio
        } else {
            console.error('Elemento con ID "messages" non trovato nel DOM');
        }
    });
    

    
    // Cambio tra il modulo di login e di registrazione
    if (showLoginFormButton) {
        showLoginFormButton.addEventListener('click', () => {
            registerContainer.style.display = 'none';
            loginContainer.style.display = 'block';
        });
    }

    if (showRegisterFormButton) {
        showRegisterFormButton.addEventListener('click', () => {
            loginContainer.style.display = 'none';
            registerContainer.style.display = 'block';
        });
    }

    // Gestione del logout per il client
    document.getElementById('logoutClient')?.addEventListener('click', () => {
        clientDashboard.style.display = 'none';
        loginContainer.style.display = 'block';
        welcomeTitle.style.display = 'block';

    });

    // Gestione del logout per il tatuatore
    document.getElementById('logoutTatuatore')?.addEventListener('click', () => {
        tatuatoreDashboard.style.display = 'none';
        loginContainer.style.display = 'block';
        localStorage.removeItem('userId'); // Rimuove l'ID utente dal localStorage
        welcomeTitle.style.display = 'block';
    });

    // Visualizzazione della sezione chat quando si fa clic sul pulsante chat
    document.getElementById('chatButton')?.addEventListener('click', () => {
        chatDiv.style.display = 'block';
        bookingMenu.style.display = 'none'; // Nasconde il menu delle prenotazioni
    });

    // Gestione della visualizzazione del menu di prenotazione
    if (showBookingMenuButton) {
        showBookingMenuButton.addEventListener('click', () => {
            bookingMenu.style.display = 'block'; // Mostra il menu delle prenotazioni
            chatDiv.style.display = 'none'; // Nasconde la chat
        });
    }

    // Gestione della chiusura del menu di prenotazione
    if (closeBookingMenuButton) {
        closeBookingMenuButton.addEventListener('click', () => {
            bookingMenu.style.display = 'none'; // Nasconde il menu delle prenotazioni
        });
    }

    // Carica gli orari fissi nel menu a discesa
    const loadFixedTimes = () => {
        bookingTimeSelect.innerHTML = ''; // Pulisce il menu a discesa

        fixedHours.forEach(time => {
            const option = document.createElement('option');
            option.value = time;
            option.textContent = time;
            bookingTimeSelect.appendChild(option);
        });
    };

    // Carica gli orari iniziali
    loadFixedTimes();

    
// JavaScript Example
document.getElementById('bookingForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const date = document.getElementById('bookingDate').value.trim();
    const time = document.getElementById('bookingTime').value.trim();
    const userId = localStorage.getItem('userId'); // Recupera l'userId dal localStorage
    const tattooerId = localStorage.getItem('selectedTattooerId'); // Recupera l'ID del tatuatore dal localStorage

    if (!date || !time || !userId || !tattooerId) {
        console.error('Tutti i campi sono obbligatori.');
        alert('Tutti i campi sono obbligatori.');
        return;
    }

    // Controllo che la data non sia precedente a oggi
    const today = new Date().toISOString().split('T')[0]; // Data odierna in formato YYYY-MM-DD
    if (date < today) {
        alert('Non è possibile prenotare per una data precedente ad oggi.');
        return;
    }

    const data = {
        userId: parseInt(userId), // Assicurati che userId sia un numero
        date,
        time,
        tattooerId: parseInt(tattooerId) // Assicurati che tattooerId sia un numero
    };

    try {
        // Verifica se lo slot è già prenotato
        const slotResponse = await fetch(`/api/bookings/check?date=${date}&time=${time}&tattooerId=${tattooerId}`);
        const slotData = await slotResponse.json();

        if (!slotResponse.ok || slotData.isBooked) {
            alert('Questo slot è già prenotato.');
            return;
        }

        const response = await fetch('/api/bookings/create', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });

        const result = await response.json();
        if (!response.ok) {
            throw new Error(result.message || 'Errore sconosciuto');
        }
        alert('Prenotazione riuscita!\nA breve ti arriverà una mail')
    } catch (error) {
        console.error('Errore nella creazione della prenotazione:', error);
        alert('Errore nella creazione della prenotazione: ' + error.message);
    }
});



function showTatuatoreAppointments() {
    // Visualizza la sezione della dashboard del tatuatore
    const tatuatoreDashboard = document.getElementById('tatuatoreDashboard');
    if (tatuatoreDashboard) {
        tatuatoreDashboard.style.display = 'block';
    } else {
        alert('Elemento con ID "tatuatoreDashboard" non trovato nel DOM');
    }
    
    // Visualizza la sezione delle prenotazioni
    const tatuatoreAppointmentsSection = document.getElementById('tatuatoreBookings');
    if (tatuatoreAppointmentsSection) {
        tatuatoreAppointmentsSection.style.display = 'block';
    } else {
        alert('Elemento con ID "tatuatoreBookings" non trovato nel DOM');
    }

    // Carica le prenotazioni
    loadTatuatoreAppointments();
}

async function loadTatuatoreAppointments() {
    const tattooerId = localStorage.getItem('userId'); // Assicurati che questo ID sia corretto per il tatuatore
    if (!tattooerId) {
        alert('Utente non trovato. Non sei autenticato. Per favore, effettua il login.');
        return;
    }

    try {
        const response = await fetch(`/api/tattoo-artists/${tattooerId}/bookings`);
        if (!response.ok) {
            throw new Error('Errore nella risposta: ' + response.statusText);
        }

        const appointments = await response.json();
        const appointmentsList = document.getElementById('tatuatoreAppointmentsList');
        if (!appointmentsList) {
            alert('Elemento con ID "tatuatoreAppointmentsList" non trovato nel DOM');
            return;
        }

        appointmentsList.innerHTML = '';
        if (appointments.length > 0) {
            appointments.forEach(appointment => {
                const item = document.createElement('div');
                item.className = 'appointment-item';

                // Verifica e formattazione della data
                const dateObj = new Date(appointment.date);
                const formattedDate = dateObj.toLocaleDateString('it-IT', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric'
                });

                // Verifica e formattazione dell'orario
                const time = appointment.time ? appointment.time.split(':').slice(0, 2).join(':') : 'Orario sconosciuto'; // Rimuove i secondi se presenti
                const formattedTime = time.length === 5 ? time : 'Orario sconosciuto'; // Assumiamo che l'orario sia in formato HH:mm

                // Verifica il nome del cliente
                const clientName = appointment.clientName || appointment.clientname || 'Cliente sconosciuto'; 

                item.innerHTML = `
                    <div class="appointment-details">
                        <div class="appointment-name">
                            <strong>Dettagli prenotazione:</strong>
                        </div>
                        <div class="appointment-date-time">
                            Data: ${formattedDate || 'Data sconosciuta'}<br>
                            Orario: ${formattedTime}
                        </div>
                        <button class="delete-button" data-id="${appointment.id}">X</button>
                    </div>
                `;

                appointmentsList.appendChild(item);
            });

            // Aggiungi il listener per i pulsanti di cancellazione
            document.querySelectorAll('.delete-button').forEach(button => {
                button.addEventListener('click', async (event) => {
                    const appointmentId = event.target.getAttribute('data-id');
                    if (appointmentId) {
                        try {
                            const deleteResponse = await fetch(`/api/bookings/${appointmentId}`, {
                                method: 'DELETE'
                            });

                            if (!deleteResponse.ok) {
                                throw new Error('Errore nella cancellazione della prenotazione: ' + deleteResponse.statusText);
                            }

                            // Ricarica la lista delle prenotazioni dopo la cancellazione
                            loadTatuatoreAppointments();
                        } catch (error) {
                            alert('Errore durante la cancellazione della prenotazione: ' + error.message);
                        }
                    }
                });
            });
        } else {
            appointmentsList.innerHTML = 'Nessuna prenotazione trovata.';
        }
    } catch (error) {
        alert('Non hai prenotazioni :(');
    }
}


    function initMap() {
        map = L.map('map').setView([41.9028, 12.4964], 13); // Visualizzazione predefinita su Roma
    
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(map);
    
        const defaultMarkerIcon = L.icon({
            iconUrl: 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/images/marker-icon.png',
            shadowUrl: 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/images/marker-shadow.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            shadowSize: [41, 41]
        });
    
        const getMarkerTooltipContent = (artist) => `
            <b>${artist.name || 'Sconosciuto'}</b>
        `;
    
        const getFullPopupContent = (artist) => `
            <b>${artist.name || 'Sconosciuto'}</b><br>
            Studio: ${artist.studio_name || 'Studio sconosciuto'}<br>
            Indirizzo: ${artist.studio_address || 'Indirizzo sconosciuto'}<br>
            Città: ${artist.studio_city || 'Città sconosciuta'}<br>
            CAP: ${artist.studio_postal_code || 'CAP sconosciuto'}<br><br>
            <button class="book-button" data-id="${artist.id}">Prenotazione</button>
        `;
    
        let clickedMarker = null;
    
        const searchTattooArtists = async () => {
            const city = document.getElementById('tattooLocation').value;
            const postalCode = document.getElementById('postalCode').value;
    
            if (!city || !postalCode) {
                alert('Per favore, inserisci sia la città che il CAP.');
                return;
            }
    
            try {
                const address = `${city}, ${postalCode}`;
                const geocodeResponse = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json`);
                const geocodeData = await geocodeResponse.json();
    
                if (geocodeData.length === 0) {
                    alert('Impossibile trovare la posizione.');
                    return;
                }
    
                const { lat, lon } = geocodeData[0];
                map.setView([lat, lon], 13);
    
                const response = await fetch(`/api/tattoo-artists?city=${encodeURIComponent(city)}&postalCode=${encodeURIComponent(postalCode)}`);
                const data = await response.json();
    
                console.log('Dati ricevuti dalla ricerca:', data);
    
                if (response.ok) {
                    document.getElementById('tattooLocation').value = '';
                    document.getElementById('postalCode').value = '';
                    map.eachLayer((layer) => {
                        if (layer instanceof L.Marker) {
                            map.removeLayer(layer);
                        }
                    });
    
                    data.forEach((artist) => {
                        if (artist.latitude && artist.longitude) {
                            const marker = L.marker([artist.latitude, artist.longitude], { icon: defaultMarkerIcon }).addTo(map);
                            marker.bindTooltip(getMarkerTooltipContent(artist), { permanent: false, direction: 'top', offset: [0, -20] });
                            marker.bindPopup(getFullPopupContent(artist));
                            marker.on('click', () => {
                                if (clickedMarker) {
                                    clickedMarker.setIcon(defaultMarkerIcon);
                                    clickedMarker.closePopup();
                                }
                                marker.setIcon(defaultMarkerIcon); // Non ingrandisce il marker
                                marker.openPopup();
                                clickedMarker = marker;
    
                                // Salva l'ID del tatuatore nel localStorage
                                localStorage.setItem('selectedTattooerId', artist.id);
                                console.log('Tattooer ID salvato:', artist.id);



                            });
                        }
                    });
                } else {
                    alert('Errore nel recupero degli artisti del tatuaggio: ' + (data.message || 'Errore sconosciuto'));
                }
            } catch (error) {
                console.error('Errore:', error);
                alert('Si è verificato un errore durante il recupero degli artisti del tatuaggio.');
            }
        };
    
        map.on('popupopen', (e) => {
            setTimeout(() => {
                const bookButton = e.popup.getElement().querySelector('.book-button');
                const chatButton = e.popup.getElement().querySelector('.chat-button');
    
                if (bookButton) {
                    bookButton.removeEventListener('click', handleBookButtonClick);
                    bookButton.addEventListener('click', handleBookButtonClick);
                }
    
                if (chatButton) {
                    chatButton.removeEventListener('click', handleChatButtonClick);
                    chatButton.addEventListener('click', handleChatButtonClick);
                }
            }, 0);
        });
    
        function handleBookButtonClick(event) {
            const artistId = event.target.getAttribute('data-id');
            bookingForm.setAttribute('data-artist-id', artistId);
            bookingMenu.style.display = 'block';
            chatDiv.style.display = 'none';
            map.closePopup();
        }
    
        function handleChatButtonClick(event) {
            const artistId = event.target.getAttribute('data-id');
            receiverIdInput.value = artistId;
            console.log('Chat with user ID:', artistId);
            chatDiv.style.display = 'block';
            bookingMenu.style.display = 'none';
            map.closePopup();
        }
    
        searchTattooArtistsButton.addEventListener('click', searchTattooArtists);
    }
    
    // Inizializzazione della mappa
    initMap();




    // Inizializza Interact.js sul menu di prenotazione
    interact('#bookingMenu')
        .draggable({
            listeners: {
                start (event) {
                    // Inizia il drag
                    console.log('Drag started');
                },
                move (event) {
                    const target = event.target;

                    // Ottieni la posizione attuale
                    const x = (parseFloat(target.getAttribute('data-x')) || 0) + event.dx;
                    const y = (parseFloat(target.getAttribute('data-y')) || 0) + event.dy;

                    // Trasla l'elemento
                    target.style.transform = `translate(${x}px, ${y}px)`;

                    // Memorizza la posizione
                    target.setAttribute('data-x', x);
                    target.setAttribute('data-y', y);
                },
                end (event) {
                    // Fine del drag
                    console.log('Drag ended');
                }
            },
            modifiers: [
                interact.modifiers.restrictRect({
                    restriction: 'parent',
                    endOnly: true
                })
            ],
            inertia: true
        });
});
