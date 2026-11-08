const RAIO_TERRA = 6371000; // em metros

function paraRadianos(graus){
    return graus * (Math.PI / 180);
}

//Calculo da distancia entre dois pontos geograficos usando a formula de HaversineS.
export function haversine(lat1, lon1, lat2, lon2) {
    const lat1Rad = paraRadianos(lat1);
    const lon1Rad = paraRadianos(lon1);
    const lat2Rad = paraRadianos(lat2);
    const lon2Rad = paraRadianos(lon2);

    const dLat = lat2Rad - lat1Rad;
    const dLon = lon2Rad - lon1Rad;

    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(dLon / 2) ** 2;
    if (a > 1) {
        throw new Error(`Erro no cálculo da distância: a=${a} > 1`);
    }
    const c = 2 * Math.asin(Math.sqrt(a));
    return RAIO_TERRA * c;
}