INSERT INTO organizations (name) VALUES ('Acme'), ('Globex') ON CONFLICT DO NOTHING;

INSERT INTO users (organization_id, name, email, role)
SELECT o.id, x.name, x.email, x.role
FROM organizations o
JOIN (VALUES
  ('Acme','Alice Employee','alice@acme.test','employee'),
  ('Acme','Manny Manager','manny@acme.test','manager'),
  ('Acme','Ada Admin','ada@acme.test','admin'),
  ('Globex','Gina Employee','gina@globex.test','employee'),
  ('Globex','Gary Manager','gary@globex.test','manager'),
  ('Globex','Grace Admin','grace@globex.test','admin')
) AS x(org_name,name,email,role) ON x.org_name=o.name
ON CONFLICT (email) DO NOTHING;

INSERT INTO expenses (organization_id, user_id, amount, currency, category, description, spent_at, status)
SELECT u.organization_id, u.id, 42.50, 'EUR', 'Meals', 'Synthetic team lunch', CURRENT_DATE - 2, 'pending'
FROM users u WHERE u.email='alice@acme.test'
AND NOT EXISTS (SELECT 1 FROM expenses WHERE description='Synthetic team lunch');

INSERT INTO expenses (organization_id, user_id, amount, currency, category, description, spent_at, status)
SELECT u.organization_id, u.id, 88.10, 'EUR', 'Travel', 'Synthetic train ticket', CURRENT_DATE - 1, 'pending'
FROM users u WHERE u.email='gina@globex.test'
AND NOT EXISTS (SELECT 1 FROM expenses WHERE description='Synthetic train ticket');
