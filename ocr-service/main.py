"""
OCR 微服務 - 解析郵局投遞簽收清單
擷取每行第一段連續數字（6-8碼追蹤碼）
"""

import re
import io
import logging
from pathlib import Path

import easyocr
import numpy as np
from PIL import Image, ImageFilter, ImageEnhance
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Mail OCR Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 上線後改為 Next.js 的 domain
    allow_methods=["*"],
    allow_headers=["*"],
)

# 初始化 EasyOCR（第一次執行會下載模型，約 1-2 分鐘）
logger.info("載入 OCR 模型中...")
reader = easyocr.Reader(["ch_tra", "en"], gpu=False)  # 繁體中文 + 英文
logger.info("OCR 模型載入完成")


def preprocess_image(img: Image.Image) -> np.ndarray:
    """影像前處理：灰階、提高對比、銳化"""
    img = img.convert("L")  # 灰階
    img = img.filter(ImageFilter.SHARPEN)
    enhancer = ImageEnhance.Contrast(img)
    img = enhancer.enhance(2.0)
    return np.array(img)


def extract_tracking_codes(ocr_results: list) -> tuple[list[str], str]:
    """
    從 OCR 結果中擷取追蹤碼。
    規則：每行第一段連續數字，長度 6-8 碼。
    忽略純序號（1-99）與不符合長度的數字。
    """
    raw_lines = [text for (_, text, _) in ocr_results]
    raw_text = "\n".join(raw_lines)

    tracking_codes: list[str] = []
    seen: set[str] = set()

    for line in raw_lines:
        line = line.strip()
        if not line:
            continue

        # 找出該行所有連續數字段
        numbers = re.findall(r"\d+", line)
        if not numbers:
            continue

        # 跳過純序號行（如 "1", "41" 等 1-2 位數字開頭）
        first_num = numbers[0]
        if len(first_num) <= 2:
            # 嘗試第二個數字段作為追蹤碼
            candidates = [n for n in numbers if 6 <= len(n) <= 8]
        else:
            candidates = [first_num] if 6 <= len(first_num) <= 8 else []

        for code in candidates:
            if code not in seen:
                seen.add(code)
                tracking_codes.append(code)
                break  # 每行只取一個

    return tracking_codes, raw_text


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/ocr")
async def ocr_endpoint(file: UploadFile = File(...)):
    """
    接收圖片，回傳追蹤碼列表與原始 OCR 文字。
    """
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="請上傳圖片檔案")

    content = await file.read()

    try:
        img = Image.open(io.BytesIO(content))
    except Exception:
        raise HTTPException(status_code=400, detail="無法解析圖片")

    img_array = preprocess_image(img)

    logger.info(f"開始 OCR 辨識：{file.filename}（{img.size}）")
    results = reader.readtext(img_array, detail=1, paragraph=False)
    logger.info(f"辨識完成，共 {len(results)} 行文字")

    tracking_codes, raw_text = extract_tracking_codes(results)
    logger.info(f"擷取追蹤碼 {len(tracking_codes)} 筆：{tracking_codes[:5]}")

    return {
        "trackingCodes": tracking_codes,
        "rawText": raw_text,
        "lineCount": len(results),
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
