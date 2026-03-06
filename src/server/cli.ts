import { ingestAllSources } from "./pipeline";
import { publishApprovedItems } from "./repository";
import { ensureStorage } from "./storage";

async function main(): Promise<void> {
  await ensureStorage();
  const command = process.argv[2];

  if (command === "ingest") {
    const result = await ingestAllSources();
    console.log(`Ingested review items: ${result.added}`);
    return;
  }

  if (command === "publish") {
    const result = await publishApprovedItems();
    console.log(`Published ${result.count} items (${result.version})`);
    return;
  }

  console.error("Unknown command. Use: ingest | publish");
  process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
