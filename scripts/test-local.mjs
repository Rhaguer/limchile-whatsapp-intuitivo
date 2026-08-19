import { searchBenefits } from "../src/catalog.mjs";

const tests = [
  "¿Hay un beneficio dental?",
  "Necesito ir al dentista",
  "¿Tienen algo para una muela?",
  "Busco descuento para lentes",
  "Necesito anteojos"
];

for (const q of tests) {
  const result = await searchBenefits(q, "56900000000");
  console.log("\nCONSULTA:", q);
  console.log("RESULTADO:", result.items.map(x => x.title).join(" | ") || "SIN RESULTADOS");
}
