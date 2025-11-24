FROM node:20-alpine

WORKDIR /app

# Install dependencies using the standalone web app package.json / package-lock.json
COPY apps/web/package*.json ./
RUN npm ci

# Copy the rest of the frontend source
COPY apps/web ./

# Vite dev server will be run on 5173 (overriding config port via CLI)
EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]


