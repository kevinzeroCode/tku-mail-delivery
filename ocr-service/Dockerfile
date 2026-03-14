FROM python:3.11-slim

WORKDIR /app

# 系統依賴（EasyOCR / OpenCV 需要）
RUN apt-get update && apt-get install -y --no-install-recommends \
    libglib2.0-0 libsm6 libxrender1 libxext6 libgl1 \
    && rm -rf /var/lib/apt/lists/*

# 先安裝套件（利用 Docker cache）
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
# 模型在第一次啟動時自動下載至 /root/.EasyOCR（由 volume 持久化）

EXPOSE 8000
CMD ["python", "main.py"]
