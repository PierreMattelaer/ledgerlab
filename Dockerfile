FROM node:26.5.0-alpine AS base
WORKDIR /app
COPY package*.json ./
COPY apps/api/package*.json apps/api/
COPY apps/web/package*.json apps/web/
RUN npm install
COPY . .

FROM base AS api-build
RUN npm --workspace apps/api run build

FROM node:26.5.0-alpine AS api
WORKDIR /app
ENV NODE_ENV=production
COPY --from=base /app/node_modules ./node_modules
COPY --from=api-build /app/apps/api/dist ./apps/api/dist
COPY --from=base /app/openapi.yaml ./openapi.yaml
WORKDIR /app/apps/api
CMD ["node", "dist/server.js"]

FROM base AS web-build
ARG NEXT_PUBLIC_API_URL=http://localhost:4000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN npm --workspace apps/web run build

FROM node:26.5.0-alpine AS web
WORKDIR /app
ENV NODE_ENV=production
COPY --from=base /app/node_modules ./node_modules
COPY --from=web-build /app/apps/web/.next ./apps/web/.next
COPY --from=base /app/apps/web/package.json ./apps/web/package.json
WORKDIR /app/apps/web
CMD ["npm", "run", "start"]
