# Detecção de encontros por geolocalização

Detecta **encontros** entre monitorados: dois registros com o **mesmo timestamp** a
**menos de 20 m** de distância (Haversine, raio da Terra = 6.371.000 m).

Cada encontro é classificado, nesta ordem de prioridade:

| tipo        | regra                                                                   |
|-------------|-------------------------------------------------------------------------|
| `protetiva` | um dos dois tem medida protetiva e o outro está em `idsRestricaoMedida` |
| `faccao`    | os dois têm a mesma facção (facção vazia não conta)                     |
| `generico`  | qualquer outro par                                                      |

Cada par é registrado uma única vez por timestamp.

## Requisitos

- Node.js 18 ou mais novo (usa `fetch` nativo e ES Modules)
- Acesso à internet, porque os datasets são baixados na hora

Não há dependências externas, então não precisa de `npm install`.

## Como rodar

### Gerar o resultado

```bash
npm start            # roda os 7 datasets, um depois do outro
node index.js 3      # roda só o dataset3
```

- O resultado de cada dataset é salvo em `saida/encontros<N>.json`.
- Nos datasets 1 e 2, o script também baixa o gabarito (`respostas<N>.json`) e mostra se o
  resultado bate, listando o que faltou ou sobrou.
- No final aparece uma tabela-resumo com registros, timestamps, encontros, tempos e o status
  do gabarito de cada dataset.

### Benchmark

```bash
npm run bench -- 3      # dataset3
```

Roda a detecção 5 vezes e mostra o tempo da 1ª rodada, o melhor tempo, a média e a quantidade
de encontros. A 1ª rodada costuma ser mais lenta porque o JIT do V8 ainda está esquentando.
O tempo de download e parse aparece separado.

## Como os dados são obtidos (`streamTxt.js`)

Os datasets ficam num bucket S3 público (links em `links.txt`):

```
https://bucket-projeto-trainee.s3.sa-east-1.amazonaws.com/dataset<N>.txt
```

O arquivo é baixado com `fetch` e lido **linha por linha, em stream**: o corpo da resposta HTTP
vira um `Readable` do Node e passa pelo `readline`. O texto inteiro nunca fica em memória.

Para cada linha:

1. Separa os campos por `;` e remove as aspas. A primeira linha é o cabeçalho e serve para mapear
   cada coluna pelo nome.
2. Monta um registro enxuto: `idMonitorado`, `faccaoMonitorado` (vazio vira `0`), `latitude`,
   `longitude`, `medidaProtetiva` e `idsRestricaoMedida` (convertido em array de números).
3. Coloca o registro num `Map<timestamp, registro[]>`. O timestamp é a chave e não é repetido
   dentro do registro.

Como só se comparam posições com o mesmo timestamp, esse agrupamento divide o problema em vários
grupos pequenos e independentes, já durante o download.

Formato de entrada (separado por `;`):

```
idMonitorado;faccaoMonitorado;timestamp;latitude;longitude;medidaProtetiva;idsRestricaoMedida
```

## Detecção: sequencial ordenado por latitude (`encontrosOrdenado.js`)

Para cada grupo de timestamp:

1. **Ordena** os registros por latitude.
2. Para cada registro `a`, compara só com os registros seguintes `b` da lista.
3. **Para o laço** assim que `b.latitude - a.latitude >= DLAT_MAX`, que é cerca de 0,0001799°
   e equivale a 20 m em latitude.
4. Para os pares que sobram, calcula a distância com Haversine. Se for menor que 20 m, registra
   o encontro e classifica.

O corte é seguro porque a distância entre dois pontos nunca é menor que a distância só no eixo
norte–sul (`R · Δlat`). Se a diferença de latitude já dá 20 m ou mais, a distância real também
dá. Como a lista está ordenada, todos os registros seguintes estão ainda mais longe.

Com isso, o custo por grupo cai de O(n²), comparando todos os pares, para
O(n log n + pares próximos). O resultado é o mesmo da comparação de todos com todos.

Tudo roda num único processo, percorrendo os grupos em sequência.

## Resultados

Saída do `npm start`, rodando os 7 datasets em sequência:

| dataset | registros  | timestamps | encontros | leitura (ms) | detecção (ms) | gabarito |
|--------:|-----------:|-----------:|----------:|-------------:|--------------:|:--------:|
| 1       | 5.000      | 500        | 4         | 288,84       | 1,56          | ok       |
| 2       | 25.000     | 1.250      | 6         | 301,11       | 2,79          | ok       |
| 3       | 100.000    | 2.500      | 10        | 504,10       | 9,70          | -        |
| 4       | 400.020    | 6.667      | 15        | 1.823,50     | 45,50         | -        |
| 5       | 1.000.000  | 12.500     | 21        | 4.440,54     | 104,23        | -        |
| 6       | 8.000.000  | 80.000     | 27        | 33.157,06    | 913,27        | -        |
| 7       | 12.000.000 | 100.000    | 35        | 49.996,16    | 3.140,16      | -        |

- **leitura:** download + parse em stream + agrupamento por timestamp.
- **detecção:** ordenação + comparação dentro de cada timestamp.
- **gabarito:** `ok` quando o resultado bate exatamente com `respostas<N>.json`. Só os datasets
  1 e 2 têm gabarito.

A leitura é a parte mais cara: no dataset 7, ela leva ~50 s, enquanto a detecção leva ~3 s.

## Estrutura

```
index.js              baixa o dataset, detecta, salva o JSON e confere com o gabarito (1 e 2)
benchmark.js          mede o tempo da detecção
streamTxt.js          download + parse em stream, agrupado por timestamp
encontrosOrdenado.js  detecção ordenada por latitude + classificação
haversine.js          fórmula de Haversine
saida/                JSONs gerados
```

## Formato da saída

```json
[{
  "tipo": "faccao",
  "monitoradosEncontro": [40, 44],
  "timestamp": "2024-01-01 00:01:50",
  "posicoes": {
    "40": { "lat": -10.07996, "lon": -37.08384 },
    "44": { "lat": -10.07987, "lon": -37.08389 }
  },
  "distanciaMetros": 11.406788673336607
}]
```
