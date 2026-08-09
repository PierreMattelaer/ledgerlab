output "api_repository_url" { value = aws_ecr_repository.api.repository_url }
output "web_repository_url" { value = aws_ecr_repository.web.repository_url }
output "database_endpoint" { value = aws_db_instance.postgres.address }
output "ecs_cluster_name" { value = aws_ecs_cluster.main.name }
