variable "aws_region" {
  type    = string
  default = "eu-west-1"
}

variable "app_name" {
  type    = string
  default = "ledgerlab"
}

variable "db_username" {
  type    = string
  default = "ledgerlab"
}

variable "db_password" {
  type      = string
  sensitive = true
}
