/* --- FREQUENZE LETTERE --- */
const vocaliFrequenze = { A:70, E:75, I:60, O:50, U:23, Y:1, J:1 };
const consonantiFrequenze = {
    B:9, C:45, D:37, F:11, G:16, H:1, L:65, M:25, N:70, P:30,
    Q:1, R:63, S:50, T:56, V:21, W:0, X:0, Y:0, Z:11
};

function buildWeightedArray(freqObj) {
    const arr = [];
    for (const lettera in freqObj)
        for (let i = 0; i < freqObj[lettera]; i++) arr.push(lettera);
    return arr;
}

const vocali = buildWeightedArray(vocaliFrequenze);
const consonanti = buildWeightedArray(consonantiFrequenze);

/* --- STATO DI GIOCO --- */
let lettereEstratte = [];
let lettereUsate = [];
let placeholders = [];
let giocoAttivo = false;
let parolaGiocatoreValida = false;
let timerInterval = null;
let tempoRimanente = 0;
let inputLock = false;

/* --- JOLLY --- */
let jollyCount = 0;
let jollyInUso = false;
let letteraJollyScelta = null;
let timerInPausa = false;

/* --- RIFERIMENTI DOM --- */
let lettersContainer, placeholdersContainer, resultEl, computerResultEl,
    timerEl, estrazioneControlsEl, touchControlsEl, nextBtnEl,
    jollyContainerEl, jollyCountEl, jollyOverlayEl, alphabetGridEl,
    penaltyBannerEl, celebrationBannerEl, confettiContainerEl;

window.addEventListener("DOMContentLoaded", () => {
    lettersContainer = document.getElementById("letters");
    placeholdersContainer = document.getElementById("placeholders");
    resultEl = document.getElementById("result");
    computerResultEl = document.getElementById("computerResult");
    timerEl = document.getElementById("timer");
    estrazioneControlsEl = document.getElementById("estrazioneControls");
    touchControlsEl = document.getElementById("touchControls");
    nextBtnEl = document.getElementById("nextBtn");
    jollyContainerEl = document.getElementById("jollyContainer");
    jollyCountEl = document.getElementById("jollyCount");
    jollyOverlayEl = document.getElementById("jollyOverlay");
    alphabetGridEl = document.getElementById("alphabetGrid");
    penaltyBannerEl = document.getElementById("penaltyBanner");
    celebrationBannerEl = document.getElementById("celebrationBanner");
    confettiContainerEl = document.getElementById("confettiContainer");

    /* CLICK LETTERE */
    lettersContainer.addEventListener("click", onLetterClick);

    /* PULSANTI TOUCH */
    const btnBackAll = document.getElementById("btnBackAll");
    const btnBack = document.getElementById("btnBack");
    const btnVai = document.getElementById("btnVai");

    if (btnBackAll) {
        btnBackAll.addEventListener("click", () => {
            if (!giocoAttivo) return;
            resetTutteLettere();
        });
    }

    if (btnBack) {
        btnBack.addEventListener("click", () => {
            if (!giocoAttivo) return;
            rimuoviUltimaLettera();
        });
    }

    if (btnVai) {
        btnVai.addEventListener("click", () => {
            if (!giocoAttivo) return;
            endRound();
        });
    }

    /* DIGITAZIONE DIRETTA */
    window.addEventListener("keydown", onKeyDown);

    /* SERVICE WORKER */
    if ("serviceWorker" in navigator) {
        window.addEventListener("load", () => {
            navigator.serviceWorker.register("service-worker.js")
                .catch(err => console.log("SW registration failed:", err));
        });
    }

    aggiornaUIJolly();
});

/* --- UI LETTERE --- */
function aggiornaUI() {
    lettersContainer.innerHTML = "";

    lettereEstratte.forEach((l, i) => {
        const usata = lettereUsate.includes(i);

        const box = document.createElement("div");
        box.className = "letter-box";
        box.textContent = l;
        box.id = `letter-${i}`;

        if (usata) {
            box.style.opacity = "0.35";
            box.style.pointerEvents = "none";
        }

        if (jollyInUso) {
            box.classList.add("jolly-selectable");
        }

        lettersContainer.appendChild(box);
    });
}

/* --- CLICK SULLE LETTERE --- */
function onLetterClick(event) {
    if (!giocoAttivo) return;

    const target = event.target;
    if (!target.id || !target.id.startsWith("letter-")) return;

    const index = parseInt(target.id.replace("letter-", ""), 10);

    if (jollyInUso) {
        applicaSostituzioneJolly(index);
        return;
    }

    const lettera = lettereEstratte[index];
    if (lettereUsate.includes(index)) return;

    const slot = placeholders.find(s => s.textContent === "");
    if (!slot) return;

    lettereUsate.push(index);
    aggiornaUI();

    animaVolo(target, slot, lettera);
    slot.dataset.letterIndex = index;
}

/* --- RESET --- */
function resetLettere() {
    lettereEstratte = [];
    lettereUsate = [];
    giocoAttivo = false;
    parolaGiocatoreValida = false;
    inputLock = false;
    jollyInUso = false;
    letteraJollyScelta = null;
    timerInPausa = false;

    lettersContainer.innerHTML = "";
    placeholdersContainer.innerHTML = "";
    resultEl.innerText = "";
    computerResultEl.innerHTML = "";

    clearInterval(timerInterval);
    timerEl.innerText = "";
    timerEl.classList.remove("red");

    touchControlsEl.style.display = "none";
    estrazioneControlsEl.style.display = "block";

    nascondiOverlayJolly();
    aggiornaUI();
}

/* --- NEXT --- */
function nextRound() {
    resetLettere();
    nextBtnEl.style.display = "none";
}

/* --- ESTRAZIONE SINGOLA --- */
function estrai(tipo) {
    const numLettere = parseInt(document.getElementById("numLettere").value);
    if (lettereEstratte.length >= numLettere) return;

    let lettera = (tipo === "vocale")
        ? vocali[Math.floor(Math.random() * vocali.length)]
        : consonanti[Math.floor(Math.random() * consonanti.length)];

    lettereEstratte.push(lettera);
    aggiornaUI();

    if (lettereEstratte.length === numLettere) startGame();
}

/* --- ESTRAZIONE 50/50 --- */
function estrai50() {
    const numLettere = parseInt(document.getElementById("numLettere").value);
    if (lettereEstratte.length > 0) return;

    const metà = Math.floor(numLettere / 2);
    const extra = numLettere % 2;

    const numVocali = metà;
    const numConsonanti = metà + extra;

    for (let i = 0; i < numVocali; i++)
        lettereEstratte.push(vocali[Math.floor(Math.random() * vocali.length)]);

    for (let i = 0; i < numConsonanti; i++)
        lettereEstratte.push(consonanti[Math.floor(Math.random() * consonanti.length)]);

    aggiornaUI();
    startGame();
}

/* --- TIMER --- */
function startGame() {
    const tempoSelezionato = parseInt(document.getElementById("tempoRound").value);
    tempoRimanente = tempoSelezionato;

    if (tempoSelezionato === 0) {
        timerEl.innerText = "∞";
        timerEl.classList.remove("red");
    } else {
        timerEl.innerText = tempoRimanente + "s";

        clearInterval(timerInterval);
        timerInterval = setInterval(() => {
            tempoRimanente--;
            timerEl.innerText = tempoRimanente + "s";

            if (tempoRimanente <= 5) timerEl.classList.add("red");
            if (tempoRimanente <= 0) endRound();
        }, 1000);
    }

    creaPlaceholder(lettereEstratte.length);
    giocoAttivo = true;
    touchControlsEl.style.display = "block";
}

/* --- PLACEHOLDER --- */
function creaPlaceholder(n) {
    placeholdersContainer.innerHTML = "";
    placeholders = [];

    for (let i = 0; i < n; i++) {
        const slot = document.createElement("div");
        slot.classList.add("placeholder-slot");
        slot.textContent = "";
        slot.dataset.letterIndex = "";
        placeholdersContainer.appendChild(slot);
        placeholders.push(slot);
    }
}

/* --- ANIMAZIONE --- */
function animaVolo(letterElement, placeholderElement, lettera) {
    const rectStart = letterElement.getBoundingClientRect();
    const rectEnd = placeholderElement.getBoundingClientRect();

    const clone = letterElement.cloneNode(true);
    clone.classList.add("flying-letter");
    clone.style.left = rectStart.left + "px";
    clone.style.top = rectStart.top + "px";

    document.body.appendChild(clone);

    requestAnimationFrame(() => {
        clone.style.left = rectEnd.left + "px";
        clone.style.top = rectEnd.top + "px";
        clone.style.opacity = 0;
        clone.style.transform = "scale(0.9)";
    });

    clone.addEventListener("transitionend", () => {
        clone.remove();
        placeholderElement.textContent = lettera;
        inputLock = false;
    });
}

/* --- DIGITAZIONE DIRETTA --- */
function onKeyDown(event) {
    if (!giocoAttivo) return;

    if (event.key === "Enter") { endRound(); return; }
    if (event.key === "Backspace") { rimuoviUltimaLettera(); return; }

    const key = event.key.toUpperCase();
    if (!/^[A-Z]$/.test(key)) return;

    inserisciLettera(key);
}

/* --- INSERIMENTO LETTERA --- */
function inserisciLettera(lettera) {
    if (inputLock) return;
    inputLock = true;

    const slot = placeholders.find(s => s.textContent === "");
    if (!slot) { inputLock = false; return; }

    for (let i = 0; i < lettereEstratte.length; i++) {
        if (lettereEstratte[i] === lettera && !lettereUsate.includes(i)) {

            slot.textContent = lettera;
            slot.dataset.letterIndex = i;

            lettereUsate.push(i);

            requestAnimationFrame(() => aggiornaUI());

            const letterEl = document.getElementById("letter-" + i);
            animaVolo(letterEl, slot, lettera);

            return;
        }
    }

    inputLock = false;
}

/* --- BACKSPACE --- */
function rimuoviUltimaLettera() {
    for (let i = placeholders.length - 1; i >= 0; i--) {
        const slot = placeholders[i];
        if (slot.textContent !== "") {

            const idx = parseInt(slot.dataset.letterIndex, 10);

            const pos = lettereUsate.indexOf(idx);
            if (pos !== -1) {
                lettereUsate.splice(pos, 1);
            }

            slot.textContent = "";
            slot.dataset.letterIndex = "";

            aggiornaUI();
            break;
        }
    }
}

/* --- RESET TOTALE LETTERE --- */
function resetTutteLettere() {
    placeholders.forEach(slot => {
        slot.textContent = "";
        slot.dataset.letterIndex = "";
    });

    lettereUsate = [];
    aggiornaUI();
}

/* --- COSTRUZIONE PAROLA --- */
function parolaGiocatore() {
    return placeholders.map(s => s.textContent).join("");
}

/* --- VERIFICA LETTERE --- */
function verificaParolaConLettere(parola, lettere) {
    const disponibili = {};
    lettere.forEach(l => disponibili[l] = (disponibili[l] || 0) + 1);

    const usate = {};
    for (let c of parola) {
        usate[c] = (usate[c] || 0) + 1;
        if (!disponibili[c] || usate[c] > disponibili[c]) {
            return { valida: false, messaggio: "Lettere non valide o usate troppe volte." };
        }
    }
    return { valida: true, messaggio: "OK" };
}

/* --- FINE ROUND --- */
function endRound() {
    if (!giocoAttivo) return;
    giocoAttivo = false;

    touchControlsEl.style.display = "none";
    estrazioneControlsEl.style.display = "none";

    clearInterval(timerInterval);

    if (tempoRimanente === 0) {
        timerEl.innerText = "Tempo scaduto!";
        timerEl.classList.add("red");
    }

    verifica();

    computerResultEl.innerHTML = "";

    setTimeout(() => {
        mossaComputer();
        nextBtnEl.style.display = "inline-block";
    }, 80);
}

/* --- VERIFICA --- */
function verifica() {
    parolaGiocatoreValida = false;

    if (!window.dizionario) return;

    const parola = parolaGiocatore();
    if (!parola) return;

    const esito = verificaParolaConLettere(parola, lettereEstratte);
    if (!esito.valida) {
        resultEl.innerText = "❌ " + esito.messaggio;
        return;
    }

    if (!dizionario.includes(parola)) {
        resultEl.innerText = "❌ Parola non trovata nel dizionario.";
        return;
    }
// Se siamo qui, la parola è valida
parolaGiocatoreValida = true;

// per ora non scriviamo ancora il punteggio completo,
// lo aggiorneremo dopo in mossaComputer()
document.getElementById("result").innerText = "✔️ Parola valida!";

}

/* --- BANNER COMPLIMENTI --- */
function mostraBannerComplimenti() {
    if (!celebrationBannerEl) return;
    celebrationBannerEl.innerText = "🎉 Complimenti! Hai trovato la parola più lunga possibile!!! 🎉";
    celebrationBannerEl.style.display = "block";

    lanciaCoriandoli();

    setTimeout(() => {
        celebrationBannerEl.style.display = "none";
    }, 4000);
}

/* --- CORIANDOLI --- */
function lanciaCoriandoli() {
    let container = confettiContainerEl;

    if (!container) {
        container = document.createElement("div");
        container.id = "confettiContainer";
        document.body.appendChild(container);
        confettiContainerEl = container;
    }

    const count = 80;
    const colors = ["#ff5722", "#ff9800", "#ffc107", "#4caf50", "#03a9f4", "#9c27b0"];

    for (let i = 0; i < count; i++) {
        const conf = document.createElement("div");
        conf.classList.add("confetto");

        conf.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        conf.style.left = Math.random() * 100 + "vw";

        const duration = 2 + Math.random() * 3;
        conf.style.animationDuration = duration + "s";

        container.appendChild(conf);

        setTimeout(() => conf.remove(), duration * 1000);
    }
}

/* --- JOLLY: UI --- */
function aggiornaUIJolly() {
    if (!jollyContainerEl || !jollyCountEl) return;

    if (jollyCount <= 0) {
        jollyContainerEl.style.opacity = "0.3";
        jollyContainerEl.style.pointerEvents = "none";
        jollyCountEl.textContent = "x0";
    } else {
        jollyContainerEl.style.opacity = "1";
        jollyContainerEl.style.pointerEvents = "auto";
        jollyCountEl.textContent = "x" + jollyCount;
    }
}

/* --- JOLLY: OTTENIMENTO --- */
function assegnaJolly() {
    jollyCount++;
    aggiornaUIJolly();
}

/* --- JOLLY: USO --- */
function usaJolly() {
    if (!giocoAttivo) return;
    if (jollyCount <= 0) return;
    if (!lettereEstratte || lettereEstratte.length === 0) return;
    if (jollyInUso) return;

    const tempoSelezionato = parseInt(document.getElementById("tempoRound").value);
    if (tempoSelezionato !== 0 && timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
        timerInPausa = true;
    }

    jollyInUso = true;
    letteraJollyScelta = null;

    mostraOverlayJolly();
    evidenziaLetterePerJolly();
}

/* --- OVERLAY JOLLY --- */
function mostraOverlayJolly() {
    if (!jollyOverlayEl || !alphabetGridEl) return;

    jollyOverlayEl.style.display = "flex";
    alphabetGridEl.innerHTML = "";

    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
    letters.forEach(l => {
        const cell = document.createElement("div");
        cell.className = "alphaCell";
        cell.textContent = l;
        cell.addEventListener("click", () => selezionaLetteraJolly(l));
        alphabetGridEl.appendChild(cell);
    });
}

function nascondiOverlayJolly() {
    if (!jollyOverlayEl) return;
    jollyOverlayEl.style.display = "none";
}

/* --- SCELTA LETTERA JOLLY --- */
function selezionaLetteraJolly(lettera) {
    letteraJollyScelta = lettera;
    nascondiOverlayJolly();
}

/* --- EVIDENZIA LETTERE ESTRATTE --- */
function evidenziaLetterePerJolly() {
    aggiornaUI();
}

/* --- APPLICA SOSTITUZIONE JOLLY --- */
function applicaSostituzioneJolly(index) {
    if (!jollyInUso) return;
    if (!letteraJollyScelta) return;

    if (index < 0 || index >= lettereEstratte.length) return;

    lettereEstratte[index] = letteraJollyScelta;

    placeholders.forEach(slot => {
        const idx = parseInt(slot.dataset.letterIndex || "-1", 10);
        if (idx === index) {
            slot.textContent = letteraJollyScelta;
        }
    });

    jollyCount--;
    if (jollyCount < 0) jollyCount = 0;
    aggiornaUIJolly();

    jollyInUso = false;
    letteraJollyScelta = null;

    const tempoSelezionato = parseInt(document.getElementById("tempoRound").value);
    if (tempoSelezionato !== 0 && timerInPausa) {
        timerInPausa = false;
        timerInterval = setInterval(() => {
            tempoRimanente--;
            timerEl.innerText = tempoRimanente + "s";

            if (tempoRimanente <= 5) timerEl.classList.add("red");
            if (tempoRimanente <= 0) endRound();
        }, 1000);
    }

    aggiornaUI();
}

/* --- PENALITÀ JOLLY --- */
function mostraPenaltyBanner() {
    if (!penaltyBannerEl) return;
    penaltyBannerEl.style.display = "block";
    setTimeout(() => {
        penaltyBannerEl.style.display = "none";
    }, 2500);
}

function applicaPenalitaJolly() {
    if (jollyCount <= 0) return;
    jollyCount--;
    if (jollyCount < 0) jollyCount = 0;
    aggiornaUIJolly();
    mostraPenaltyBanner();
}

/* --- MOSSA COMPUTER (versione con box grafici) --- */
function mossaComputer() {
    if (!window.dizionario) return;

    let valide = [];

    for (const parola of dizionario) {
        const esito = verificaParolaConLettere(parola, lettereEstratte);
        if (esito.valida) valide.push(parola);
    }

    valide.sort((a, b) => b.length - a.length);

    const migliore = valide[0] || "";
    const parolaGioc = parolaGiocatore();
    const lenG = parolaGioc ? parolaGioc.length : 0;
const puntiGioc = lenG;
const puntiCpu = migliore ? migliore.length : 0;

if (parolaGiocatoreValida) {

    const puntiGioc = puntiGiocatore = parolaGioc ? parolaGioc.length : 0;
    const puntiCpu = migliore ? migliore.length : 0;

    // classi per evidenziare il vincitore
    const playerClass = puntiGioc > puntiCpu ? "score-badge score-player score-winner"
                                             : "score-badge score-player";

    const cpuClass    = puntiCpu > puntiGioc ? "score-badge score-cpu score-winner"
                                             : "score-badge score-cpu";

    resultEl.innerHTML =
        `✔️ Parola valida!<br>
         Tu: <span class="${playerClass}"> ${puntiGioc} </span>
         — Computer: <span class="${cpuClass}"> ${puntiCpu} </span>`;
}

    /* --- JOLLY E COMPLIMENTI --- */
    if (parolaGiocatoreValida && migliore && parolaGioc.length === migliore.length) {
        mostraBannerComplimenti();
        assegnaJolly();
    }

    if (parolaGiocatoreValida && migliore && (migliore.length - parolaGioc.length) >= 2 && jollyCount > 0) {
        applicaPenalitaJolly();
    }

    /* --- RAGGRUPPIAMO LE PAROLE PER DIFFERENZA DI LUNGHEZZA --- */
    const gruppi = {};

    valide.forEach(p => {
        const diff = p.length - lenG;
        if (!gruppi[diff]) gruppi[diff] = [];
        gruppi[diff].push(p);
    });

    /* --- COSTRUIAMO I BOX --- */
    let html = "";

Object.keys(gruppi).sort((a, b) => b - a).forEach(diff => {

    if (diff < 0) return;  // mostra solo =, +1, +2, +3...

    const parole = gruppi[diff];
    const label = diff == 0 ? "=" : "+" + diff;

    const diffClass = diff == 0 ? "eq" : "plus";

    html += `
        <div class="cpu-box ${diffClass}" onclick="this.classList.toggle('expanded')">
            <span class="cpu-box-header">${label}</span>
            <span class="cpu-box-content">${parole.join(", ")}</span>
        </div>
    `;
});

    computerResultEl.innerHTML = html;
}
