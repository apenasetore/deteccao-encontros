import { writeFile, mkdir } from "node:fs/promises";
import { lerDataset } from "./streamTxt.js";
import { detectarOrdenado } from "./encontrosOrdenado.js";

const BASE_URL = "https://bucket-projeto-trainee.s3.sa-east-1.amazonaws.com";
const TOTAL_DATASETS = 7;
const COM_GABARITO = 2; 

// sem argumento roda todos (1..7); com argumento roda só aquele (ex: node index.js 3)
const DATASETS = process.argv[2]
    ? [Number(process.argv[2])]
    : Array.from({ length: TOTAL_DATASETS }, (_, i) => i + 1);

// mede o tempo de uma função (sync ou async)
async function medir(nome, fn) {
    const inicio = performance.now();
    const resultado = await fn();
    const ms = performance.now() - inicio;
    console.log(`${nome.padEnd(28)} ${ms.toFixed(2).padStart(10)} ms`);
    return { resultado, ms };
}

// chave única por encontro: ordena os IDs para a ordem do par não importar
const chave = e => {
    const ids = [...e.monitoradosEncontro].sort((x, y) => x - y).join("-");
    return `${e.tipo}|${ids}|${e.timestamp}`;
};

await mkdir("saida", { recursive: true });

const resumo = [];

for (const N of DATASETS) {
    console.log(`\n=== dataset${N} ===`);

    const { resultado: { timestampMap, total }, ms: msLeitura } = await medir("download + parse (stream)", () =>
        lerDataset(`${BASE_URL}/dataset${N}.txt`)
    );
    console.log(`${total} registros, ${timestampMap.size} timestamps`);

    const { resultado: encontros, ms: msDeteccao } = await medir("sequencial ordenado", () =>
        detectarOrdenado(timestampMap)
    );
    console.log(`encontros: ${encontros.length}`);

    // salva o resultado
    await writeFile(`saida/encontros${N}.json`, JSON.stringify(encontros, null, 2));
    console.log(`arquivo gerado: saida/encontros${N}.json`);

    // ---- conferência com o gabarito ----
    let gabarito = "-";
    if (N <= COM_GABARITO) {
        const esperado = await (await fetch(`${BASE_URL}/respostas${N}.json`)).json();

        const meus = new Set(encontros.map(chave));
        const certos = new Set(esperado.map(chave));
        const faltando = [...certos].filter(k => !meus.has(k)); // estão no gabarito, não achamos
        const sobrando = [...meus].filter(k => !certos.has(k)); // achamos, mas não estão no gabarito

        console.log(`Meus: ${meus.size} | Esperado: ${certos.size}`);
        if (faltando.length === 0 && sobrando.length === 0) {
            console.log("Resultado bate com o gabarito!");
            gabarito = "ok";
        } else {
            console.log("Faltando:", faltando);
            console.log("Sobrando:", sobrando);
            gabarito = `faltando ${faltando.length} / sobrando ${sobrando.length}`;
        }
    }

    resumo.push({
        dataset: N,
        registros: total,
        timestamps: timestampMap.size,
        encontros: encontros.length,
        "leitura (ms)": msLeitura.toFixed(2),
        "deteccao (ms)": msDeteccao.toFixed(2),
        gabarito,
    });
}

console.log("\n=== RESUMO ===");
console.table(resumo);
