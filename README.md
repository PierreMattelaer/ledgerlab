# LedgerLab

A deliberately small multi-tenant expense-management SaaS demo using **only synthetic data**.

## Stack

- TypeScript
- Next.js
- Node.js + Express REST API
- PostgreSQL
- Docker / Docker Compose
- Terraform for AWS
- OpenAPI 3.0

## Repository

```text
/apps/web          Next.js UI
/apps/api          Express API, SQL schema/seeds, integration tests
/infra/terraform   Small AWS baseline (VPC, RDS, ECS cluster, ECR)
/openapi.yaml      API contract
/Dockerfile        Multi-target API/web image
/docker-compose.yml
```

## Demo tenants and users

No real people, credentials, receipts, or financial data are used.

| Organization | Role | Email |
|---|---|---|
| Acme | employee | alice@acme.test |
| Acme | manager | manny@acme.test |
| Acme | admin | ada@acme.test |
| Globex | employee | gina@globex.test |
| Globex | manager | gary@globex.test |
| Globex | admin | grace@globex.test |

Login is intentionally passwordless for the demo. Selecting a seeded email returns a JWT containing the user's organization and role.

## Run locally

```bash
docker compose up --build
```

Then open:

- Web UI: http://localhost:3000
- API: http://localhost:4000
- Swagger/OpenAPI: http://localhost:4000/docs

PostgreSQL is exposed on localhost:5432 for development.

To reset the seeded database:

```bash
docker compose down -v
docker compose up --build
```

## Main flows

1. Log in as an Acme or Globex synthetic user.
2. Employees create expenses and see only their own expenses.
3. Managers can see expenses for their organization and approve/reject them.
4. Admins can also load a simple organization overview.
5. Upload a fake receipt file against an expense.
6. Switch tenants and verify that an expense ID from the other tenant returns 404.

Tenant isolation is enforced in API database queries using `organization_id`; it is not left to the frontend.

## API tests

The integration tests expect PostgreSQL. The simplest route is to create a test database in the local container:

```bash
docker compose up -d db
docker compose exec db createdb -U ledgerlab ledgerlab_test
npm install
TEST_DATABASE_URL=postgres://ledgerlab:ledgerlab@localhost:5432/ledgerlab_test npm test
```

Tests cover:

- seeded login
- creating/listing expenses
- manager approval
- cross-tenant access isolation
- admin authorization

## Terraform

The Terraform is intentionally modest. It creates:

- VPC and public/private subnets
- private PostgreSQL RDS instance
- ECS cluster
- ECR repositories for API and web images

It does **not** pretend to be a production platform. ALB, TLS, Route53, Secrets Manager, ECS task definitions, autoscaling, observability, backups, WAF, and CI/CD are natural next steps.

```bash
cd infra/terraform
terraform init
terraform plan -var='db_password=replace-me'
```

## Intentional demo shortcuts

- Passwordless seeded login rather than a real identity provider.
- Receipts are stored on the API filesystem/volume instead of S3.
- No email notifications or background workers.
- No ORM; direct SQL keeps tenant filters visible and understandable.
- Minimal validation rather than a large validation/domain framework.
- Synthetic seed data only.

These choices keep LedgerLab useful for application-security demos without burying the important behavior under infrastructure or architecture noise.
