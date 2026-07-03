FROM node:20-alpine AS builder
WORKDIR /app
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_DEMO_API_KEY
ARG NEXT_PUBLIC_MOCK_API
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_DEMO_API_KEY=$NEXT_PUBLIC_DEMO_API_KEY
ENV NEXT_PUBLIC_MOCK_API=$NEXT_PUBLIC_MOCK_API
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
RUN npm ci --omit=dev
EXPOSE 3000
CMD ["npx", "next", "start", "-p", "3000"]
