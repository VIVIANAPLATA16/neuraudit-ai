import { Client } from "@elastic/elasticsearch";
import * as dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../.env.local") });

const client = new Client({
  node: process.env.ELASTIC_ENDPOINT,
  auth: { apiKey: process.env.ELASTIC_API_KEY },
});

const INDEX = "secop-contratos";

async function createIndex() {
  const exists = await client.indices.exists({ index: INDEX });
  if (!exists) {
    await client.indices.create({
      index: INDEX,
      mappings: {
        properties: {
          objeto: { type: "text", analyzer: "spanish" },
          entidad: { type: "keyword" },
          contratista: { type: "keyword" },
          valor: { type: "double" },
          modalidad: { type: "keyword" },
          fecha_firma: { type: "date" },
          estado: { type: "keyword" },
          departamento: { type: "keyword" },
          texto_completo: { type: "text", analyzer: "spanish" },
        },
      },
    });
    console.log("Índice creado:", INDEX);
  }
}

async function fetchSecop(offset = 0, limit = 1000) {
  const url = `https://www.datos.gov.co/resource/jbjy-vk9h.json?$limit=${limit}&$offset=${offset}&$order=fecha_de_firma DESC`;
  const res = await fetch(url);
  return await res.json();
}

async function indexBatch(contratos) {
  if (!contratos.length) return 0;
  const ops = contratos.flatMap((c) => [
    { index: { _index: INDEX } },
    {
      objeto: c.objeto_del_contrato || c.descripcion_del_proceso || "",
      entidad: c.nombre_entidad || "",
      contratista: c.proveedor_adjudicado || "",
      valor: parseFloat(c.valor_del_contrato) || 0,
      modalidad: c.modalidad_de_contratacion || "",
      fecha_firma: c.fecha_de_firma || null,
      estado: c.estado_contrato || "",
      departamento: c.departamento || "",
      texto_completo: [
        c.objeto_del_contrato,
        c.descripcion_del_proceso,
        c.nombre_entidad,
        c.proveedor_adjudicado,
        c.modalidad_de_contratacion,
      ].filter(Boolean).join(" "),
    },
  ]);
  const result = await client.bulk({ operations: ops });
  return contratos.length - (result.errors ? 1 : 0);
}

async function main() {
  console.log("Conectando a Elastic...");
  await createIndex();
  let total = 0;
  const batches = 5;
  for (let i = 0; i < batches; i++) {
    console.log(`Descargando batch ${i + 1}/${batches}...`);
    const data = await fetchSecop(i * 1000, 1000);
    if (!data.length) break;
    const indexed = await indexBatch(data);
    total += indexed;
    console.log(`Indexados: ${total} contratos`);
  }
  console.log(`Total indexado: ${total} contratos en Elastic`);
}

main().catch(console.error);
