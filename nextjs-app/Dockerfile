FROM node:20-alpine AS base

# 安裝依賴
FROM base AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

# 建置
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

# 正式執行
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN apk add --no-cache openssl

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# 持久化目錄
RUN mkdir -p /app/data /app/public/uploads \
    && chown -R nextjs:nodejs /app/data /app/public/uploads

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/prisma ./prisma

# 持久化目錄 + prisma 寫入目錄都給 nextjs 權限
RUN mkdir -p /app/data /app/public/uploads \
    && chown -R nextjs:nodejs /app/data /app/public/uploads \
    && chown -R nextjs:nodejs /app/node_modules/.prisma /app/node_modules/@prisma /app/node_modules/prisma

USER nextjs
EXPOSE 3000
ENV PORT=3000 HOSTNAME="0.0.0.0"

# 啟動時先建立/更新資料庫 schema，再啟動 Next.js
CMD ["sh", "-c", "node node_modules/prisma/build/index.js db push --skip-generate && node server.js"]
