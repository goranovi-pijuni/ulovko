FROM python:3.12-alpine

WORKDIR /app
COPY server.py ./server.py

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=5000

USER 10001:10001
EXPOSE 5000
CMD ["python", "-B", "-u", "server.py"]
