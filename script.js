// script.js
import { ref, set, get, update, onValue } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-database.js";
import { db } from './firebase-config.js';
import { banco, retos } from './preguntas.js';

// --- SISTEMA DE SONIDO ---
const sonido = {
    play(freq, type, dur) {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = type; o.frequency.value = freq;
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
        o.connect(g); g.connect(ctx.destination);
        o.start(); o.stop(ctx.currentTime + dur);
    },
    exito() { this.play(880, 'square', 0.2); },
    error() { this.play(150, 'sawtooth', 0.3); },
    victoria() { this.play(523, 'sine', 0.2); setTimeout(()=>this.play(659, 'sine', 0.4), 150); }
};

let miSala = "", miEquipo = "", miData = {};
let retosDisponibles = [];

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

// --- EVENTOS DE INTERFAZ ---
document.getElementById('btn-nav-tablero').onclick = () => cambiarTab('tablero');
document.getElementById('btn-nav-jugar').onclick = () => cambiarTab('controles');
document.getElementById('btn-crear').onclick = crearSala;
document.getElementById('btn-unir').onclick = unirseSala;
document.getElementById('btn-salir').onclick = salirSala;
document.getElementById('btn-reiniciar').onclick = reiniciarJuego;
document.getElementById('btn-arriesgar').onclick = arriesgarPalabra;

// --- FUNCIONES DE NAVEGACIÓN ---
function cambiarTab(vista) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('activa'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('activo'));
    document.getElementById('vista-' + vista).classList.add('activa');
    if(vista === 'tablero') document.getElementById('btn-nav-tablero').classList.add('activo');
    else document.getElementById('btn-nav-jugar').classList.add('activo');
}

// --- LÓGICA DE SALA Y FIREBASE ---
async function crearSala() {
    miSala = document.getElementById('in-sala').value.trim().toLowerCase();
    miEquipo = document.getElementById('in-equipo').value.trim();
    if(!miSala || !miEquipo) return alert("Faltan datos");

    const palabra = banco[Math.floor(Math.random() * banco.length)];
    await set(ref(db, `sesiones/${miSala}`), {
        palabra_actual: palabra,
        letras_adivinadas: [""],
        errores: 0,
        estado: "jugando", // Puede ser: jugando, victoria, derrota
        ganador: "",
        jugadores: {[miEquipo]: true},
        orden_turnos: [miEquipo],
        turno_index: 0
    });
    iniciarJuego();
}

async function unirseSala() {
    miSala = document.getElementById('in-sala').value.trim().toLowerCase();
    miEquipo = document.getElementById('in-equipo').value.trim();
    if(!miSala || !miEquipo) return alert("Faltan datos");

    const s = await get(ref(db, `sesiones/${miSala}`));
    if(!s.exists()) return alert("La sala no existe");
    
    let d = s.val();
    let jug = d.jugadores || {};
    jug[miEquipo] = true;
    await update(ref(db, `sesiones/${miSala}`), {
        jugadores: jug,
        orden_turnos: Object.keys(jug).sort()
    });
    iniciarJuego();
}

async function salirSala() {
    if(confirm("¿Seguro que deseas salir de la sala?")) {
        const s = await get(ref(db, `sesiones/${miSala}`));
        if(s.exists()) {
            let d = s.val();
            if(d.jugadores && d.jugadores[miEquipo]) {
                delete d.jugadores[miEquipo];
                let nuevosTurnos = d.orden_turnos.filter(e => e !== miEquipo);
                await update(ref(db, `sesiones/${miSala}`), {
                    jugadores: d.jugadores,
                    orden_turnos: nuevosTurnos,
                    turno_index: 0 
                });
            }
        }
        window.location.reload(); 
    }
}

async function reiniciarJuego() {
    const nuevaPalabra = banco[Math.floor(Math.random() * banco.length)];
    await update(ref(db, `sesiones/${miSala}`), {
        palabra_actual: nuevaPalabra,
        letras_adivinadas: [""],
        errores: 0,
        estado: "jugando",
        ganador: "",
        turno_index: 0
    });
}

function iniciarJuego() {
    document.getElementById('pantalla-inicio').style.display = 'none';
    document.getElementById('pantalla-juego').classList.add('activa');
    document.getElementById('lbl-sala').innerText = `SALA: ${miSala.toUpperCase()}`;
    
    onValue(ref(db, `sesiones/${miSala}`), (snap) => {
        miData = snap.val();
        if(!miData) return;
        render();
    });
    prepararReto();
}

// --- RENDERIZADO Y CONTROL DE ESTADOS ---
function render() {
    const box = document.getElementById('display-palabra');
    box.innerHTML = "";
    
    // Si el juego terminó, mostramos toda la palabra
    const revelarTodo = (miData.estado === "victoria" || miData.estado === "derrota");

    miData.palabra_actual.split("").forEach(letra => {
        const span = document.createElement('span');
        span.innerText = (revelarTodo || miData.letras_adivinadas.includes(letra)) ? letra : "_";
        box.appendChild(span);
    });

    document.getElementById('lbl-errores').innerText = `Errores: ${miData.errores}/6`;
    dibujar(miData.errores);

    const miTurno = miData.orden_turnos[miData.turno_index] === miEquipo;
    const tBox = document.getElementById('display-turno');
    
    // Gestión de Estados Visuales
    tBox.className = "turn-box";
    if (miData.estado === "victoria") {
        tBox.innerText = `¡VICTORIA! Ganó: ${miData.ganador}`;
        tBox.classList.add("victoria");
        sonido.victoria(); // Suena cada que sincroniza, podrías controlarlo para que suene 1 vez
        mostrarCertificado(miData.ganador);
    } else if (miData.estado === "derrota") {
        tBox.innerText = `¡DERROTA! La palabra era ${miData.palabra_actual}`;
        tBox.classList.add("derrota");
    } else {
        tBox.innerText = miTurno ? "🎯 TU TURNO" : `Espera a: ${miData.orden_turnos[miData.turno_index]}`;
        if (miTurno) tBox.classList.add("mi-turno");
    }

    // Ocultar/Mostrar botón de reinicio y bloquear teclado si no están jugando
    document.getElementById('btn-reiniciar').style.display = (miData.estado !== "jugando") ? "block" : "none";
    document.getElementById('vista-controles').style.pointerEvents = (miData.estado !== "jugando" || !miTurno) ? "none" : "auto";
    document.getElementById('vista-controles').style.opacity = (miData.estado !== "jugando" || !miTurno) ? "0.5" : "1";

    actualizarTeclado(miTurno && miData.estado === "jugando");
}

// --- MECÁNICAS DE JUEGO ---
function prepararReto() {
    // Si la lista está vacía (al iniciar el juego o si ya respondieron todas), la recargamos
    if (retosDisponibles.length === 0) {
        retosDisponibles = [...retos]; 
    }

    // Seleccionamos un índice al azar de las preguntas que aún quedan
    const randomIndex = Math.floor(Math.random() * retosDisponibles.length);
    
    // .splice() extrae el reto del arreglo, asegurando que no se repita en este ciclo
    const r = retosDisponibles.splice(randomIndex, 1)[0];

    document.getElementById('txt-pregunta').innerText = r.q;
    document.getElementById('txt-pregunta').dataset.correct = r.correctIndex;
    
    const opcionesBtns = document.querySelectorAll('.btn-opcion');
    opcionesBtns.forEach((btn, index) => {
        btn.innerText = r.opciones[index];
        btn.onclick = () => verificarRetoMatematico(index);
    });
    
    document.getElementById('caja-reto').style.display = "block";
    document.getElementById('caja-teclado').style.display = "none";
}

function verificarRetoMatematico(selectedIndex) {
    const correctIndex = parseInt(document.getElementById('txt-pregunta').dataset.correct);
    if(selectedIndex === correctIndex) {
        sonido.exito();
        document.getElementById('caja-reto').style.display = "none";
        document.getElementById('caja-teclado').style.display = "block";
    } else {
        sonido.error();
        alert("Incorrecto. Pasas turno.");
        // Si falla el reto, pasa turno
        let nIndex = (miData.turno_index + 1) % miData.orden_turnos.length;
        update(ref(db, `sesiones/${miSala}`), { turno_index: nIndex });
        prepararReto();
        cambiarTab('tablero');
    }
}

function actualizarTeclado(activo) {
    const t = document.getElementById('teclado');
    t.innerHTML = "";
    "ABCDEFGHIJKLMNÑOPQRSTUVWXYZ".split("").forEach(l => {
        const b = document.createElement('button');
        b.className = "k-btn"; b.innerText = l;
        b.disabled = !activo || miData.letras_adivinadas.includes(l);
        
        b.onclick = async () => {
            const acierto = miData.palabra_actual.includes(l);
            if(acierto) sonido.exito(); else sonido.error();
            
            const nuevasLetras = [...miData.letras_adivinadas, l];
            const nuevosErrores = miData.errores + (acierto ? 0 : 1);
            let nIndex = miData.turno_index;
            
            // Evaluar Victoria o Derrota
            let nuevoEstado = "jugando";
            let ganador = "";
            const gano = miData.palabra_actual.split("").every(letra => nuevasLetras.includes(letra));
            
            if(gano) {
                nuevoEstado = "victoria";
                ganador = miEquipo;
            } else if (nuevosErrores >= 6) {
                nuevoEstado = "derrota";
            }

            if(!acierto && nuevoEstado === "jugando") nIndex = (nIndex + 1) % miData.orden_turnos.length;

            await update(ref(db, `sesiones/${miSala}`), {
                letras_adivinadas: nuevasLetras,
                errores: nuevosErrores,
                turno_index: nIndex,
                estado: nuevoEstado,
                ganador: ganador
            });
            
            prepararReto();
            cambiarTab('tablero');
        };
        t.appendChild(b);
    });
}

async function arriesgarPalabra() {
    const input = document.getElementById('in-arriesgar');
    const intento = input.value.trim().toUpperCase();
    if(!intento) return;

    if(intento === miData.palabra_actual) {
        sonido.exito();
        await update(ref(db, `sesiones/${miSala}`), {
            estado: "victoria",
            ganador: miEquipo
        });
    } else {
        sonido.error();
        const nuevosErrores = miData.errores + 1;
        let nuevoEstado = nuevosErrores >= 6 ? "derrota" : "jugando";
        let nIndex = (miData.turno_index + 1) % miData.orden_turnos.length;

        await update(ref(db, `sesiones/${miSala}`), {
            errores: nuevosErrores,
            turno_index: nIndex,
            estado: nuevoEstado
        });
        alert(`¡Incorrecto! La palabra no es ${intento}`);
    }
    
    input.value = "";
    prepararReto();
    cambiarTab('tablero');
}

// --- DIBUJO DEL AHORCADO ---
function dibujar(e) {
    ctx.clearRect(0,0,200,180);
    ctx.strokeStyle = "#334155"; ctx.lineWidth = 3;
    ctx.beginPath(); 
    ctx.moveTo(10,170); ctx.lineTo(100,170); // Base
    ctx.moveTo(30,170); ctx.lineTo(30,10); ctx.lineTo(80,10); ctx.lineTo(80,30);
    ctx.stroke();
    if(e>0) { ctx.beginPath(); ctx.arc(80,45,15,0,7); ctx.stroke(); } // Cabeza
    if(e>1) { ctx.beginPath(); ctx.moveTo(80,60); ctx.lineTo(80,110); ctx.stroke(); } // Cuerpo
    if(e>2) { ctx.beginPath(); ctx.moveTo(80,75); ctx.lineTo(60,100); ctx.stroke(); } // Brazo L
    if(e>3) { ctx.beginPath(); ctx.moveTo(80,75); ctx.lineTo(100,100); ctx.stroke(); } // Brazo R
    if(e>4) { ctx.beginPath(); ctx.moveTo(80,110); ctx.lineTo(60,140); ctx.stroke(); } // Pierna L
    if(e>5) { ctx.beginPath(); ctx.moveTo(80,110); ctx.lineTo(100,140); ctx.stroke(); } // Pierna R
}

// --- CERTIFICADO DE GANADOR ---
let certificadoMostrado = false;

function mostrarCertificado(ganador) {
    if(certificadoMostrado) return; // Evitar mostrar múltiples veces
    certificadoMostrado = true;

    // Llenar datos del certificado
    document.getElementById('cert-nombre').innerText = ganador;
    const hoy = new Date();
    const fechaFormato = hoy.toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
    document.getElementById('cert-fecha').innerHTML = `Fecha: <strong>${fechaFormato}</strong>`;
    
    // Mostrar modal
    const modal = document.getElementById('modal-certificado');
    modal.classList.add('activo');
    
    // Agregar event listeners si no existen
    if(!document.getElementById('btn-descargar-cert').onclick) {
        document.getElementById('btn-descargar-cert').onclick = descargarCertificado;
    }
    if(!document.getElementById('btn-cerrar-cert').onclick) {
        document.getElementById('btn-cerrar-cert').onclick = cerrarCertificado;
    }
}

function cerrarCertificado() {
    const modal = document.getElementById('modal-certificado');
    modal.classList.remove('activo');
}

async function descargarCertificado() {
    // Cargar html2canvas
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
    document.head.appendChild(script);
    
    script.onload = () => {
        const certificado = document.getElementById('certificado');
        html2canvas(certificado, {
            backgroundColor: null,
            scale: 2
        }).then(canvas => {
            const link = document.createElement('a');
            link.href = canvas.toDataURL('image/png');
            link.download = `Certificado_${document.getElementById('cert-nombre').innerText}_${new Date().getTime()}.png`;
            link.click();
        });
    };
}