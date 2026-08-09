import fs from 'fs';
import path from 'path';
import request from 'supertest';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { pool } from '../src/db';
import { app } from '../src/app';

const dbUrl = process.env.TEST_DATABASE_URL;
if (!dbUrl) {
  console.warn('TEST_DATABASE_URL not set. Tests expect a PostgreSQL database, e.g. postgres://ledgerlab:ledgerlab@localhost:5432/ledgerlab_test');
}

async function login(email: string) {
  const response = await request(app).post('/auth/login').send({ email });
  return response.body.token as string;
}

beforeAll(async () => {
  if (dbUrl) {
    // The pool is created from DATABASE_URL, so point DATABASE_URL at the test DB before invoking vitest.
    const schema = fs.readFileSync(path.resolve(__dirname, '../schema.sql'), 'utf8');
    const seed = fs.readFileSync(path.resolve(__dirname, '../seed.sql'), 'utf8');
    await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
    await pool.query(schema);
    await pool.query(seed);
  }
});

afterAll(async () => pool.end());

describe('LedgerLab API', () => {
  it('logs in a seeded user', async () => {
    const res = await request(app).post('/auth/login').send({ email: 'alice@acme.test' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
  });

  it('creates and lists an expense', async () => {
    const token = await login('alice@acme.test');
    const created = await request(app)
      .post('/expenses')
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 19.99, category: 'Software', description: 'Synthetic SaaS subscription' });
    expect(created.status).toBe(201);

    const listed = await request(app).get('/expenses').set('Authorization', `Bearer ${token}`);
    expect(listed.status).toBe(200);
    expect(listed.body.some((e: any) => e.description === 'Synthetic SaaS subscription')).toBe(true);
  });

  it('allows a manager to approve an expense', async () => {
    const employeeToken = await login('alice@acme.test');
    const managerToken = await login('manny@acme.test');
    const created = await request(app)
      .post('/expenses')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ amount: 25, category: 'Office', description: 'Synthetic keyboard' });

    const decision = await request(app)
      .post(`/expenses/${created.body.id}/decision`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ decision: 'approved', comment: 'Looks good' });

    expect(decision.status).toBe(200);
    expect(decision.body.status).toBe('approved');
  });

  it('prevents cross-tenant expense access', async () => {
    const acmeToken = await login('alice@acme.test');
    const globexManagerToken = await login('gary@globex.test');
    const created = await request(app)
      .post('/expenses')
      .set('Authorization', `Bearer ${acmeToken}`)
      .send({ amount: 50, category: 'Travel', description: 'Synthetic taxi' });

    const res = await request(app)
      .get(`/expenses/${created.body.id}`)
      .set('Authorization', `Bearer ${globexManagerToken}`);
    expect(res.status).toBe(404);
  });

  it('restricts admin overview to admins', async () => {
    const employeeToken = await login('alice@acme.test');
    const adminToken = await login('ada@acme.test');

    expect((await request(app).get('/admin/overview').set('Authorization', `Bearer ${employeeToken}`)).status).toBe(403);
    expect((await request(app).get('/admin/overview').set('Authorization', `Bearer ${adminToken}`)).status).toBe(200);
  });
});
