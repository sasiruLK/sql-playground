import type { QueryResult, SandboxStorage, TableInfo } from "@/lib/types";

type WorkerReply = {
  id: number;
  ok: boolean;
  error?: string;
  storage?: SandboxStorage;
  storageReason?: string | null;
  schema?: TableInfo[];
  result?: QueryResult;
};

export type SandboxSnapshot = {
  storage: SandboxStorage;
  /** Set only in `memory` mode: why this browser could not persist the Sandbox. */
  storageReason: string | null;
  schema: TableInfo[];
};

/**
 * A student's private database, running in a worker in this browser.
 *
 * Every call resolves against the live schema, so callers never have to
 * re-introspect after a query changes the tables.
 */
export class Sandbox {
  #worker: Worker;
  #pending = new Map<
    number,
    { resolve: (reply: WorkerReply) => void; reject: (error: Error) => void }
  >();
  #nextId = 1;

  private constructor() {
    this.#worker = new Worker("/sandbox-worker.js", { type: "module" });

    this.#worker.onmessage = (event: MessageEvent<WorkerReply>) => {
      const pending = this.#pending.get(event.data.id);
      if (!pending) return;

      this.#pending.delete(event.data.id);
      pending.resolve(event.data);
    };

    this.#worker.onerror = (event) => {
      const failure = new Error(
        event.message || "The database engine failed to start.",
      );

      for (const pending of this.#pending.values()) {
        pending.reject(failure);
      }
      this.#pending.clear();
    };
  }

  static open(): { sandbox: Sandbox; ready: Promise<SandboxSnapshot> } {
    const sandbox = new Sandbox();
    return { sandbox, ready: sandbox.#snapshot("init") };
  }

  async query(sql: string): Promise<{ result: QueryResult; schema: TableInfo[] }> {
    const reply = await this.#send({ type: "query", sql });
    return { result: reply.result!, schema: reply.schema! };
  }

  /** Discards the student's changes and restores the pristine Seed. */
  reset(): Promise<SandboxSnapshot> {
    return this.#snapshot("reset");
  }

  /**
   * Releases the OPFS lock before tearing the worker down, so the next Sandbox
   * in this browser can open the saved database immediately. Terminating
   * without this leaves the handles held for an unpredictable while.
   */
  close() {
    const terminate = () => this.#worker.terminate();

    this.#send({ type: "release" })
      .then(terminate)
      .catch(terminate);

    // Never let a wedged worker outlive the page.
    setTimeout(terminate, 2000);
  }

  async #snapshot(type: "init" | "reset"): Promise<SandboxSnapshot> {
    const reply = await this.#send({ type });
    return {
      storage: reply.storage!,
      storageReason: reply.storageReason ?? null,
      schema: reply.schema!,
    };
  }

  #send(request: { type: string; sql?: string }): Promise<WorkerReply> {
    const id = this.#nextId++;

    return new Promise<WorkerReply>((resolve, reject) => {
      this.#pending.set(id, { resolve, reject });
      this.#worker.postMessage({ id, ...request });
    }).then((reply) => {
      if (!reply.ok) {
        throw new Error(reply.error ?? "The query failed.");
      }
      return reply;
    });
  }
}
