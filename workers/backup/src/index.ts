/**
 * Worker de backup automático D1 → R2
 * Ejecutado diariamente por Cron Trigger (0 0 * * * = medianoche UTC)
 */
import {
  WorkflowEntrypoint,
  WorkflowStep,
  WorkflowEvent,
} from "cloudflare:workers";

type Env = {
  BACKUP_WORKFLOW: Workflow;
  D1_REST_API_TOKEN: string;
  BACKUP_BUCKET: R2Bucket;
  ACCOUNT_ID: string;
  DATABASE_ID: string;
};

type Params = {
  accountId: string;
  databaseId: string;
};

export class BackupWorkflow extends WorkflowEntrypoint<Env, Params> {
  async run(event: WorkflowEvent<Params>, step: WorkflowStep) {
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
          body: JSON.stringify(payload),
        });
        const json = (await res.json()) as { result?: { at_bookmark?: string } };
        const result = json.result;
        if (!result?.at_bookmark) {
          throw new Error(
            `Fallo al iniciar exportación: ${JSON.stringify(json)}`
          );
        }
        return result.at_bookmark;
      }
    );

    await step.do("Obtener dump y guardar en R2", async () => {
      const payload = { output_format: "polling", current_bookmark: bookmark };
      const res = await fetch(url, {
        method,
        headers,
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as {
        result?: {
          result?: { signed_url?: string; filename?: string };
          status?: string;
        };
      };
      const exportResult = json.result?.result;
      const signedUrl = exportResult?.signed_url;
      if (!signedUrl) {
        throw new Error(
          `Dump aún no disponible (polling): ${JSON.stringify(json)}`
        );
      }

      const dumpResponse = await fetch(signedUrl);
      if (!dumpResponse.ok) {
        throw new Error("Error al descargar el dump de D1");
      }

      const today = new Date().toISOString().slice(0, 10);
      const objectKey = `backup-${today}.sql`;

      await this.env.BACKUP_BUCKET.put(objectKey, dumpResponse.body);

      const toDelete: string[] = [];
      let truncated = true;
      let cursor: string | undefined;
      while (truncated) {
        const list = await this.env.BACKUP_BUCKET.list({
          prefix: "backup-",
          cursor,
          limit: 1000,
        });
        for (const obj of list.objects) {
          if (obj.key !== objectKey) toDelete.push(obj.key);
        }
        truncated = list.truncated;
        cursor = list.cursor;
      }
      if (toDelete.length > 0) {
        for (let i = 0; i < toDelete.length; i += 1000) {
          await this.env.BACKUP_BUCKET.delete(toDelete.slice(i, i + 1000));
        }
      }

      return { saved: objectKey, deleted: toDelete.length };
    });
  }
}

export default {
  async fetch(_req: Request, env: Env): Promise<Response> {
    return new Response("Backup worker. Use Cron o triggers.", { status: 404 });
  },

  async scheduled(
    _controller: ScheduledController,
    env: Env,
    _ctx: ExecutionContext
  ): Promise<void> {
    const params: Params = {
      accountId: env.ACCOUNT_ID,
      databaseId: env.DATABASE_ID,
    };
    const instance = await env.BACKUP_WORKFLOW.create({ params });
    console.log(`Workflow de backup iniciado: ${instance.id}`);
  },
};
