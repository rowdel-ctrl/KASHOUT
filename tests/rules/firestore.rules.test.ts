// Run with: npm run test:rules   (starts the Firestore emulator; needs Java)
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { deleteDoc, deleteField, doc, getDoc, getDocs, collection, setDoc, updateDoc, query, limit } from 'firebase/firestore';

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
    await setDoc(doc(db, 'records', 'existing'), rec('ben', { ref: '0046809244410', savedAt: Date.now() }));
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

  it('lets the person who saved a record delete it (undo, delete)', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'records', 'mine'), rec('ana'));
    });
    await assertSucceeds(deleteDoc(doc(ana(env), 'records', 'mine')));
  });

  it('does not let someone else delete a record', async () => {
    await assertFails(deleteDoc(doc(ana(env), 'records', 'existing'))); // saved by ben
  });

  it('lets anyone on the list delete a record older than one year', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'records', 'old'), rec('ben', { savedAt: Date.now() - 400 * 86_400_000 }));
      await setDoc(doc(ctx.firestore(), 'records', 'recent'), rec('ben', { savedAt: Date.now() - 300 * 86_400_000 }));
    });
    await assertSucceeds(deleteDoc(doc(ana(env), 'records', 'old')));
    await assertFails(deleteDoc(doc(ana(env), 'records', 'recent')));
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

describe('alert topic', () => {
  const topic = 'kashawt-0123456789abcdef01234567';

  it('the first allowed phone creates it and everyone allowed can read it', async () => {
    await assertSucceeds(setDoc(doc(ana(env), 'shared', 'alerts'), { topic }));
    await assertSucceeds(getDoc(doc(ana(env), 'shared', 'alerts')));
  });

  it('cannot be changed once it exists', async () => {
    await assertSucceeds(setDoc(doc(ana(env), 'shared', 'alerts'), { topic }));
    await assertFails(setDoc(doc(ana(env), 'shared', 'alerts'), { topic: 'kashawt-ffffffffffffffffffffffff' }));
  });

  it('is blocked for accounts not on the list, and for short or odd values', async () => {
    await assertFails(setDoc(doc(stranger(env), 'shared', 'alerts'), { topic }));
    await assertFails(getDoc(doc(stranger(env), 'shared', 'alerts')));
    await assertFails(setDoc(doc(ana(env), 'shared', 'alerts'), { topic: 'short' }));
    await assertFails(setDoc(doc(ana(env), 'shared', 'alerts'), { topic, extra: 1 }));
  });
});

describe('photos', () => {
  const photo = (uid: string, over: Record<string, unknown> = {}) => ({ data: 'data:image/jpeg;base64,AAAA', byUid: uid, savedAt: Date.now(), ...over });

  it('an allowed user can save and read a photo', async () => {
    await assertSucceeds(setDoc(doc(ana(env), 'photos', 'r1'), photo('ana')));
    await assertSucceeds(getDoc(doc(ana(env), 'photos', 'r1')));
  });

  it('blocked for accounts not on the list', async () => {
    await assertFails(setDoc(doc(stranger(env), 'photos', 'r1'), photo('eve')));
    await env.withSecurityRulesDisabled(async (ctx) => setDoc(doc(ctx.firestore(), 'photos', 'r1'), photo('ana')));
    await assertFails(getDoc(doc(stranger(env), 'photos', 'r1')));
  });

  it('cannot save as someone else, cannot be edited, and has a size limit', async () => {
    await assertFails(setDoc(doc(ana(env), 'photos', 'r1'), photo('ben')));
    await assertSucceeds(setDoc(doc(ana(env), 'photos', 'r2'), photo('ana')));
    await assertFails(setDoc(doc(ana(env), 'photos', 'r2'), photo('ana', { data: 'x' })));
    await assertFails(setDoc(doc(ana(env), 'photos', 'big'), photo('ana', { data: 'x'.repeat(200001) })));
    await assertFails(setDoc(doc(ana(env), 'photos', 'extra'), { ...photo('ana'), more: 1 }));
  });

  it('only the person who saved it can delete it; a missing photo can be deleted; old ones go', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'photos', 'mine'), photo('ana'));
      await setDoc(doc(ctx.firestore(), 'photos', 'bens'), photo('ben'));
      await setDoc(doc(ctx.firestore(), 'photos', 'old'), photo('ben', { savedAt: Date.now() - 400 * 86_400_000 }));
    });
    await assertSucceeds(deleteDoc(doc(ana(env), 'photos', 'mine')));
    await assertFails(deleteDoc(doc(ana(env), 'photos', 'bens')));
    await assertSucceeds(deleteDoc(doc(ana(env), 'photos', 'old')));
    await assertSucceeds(deleteDoc(doc(ana(env), 'photos', 'never-existed')));
  });
});

describe('pending and paid', () => {
  const pending = (uid: string, over: Record<string, unknown> = {}) => rec(uid, { status: 'pending', savedAt: Date.now(), ...over });
  const paidFields = (uid: string, name = 'Ben') => ({ status: 'paid', paidBy: name, paidByUid: uid, paidAt: Date.now() });

  it('a pending record can be saved, but not with paid details already filled in', async () => {
    await assertSucceeds(setDoc(doc(ana(env), 'records', 'p1'), pending('ana')));
    await assertFails(setDoc(doc(ana(env), 'records', 'p2'), { ...pending('ana'), paidBy: 'Ana' }));
    await assertFails(setDoc(doc(ana(env), 'records', 'p3'), pending('ana', { status: 'maybe' })));
  });

  it('anyone on the list can mark a pending record as paid', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => setDoc(doc(ctx.firestore(), 'records', 'p1'), pending('ben')));
    await assertSucceeds(updateDoc(doc(ana(env), 'records', 'p1'), paidFields('ana', 'Ana')));
  });

  it('marking as paid cannot change anything else', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => setDoc(doc(ctx.firestore(), 'records', 'p1'), pending('ben')));
    await assertFails(updateDoc(doc(ana(env), 'records', 'p1'), { ...paidFields('ana', 'Ana'), amount: 1 }));
    await assertFails(updateDoc(doc(ana(env), 'records', 'p1'), { ...paidFields('ana', 'Ana'), by: 'Someone' }));
  });

  it('cannot be marked as paid in someone else\'s name, or half-filled', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => setDoc(doc(ctx.firestore(), 'records', 'p1'), pending('ben')));
    await assertFails(updateDoc(doc(ana(env), 'records', 'p1'), paidFields('ben', 'Ben')));
    await assertFails(updateDoc(doc(ana(env), 'records', 'p1'), { status: 'paid' }));
  });

  it('a paid record cannot be changed or put back to pending, and old records (no status) are paid', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'records', 'done'), rec('ben', { status: 'paid', savedAt: Date.now() }));
      await setDoc(doc(ctx.firestore(), 'records', 'old'), rec('ben', { savedAt: Date.now() }));
    });
    await assertFails(updateDoc(doc(ana(env), 'records', 'done'), paidFields('ana', 'Ana')));
    await assertFails(updateDoc(doc(ana(env), 'records', 'done'), { status: 'pending' }));
    await assertFails(updateDoc(doc(ana(env), 'records', 'old'), paidFields('ana', 'Ana')));
  });

  it('accounts not on the list cannot mark anything as paid', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => setDoc(doc(ctx.firestore(), 'records', 'p1'), pending('ben')));
    await assertFails(updateDoc(doc(stranger(env), 'records', 'p1'), paidFields('eve', 'Eve')));
  });

  it('only the person who saved a pending record can delete it', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => setDoc(doc(ctx.firestore(), 'records', 'p1'), pending('ben')));
    await assertFails(deleteDoc(doc(ana(env), 'records', 'p1')));
  });
});


describe('undo mark as paid', () => {
  const paidBy = (uid: string, at: number) => ({ status: 'paid', paidBy: 'Ana', paidByUid: uid, paidAt: at });
  const back = { status: 'pending', paidBy: deleteField(), paidByUid: deleteField(), paidAt: deleteField() };

  it('the person who marked it paid can undo it within 2 minutes', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => setDoc(doc(ctx.firestore(), 'records', 'p1'), rec('ben', { savedAt: Date.now(), ...paidBy('ana', Date.now() - 30_000) })));
    await assertSucceeds(updateDoc(doc(ana(env), 'records', 'p1'), back));
  });

  it('not after 2 minutes, and not by someone else', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'records', 'late'), rec('ben', { savedAt: Date.now(), ...paidBy('ana', Date.now() - 300_000) }));
      await setDoc(doc(ctx.firestore(), 'records', 'other'), rec('ana', { savedAt: Date.now(), ...paidBy('ben', Date.now() - 30_000) }));
    });
    await assertFails(updateDoc(doc(ana(env), 'records', 'late'), back));
    await assertFails(updateDoc(doc(ana(env), 'records', 'other'), back));
  });

  it('undo cannot change anything else', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => setDoc(doc(ctx.firestore(), 'records', 'p1'), rec('ben', { savedAt: Date.now(), ...paidBy('ana', Date.now() - 30_000) })));
    await assertFails(updateDoc(doc(ana(env), 'records', 'p1'), { ...back, amount: 1 }));
  });
});

describe('edit a record', () => {
  const entry = (uid: string) => ({ at: Date.now(), by: 'Ana', byUid: uid, changes: [{ f: 'amount', from: 3500, to: 3000 }] });
  const mine = (over: Record<string, unknown> = {}) => rec('ana', { savedAt: Date.now(), ...over });
  const seed = async (over: Record<string, unknown> = {}) =>
    env.withSecurityRulesDisabled(async (ctx) => setDoc(doc(ctx.firestore(), 'records', 'mine'), mine(over)));

  it('the person who saved it can change it, and the change is added to the history', async () => {
    await seed();
    await assertSucceeds(updateDoc(doc(ana(env), 'records', 'mine'), { amount: 3000, name: 'Ana R.', history: [entry('ana')], editedAt: Date.now() }));
    await assertSucceeds(updateDoc(doc(ana(env), 'records', 'mine'), { ref: '1111222233334', history: [entry('ana'), entry('ana')], editedAt: Date.now() }));
  });

  it('someone else cannot edit it', async () => {
    await seed();
    await env.withSecurityRulesDisabled(async (ctx) => setDoc(doc(ctx.firestore(), 'records', 'bens'), rec('ben', { savedAt: Date.now() })));
    await assertFails(updateDoc(doc(ana(env), 'records', 'bens'), { amount: 3000, history: [entry('ana')], editedAt: Date.now() }));
    await assertFails(updateDoc(doc(stranger(env), 'records', 'mine'), { amount: 3000, history: [entry('eve')], editedAt: Date.now() }));
  });

  it('a change without a new history entry is refused, and history cannot be rewritten', async () => {
    await seed({ history: [entry('ana')] });
    await assertFails(updateDoc(doc(ana(env), 'records', 'mine'), { amount: 3000, editedAt: Date.now() }));
    await assertFails(updateDoc(doc(ana(env), 'records', 'mine'), { amount: 3000, history: [entry('ana')], editedAt: Date.now() })); // still 1 entry
    await assertFails(updateDoc(doc(ana(env), 'records', 'mine'), { amount: 3000, history: [entry('ana'), entry('ana'), entry('ana')], editedAt: Date.now() })); // 2 new at once
    await assertFails(updateDoc(doc(ana(env), 'records', 'mine'), { amount: 3000, history: [entry('ben'), entry('ben')], editedAt: Date.now() })); // not signed by me
  });

  it('cannot change who saved it, when, the status, or the paid details', async () => {
    await seed();
    const h = { history: [entry('ana')], editedAt: Date.now() };
    await assertFails(updateDoc(doc(ana(env), 'records', 'mine'), { by: 'Ben', ...h }));
    await assertFails(updateDoc(doc(ana(env), 'records', 'mine'), { byUid: 'ben', ...h }));
    await assertFails(updateDoc(doc(ana(env), 'records', 'mine'), { savedAt: 1, ...h }));
    await assertFails(updateDoc(doc(ana(env), 'records', 'mine'), { status: 'pending', ...h }));
    await assertFails(updateDoc(doc(ana(env), 'records', 'mine'), { paidBy: 'Ana', ...h }));
    await assertFails(updateDoc(doc(ana(env), 'records', 'mine'), { thumb: 'x', ...h }));
  });

  it('refuses bad values', async () => {
    await seed();
    const h = { history: [entry('ana')], editedAt: Date.now() };
    await assertFails(updateDoc(doc(ana(env), 'records', 'mine'), { amount: -1, ...h }));
    await assertFails(updateDoc(doc(ana(env), 'records', 'mine'), { amount: '3000', ...h }));
    await assertFails(updateDoc(doc(ana(env), 'records', 'mine'), { ref: '', ...h }));
    await assertFails(updateDoc(doc(ana(env), 'records', 'mine'), { name: 'x'.repeat(81), ...h }));
    await assertFails(updateDoc(doc(ana(env), 'records', 'mine'), { fee: -5, ...h }));
  });

  it('works on a paid record too', async () => {
    await seed({ status: 'paid' });
    await assertSucceeds(updateDoc(doc(ana(env), 'records', 'mine'), { fee: 50, history: [entry('ana')], editedAt: Date.now() }));
  });
});
