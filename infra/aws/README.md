# AWS infra stubs

Placeholder only — no live Terraform/CDK apply in the foundation PR.

Suggested variables for a later module:

```hcl
variable "project" { default = "maddenhq" }
variable "region"  { default = "us-east-1" }
variable "db_instance_class" { default = "db.t4g.micro" }
```

Resources to add later:

- VPC (or default VPC for early demos)
- RDS PostgreSQL
- App Runner service connected to this GitHub repo
- Secrets Manager entries
- IAM role for sync tasks
