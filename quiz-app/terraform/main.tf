# Cloudflare Pages Project
resource "cloudflare_pages_project" "quiz_app" {
  account_id        = var.cloudflare_account_id
  name              = "quiz-app"
  production_branch = "main"

  build_config {
    build_command   = "make build"
    destination_dir = "dist"
  }

  deployment_configs {
    production {
      d1_databases = {
        DB = cloudflare_d1_database.quiz_db.id
      }
    }
    preview {
      d1_databases = {
        DB = cloudflare_d1_database.quiz_db.id
      }
    }
  }
}

# Cloudflare D1 Database
resource "cloudflare_d1_database" "quiz_db" {
  account_id = var.cloudflare_account_id
  name       = "quiz-db"
}

# DNS: 本番 (quiz.gocon.jp)
resource "cloudflare_record" "quiz_production" {
  zone_id = var.cloudflare_zone_id
  name    = "quiz"
  type    = "CNAME"
  value   = "${cloudflare_pages_project.quiz_app.name}.pages.dev"
  proxied = true
}

# DNS: ステージング (staging.quiz.gocon.jp)
resource "cloudflare_record" "quiz_staging" {
  zone_id = var.cloudflare_zone_id
  name    = "staging.quiz"
  type    = "CNAME"
  value   = "${cloudflare_pages_project.quiz_app.name}.pages.dev"
  proxied = true
}

# Access: ステージング環境全体を保護
resource "cloudflare_access_application" "staging" {
  account_id       = var.cloudflare_account_id
  name             = "quiz-app-staging"
  domain           = "staging.quiz.gocon.jp"
  session_duration = "24h"
}

resource "cloudflare_access_policy" "staging_allow" {
  application_id = cloudflare_access_application.staging.id
  account_id     = var.cloudflare_account_id
  name           = "allow-staging"
  precedence     = 1
  decision       = "allow"

  include {
    email = var.allowed_emails
  }
}

# Access: 本番の管理パスを保護
resource "cloudflare_access_application" "admin" {
  account_id       = var.cloudflare_account_id
  name             = "quiz-app-admin"
  domain           = "quiz.gocon.jp/admin"
  session_duration = "24h"
}

resource "cloudflare_access_policy" "admin_allow" {
  application_id = cloudflare_access_application.admin.id
  account_id     = var.cloudflare_account_id
  name           = "allow-admin"
  precedence     = 1
  decision       = "allow"

  include {
    email = var.allowed_emails
  }
}
