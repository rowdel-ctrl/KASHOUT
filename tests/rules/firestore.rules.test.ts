// Run with: npm run test:rules   (starts the Firestore emulator; needs Java)
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { deleteDoc, doc, getDoc, getDocs, collection, setDoc, updateDoc, query, limit } from 'firebase/firestore';

let env: RulesTestEnvironment;

const rec = (uid: string, over: Record<string, unknown> = {}) => ({
  ref: '9047022665601', amount: 3500, fee: 40, name: 'MA***A R.', number: '09XXXXXXXXX',
  txAt: 1_700_000_000_000, savedAt: 1_700_000_100_000, by: 'Ana', byUid: uid, ...over,
});

const ana = (e: RulesTestEnvironment) => e.authenticatedContext('ana', { email: 'Ana@Example.com', email_verified: true }).firestore();
const stranger = (e: RulesTestEnvironment) => e.authenticatedContext('eve', { email: 'eve@example.com', email_verified: true }).firestore();
const unverified = (e: RulesTestEnvironment) => e.authenticatedContext('ana', { email: 'ana@example.com', email_verified: false }).firestore();

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'rules-test',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});
afterAll(async () => env.cleanup());
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'config', 'allowlist'), { emails: ['ana@example.com', 'ben@example.com'] });
    await setDoc(doc(db, 'records', 'existing'), rec('ben', { ref: '0046809244410' }));
  });
});

describe('allowlist', () => {
  it('lets an allowed, verified account read and save', async () => {
    const db = ana(env);
    await assertSucceeds(getDocs(query(collection(db, 'records'), limit(10))));
    await assertSucceeds(setDoc(doc(db, 'records', '9047022665601'), rec('ana')));
  });

  it('blocks a Google account that is not on the list', async () => {
    const db = stranger(env);
    await assertFails(getDocs(query(collection(db, 'records'), limit(10))));
    await assertFails(getDoc(doc(db, 'records', 'existing')));
    await assertFails(setDoc(doc(db, 'records', '9047022665601'), rec('eve')));
    await assertFails(deleteDoc(doc(db, 'records', 'existing')));
  });

  it('blocks a signed-out visitor and an unverified email', async () => {
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'records', 'existing')));
    await assertFails(getDoc(doc(unverified(env), 'records', 'existing')));
  });

  it('never exposes or changes the allowlist', async () => {
    const db = ana(env);
    await assertFails(getDoc(doc(db, 'config', 'allowlist')));
    await assertFails(setDoc(doc(db, 'config', 'allowlist'), { emails: ['eve@example.com'] }));
  });
});

describe('records', () => {
  it('rejects a second save of the same id (no duplicates)', async () => {
    const db = ana(env);
    await assertSucceeds(setDoc(doc(db, 'records', '9047022665601'), rec('ana')));
    await assertFails(setDoc(doc(db, 'records', '9047022665601'), rec('ana', { amount: 1 })));
  });

  it('cannot save as someone else, and cannot edit', async () => {
    const db = ana(env);
    await assertFails(setDoc(doc(db, 'records', 'a'), rec('ben')));
    await assertFails(updateDoc(doc(db, 'records', 'existing'), { amount: 1 }));
  });

  it('rejects bad data', async () => {
    const db = ana(env);
    await assertFails(setDoc(doc(db, 'records', 'a'), rec('ana', { amount: -5 })));
    await assertFails(setDoc(doc(db, 'records', 'b'), rec('ana', { amount: '3500' })));
    await assertFails(setDoc(doc(db, 'records', 'c'), { ...rec('ana'), extra: 1 }));
  });

  it('lets an allowed user delete (undo, delete record)', async () => {
    await assertSucceeds(deleteDoc(doc(ana(env), 'records', 'existing')));
  });
});

describe('shared settings', () => {
  it('lets an allowed user save the fee table, but nothing else', async () => {
    const db = ana(env);
    await assertSucceeds(setDoc(doc(db, 'shared', 'settings'), { feeTable: [{ upTo: 200, fee: 5 }] }));
    await assertFails(setDoc(doc(db, 'shared', 'other'), { feeTable: [{ upTo: 200, fee: 5 }] }));
    await assertFails(setDoc(doc(stranger(env), 'shared', 'settings'), { feeTable: [{ upTo: 200, fee: 5 }] }));
  });
});
