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
let miPuntuacion = 5.0; // Puntuación inicial
let puntajes = {}; // Almacenar puntuaciones de todos los equipos

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

// Ajustar tamaño del canvas
function ajustarCanvas() {
    const container = canvas.parentElement;
    if (!container) return;
    
    // Esperar a que el contenedor sea visible
    let width = container.offsetWidth;
    let attempts = 0;
    while (width === 0 && attempts < 10) {
        width = container.offsetWidth;
        attempts++;
    }
    
    width = Math.max(300, width - 20);
    const height = Math.max(300, width * 0.75);
    
    canvas.width = width;
    canvas.height = height;
}

// --- EVENTOS DE INTERFAZ ---
document.getElementById('btn-nav-tablero').onclick = () => {
    cambiarTab('tablero');
    ajustarCanvas();
};
document.getElementById('btn-nav-jugar').onclick = () => cambiarTab('controles');
document.getElementById('btn-crear').onclick = crearSala;
document.getElementById('btn-unir').onclick = unirseSala;
document.getElementById('btn-salir').onclick = salirSala;
document.getElementById('btn-reiniciar').onclick = reiniciarJuego;

window.addEventListener('resize', () => {
    if (document.getElementById('pantalla-juego').classList.contains('activa')) {
        ajustarCanvas();
    }
});

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
    
    // Inicializar sesión con estructura de progreso
    await set(ref(db, `sesiones/${miSala}`), {
        palabra_actual: palabra,
        estado: "jugando",
        ganador: "",
        jugadores: {[miEquipo]: true},
        orden_turnos: [miEquipo],
        turno_index: 0,
        progreso: {
            [miEquipo]: 0 // 0% al inicio
        },
        puntajes: {
            [miEquipo]: 5.0 // Puntuación inicial 5.0
        }
    });
    
    miPuntuacion = 5.0;
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
    
    // Inicializar progreso y puntuación del nuevo equipo
    const progreso = d.progreso || {};
    progreso[miEquipo] = 0;
    
    const puntos = d.puntajes || {};
    puntos[miEquipo] = 5.0;
    
    await update(ref(db, `sesiones/${miSala}`), {
        jugadores: jug,
        orden_turnos: Object.keys(jug).sort(),
        progreso: progreso,
        puntajes: puntos
    });
    
    miPuntuacion = 5.0;
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
    certificadoMostrado = false;
    await update(ref(db, `sesiones/${miSala}`), {
        palabra_actual: nuevaPalabra,
        estado: "jugando",
        ganador: "",
        turno_index: 0,
        progreso: Object.keys(miData.jugadores || {}).reduce((acc, eq) => {
            acc[eq] = 0;
            return acc;
        }, {}),
        puntajes: Object.keys(miData.jugadores || {}).reduce((acc, eq) => {
            acc[eq] = 5.0;
            return acc;
        }, {})
    });
    miPuntuacion = 5.0;
}

function iniciarJuego() {
    document.getElementById('pantalla-inicio').style.display = 'none';
    document.getElementById('pantalla-juego').classList.add('activa');
    document.getElementById('lbl-sala').innerText = `SALA: ${miSala.toUpperCase()}`;
    
    ajustarCanvas();
    
    onValue(ref(db, `sesiones/${miSala}`), (snap) => {
        miData = snap.val();
        if(!miData) return;
        render();
    });
    prepararReto();
}

// --- RENDERIZADO Y CONTROL DE ESTADOS ---
function render() {
    if (!miData || !miData.orden_turnos) return; // Validación básica
    
    // Actualizar puntuación
    puntajes = miData.puntajes || {};
    miPuntuacion = puntajes[miEquipo] || 5.0;
    document.getElementById('lbl-puntuacion').innerText = `Puntuación: ${miPuntuacion.toFixed(1)}`;
    console.log('Render - Mi puntuación:', miPuntuacion, 'Todos los puntajes:', puntajes, 'Progreso:', miData.progreso);

    // Asegurar que canvas tiene dimensiones antes de dibujar
    if (canvas.width === 0 || canvas.height === 0) {
        ajustarCanvas();
    }
    
    // Dibujar pista de carreras
    try {
        dibujarPista(miData.progreso || {});
    } catch (e) {
        console.error('Error al dibujar pista:', e);
    }

    const miTurno = miData.orden_turnos[miData.turno_index] === miEquipo;
    const tBox = document.getElementById('display-turno');
    
    // Gestión de Estados Visuales
    tBox.className = "turn-box";
    if (miData.estado === "victoria") {
        tBox.innerText = `🏁 ¡GANADOR! ${miData.ganador}`;
        tBox.classList.add("victoria");
        sonido.victoria();
        registrarResultado(miData.ganador, puntajes[miData.ganador] || 5.0);
        mostrarCertificado(miData.ganador, puntajes[miData.ganador] || 5.0);
    } else {
        tBox.innerText = miTurno ? "🎯 TU TURNO" : `Espera a: ${miData.orden_turnos[miData.turno_index]}`;
        if (miTurno) tBox.classList.add("mi-turno");
    }

    // Ocultar/Mostrar botón de reinicio
    document.getElementById('btn-reiniciar').style.display = (miData.estado !== "jugando") ? "block" : "none";
    document.getElementById('vista-controles').style.pointerEvents = (miData.estado !== "jugando" || !miTurno) ? "none" : "auto";
    document.getElementById('vista-controles').style.opacity = (miData.estado !== "jugando" || !miTurno) ? "0.5" : "1";
    
    // Auto preparar reto si es turno del usuario
    if (miTurno && miData.estado === "jugando" && document.getElementById('txt-pregunta').innerText === "--") {
        prepararReto();
    }
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
}

function verificarRetoMatematico(selectedIndex) {
    const correctIndex = parseInt(document.getElementById('txt-pregunta').dataset.correct);
    
    if(selectedIndex === correctIndex) {
        sonido.exito();
        // Acierto: +10% de progreso
        const progreso = miData.progreso || {};
        const nuevoProgreso = Math.min(100, (progreso[miEquipo] || 0) + 10);
        progreso[miEquipo] = nuevoProgreso;
        
        // Verificar victoria
        let nuevoEstado = miData.estado;
        let ganador = "";
        if (nuevoProgreso >= 100) {
            nuevoEstado = "victoria";
            ganador = miEquipo;
        }
        
        // Pasar al siguiente turno (excepto si hay victoria)
        let nIndex = miData.turno_index;
        if (nuevoEstado === "jugando") {
            nIndex = (miData.turno_index + 1) % miData.orden_turnos.length;
        }
        
        console.log('Respuesta correcta - Progreso:', nuevoProgreso, 'Turno:', nIndex);
        update(ref(db, `sesiones/${miSala}`), {
            progreso: progreso,
            turno_index: nIndex,
            estado: nuevoEstado,
            ganador: ganador
        });
        cambiarTab('tablero');
        setTimeout(() => ajustarCanvas(), 300);
    } else {
        sonido.error();
        alert("Incorrecto. Penalización: -0.5 puntos. Pasas turno.");
        
        // Penalización: -0.5 puntos (mínimo 1.0)
        // IMPORTANTE: Preservar puntajes de TODOS los equipos
        const puntajes = miData.puntajes || {};
        const nuevaPuntuacion = Math.max(1.0, (puntajes[miEquipo] || 5.0) - 0.5);
        puntajes[miEquipo] = nuevaPuntuacion;
        
        // Pasar turno al siguiente equipo
        let nIndex = (miData.turno_index + 1) % miData.orden_turnos.length;
        
        console.log('Respuesta incorrecta - Puntuación:', nuevaPuntuacion, 'Puntajes:', puntajes, 'Turno:', nIndex);
        update(ref(db, `sesiones/${miSala}`), {
            turno_index: nIndex,
            puntajes: puntajes
        });
        
        cambiarTab('tablero');
        setTimeout(() => ajustarCanvas(), 300);
    }
}

function actualizarTeclado(activo) {
    // En Grand Prix no usamos teclado alfabético, solo retos de opción múltiple
    // Esta función no hace nada
}

async function arriesgarPalabra() {
    const input = document.getElementById('in-arriesgar');
    const intento = input.value.trim().toUpperCase();
    if(!intento) return;

    // En Grand Prix, el "arriesgar" es simplemente pasar turno sin responder
    // No penalizamos por arriesgar, solo pasamos turno
    let nIndex = (miData.turno_index + 1) % miData.orden_turnos.length;
    
    await update(ref(db, `sesiones/${miSala}`), {
        turno_index: nIndex
    });
    
    input.value = "";
    prepararReto();
    cambiarTab('tablero');
}

// --- DIBUJO DE PISTA DE CARRERAS ---
function dibujarPista(progreso) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const equipos = miData.orden_turnos || [];
    const alturaCarril = canvas.height / equipos.length;
    const anchoUtil = canvas.width - 60;
    const colores = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#f9ca24', '#6c5ce7', '#a29bfe', '#fd79a8', '#fdcb6e'];
    
    // Dibujar meta (línea de meta a la derecha)
    ctx.strokeStyle = '#2ecc71';
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 5]);
    ctx.beginPath();
    ctx.moveTo(canvas.width - 15, 0);
    ctx.lineTo(canvas.width - 15, canvas.height);
    ctx.stroke();
    ctx.setLineDash([]);
    
    ctx.fillStyle = '#2ecc71';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('🏁', canvas.width - 8, 20);
    
    // Dibujar cada carril
    equipos.forEach((equipo, index) => {
        const y = index * alturaCarril + alturaCarril / 2;
        const color = colores[index % colores.length];
        
        // Línea del carril
        ctx.strokeStyle = '#ddd';
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(40, y);
        ctx.lineTo(canvas.width - 20, y);
        ctx.stroke();
        ctx.setLineDash([]);
        
        // Calcular posición del caballo basado en progreso
        const progresoPorcentaje = (progreso[equipo] || 0) / 100;
        const xCaballo = 40 + progresoPorcentaje * anchoUtil;
        
        // Dibujar caballo (círculo)
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(xCaballo, y, 15, 0, Math.PI * 2);
        ctx.fill();
        
        // Borde del caballo
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Número de progreso en el caballo
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${progreso[equipo] || 0}%`, xCaballo, y);
        
        // Nombre del equipo
        ctx.fillStyle = '#333';
        ctx.font = 'bold 13px Arial';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(equipo, 35, y);
        
        // Indicador de turno actual
        if (miData.orden_turnos[miData.turno_index] === equipo) {
            ctx.strokeStyle = '#f39c12';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(xCaballo, y, 18, 0, Math.PI * 2);
            ctx.stroke();
            
            // Estrella indicadora
            ctx.fillStyle = '#f39c12';
            ctx.font = 'bold 16px Arial';
            ctx.fillText('⭐', xCaballo, y - 25);
        }
    });
    
    // Mostrar título
    ctx.fillStyle = '#2c3e50';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('🏁 GRAND PRIX MATEMÁTICO 🏁', canvas.width / 2, 25);
}

// --- CERTIFICADO DE GANADOR ---
let certificadoMostrado = false;

function mostrarCertificado(ganador, puntuacion) {
    if(certificadoMostrado) return;
    certificadoMostrado = true;

    document.getElementById('cert-nombre').innerText = ganador;
    document.getElementById('cert-puntuacion').innerText = puntuacion.toFixed(1);
    
    const hoy = new Date();
    const fechaFormato = hoy.toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
    document.getElementById('cert-fecha').innerHTML = fechaFormato;
    
    const modal = document.getElementById('modal-certificado');
    modal.classList.add('activo');
    
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

async function registrarResultado(ganador, puntuacion) {
    // Guardar resultado en Firebase bajo resultados/{sala}
    try {
        await set(ref(db, `resultados/${miSala}/${ganador}`), {
            equipo: ganador,
            puntuacion: puntuacion,
            fecha: new Date().toISOString(),
            ganador: true
        });
        console.log('Resultado registrado:', ganador, puntuacion);
    } catch (e) {
        console.error('Error al registrar resultado:', e);
    }
}

async function descargarCertificado() {
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