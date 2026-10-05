import { test } from "node:test";
import assert from "node:assert/strict";
import { InMemoryMemoryStore } from "../src/engine/memory.js";

test("short-term memory keeps recent turns, oldest → newest", () => {
  const m = new InMemoryMemoryStore(3);
  m.appendTurn("u1", { question: "q1", answer: "a1", at: 1 });
  m.appendTurn("u1", { question: "q2", answer: "a2", at: 2 });
  const turns = m.recentTurns("u1");
  assert.equal(turns.length, 2);
  assert.equal(turns[0].question, "q1");
  assert.equal(turns[1].question, "q2");
});

test("short-term memory is bounded to maxTurns (drops oldest)", () => {
  const m = new InMemoryMemoryStore(2);
  m.appendTurn("u1", { question: "q1", answer: "a1", at: 1 });
  m.appendTurn("u1", { question: "q2", answer: "a2", at: 2 });
  m.appendTurn("u1", { question: "q3", answer: "a3", at: 3 });
  const turns = m.recentTurns("u1");
  assert.equal(turns.length, 2);
  assert.equal(turns[0].question, "q2"); // q1 evicted
  assert.equal(turns[1].question, "q3");
});

test("memory is isolated per user", () => {
  const m = new InMemoryMemoryStore();
  m.appendTurn("u1", { question: "q1", answer: "a1", at: 1 });
  assert.equal(m.recentTurns("u2").length, 0);
});

test("long-term interests rank by frequency and exclude 'general'", () => {
  const m = new InMemoryMemoryStore();
  m.recordIntent("u1", "career");
  m.recordIntent("u1", "career");
  m.recordIntent("u1", "finance");
  m.recordIntent("u1", "general");
  const interests = m.interests("u1");
  assert.deepEqual(interests, ["career", "finance"]);
});

test("load() returns both short-term turns and long-term interests", () => {
  const m = new InMemoryMemoryStore();
  m.appendTurn("u1", { question: "q1", answer: "a1", at: 1 });
  m.recordIntent("u1", "health");
  const mem = m.load("u1");
  assert.equal(mem.recentTurns.length, 1);
  assert.deepEqual(mem.interests, ["health"]);
});
