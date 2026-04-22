// preguntas.js

export const banco = [
    "POLINOMIO", "HIPOTENUSA", "ALGEBRA", "GEOMETRIA", 
    "ESTADISTICA", "FRACCION", "RADICACION", "TEOREMA",
    "PENTAGONO", "DERIVADA", "INTEGRAL", "ALGORITMO",
    "DIAMETRO", "CIRCUNFERENCIA", "PROBABILIDAD", "ANGULO",
    "TRIANGULO", "CUADRADO", "RECTANGULO", "ROMBO",
    "PARALELOGRAMO", "TRAPECIO", "CILINDRO", "ESFERA"
];

function generarOpciones(correcta) {
    const opciones = [correcta];
    while (opciones.length < 4) {
        let wrong = correcta + Math.floor(Math.random() * 10) - 5; // +/- 5
        if (wrong !== correcta && !opciones.includes(wrong)) {
            opciones.push(wrong);
        }
    }
    // Shuffle
    for (let i = opciones.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [opciones[i], opciones[j]] = [opciones[j], opciones[i]];
    }
    const correctIndex = opciones.indexOf(correcta);
    return { opciones, correctIndex };
}

export const retos = [
    // --- Retos Iniciales ---
    {q: "¿Raíz cuadrada de 81?", ...generarOpciones(9)},
    {q: "Si x + 5 = 12, ¿x?", ...generarOpciones(7)},
    {q: "3 x 3 x 3 =", ...generarOpciones(27)},
    {q: "Lados de un dodecágono", ...generarOpciones(12)},
    {q: "15% de 200", ...generarOpciones(30)},

    // --- Geometría ---
    {q: "¿Suma de los ángulos internos de un triángulo?", ...generarOpciones(180)},
    {q: "¿Cuántos lados tiene un heptágono?", ...generarOpciones(7)},
    {q: "Si el radio mide 5, ¿cuánto mide el diámetro?", ...generarOpciones(10)},
    {q: "Lados de un trapecio", ...generarOpciones(4)},
    {q: "Si un cuadrado tiene de lado 6, ¿cuál es su área?", ...generarOpciones(36)},
    {q: "Cuántos grados tiene un ángulo recto", ...generarOpciones(90)},
    {q: "¿Cuántos vértices tiene un cubo?", ...generarOpciones(8)},
    {q: "¿Cuántos grados suman dos ángulos complementarios?", ...generarOpciones(90)},
    {q: "Cuántos lados iguales tiene un triángulo equilátero:", ...generarOpciones(3)},
    {q: "Si la base es 10 y altura 5, ¿el área del rectángulo es?", ...generarOpciones(25)},
    {q: "¿Cuántas caras tiene un tetraedro?", ...generarOpciones(4)},
    {q: "¿Cuántos grados mide un ángulo llano?", ...generarOpciones(180)},
    {q: "Perímetro de un hexágono regular de lado 5", ...generarOpciones(30)},
    {q: "¿Cuántos segundos tiene una hora?", ...generarOpciones(3600)},

    // --- Álgebra ---
    {q: "Si 2x = 40, ¿cuánto vale x?", ...generarOpciones(20)},
    {q: "Resultado de (-5) + (-8)", ...generarOpciones(-13)},
    {q: "Si x - 10 = 5, ¿x vale?", ...generarOpciones(15)},
    {q: "El doble de un número es 50, ¿el número es?", ...generarOpciones(25)},
    {q: "Resultado de 100 ÷ 4 + 5", ...generarOpciones(30)},
    {q: "Valor de x en: 3x - 1 = 20", ...generarOpciones(7)},
    {q: "Si a=2 y b=3, ¿cuánto es 2a + b?", ...generarOpciones(7)},
    {q: "Resultado de 2 a la potencia 5 (2^5)", ...generarOpciones(32)},
    {q: "Si x/2 = 15, ¿x es?", ...generarOpciones(30)},
    {q: "Resultado de (4 + 6) x 2", ...generarOpciones(20)},
    {q: "Raíz cuadrada de 144", ...generarOpciones(12)},
    {q: "Si 5x = 0, ¿x vale?", ...generarOpciones(0)},
    {q: "Resultado de 7 x 8 - 6", ...generarOpciones(50)},
    {q: "Valor de x en: x + x + x = 12", ...generarOpciones(4)},

    // --- Estadística y Probabilidad ---
    {q: "Media de: 5, 5, 10, 10", a: 7.5},
    {q: "Si lanzas un dado, ¿cuántos resultados posibles hay?", a: 6},
    {q: "Moda de los datos: 2, 3, 3, 4, 5, 3", a: 3},
    {q: "Rango de los datos: 10, 20, 30, 40", a: 30},
    {q: "Si un evento es seguro, su probabilidad es (%)", a: 100},
    {q: "Mediana de: 1, 3, 5, 7, 9", a: 5},
    {q: "Probabilidad de cara al lanzar una moneda (%)", a: 50},
    {q: "¿Suma de frecuencias relativas siempre es?", a: 1},
    {q: "Si hay 4 bolas rojas y 6 azules, ¿total de bolas?", a: 10},
    {q: "Si la media de 2 números es 10, ¿cuánto suman?", a: 20},
    {q: "La mitad de la población equivale al (%)", a: 50},
    {q: "Cuántos grados tiene un grafico circular", a: 360}
];