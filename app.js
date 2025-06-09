class IndexedDBManager {
    constructor() {
        this.db = null;
        this.DB_NAME = 'VoiceNotesDB';
        this.DB_VERSION = 1;
        this.STORE_NAME = 'recordingsStore';
    }

    open() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                db.createObjectStore(this.STORE_NAME, { keyPath: 'id' });
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                console.log("IndexedDB opened successfully.");
                resolve();
            };

            request.onerror = (event) => {
                console.error("IndexedDB error:", event.target.errorCode);
                reject("Error opening IndexedDB");
            };
        });
    }

    saveRecording(recording) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.STORE_NAME], 'readwrite');
            const store = transaction.objectStore(this.STORE_NAME);
            const request = store.put(recording);

            request.onsuccess = () => {
                console.log("Recording saved to IndexedDB:", recording.id);
                resolve();
            };

            request.onerror = (event) => {
                console.error("Error saving recording to IndexedDB:", event.target.error);
                reject("Error saving recording");
            };
        });
    }

    getBlob(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.STORE_NAME], 'readonly');
            const store = transaction.objectStore(this.STORE_NAME);
            const request = store.get(id);

            request.onsuccess = () => {
                if (request.result) {
                    console.log("Blob retrieved from IndexedDB:", id);
                    return resolve(request.result.blob);
                }
                console.warn("Blob not found in IndexedDB:", id);
                return resolve(null);
            };

            request.onerror = (event) => {
                console.error("Error retrieving blob from IndexedDB:", event.target.error);
                reject("Error retrieving blob");
            };
        });
    }

    getAllRecordings() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.STORE_NAME], 'readonly');
            const store = transaction.objectStore(this.STORE_NAME);
            const request = store.getAll();

            request.onsuccess = () => {
                console.log("All recordings retrieved from IndexedDB.");
                resolve(request.result);
            };

            request.onerror = (event) => {
                console.error("Error retrieving all recordings from IndexedDB:", event.target.error);
                reject("Error retrieving all recordings");
            };
        });
    }

    deleteRecording(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.STORE_NAME], 'readwrite');
            const store = transaction.objectStore(this.STORE_NAME);
            const request = store.delete(id);

            request.onsuccess = () => {
                console.log("Recording deleted from IndexedDB:", id);
                resolve();
            };

            request.onerror = (event) => {
                console.error("Error deleting recording from IndexedDB:", event.target.error);
                reject("Error deleting recording");
            };
        });
    }
}

class VoiceRecorder {
    constructor(onRecordingStoppedCallback) {
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.isRecording = false;
        this.currentRecording = null;
        this.onRecordingStoppedCallback = onRecordingStoppedCallback;
        this.supportedMimeType = VoiceRecorder.getPreferredMimeType(); // Determina il MIME type supportato

        if (!this.supportedMimeType) {
            console.error("Nessun tipo MIME audio supportato trovato per la registrazione.");
            alert("Il tuo browser non supporta la registrazione audio con i codec comuni. Potrebbe non funzionare correttamente.");
        }
    }

    static getPreferredMimeType() {
        const preferredTypes = [
            'audio/mp4', // Spesso buono per iOS (AAC)
            'audio/webm; codecs=opus', // Ottima qualità e compressione, ampia compatibilità
            'audio/wav', // Ampiamente supportato ma file più grandi
        ];

        for (const type of preferredTypes) {
            if (MediaRecorder.isTypeSupported(type)) {
                console.log(`Preferred MIME type for audio recording: ${type}`);
                return type;
            }
        }
        console.warn("Nessun tipo MIME preferito supportato. Utilizzo il fallback a 'audio/webm'.");
        return 'audio/webm'; // Fallback generico
    }

    async startRecording() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            // Usa il tipo MIME supportato per il MediaRecorder
            this.mediaRecorder = new MediaRecorder(stream, { mimeType: this.supportedMimeType });
            this.audioChunks = [];

            this.mediaRecorder.ondataavailable = (event) => {
                this.audioChunks.push(event.data);
            };

            this.mediaRecorder.onstop = () => {
                const audioBlob = new Blob(this.audioChunks, { type: this.supportedMimeType });
                const audioURL = URL.createObjectURL(audioBlob);

                console.log("Attempting to load audio metadata for URL:", audioURL);

                const audio = new Audio();
                audio.src = audioURL;

                audio.onloadedmetadata = () => {
                    const duration = audio.duration; // in seconds
                    console.log("Audio loaded metadata. Duration:", duration, "seconds");
                    this.currentRecording = {
                        blob: audioBlob,
                        url: audioURL,
                        date: new Date(),
                        duration: duration // Aggiungi la durata qui
                    };
                    if (this.onRecordingStoppedCallback) {
                        console.log("Calling onRecordingStoppedCallback with duration:", this.currentRecording.duration);
                        this.onRecordingStoppedCallback(this.currentRecording);
                    }
                    // NON revocare l'URL qui, deve rimanere valido per la riproduzione
                };
                audio.onerror = (e) => {
                    console.error("Error loading audio metadata:", e);
                    // Procedi anche senza durata se c'è un errore
                    this.currentRecording = {
                        blob: audioBlob,
                        url: audioURL,
                        date: new Date(),
                        duration: 0 // Durata predefinita a 0 in caso di errore
                    };
                    if (this.onRecordingStoppedCallback) {
                        console.log("Calling onRecordingStoppedCallback with default duration 0 due to error.");
                        this.onRecordingStoppedCallback(this.currentRecording);
                    }
                };
                // Assicurati che il caricamento dei metadati inizi
                audio.load();
            };

            this.mediaRecorder.start();
            this.isRecording = true;
        } catch (error) {
            console.error('Error accessing microphone:', error);
            alert('Impossibile accedere al microfono. Assicurati di aver dato i permessi necessari.');
        }
    }

    stopRecording() {
        if (this.mediaRecorder && this.isRecording) {
            this.mediaRecorder.stop();
            this.isRecording = false;
            this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
        }
    }
}

class App {
    constructor() {
        this.indexedDBManager = new IndexedDBManager();
        this.recorder = new VoiceRecorder((recordingData) => {
            this.recorder.currentRecording = recordingData;
            this.showSaveDialog();
        });
        this.recordings = []; // Ora le registrazioni verranno caricate da IndexedDB
        this.currentMenuRecordingId = null; // Per tenere traccia della registrazione per il menu
        this.setupEventListeners();
        this.initializeIndexedDBAndRender();
    }

    async initializeIndexedDBAndRender() {
        try {
            await this.indexedDBManager.open();
            this.recordings = await this.indexedDBManager.getAllRecordings(); // Carica tutte le registrazioni
            // Ordina le registrazioni dalla più recente alla meno recente
            this.recordings.sort((a, b) => b.date - a.date); 
            this.renderRecordings();
        } catch (error) {
            console.error("Failed to initialize IndexedDB:", error);
            alert("Errore nell'apertura del database locale. Alcune funzionalità potrebbero non essere disponibili.");
        }
    }

    setupEventListeners() {
        const recordButton = document.getElementById('recordButton');
        const saveButton = document.getElementById('saveButton');
        const cancelButton = document.getElementById('cancelButton');
        const saveDialog = document.getElementById('saveDialog');
        const recordingsMenu = document.getElementById('recordingsMenu');
        const transcribeOption = document.getElementById('transcribeOption');
        const deleteOption = document.getElementById('deleteOption');
        const listenOption = document.getElementById('listenOption');
        const copyToNotesOption = document.getElementById('copyToNotesOption');
        const showMindMapOption = document.getElementById('showMindMapOption');
        const cancelMenu = document.getElementById('cancelMenu');
        const mindMapDialog = document.getElementById('mindMapDialog');
        const closeMindMapDialog = document.getElementById('closeMindMapDialog');

        recordButton.addEventListener('click', () => this.toggleRecording());
        saveButton.addEventListener('click', () => this.saveRecording());
        cancelButton.addEventListener('click', () => this.hideSaveDialog());

        // Gestione eventi per il menu delle opzioni
        recordingsMenu.addEventListener('click', (event) => {
            if (event.target === recordingsMenu) { // Se clicca fuori dal menu
                this.hideRecordingsMenu();
            }
        });
        transcribeOption.addEventListener('click', () => this.handleTranscribe());
        deleteOption.addEventListener('click', () => this.handleDelete());
        listenOption.addEventListener('click', () => this.handleListen());
        copyToNotesOption.addEventListener('click', () => this.handleCopyToNotes());
        showMindMapOption.addEventListener('click', () => this.handleShowMindMap());
        cancelMenu.addEventListener('click', () => this.hideRecordingsMenu());

        // Gestione eventi per il dialog della Mappa Mentale
        mindMapDialog.addEventListener('click', (event) => {
            if (event.target === mindMapDialog) { // Se clicca fuori dal dialog
                this.hideMindMapDialog();
            }
        });
        closeMindMapDialog.addEventListener('click', () => this.hideMindMapDialog());
    }

    toggleRecording() {
        const recordButton = document.getElementById('recordButton');
        const recordingStatus = document.getElementById('recordingStatus');

        if (!this.recorder.isRecording) {
            this.recorder.startRecording();
            recordButton.classList.add('recording');
            recordingStatus.textContent = 'Registrazione in corso...';
            recordingStatus.style.color = 'var(--danger-color)';
        } else {
            this.recorder.stopRecording();
            recordButton.classList.remove('recording');
            recordingStatus.textContent = 'Tocca per registrare';
            recordingStatus.style.color = 'var(--secondary-text-color)';
        }
    }

    showSaveDialog() {
        const saveDialog = document.getElementById('saveDialog');
        const recordingName = document.getElementById('recordingName');
        recordingName.value = `Registrazione ${this.recordings.length + 1}`;
        saveDialog.classList.remove('hidden');
    }

    hideSaveDialog() {
        const saveDialog = document.getElementById('saveDialog');
        saveDialog.classList.add('hidden');
    }

    showRecordingsMenu(recordingId) {
        this.currentMenuRecordingId = recordingId;
        const recordingsMenu = document.getElementById('recordingsMenu');
        recordingsMenu.classList.remove('hidden');
    }

    hideRecordingsMenu() {
        this.currentMenuRecordingId = null;
        const recordingsMenu = document.getElementById('recordingsMenu');
        recordingsMenu.classList.add('hidden');
    }

    showMindMapDialog() {
        const mindMapDialog = document.getElementById('mindMapDialog');
        mindMapDialog.classList.remove('hidden');
    }

    hideMindMapDialog() {
        const mindMapDialog = document.getElementById('mindMapDialog');
        mindMapDialog.classList.add('hidden');
    }

    async saveRecording() {
        const recordingName = document.getElementById('recordingName').value;
        if (!recordingName) return;

        const recordingId = Date.now();
        const audioBlob = this.recorder.currentRecording.blob;
        const recordingToSave = {
            id: recordingId,
            name: recordingName,
            date: this.recorder.currentRecording.date.getTime(), // Salva la data come timestamp per persistenza
            duration: this.recorder.currentRecording.duration,
            blob: audioBlob // Salva il blob direttamente con l'oggetto registrazione
        };

        try {
            await this.indexedDBManager.saveRecording(recordingToSave);

            this.recordings.unshift(recordingToSave); // Aggiungi in cima alla lista
            this.recordings.sort((a, b) => b.date - a.date); // Riordina in caso di salvataggio asincrono
            // localStorage.setItem('recordings', JSON.stringify(this.recordings)); // Rimosso: ora tutto è in IndexedDB
            this.renderRecordings();
            this.hideSaveDialog();

            // Invia la registrazione a Google AI (ora con il blob da IndexedDB)
            // const transcription = await this.transcribeAudio(audioBlob);
            // this.saveTranscription(recordingId, transcription);

        } catch (error) {
            console.error('Error saving recording to IndexedDB:', error);
            alert('Errore durante il salvataggio della registrazione. Riprova.');
        }
    }

    async handleDelete() {
        if (!this.currentMenuRecordingId) return;

        const recordingIdToDelete = this.currentMenuRecordingId;
        const recordingName = this.recordings.find(rec => rec.id === recordingIdToDelete)?.name || "questa registrazione";

        if (confirm(`Sei sicuro di voler eliminare "${recordingName}"?`)) {
            try {
                await this.indexedDBManager.deleteRecording(recordingIdToDelete); // Usa il metodo rinominato

                this.recordings = this.recordings.filter(rec => rec.id !== recordingIdToDelete);
                // localStorage.setItem('recordings', JSON.stringify(this.recordings)); // Rimosso
                this.renderRecordings();
                this.hideRecordingsMenu();
                alert(`"${recordingName}" è stata eliminata.`);
            } catch (error) {
                console.error("Error deleting recording:", error);
                alert("Errore durante l'eliminazione della registrazione. Riprova.");
            }
        }
    }

    async handleListen() {
        if (!this.currentMenuRecordingId) return;

        const recordingToPlay = this.recordings.find(rec => rec.id === this.currentMenuRecordingId);
        if (recordingToPlay) {
            await this.playRecording(recordingToPlay);
        }
        this.hideRecordingsMenu();
    }

    async handleTranscribe() {
        if (!this.currentMenuRecordingId) return;

        const recordingToTranscribe = this.recordings.find(rec => rec.id === this.currentMenuRecordingId);
        if (recordingToTranscribe) {
            alert("Trascrizione avviata... (Potrebbe richiedere qualche secondo)"); 
            this.hideRecordingsMenu();
            
            // Chiedi all'utente se vuole anche la mappa mentale
            const generateMindMap = confirm("Vuoi anche il contenuto Markdown per la Mappa Mentale? (Se sì, la trascrizione includerà il codice per la mappa mentale Markmap in coda. Se no, verrà generata solo la trascrizione.)");

            // Aggiorna l'UI per mostrare lo stato di trascrizione
            recordingToTranscribe.transcription = "Trascrizione in corso...";
            this.renderRecordings();

            try {
                const audioBlob = await this.indexedDBManager.getBlob(recordingToTranscribe.id);
                if (audioBlob) {
                    // Passa il parametro generateMindMap alla funzione transcribeAudio
                    const transcriptionOutput = await this.transcribeAudio(audioBlob, generateMindMap);
                    
                    // Salva la trascrizione nell'oggetto registrazione
                    this.saveTranscription(recordingToTranscribe.id, transcriptionOutput);

                    // Offri il download del file MD
                    this.downloadMarkdownFile(recordingToTranscribe.name, transcriptionOutput);

                    // Se l'utente ha scelto la mappa mentale, visualizzala
                    if (generateMindMap) {
                        // La mappa è stata generata, mostriamo il dialog e la renderizziamo
                        this.showMindMapDialog();
                        this.renderMindMap(transcriptionOutput); // Passa il markdown alla funzione di rendering
                    } else {
                        alert("Trascrizione completata. Per generare una Mappa Mentale, trascrivi di nuovo e seleziona l'opzione.");
                    }
                    
                } else {
                    alert("Impossibile trovare l'audio per la trascrizione.");
                    recordingToTranscribe.transcription = "Trascrizione fallita: audio non trovato.";
                    this.renderRecordings();
                }
            } catch (error) {
                console.error("Error during transcription:", error);
                alert("Errore durante la trascrizione. Controlla la console per i dettagli.");
                recordingToTranscribe.transcription = "Trascrizione fallita.";
                this.renderRecordings();
            }
        }
    }

    // Funzione per offrire il download del file Markdown
    downloadMarkdownFile(recordingName, markdownContent) {
        const fileName = `${recordingName.replace(/\s+/g, '-')}.md`; // Sostituisci spazi con trattini per il nome file
        const blob = new Blob([markdownContent], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        alert(`File Markdown "${fileName}" generato e scaricato!`);
    }

    async transcribeAudio(audioBlob, generateMindMap) {
        console.log("Transcribing audio blob...");
        
        // Funzione per convertire Blob in Base64
        const blobToBase64 = (blob) => {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result.split(',')[1]);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
        };

        try {
            const base64Audio = await blobToBase64(audioBlob);

            // --- INSERISCI LA TUA CHIAVE API QUI ---
            const GOOGLE_API_KEY = "AIzaSyAH8Ccvc9XuT-Zm-l0L7_5dCip0IMDY9-Y"; 
            // ----------------------------------------

            const PROMPT_TRANSCRIPTION_ONLY = `Ruolo: Sei un assistente AI incaricato di trascrivere, interpretare e organizzare note vocali registrate dall'utente.

Input: Un file audio fornito tramite API contenente una nota vocale registrata (voce umana naturale).

Obiettivo:
1. Trascrivere fedelmente il contenuto dell'audio.
2. Analizzare la prima frase per determinare la natura della nota.
3. Classificare automaticamente la nota in una delle seguenti categorie o crearne una nuova coerente:
    - Nota creativa
    - Lista di cose da fare
    - Brainstorming
    - Chiacchierata tra amici per idee
    - Appunti
    - Lezione
    - Altro (specificare)
4. Generare tag riutilizzabili che rappresentino questa categoria.
5. Organizzare la trascrizione in sezioni tematiche chiare con titoli e sottosezioni se necessario.
6. Evidenziare in grassetto eventuali parole o frasi non chiaramente comprensibili.
7. Restituire l'output in formato .md compatibile con l'app Note di Apple.

Formato del file finale:
Nome file: DataNota-Argomento.md
Contenuto:

# [Titolo automatico o tratto dal contenuto]

**Categoria:** [categoria individuata]  
**Tag:** #[tag1] #[tag2] #[...]

## Sezione 1 – [Titolo]
[Contenuto trascritto e pulito]

## Sezione 2 – [Titolo]
[Altro contenuto]

...

---
**Termini non chiari (da verificare):**  
- **[parola/frase]**
Nota: Non inventare contenuti non presenti nell'audio. Se l'audio è poco chiaro, segnala le incertezze in grassetto.
`;

            const PROMPT_TRANSCRIPTION_AND_MINDMAP = `Ruolo: Sei un assistente AI incaricato di trascrivere, interpretare e organizzare note vocali registrate dall'utente.

Input: Un file audio fornito tramite API contenente una nota vocale registrata (voce umana naturale).

Obiettivo:
1. Trascrivere fedelmente il contenuto dell'audio
2. Analizzare il contenuto per identificare i concetti principali e le loro relazioni
3. Generare una mappa mentale in formato Markdown compatibile con Markmap.
4. Restituire l'output UNICAMENTE in formato Markdown con la struttura Markmap.

Formato della risposta (solo Markdown per Markmap):
# [Titolo principale della nota]

## [Concetto principale 1]
### [Sottoconcetto 1.1]
- [Dettaglio o esempio]
- [Dettaglio o esempio]
### [Sottoconcetto 1.2]
- [Dettaglio o esempio]

## [Concetto principale 2]
### [Sottoconcetto 2.1]
- [Dettaglio o esempio]

... e così via, mantenendo la struttura gerarchica usando #, ##, ### e -

Nota: NON includere testo aggiuntivo al di fuori della struttura Markdown della mappa mentale. Se l'audio è troppo breve o poco chiaro per una mappa mentale significativa, restituisci solo un titolo principale.
`;
            
            const PROMPT = generateMindMap ? PROMPT_TRANSCRIPTION_AND_MINDMAP : PROMPT_TRANSCRIPTION_ONLY;
            // ------------------------------------

            const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GOOGLE_API_KEY}`;

            const requestBody = {
                contents: [
                    {
                        parts: [
                            { text: PROMPT },
                            {
                                inlineData: {
                                    mimeType: audioBlob.type, // Usa il tipo MIME originale del Blob
                                    data: base64Audio
                                }
                            }
                        ]
                    }
                ]
            };

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`API Error: ${response.status} - ${errorData.error.message || response.statusText}`);
            }

            const data = await response.json();
            const transcribedText = data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts[0] && data.candidates[0].content.parts[0].text;

            if (!transcribedText) {
                throw new Error("Nessun testo trascritto trovato nella risposta API.");
            }
            return transcribedText;

        } catch (error) {
            console.error("Error during transcription API call:", error);
            alert("Errore durante la trascrizione: " + error.message);
            return "Errore nella trascrizione."; // Restituisci un messaggio di errore
        }
    }

    saveTranscription(recordingId, transcription) {
        const recordingIndex = this.recordings.findIndex(r => r.id === recordingId);
        if (recordingIndex !== -1) {
            this.recordings[recordingIndex].transcription = transcription;
            // localStorage.setItem('recordings', JSON.stringify(this.recordings)); // Rimosso: ora tutto è in IndexedDB
            this.renderRecordings();
        }
    }

    renderRecordings() {
        const recordingsList = document.getElementById('recordingsList');
        recordingsList.innerHTML = '';

        this.recordings.forEach(recording => {
            const recordingElement = document.createElement('div');
            recordingElement.className = 'recording-item';
            // Assicurati che la data sia un oggetto Date per toLocaleString
            const displayDate = recording.date instanceof Date ? recording.date : new Date(recording.date);
            const durationText = recording.duration ? this.formatDuration(recording.duration) : "00:00";
            const transcriptionPreview = recording.transcription ? `<p class="transcription-preview">${recording.transcription.substring(0, 50)}...</p>` : '';
            recordingElement.innerHTML = `
                <div class="recording-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M12 2v20M2 12h20"/>
                    </svg>
                </div>
                <div class="recording-info">
                    <div class="recording-name">${recording.name}</div>
                    <div class="recording-date">${displayDate.toLocaleString()} (${durationText})</div>
                    ${transcriptionPreview}
                </div>
                <button class="options-button" data-recording-id="${recording.id}">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-more-horizontal">
                        <circle cx="12" cy="12" r="1"></circle>
                        <circle cx="19" cy="12" r="1"></circle>
                        <circle cx="5" cy="12" r="1"></circle>
                    </svg>
                </button>
            `;

            // Aggiungi event listener per il pulsante delle opzioni
            const optionsButton = recordingElement.querySelector('.options-button');
            optionsButton.addEventListener('click', (event) => {
                event.stopPropagation(); // Evita che il click sul bottone apra anche la riproduzione
                this.showRecordingsMenu(parseInt(optionsButton.dataset.recordingId));
            });

            // Non più listener sull'intero elemento per la riproduzione, ora gestita dal menu
            // recordingElement.addEventListener('click', () => this.playRecording(recording));
            recordingsList.appendChild(recordingElement);
        });
    }

    async playRecording(recording) {
        console.log("Attempting to play recording:", recording.name, recording.id);
        
        try {
            const audioBlob = await this.indexedDBManager.getBlob(recording.id);
            if (!audioBlob) {
                alert("Registrazione audio non trovata nel database. Potrebbe essere stata eliminata o danneggiata.");
                console.error("Audio blob not found for ID:", recording.id);
                return;
            }
            
            const audioURL = URL.createObjectURL(audioBlob);
            console.log("Playing audio from Blob URL:", audioURL);

            // Verifica se il browser può riprodurre questo tipo di audio
            const audioTest = new Audio();
            const canPlay = audioTest.canPlayType(audioBlob.type);
            console.log(`Browser can play type ${audioBlob.type}? ${canPlay}`);

            if (canPlay === '' || canPlay === 'no') {
                alert("Il browser non supporta la riproduzione di questo formato audio.");
                console.error("Browser cannot play this audio type:", audioBlob.type);
                URL.revokeObjectURL(audioURL); // Revoca l'URL se non riproducibile
                return;
            }
            
            const audio = new Audio(audioURL);
            audio.play().then(() => {
                console.log("Audio started playing successfully.");
                // Revoca l'URL solo dopo che l'audio ha finito di suonare
                audio.onended = () => {
                    URL.revokeObjectURL(audioURL);
                    console.log("Blob URL revoked after playback.");
                };
                // Se l'audio si interrompe o fallisce per qualche motivo non previsto da .catch
                audio.onerror = (e) => {
                    console.error("Audio playback error (onended/onerror):");
                    URL.revokeObjectURL(audioURL);
                    console.log("Blob URL revoked due to audio error (onended/onerror).");
                };
            }).catch(error => {
                console.error("Error playing audio:", error);
                alert("Impossibile riprodurre la registrazione. Errore: " + error.message + ". Controlla la console per i dettagli.");
                URL.revokeObjectURL(audioURL); // Revoca l'URL anche in caso di errore
                console.log("Blob URL revoked due to initial play error.");
            });
        } catch (error) {
            console.error("Error playing recording from IndexedDB:", error);
            alert("Errore durante la riproduzione della registrazione dal database.");
        }
    }

    formatDuration(seconds) {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.floor(seconds % 60);
        const formattedMinutes = String(minutes).padStart(2, '0');
        const formattedSeconds = String(remainingSeconds).padStart(2, '0');
        return `${formattedMinutes}:${formattedSeconds}`;
    }

    async handleCopyToNotes() {
        if (!this.currentMenuRecordingId) return;

        const recordingToCopy = this.recordings.find(rec => rec.id === this.currentMenuRecordingId);
        if (recordingToCopy && recordingToCopy.transcription) {
            try {
                await navigator.clipboard.writeText(recordingToCopy.transcription);
                alert('Trascrizione copiata negli appunti! Ora puoi incollarla nell\'app Note.');
                this.hideRecordingsMenu();

                // Tentativo di aprire l'app Note
                window.location.href = 'mobilenotes://';
            } catch (err) {
                console.error('Errore durante la copia o l\'apertura dell\'app Note:', err);
                alert('Impossibile copiare la trascrizione o aprire l\'app Note. Assicurati di aver dato i permessi.');
            }
        } else {
            alert('Nessuna trascrizione disponibile per questa registrazione.');
            this.hideRecordingsMenu();
        }
    }

    async handleShowMindMap() {
        if (!this.currentMenuRecordingId) return;
        const recording = this.recordings.find(r => r.id === this.currentMenuRecordingId);

        if (recording && recording.transcription) {
            // Controlla se la trascrizione è già un Markdown per Markmap
            // Un semplice controllo: se inizia con # e ha almeno un ##
            const isMindMapMarkdown = recording.transcription.startsWith('#') && recording.transcription.includes('##');

            if (isMindMapMarkdown) {
                this.showMindMapDialog();
                this.renderMindMap(recording.transcription);
            } else {
                alert("La trascrizione attuale non è formattata come Mappa Mentale. Trascrivi di nuovo e seleziona l'opzione 'Mappa Mentale'.");
            }
        } else {
            alert("Nessuna trascrizione disponibile per generare una Mappa Mentale. Trascrivi prima una nota.");
        }
        this.hideRecordingsMenu(); // Nascondi il menu dopo la selezione
    }

    renderMindMap(markdown) {
        try {
            const mindmapElement = document.getElementById('markmap');
            // Pulisci il contenitore prima di creare una nuova mappa
            mindmapElement.innerHTML = ''; 

            const { Markmap, Transformer } = window;
            const transformer = new Transformer(); // Assicurati che Transformer sia disponibile
            const { root } = transformer.transform(markdown);

            // Crea la markmap
            Markmap.create(mindmapElement, null, root);
            console.log("Mind Map rendered successfully.");
        } catch (error) {
            console.error("Error rendering Markmap:", error);
            alert("Errore durante la creazione della Mappa Mentale. Controlla la console per i dettagli. Assicurati che la trascrizione sia nel formato corretto per Markmap.");
        }
    }
}

// Inizializza l'app quando il DOM è caricato
document.addEventListener('DOMContentLoaded', () => {
    new App();

    // Registra il Service Worker
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/service-worker.js')
            .then(registration => {
                console.log('Service Worker registrato con successo:', registration);
            })
            .catch(error => {
                console.error('Registrazione Service Worker fallita:', error);
            });
    }
}); 