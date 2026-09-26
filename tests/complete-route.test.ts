import { beforeEach, describe, expect, it, vi } from "vitest";

// Real route handler, with auth and storage replaced by in-memory fakes. lib/validateCards is
// real (pure, no I/O) so these tests exercise the actual validation gate, not a mocked verdict.
const state = {
  status: "done" as "done" | "pending" | "failed" | "budget_exceeded",
  reviewStatus: "draft" as "draft" | "completed",
  outputMd: "",
  editedOutputMd: null as string | null,
  owner: "a@scaler.com",
  user: "a@scaler.com",
  admin: false,
  saveCalls: [] as string[],
};

vi.mock("@/lib/auth", () => ({
  requireUser: async () => ({ user: { email: state.user, name: null, isAdmin: state.admin } }),
}));
vi.mock("@/lib/decks", () => ({
  getDeckForReview: async () => ({
    id: "d1",
    created_by: state.owner,
    status: state.status,
    review_status: state.reviewStatus,
    output_md: state.outputMd,
    edited_output_md: state.editedOutputMd,
  }),
  saveEditedOutput: async (_id: string, markdown: string) => {
    state.editedOutputMd = markdown;
    state.saveCalls.push(markdown);
  },
  setReviewStatus: async (_id: string, status: "draft" | "completed") => {
    state.reviewStatus = status;
  },
}));

import { POST as complete } from "@/app/api/decks/[id]/complete/route";

const VALID = `---
title: Introduction to Arrays
description: Optional description for introduction to arrays slide
duration: 300
card_type: cue_card
---

# Introduction to Arrays

Topics covered in this class
- How are arrays stored`;

const INVALID = "---\ntitle: Bad\n---\n"; // missing description/duration/card_type -> validator errors

const req = (body: unknown) => new Request("http://x/api/decks/d1/complete", { method: "POST", body: JSON.stringify(body) });
const params = { params: { id: "d1" } };

beforeEach(() => {
  state.status = "done";
  state.reviewStatus = "draft";
  state.outputMd = ""; // distinct from the edits below, so "changed from what's saved" is meaningful
  state.editedOutputMd = null;
  state.owner = "a@scaler.com";
  state.user = "a@scaler.com";
  state.admin = false;
  state.saveCalls = [];
});

describe("POST /api/decks/[id]/complete — save", () => {
  it("persists a clean edit and marks the deck completed", async () => {
    const res = await complete(req({ action: "save", markdown: VALID }), params);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.reviewStatus).toBe("completed");
    expect(body.savedMarkdown).toBe(VALID);
    expect(state.saveCalls).toEqual([VALID]);
  });

  it("still persists an edit with validator errors, but leaves review status as draft", async () => {
    const res = await complete(req({ action: "save", markdown: INVALID }), params);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.reviewStatus).toBe("draft");
    expect(body.result.totalErrors).toBeGreaterThan(0);
    expect(state.saveCalls).toEqual([INVALID]); // saved despite the errors — this is the point of the change
  });

  it("drops an already-completed deck back to draft if the newly saved edit has errors", async () => {
    state.reviewStatus = "completed";
    const res = await complete(req({ action: "save", markdown: INVALID }), params);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.reviewStatus).toBe("draft");
  });

  it("doesn't re-save when the submitted markdown matches what's already saved", async () => {
    state.editedOutputMd = VALID;
    const res = await complete(req({ action: "save", markdown: VALID }), params);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.savedMarkdown).toBeUndefined();
    expect(state.saveCalls).toEqual([]);
  });

  it("refuses to save while generation isn't finished", async () => {
    state.status = "pending";
    const res = await complete(req({ action: "save", markdown: VALID }), params);
    expect(res.status).toBe(409);
    expect(state.saveCalls).toEqual([]);
  });

  it("rejects a request with no markdown", async () => {
    const res = await complete(req({ action: "save" }), params);
    expect(res.status).toBe(400);
  });

  it("404s for someone who isn't the owner or an admin", async () => {
    state.user = "someone-else@scaler.com";
    const res = await complete(req({ action: "save", markdown: VALID }), params);
    expect(res.status).toBe(404);
  });
});

describe("POST /api/decks/[id]/complete — revert", () => {
  it("always succeeds and sets review status to draft, regardless of generation status", async () => {
    state.status = "pending";
    state.reviewStatus = "completed";
    const res = await complete(req({ action: "revert" }), params);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.reviewStatus).toBe("draft");
  });
});
