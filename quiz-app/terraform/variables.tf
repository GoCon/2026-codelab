variable "cloudflare_api_token" {
  description = "Cloudflare API token"
  type        = string
  sensitive   = true
}

variable "cloudflare_account_id" {
  description = "Cloudflare account ID"
  type        = string
}

variable "cloudflare_zone_id" {
  description = "Cloudflare zone ID for gocon.jp"
  type        = string
}

variable "allowed_emails" {
  description = "List of email addresses allowed to access protected resources"
  type        = list(string)
  default     = []
}
