# ---- 빌드 ----
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# 브라우저는 같은 주소의 /api 로 요청하고, nginx가 백엔드로 넘겨준다
ENV VITE_API_URL=/api
RUN npm run build

# ---- 실행 ----
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
