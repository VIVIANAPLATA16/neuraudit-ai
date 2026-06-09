FROM python:3.11-slim

WORKDIR /app

COPY neuraudit_agent/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY neuraudit_agent /app/neuraudit_agent

ENV PYTHONPATH=/app
EXPOSE 8001

CMD ["uvicorn", "neuraudit_agent.analyze_service:app", "--host", "0.0.0.0", "--port", "8001"]
