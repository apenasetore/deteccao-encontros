// Teste de performance: mede apenas a versão sequencial ordenada (latitude).
// Uso: node benchmark.js <numeroDoDataset>   (ex: node benchmark.js 3)
import { lerDataset } from "./streamTxt.js";
import { detectarOrdenado } from "./encontrosOrdenado.js";

const BASE_URL = "https://bucket-projeto-trainee.s3.sa-east-1.amazonaws.com";
const N = Number(process.argv[2] ?? 1);
const RODADAS = 5; // roda várias vezes; a 1ª costuma ser mais lenta (JIT esquentando)

console.log(`=== benchmark dataset${N} | sequencial ordenado | ${RODADAS} rodadas ===\n`);

// 1) download + parse + agrupamento, tudo em stream (linha por linha)
const inicioDownload = performance.now();
const { timestampMap, total } = await lerDataset(`${BASE_URL}/dataset${N}.txt`);
const tempoDownload = performance.now() - inicioDownload;

console.log(`download + parse:  ${tempoDownload.toFixed(2)} ms`);
console.log(`${total} registros, ${timestampMap.size} timestamps\n`);

// 2) mede a versão ordenada
const tempos = [];
let qtd = 0;
for (let r = 0; r < RODADAS; r++) {
    const inicio = performance.now();
    const encontros = await detectarOrdenado(timestampMap);
    tempos.push(performance.now() - inicio);
    qtd = encontros.length;
}

console.table([{
    versao: "ordenado (latitude)",
    "1a rodada (ms)": tempos[0].toFixed(2),
    "melhor (ms)": Math.min(...tempos).toFixed(2),
    "media (ms)": (tempos.reduce((s, t) => s + t, 0) / tempos.length).toFixed(2),
    encontros: qtd,
}]);
