# iChat - Render Deployment

This version is configured so the frontend and Socket.IO server run from the **same Node.js Render Web Service**.

## Deploy

1. Upload/push this project to a GitHub repository.
2. In Render, create a **New Web Service** and select the repository.
3. Leave Root Directory empty (project root).
4. Build Command: `npm install`
5. Start Command: `npm start`
6. Health Check Path: `/health`
7. Deploy.

No localhost URL needs to be configured in the frontend. `js/client.js` uses `io()` so Socket.IO connects to the deployed Render domain automatically.

After deployment, open:
`https://YOUR-RENDER-SERVICE.onrender.com`

Health check:
`https://YOUR-RENDER-SERVICE.onrender.com/health`

## Local test

From the project root:

```bash
npm install
npm start
```

Then open `http://localhost:8000`.
