import { haversine } from "./haversine.js";
const R = 6371000;

export const DLIMITE = 20; // encontro = distância MENOR que 20 metros

// prioridade: protetiva > faccao > generico
export function classificar(a, b) {
    const agressorDe = (v, ag) =>
        v.medidaProtetiva && Array.isArray(v.idsRestricaoMedida) &&
        v.idsRestricaoMedida.includes(ag.idMonitorado);
    if (agressorDe(a, b) || agressorDe(b, a)) return "protetiva";
    if (a.faccaoMonitorado !== 0 && a.faccaoMonitorado === b.faccaoMonitorado) return "faccao";
    return "generico";
}

// 20 m convertidos em graus de latitude (~0.0001799°).
// Se a diferença de latitude já passa disso, a distância com certeza é >= 20 m.
export const DLAT_MAX = ((DLIMITE / R) * (180 / Math.PI));

// Ordena o grupo por latitude e, para cada pessoa, só compara com os vizinhos
// seguintes enquanto a diferença de latitude for menor que DLAT_MAX.
export function encontrosDoGrupoOrdenado(timestamp, grupo) {
    const encontros = [];
    const ordenado = [...grupo].sort((x, y) => x.latitude - y.latitude);

    for (let i = 0; i < ordenado.length; i++) {
        const a = ordenado[i];
        for (let j = i + 1; j < ordenado.length; j++) {
            const b = ordenado[j];

            if (b.latitude - a.latitude >= DLAT_MAX) break;

            const dist = haversine(a.latitude, a.longitude, b.latitude, b.longitude);
            if (dist < DLIMITE) {
                encontros.push({
                    tipo: classificar(a, b),
                    monitoradosEncontro: [a.idMonitorado, b.idMonitorado],
                    timestamp,
                    posicoes: {
                        [a.idMonitorado]: { lat: a.latitude, lon: a.longitude },
                        [b.idMonitorado]: { lat: b.latitude, lon: b.longitude },
                    },
                    distanciaMetros: dist,
                });
            }
        }
    }
    return encontros;
}

export function detectarOrdenado(timestampMap) {
    const encontros = [];
    timestampMap.forEach((grupo, timestamp) => {
        for (const e of encontrosDoGrupoOrdenado(timestamp, grupo)) encontros.push(e);
    });
    return encontros;
}
