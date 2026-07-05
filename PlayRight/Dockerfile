# Official Playwright image: Chromium + all OS-level dependencies preinstalled.
# Pin the tag to match the "playwright" npm version in package.json exactly.
FROM mcr.microsoft.com/playwright:v1.55.1-jammy

WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
# Browsers already exist in the base image at this version, so this installs
# JS deps only and skips re-downloading Chromium.
RUN npm ci --omit=dev

COPY server.js ./

EXPOSE 3000

CMD ["node", "server.js"]
