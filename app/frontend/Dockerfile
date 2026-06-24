# Frontend estático (JS puro) servido pelo nginx, que também faz proxy /api -> backend.
FROM nginx:alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf

# só os assets estáticos (sem Dockerfile/nginx.conf)
COPY index.html /usr/share/nginx/html/index.html
COPY css /usr/share/nginx/html/css
COPY js  /usr/share/nginx/html/js
COPY html /usr/share/nginx/html/html

EXPOSE 80
