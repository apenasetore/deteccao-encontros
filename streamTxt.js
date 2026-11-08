import { Readable } from "node:stream";
import readline from "node:readline";

const limpar = s => (s ?? "").replace(/^"|"$/g, "");

// Baixa e lê o dataset LINHA POR LINHA (stream), já agrupando por timestamp.
export async function lerDataset(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status} (${url})`);

    const rl = readline.createInterface({ input: Readable.fromWeb(res.body), crlfDelay: Infinity });

    const timestampMap = new Map();
    let col = null; 
    let total = 0;

    for await (const linha of rl) {
        if (linha.trim() === "") continue;
        const v = linha.split(";");

        if (!col) {
            col = Object.fromEntries(v.map((nome, i) => [limpar(nome), i]));
            continue;
        }

        const timestamp = limpar(v[col.timestamp]);
        const faccao = limpar(v[col.faccaoMonitorado]);
        const medidaProtetiva = limpar(v[col.medidaProtetiva]) === "true";
        const ids = limpar(v[col.idsRestricaoMedida]);

        // registro enxuto
        const reg = {
            idMonitorado: Number(limpar(v[col.idMonitorado])),
            faccaoMonitorado: faccao === "" ? 0 : faccao,
            latitude: parseFloat(limpar(v[col.latitude])),
            longitude: parseFloat(limpar(v[col.longitude])),
            medidaProtetiva,
            idsRestricaoMedida: medidaProtetiva && ids !== "" ? ids.split(",").map(Number) : 0,
        };

        let grupo = timestampMap.get(timestamp);
        if (!grupo) {
            grupo = [];
            timestampMap.set(timestamp, grupo);
        }
        grupo.push(reg);
        total++;
    }

    return { timestampMap, total };
}
