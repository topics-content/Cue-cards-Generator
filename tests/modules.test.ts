import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// A tiny fake of the PostgREST query builder, recording what createDeck writes.
const st = { savedName: null as string | null, tableMissing: false, inserted: null as Record<string, unknown> | null, upserts: [] as unknown[] };

function chain(table: string, op = ""): unknown {
  const b: Record<string, unknown> = {};
  const self = new Proxy(b, {
    get: (_t, prop: string) => {
      if (prop === "upsert") return (row: unknown) => { st.upserts.push(row); return Promise.resolve({ error: st.tableMissing ? { message: 'relation "modules" does not exist' } : null }); };
      if (prop === "insert") return (row: Record<string, unknown>) => { st.inserted = row; return chain(table, "insert"); };
      if (prop === "maybeSingle") return () => Promise.resolve({ data: st.savedName ? { name: st.savedName } : null, error: null });
      if (prop === "single") return () => Promise.resolve({ data: { id: "deck-1" }, error: null });
      return () => self; // select / eq / order ...
    },
  });
  void op;
  return self;
}
vi.mock("@/lib/db", () => ({ db: () => ({ from: (t: string) => chain(t) }) }));

import { createDeck } from "@/lib/decks";

const deck = (module: string) => createDeck({ createdBy: "a@scaler.com", program: "AIML", module, className: "C", inputType: "md", model: "m", sourceChars: 1, sourceMd: "x" });
beforeEach(() => Object.assign(st, { savedName: null, tableMissing: false, inserted: null, upserts: [] }));
vi.spyOn(console, "warn").mockImplementation(() => {});

describe("saved modules per Program", () => {
  it("saves a new module with tidy whitespace, per Program", async () => {
    st.savedName = "Deep learning & neural network";
    await deck("  Deep learning  &  neural network ");
    expect(st.upserts[0]).toMatchObject({ program: "AIML", name: "Deep learning & neural network", name_normalized: "deep learning & neural network", created_by: "a@scaler.com" });
  });

  it("reuses the first spelling: typing 'react basics' when 'React Basics' exists", async () => {
    st.savedName = "React Basics";
    const r = await deck("react basics");
    expect(r.module).toBe("React Basics");
    expect(st.inserted).toMatchObject({ module: "React Basics", module_normalized: "react basics" });
  });

  it("still creates the cue cards if the modules table doesn't exist yet", async () => {
    st.tableMissing = true;
    st.savedName = null;
    const r = await deck("Backprop  Basics");
    expect(r).toEqual({ id: "deck-1", module: "Backprop Basics" });
    expect(st.inserted).toMatchObject({ module_normalized: "backprop basics" });
  });
});
