FROM python:3.14-slim

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir poetry \
    && poetry config virtualenvs.create false

COPY pyproject.toml poetry.lock* ./
RUN poetry install --only main --no-root

COPY . .

EXPOSE 8000

CMD ["python", "main.py"]
