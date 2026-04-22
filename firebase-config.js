// firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-app.js";
import { getDatabase, ref, push, set, get, query, orderByValue, limitToLast } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-database.js";

// Configuración oficial de tu proyecto
const firebaseConfig = {
  apiKey: "AIzaSyAxpZ0LhydIbwlFsVM0rP3mrlmuJqrPxok",
  authDomain: "narcisocabal.firebaseapp.com",
  databaseURL: "https://narcisocabal-default-rtdb.firebaseio.com",
  projectId: "narcisocabal",
  storageBucket: "narcisocabal.firebasestorage.app",
  messagingSenderId: "1024756671095",
  appId: "1:1024756671095:web:e5ff3d01a8b64adc15dc72",
  measurementId: "G-1RDZSPP08Y"
};

// Inicializamos Firebase
const app = initializeApp(firebaseConfig);

// EXPORTAMOS la base de datos para que tablero.html y control.html la usen
export const db = getDatabase(app); 

/**
 * Función para guardar la nota y actualizar el Top 3
 * @param {string} nombre - Nombre del estudiante
 * @param {string} juego - Nombre del juego (ej: 'geometria_7')
 * @param {number} puntaje - Calificación de 0 a 5
 * @param {string} grado - Grado del alumno (ej: '9-A')
 */
export async function registrarResultado(nombre, juego, puntaje, grado) {
    const fecha = new Date().toLocaleString();
    const alumnoId = nombre.toLowerCase().trim().replace(/\s+/g, '_');

    // 1. Guardar en el Historial General
    try {
        await push(ref(db, `historial/${juego}`), {
            nombre,
            grado,
            puntaje,
            fecha
        });
        console.log("Historial actualizado.");
    } catch (e) { console.error("Error historial:", e); }

    // 2. Lógica del Top 3 Personal
    const recordsRef = ref(db, `records/${alumnoId}/${juego}`);
    try {
        const snapshot = await get(recordsRef);
        let mejores = snapshot.exists() ? snapshot.val() : [];
        
        // Añadimos el nuevo puntaje, ordenamos de mayor a menor y cortamos a 3
        mejores.push(puntaje);
        mejores.sort((a, b) => b - a);
        const top3 = mejores.slice(0, 3);

        await set(recordsRef, top3);
        console.log("Top 3 actualizado para", nombre);
        return top3; 
    } catch (e) { console.error("Error Top 3:", e); }
}