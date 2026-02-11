var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/index.ts
import {
  WorkflowEntrypoint
} from "cloudflare:workers";
var BackupWorkflow = class extends WorkflowEntrypoint {
  static {
    __name(this, "BackupWorkflow");
  }
  async run(event, step) {
    const { accountId, databaseId } = event.payload;
    const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/export`;
    const method = "POST";
    const headers = new Headers();
    headers.append("Content-Type", "application/json");
    headers.append("Authorization", `Bearer ${this.env.D1_REST_API_TOKEN}`);
    const bookmark = await step.do(
      `Iniciando backup D1 para ${databaseId}`,
      async () => {
        const payload = { output_format: "polling" };
        const res = await fetch(url, {
          method,
          headers,
          body: JSON.stringify(payload)
        });
        const json = await res.json();
        const result = json.result;
        if (!result?.at_bookmark) {
          throw new Error(
            `Fallo al iniciar exportaci\xF3n: ${JSON.stringify(json)}`
          );
        }
        return result.at_bookmark;
      }
    );
    await step.do("Obtener dump y guardar en R2", async () => {
      const payload = { current_bookmark: bookmark };
      const res = await fetch(url, {
        method,
        headers,
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      const result = json.result;
      if (!result?.signed_url) {
        throw new Error(
          `Dump a\xFAn no disponible (polling): ${JSON.stringify(json)}`
        );
      }
      const dumpResponse = await fetch(result.signed_url);
      if (!dumpResponse.ok) {
        throw new Error("Error al descargar el dump de D1");
      }
      const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
      const objectKey = `backup-${today}.sql`;
      await this.env.BACKUP_BUCKET.put(objectKey, dumpResponse.body);
      return { saved: objectKey };
    });
  }
};
var index_default = {
  async fetch(_req, env) {
    return new Response("Backup worker. Use Cron o triggers.", { status: 404 });
  },
  async scheduled(_controller, env, _ctx) {
    const params = {
      accountId: env.ACCOUNT_ID,
      databaseId: env.DATABASE_ID
    };
    const instance = await env.BACKUP_WORKFLOW.create({ params });
    console.log(`Workflow de backup iniciado: ${instance.id}`);
  }
};
export {
  BackupWorkflow,
  index_default as default
};
//# sourceMappingURL=index.js.map
