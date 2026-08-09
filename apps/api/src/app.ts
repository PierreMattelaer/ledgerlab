import cors from 'cors';
import express from 'express';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yaml';
import { pool } from './db';
import { requireAuth, requireRole, signToken } from './auth';

const uploadDir = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });
const upload = multer({ dest: uploadDir, limits: { fileSize: 5 * 1024 * 1024 } });

export const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => res.json({ ok: true }));

app.post('/auth/login', async (req, res) => {
  const { email } = req.body as { email?: string };
  if (!email) return res.status(400).json({ error: 'email is required' });

  const { rows } = await pool.query(
    `SELECT id, organization_id, role, email, name FROM users WHERE email = $1`,
    [email]
  );
  if (!rows[0]) return res.status(401).json({ error: 'Unknown demo user' });

  const user = rows[0];
  const token = signToken({
    id: user.id,
    organizationId: user.organization_id,
    role: user.role,
    email: user.email
  });
  res.json({ token, user });
});

app.get('/expenses', requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT e.*, u.name AS employee_name
     FROM expenses e
     JOIN users u ON u.id = e.user_id
     WHERE e.organization_id = $1
       AND ($2::text IN ('manager','admin') OR e.user_id = $3)
     ORDER BY e.created_at DESC`,
    [req.user!.organizationId, req.user!.role, req.user!.id]
  );
  res.json(rows);
});

app.post('/expenses', requireAuth, async (req, res) => {
  const { amount, currency = 'EUR', category, description, spentAt } = req.body;
  if (!amount || !category || !description) {
    return res.status(400).json({ error: 'amount, category and description are required' });
  }

  const { rows } = await pool.query(
    `INSERT INTO expenses (organization_id, user_id, amount, currency, category, description, spent_at, status)
     VALUES ($1,$2,$3,$4,$5,$6,COALESCE($7::date,CURRENT_DATE),'pending') RETURNING *`,
    [req.user!.organizationId, req.user!.id, amount, currency, category, description, spentAt || null]
  );
  res.status(201).json(rows[0]);
});

app.get('/expenses/:id', requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT e.*, u.name AS employee_name,
      COALESCE(json_agg(DISTINCT jsonb_build_object('id', r.id, 'fileName', r.file_name, 'createdAt', r.created_at))
        FILTER (WHERE r.id IS NOT NULL), '[]') AS receipts,
      COALESCE(json_agg(DISTINCT jsonb_build_object('id', a.id, 'decision', a.decision, 'comment', a.comment, 'createdAt', a.created_at))
        FILTER (WHERE a.id IS NOT NULL), '[]') AS approvals
     FROM expenses e
     JOIN users u ON u.id = e.user_id
     LEFT JOIN receipts r ON r.expense_id = e.id
     LEFT JOIN approvals a ON a.expense_id = e.id
     WHERE e.id = $1 AND e.organization_id = $2
       AND ($3::text IN ('manager','admin') OR e.user_id = $4)
     GROUP BY e.id, u.name`,
    [req.params.id, req.user!.organizationId, req.user!.role, req.user!.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Expense not found' });
  res.json(rows[0]);
});

app.post('/expenses/:id/receipt', requireAuth, upload.single('receipt'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'receipt file is required' });

  const expense = await pool.query(
    `SELECT id FROM expenses WHERE id=$1 AND organization_id=$2 AND user_id=$3`,
    [req.params.id, req.user!.organizationId, req.user!.id]
  );
  if (!expense.rows[0] && req.user!.role === 'employee') return res.status(404).json({ error: 'Expense not found' });

  if (!expense.rows[0]) {
    const managerVisible = await pool.query(
      `SELECT id FROM expenses WHERE id=$1 AND organization_id=$2`,
      [req.params.id, req.user!.organizationId]
    );
    if (!managerVisible.rows[0]) return res.status(404).json({ error: 'Expense not found' });
  }

  const { rows } = await pool.query(
    `INSERT INTO receipts (expense_id, file_name, storage_path) VALUES ($1,$2,$3) RETURNING id, file_name, created_at`,
    [req.params.id, req.file.originalname, req.file.path]
  );
  res.status(201).json(rows[0]);
});

app.post('/expenses/:id/decision', requireAuth, requireRole('manager', 'admin'), async (req, res) => {
  const { decision, comment } = req.body as { decision?: 'approved' | 'rejected'; comment?: string };
  if (!['approved', 'rejected'].includes(decision || '')) {
    return res.status(400).json({ error: 'decision must be approved or rejected' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const updated = await client.query(
      `UPDATE expenses SET status=$1, updated_at=NOW()
       WHERE id=$2 AND organization_id=$3 RETURNING *`,
      [decision, req.params.id, req.user!.organizationId]
    );
    if (!updated.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Expense not found' });
    }
    await client.query(
      `INSERT INTO approvals (expense_id, approver_id, decision, comment) VALUES ($1,$2,$3,$4)`,
      [req.params.id, req.user!.id, decision, comment || null]
    );
    await client.query('COMMIT');
    res.json(updated.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
});

app.get('/admin/overview', requireAuth, requireRole('admin'), async (req, res) => {
  const summary = await pool.query(
    `SELECT COUNT(*)::int AS total_expenses,
            COALESCE(SUM(amount),0)::numeric AS total_amount,
            COUNT(*) FILTER (WHERE status='pending')::int AS pending,
            COUNT(*) FILTER (WHERE status='approved')::int AS approved,
            COUNT(*) FILTER (WHERE status='rejected')::int AS rejected
     FROM expenses WHERE organization_id=$1`,
    [req.user!.organizationId]
  );
  const users = await pool.query(
    `SELECT id, name, email, role FROM users WHERE organization_id=$1 ORDER BY role, name`,
    [req.user!.organizationId]
  );
  res.json({ summary: summary.rows[0], users: users.rows });
});

const openApiPath = path.resolve(process.cwd(), process.env.OPENAPI_PATH || '../../openapi.yaml');
if (fs.existsSync(openApiPath)) {
  const document = YAML.parse(fs.readFileSync(openApiPath, 'utf8'));
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(document));
}

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});
