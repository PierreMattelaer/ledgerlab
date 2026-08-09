'use client';

import { FormEvent, useEffect, useState } from 'react';
import { api, API_URL } from '../lib/api';

type User = { id:number; organization_id:number; name:string; email:string; role:'employee'|'manager'|'admin' };
type Expense = { id:number; amount:string; currency:string; category:string; description:string; spent_at:string; status:string; employee_name:string };

const demoUsers = [
  ['Acme employee', 'alice@acme.test'],
  ['Acme manager', 'manny@acme.test'],
  ['Acme admin', 'ada@acme.test'],
  ['Globex employee', 'gina@globex.test'],
  ['Globex manager', 'gary@globex.test'],
  ['Globex admin', 'grace@globex.test']
];

export default function Home() {
  const [token, setToken] = useState('');
  const [user, setUser] = useState<User | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [admin, setAdmin] = useState<any>(null);
  const [error, setError] = useState('');

  async function login(email:string) {
    try {
      const result = await api<{token:string; user:User}>('/auth/login', undefined, { method:'POST', body:JSON.stringify({ email }) });
      setToken(result.token); setUser(result.user); setSelected(null); setAdmin(null); setError('');
    } catch (e:any) { setError(e.message); }
  }

  async function refresh() {
    if (!token) return;
    try { setExpenses(await api<Expense[]>('/expenses', token)); }
    catch (e:any) { setError(e.message); }
  }

  useEffect(() => { refresh(); }, [token]);

  async function createExpense(e:FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    try {
      await api('/expenses', token, { method:'POST', body:JSON.stringify({
        amount:Number(form.get('amount')), category:form.get('category'), description:form.get('description'), spentAt:form.get('spentAt') || undefined
      }) });
      e.currentTarget.reset(); await refresh();
    } catch (err:any) { setError(err.message); }
  }

  async function viewExpense(id:number) {
    try { setSelected(await api(`/expenses/${id}`, token)); } catch (e:any) { setError(e.message); }
  }

  async function decide(id:number, decision:'approved'|'rejected') {
    try { await api(`/expenses/${id}/decision`, token, { method:'POST', body:JSON.stringify({ decision, comment:'Synthetic demo decision' }) }); await refresh(); await viewExpense(id); }
    catch (e:any) { setError(e.message); }
  }

  async function uploadReceipt(e:FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (!selected) return;
    const body = new FormData(e.currentTarget);
    try { await api(`/expenses/${selected.id}/receipt`, token, { method:'POST', body }); await viewExpense(selected.id); e.currentTarget.reset(); }
    catch (err:any) { setError(err.message); }
  }

  async function loadAdmin() {
    try { setAdmin(await api('/admin/overview', token)); } catch (e:any) { setError(e.message); }
  }

  if (!user) return (
    <main className="shell">
      <div className="header"><div><div className="brand">LedgerLab</div><div className="muted">Synthetic multi-tenant expense management demo</div></div></div>
      <section className="card stack">
        <h2>Choose a demo identity</h2>
        <p className="muted">No passwords. Every account and expense is fake. Switch organizations to test tenant isolation.</p>
        <div className="login-grid">{demoUsers.map(([label,email]) => <button key={email} className="secondary" onClick={() => login(email)}>{label}<br/><span className="small">{email}</span></button>)}</div>
        {error && <p>{error}</p>}
      </section>
    </main>
  );

  return (
    <main className="shell">
      <div className="header">
        <div><div className="brand">LedgerLab</div><div className="muted">Signed in as {user.name} · {user.role}</div></div>
        <div className="row"><a className="small" href={`${API_URL}/docs`} target="_blank">OpenAPI docs</a><button className="secondary" onClick={() => { setUser(null); setToken(''); }}>Switch user</button></div>
      </div>
      {error && <div className="card" style={{marginBottom:20}}>{error}</div>}
      <div className="grid">
        <section className="card">
          <div className="row" style={{justifyContent:'space-between'}}><h2>Expenses</h2><button className="secondary" onClick={refresh}>Refresh</button></div>
          {expenses.map(x => <div className="expense" key={x.id} onClick={() => viewExpense(x.id)} style={{cursor:'pointer'}}><div><strong>{x.description}</strong><div className="small muted">{x.employee_name} · {x.category} · {x.spent_at}</div><span className="pill">{x.status}</span></div><div className="amount">{x.currency} {x.amount}</div></div>)}
          {!expenses.length && <p className="muted">No expenses visible for this user.</p>}
        </section>

        <section className="card stack">
          <h2>Create expense</h2>
          <form className="stack" onSubmit={createExpense}>
            <input name="amount" type="number" step="0.01" min="0.01" placeholder="Amount" required />
            <select name="category" required defaultValue=""><option value="" disabled>Category</option><option>Meals</option><option>Travel</option><option>Office</option><option>Software</option></select>
            <textarea name="description" placeholder="Description" required />
            <input name="spentAt" type="date" />
            <button type="submit">Create pending expense</button>
          </form>
        </section>

        <section className="card stack">
          <h2>Expense details</h2>
          {!selected ? <p className="muted">Select an expense.</p> : <>
            <div><strong>#{selected.id} · {selected.description}</strong></div>
            <div>{selected.currency} {selected.amount} · <span className="pill">{selected.status}</span></div>
            <div className="small muted">{selected.employee_name} · {selected.category} · {selected.spent_at}</div>
            <form className="stack" onSubmit={uploadReceipt}><input name="receipt" type="file" required/><button className="secondary">Upload receipt</button></form>
            {(user.role === 'manager' || user.role === 'admin') && <div className="row"><button onClick={() => decide(selected.id,'approved')}>Approve</button><button className="danger" onClick={() => decide(selected.id,'rejected')}>Reject</button></div>}
            <pre>{JSON.stringify({ receipts:selected.receipts, approvals:selected.approvals }, null, 2)}</pre>
          </>}
        </section>

        <section className="card stack">
          <h2>Admin overview</h2>
          {user.role !== 'admin' ? <p className="muted">Available only to organization admins.</p> : <><button onClick={loadAdmin}>Load overview</button>{admin && <pre>{JSON.stringify(admin, null, 2)}</pre>}</>}
        </section>
      </div>
    </main>
  );
}
