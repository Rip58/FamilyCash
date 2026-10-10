# Copias de seguridad y restauración

## Qué está protegido
| Qué | Dónde | Cuánto tiempo |
|---|---|---|
| Código de la app | GitHub (este repositorio, con todo el historial) | Siempre |
| Versiones publicadas | Vercel → Deployments (se puede volver a una anterior con "Promote/Instant Rollback") | Siempre |
| Base de datos (automática) | Almacén privado de la app (Vercel Blob, el mismo de las fotos), carpeta `backups/`: `familycash-AAAA-MM-DD.json.gz`. Se ven y se descargan en **Ajustes → Datos y fotos → Copias automáticas** | Últimos 60 días, una por día |
| Base de datos (manual) | App → Ajustes → Datos y fotos → **Hacer copia ahora** (al almacén) o **Descargar copia completa** (JSON al móvil) | Lo que la guardes |
| Base de datos (opcional, GitHub) | GitHub → Actions → "Copia de seguridad diaria" (pg_dump cifrado). Solo manual: necesita los secretos de abajo | 90 días |

Las fotos de las notas (Vercel Blob) no entran en las copias: están en el propio almacén.

## Cómo funciona la copia automática
- Cron de Vercel (`vercel.json`) cada día a las 8:03 UTC (9:03 en invierno / 10:03 en verano en Andorra) → `/api/cron/backup`.
- La ruta guarda la copia de hoy si aún no existe (llamarla de más no hace nada) y borra las de más de 60 días (`lib/backup-store.ts`).
- Opcional: en Vercel → Settings → Environment Variables, crea `CRON_SECRET` (una cadena larga aleatoria); Vercel la envía al cron y la ruta solo acepta esa llamada.
- Si un día no aparece la copia en Ajustes, pulsa **Hacer copia ahora** y mira Vercel → Logs (`/api/cron/backup`).

## Restaurar desde una copia (automática .json.gz o descargada .json)
1. Descarga la copia en Ajustes → Datos y fotos (toca la fecha) o con «Descargar copia completa».
2. Base de datos nueva y vacía; aplica el esquema: `DIRECT_URL="postgres://…" npx prisma migrate deploy`
3. Restaura: `DIRECT_URL="postgres://…" npx tsx scripts/restore-backup.ts familycash-AAAA-MM-DD.json.gz` (también acepta el `.json`).
   - Se niega si la base de datos ya tiene empleados o días (para no pisar datos). `FORCE=1` la vacía antes.
   - Las copias antiguas (antes de unificar las notas) se convierten solas.
4. Conecta esa base de datos en Vercel y vuelve a desplegar.

## Copia por GitHub (opcional)
En GitHub → repositorio → **Settings → Secrets and variables → Actions → New repository secret**:
1. `BACKUP_DATABASE_URL`: la cadena **directa** de la base de datos (`postgres://…@db.prisma.io:5432/postgres?sslmode=require`).
2. `BACKUP_PASSPHRASE`: una contraseña larga para cifrar las copias. **Guárdala aparte**.

Después: **Actions → Copia de seguridad diaria → Run workflow**. Para restaurarla: descarga el artefacto, `gpg --decrypt familycash-AAAA-MM-DD.dump.gpg > familycash.dump` y `pg_restore --no-owner --no-privileges --dbname "postgres://…" familycash.dump`.

## Recomendaciones
- Repositorio **privado** (contiene nombres reales): Settings → General → Danger Zone → Change visibility.
- Una vez al mes, descarga una copia y guárdala fuera (Drive, iCloud): si se perdiera la cuenta de Vercel, el almacén se iría con ella.
