
import express from "express";
import cors from "cors";
import "dotenv/config";
import OpenAI from "openai";

const app = express();

app.use(cors());
app.use(express.json());

const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
  console.error("XATO: OPENAI_API_KEY .env faylida topilmadi.");
  process.exit(1);
}

const openai = new OpenAI({
  apiKey: apiKey,
});

app.post("/api/savol", async (req, res) => {
  try {
    const { savol } = req.body;

    if (!savol || !savol.trim()) {
      return res.status(400).json({
        error: "Avval savolni kiriting.",
      });
    }

    const natija = await openai.responses.create({
      model: "gpt-4.1-mini",
      instructions:
        "Sen o'quvchilarga yordam beradigan o'qituvchisan. O'zbek tilida sodda va tushunarli javob ber. Javobni qisqacha tushuntir.",
      input: savol.trim(),
    });

    res.json({
      javob: natija.output_text || "AI javob qaytarmadi.",
    });
  } catch (error) {
    console.error("AI XATOSI:", error.status || 500, error.message);

    let xabar = error.message || "Noma'lum xatolik yuz berdi.";

    if (error.status === 401) {
      xabar = "API kaliti noto'g'ri yoki yaroqsiz.";
    } else if (error.status === 429) {
      xabar =
        "API limiti tugagan yoki hisobda kredit yetarli emas. API hisobini tekshiring.";
    } else if (error.status === 403) {
      xabar = "API so'roviga ruxsat yo'q. Hisob va model ruxsatlarini tekshiring.";
    }

    res.status(error.status || 500).json({
      error: xabar,
    });
  }
});

app.listen(3001, () => {
  console.log("Backend ishlayapti: http://localhost:3001");
});