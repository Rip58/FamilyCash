# Copias de seguridad y restauración

## Qué está protegido
| Qué | Dónde | Cuánto tiempo |
|---|---|---|
| Código de la app | GitHub (este repositorio, con todo el historial) | Siempre |
| Versiones publicadas | Vercel → Deployments (se puede volver a una anterior con "Promote/Instant Rollback") | Siempre |
| Base de datos (automática) | GitHub → Actions → "Copia de seguridad nocturna" → artefacto `familycash-db-AAAA-MM-DD` (cifrado) | 90 días, una por día |
| Base de datos (manual) | App → Ajustes → Datos → **Descargar copia completa** (JSON) | Lo que la guardes |

Las fotos de los avisos (Vercel Blob) no entran en las copias.

## Puesta en marcha (una sola vez)
En GitHub → repositorio → **Settings → Secrets and variables → Actions → New repository secret**:
1. `BACKUP_DATABASE_URL`: la cadena **directa** de la base de datos (`postgres://…@db.prisma.io:5432/postgres?sslmode=require`; en Vercel → Storage → la base de datos → `.env`, la variable `…POSTGRES_URL`).
2. `BACKUP_PASSPHRASE`: una contraseña larga para cifrar las copias. **Guárdala aparte** (gestor de contraseñas): sin ella las copias no se pueden abrir.

Después: **Actions → Copia de seguridad nocturna → Run workflow** para probarla. Si una noche falla, GitHub envía un email.

## Restaurar desde la copia nocturna (pg_dump)
1. Descarga el artefacto del día (Actions → la ejecución → Artifacts) y descomprímelo.
2. Descifra: `gpg --decrypt familycash-AAAA-MM-DD.dump.gpg > familycash.dump`
3. Crea una base de datos **nueva** (p. ej. otra Prisma Postgres en Vercel → Storage) y copia su cadena directa.
4. Restaura: `pg_restore --no-owner --no-privileges --dbname "postgres://…@db.prisma.io:5432/postgres?sslmode=require" familycash.dump`
5. En Vercel, conecta la nueva base de datos al proyecto (o cambia las variables) y vuelve a desplegar.

## Restaurar desde la copia JSON (botón de la app)
1. Base de datos nueva y vacía; aplica el esquema: `DIRECT_URL="postgres://…" npx prisma migrate deploy`
2. Restaura: `DIRECT_URL="postgres://…" npx tsx scripts/restore-backup.ts familycash-copia-AAAA-MM-DD.json`
   - Se niega si la base de datos ya tiene empleados o días (para no pisar datos). `FORCE=1` la vacía antes.
3. Conecta esa base de datos en Vercel y vuelve a desplegar.

## Recomendaciones
- Repositorio **privado** (contiene nombres reales): Settings → General → Danger Zone → Change visibility.
- Descarga una copia manual antes de cambios grandes y una vez al mes guárdala fuera (Drive, iCloud).
