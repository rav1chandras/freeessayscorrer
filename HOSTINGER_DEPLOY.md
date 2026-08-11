# Hostinger Deploy Notes

This package is source-only. It intentionally does not include `.env`, `node_modules`, `.next`, or local Docker files.

## Hostinger Settings

- Node version: `20.x`
- Install command: `npm ci`
- Build command: `npm run build`
- Start command: `npm start`
- App URL: `https://freeessayscorer.com`

## Required Environment Variables

Set these in Hostinger hPanel for the Node.js app:

```bash
NODE_ENV=production
MODEL_API_KEY=your-real-meta-model-api-key
ADMIN_PASSWORD=your-long-random-admin-password
DB_HOST=your-hostinger-mysql-host
DB_PORT=3306
DB_USER=your-hostinger-mysql-user
DB_PASSWORD=your-hostinger-mysql-password
DB_NAME=your-hostinger-mysql-database
```

Use hPanel -> Databases -> MySQL for the DB values.

## After Upload

1. Extract the zip into the app directory.
2. Add the environment variables above in hPanel.
3. Run `npm ci`.
4. Run `npm run build`.
5. Start or restart the Node.js app.
6. Visit `/api/health` to confirm the app is live.
7. Visit `/admin` and sign in with `ADMIN_PASSWORD`.

## Security Notes

- Do not upload local `.env`.
- Keep `ADMIN_PASSWORD` long and random.
- Use the real Hostinger MySQL credentials only in hPanel environment variables.
- Rotate the Meta Model API key if it was ever shared or uploaded accidentally.
