FROM node:24-bookworm-slim AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Build-time placeholders only. Runtime values are configured in EasyPanel.
ENV DATABASE_URL=postgresql://appqr:appqr@localhost:5432/appqr_build \
    APP_URL=http://localhost:3000 \
    SESSION_SECRET=build-session-secret-please-change-32chars \
    PAYMENT_PROVIDER=fake
RUN npx prisma generate && npm run build

FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
RUN useradd --system --uid 1001 appuser
COPY --from=build --chown=appuser:appuser /app/.next/standalone ./
COPY --from=build --chown=appuser:appuser /app/.next/static ./.next/static
COPY --from=build --chown=appuser:appuser /app/public ./public
COPY --from=build --chown=appuser:appuser /app/prisma ./prisma
USER appuser
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
