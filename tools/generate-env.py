"""Genere le fichier .env de la pile Supabase de Farafinatigne.

Produit des secrets aleatoires et les deux cles d'API (JWT HS256 signes
par JWT_SECRET), puis ecrit supabase-stack/.env.

    python tools/generate-env.py [--env local|vps] [--force]

Le fichier produit contient des secrets : il est ignore par git.
"""
import argparse, base64, hmac, hashlib, json, os, secrets, string, sys, time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "supabase-stack", ".env")

# Ports distincts de ceux de BEKST (8000 / 5432 / 6543) pour que les
# deux piles tournent cote a cote sans conflit.
PORTS = {"gateway": 8100, "postgres": 5533, "pooler": 6644}


def rand(n=48):
    alphabet = string.ascii_letters + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(n))


def b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def jwt(payload: dict, secret: str) -> str:
    head = b64(json.dumps({"alg": "HS256", "typ": "JWT"}, separators=(",", ":")).encode())
    body = b64(json.dumps(payload, separators=(",", ":")).encode())
    signing = f"{head}.{body}".encode()
    sig = hmac.new(secret.encode(), signing, hashlib.sha256).digest()
    return f"{head}.{body}.{b64(sig)}"


def build(env: str) -> str:
    jwt_secret = rand(64)
    now = int(time.time())
    exp = now + 3600 * 24 * 365 * 10          # 10 ans
    anon = jwt({"role": "anon", "iss": "supabase", "iat": now, "exp": exp}, jwt_secret)
    service = jwt({"role": "service_role", "iss": "supabase", "iat": now, "exp": exp}, jwt_secret)

    if env == "vps":
        public_url = "https://office.farafinatigne.com/supabase"
        site_url = "https://office.farafinatigne.com"
        extra_redirects = "https://farafinatigne.com"
    else:
        # 127.0.0.1 et jamais localhost : sur ce poste localhost part en
        # IPv6 vers un autre conteneur et renvoie un 401 trompeur.
        public_url = f"http://127.0.0.1:{PORTS['gateway']}"
        site_url = "http://127.0.0.1:3100"
        extra_redirects = "http://127.0.0.1:3100"

    return f"""############################################################
#  Supabase — Farafinatigne ({env})
#  Genere par tools/generate-env.py, ne pas versionner.
############################################################
# Le separateur par defaut de COMPOSE_FILE est ':' sous Linux et ';' sous
# Windows : on le fige pour que ce fichier marche des deux cotes.
COMPOSE_PATH_SEPARATOR=:
COMPOSE_FILE=docker-compose.yml:docker-compose.override.yml
COMPOSE_PROJECT_NAME=farafina

# --- secrets ---
POSTGRES_PASSWORD={rand(40)}
JWT_SECRET={jwt_secret}
ANON_KEY={anon}
SERVICE_ROLE_KEY={service}
SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
JWT_KEYS=
JWT_JWKS=
SECRET_KEY_BASE={rand(64)}
REALTIME_DB_ENC_KEY={rand(32)}
VAULT_ENC_KEY={rand(32)}
PG_META_CRYPTO_KEY={rand(32)}
LOGFLARE_PUBLIC_ACCESS_TOKEN={rand(32)}
LOGFLARE_PRIVATE_ACCESS_TOKEN={rand(32)}

# --- acces au tableau de bord Supabase Studio ---
DASHBOARD_USERNAME=farafina
DASHBOARD_PASSWORD={rand(28)}

# --- base ---
POSTGRES_HOST=db
POSTGRES_DB=postgres
POSTGRES_PORT={PORTS['postgres']}
POOLER_PROXY_PORT_TRANSACTION={PORTS['pooler']}
POOLER_DEFAULT_POOL_SIZE=20
POOLER_MAX_CLIENT_CONN=100
POOLER_TENANT_ID=farafina
POOLER_DB_POOL_SIZE=5

# --- passerelle ---
API_GW_HTTP_PORT={PORTS['gateway']}
KONG_HTTP_PORT={PORTS['gateway']}
KONG_HTTPS_PORT=8543
SUPABASE_PUBLIC_URL={public_url}
API_EXTERNAL_URL={public_url}

# --- studio ---
STUDIO_DEFAULT_ORGANIZATION=Farafinatigne
STUDIO_DEFAULT_PROJECT=FarafinaOffice
OPENAI_API_KEY=

# --- authentification ---
# Les comptes sont crees par l'administrateur : pas d'inscription libre.
SITE_URL={site_url}
ADDITIONAL_REDIRECT_URLS={extra_redirects}
JWT_EXPIRY=3600
DISABLE_SIGNUP=true
ENABLE_EMAIL_SIGNUP=true
ENABLE_EMAIL_AUTOCONFIRM=true
ENABLE_ANONYMOUS_USERS=false
ENABLE_PHONE_SIGNUP=false
ENABLE_PHONE_AUTOCONFIRM=false
MAILER_URLPATHS_CONFIRMATION=/auth/v1/verify
MAILER_URLPATHS_INVITE=/auth/v1/verify
MAILER_URLPATHS_RECOVERY=/auth/v1/verify
MAILER_URLPATHS_EMAIL_CHANGE=/auth/v1/verify

# --- courriel (a renseigner pour les invitations et mots de passe oublies) ---
SMTP_ADMIN_EMAIL=farafinatigne@gmail.com
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_SENDER_NAME=Farafinatigne

# --- stockage ---
REGION=eu-west-1
MINIO_ROOT_USER=farafina
MINIO_ROOT_PASSWORD={rand(32)}
STORAGE_TENANT_ID=farafina
IMGPROXY_AUTO_WEBP=true

# --- api ---
FUNCTIONS_VERIFY_JWT=false
PGRST_DB_SCHEMAS=public,storage,graphql_public
PGRST_DB_MAX_ROWS=1000
PGRST_DB_EXTRA_SEARCH_PATH=public,extensions
DOCKER_SOCKET_LOCATION=/var/run/docker.sock
GOOGLE_PROJECT_ID=
GOOGLE_PROJECT_NUMBER=
ANON_KEY_ASYMMETRIC=
SERVICE_ROLE_KEY_ASYMMETRIC=
PROXY_DOMAIN=
CERTBOT_EMAIL=blaisecisse79@gmail.com
"""


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--env", choices=["local", "vps"], default="local")
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--out", default=OUT)
    a = ap.parse_args()

    if os.path.exists(a.out) and not a.force:
        sys.exit("%s existe deja — utiliser --force pour le regenerer "
                 "(cela invalide les cles et les sessions)" % a.out)

    with open(a.out, "w", encoding="utf-8", newline="\n") as f:
        f.write(build(a.env))
    print("ecrit :", a.out)
    print("ports : passerelle %(gateway)d, postgres %(postgres)d, pooler %(pooler)d" % PORTS)
