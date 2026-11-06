import { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import "./App.css";

const API = import.meta.env.VITE_API_URL || "http://localhost:3001";

const TARIFLAR = [
  {
    nom: "FREE",
    narx: 0,
    tavsif: "1–6-sinf uchun boshlang‘ich daraja",
    imkoniyatlar: [
      "1–6-sinf savollariga javob",
      "Savollar tarixi",
      "Oddiy tushuntirishlar",
    ],
    icon: "✓",
    theme: "free",
    badge: "Faol",
  },
  {
    nom: "PRO",
    narx: 90000,
    tavsif: "1–7-sinf uchun kengaytirilgan imkoniyat",
    imkoniyatlar: [
      "1–7-sinf savollariga javob",
      "Batafsil tushuntirishlar",
      "Matematik yechimlar bo‘yicha ko‘rsatmalar",
    ],
    icon: "◆",
    theme: "pro",
    badge: "Tez orada",
  },
  {
    nom: "PRO MAX",
    narx: 110000,
    tavsif: "1–11-sinf uchun to‘liq imkoniyat",
    imkoniyatlar: [
      "1–11-sinf savollariga javob",
      "Kengaytirilgan AI yechimlar",
      "Yuqori darajali tushuntirishlar",
      "Barcha sinflar uchun maxsus yordamlash",
    ],
    icon: "♛",
    theme: "pro-max",
    badge: "Tez orada",
  },
];

const SINFLAR = Array.from({ length: 11 }, (_, index) => index + 1);
const PLAN_LIMITS = {
  FREE: 6,
  PRO: 7,
  "PRO MAX": 11,
};

function getMaxAllowedClassForPlan(plan) {
  return PLAN_LIMITS[plan] ?? PLAN_LIMITS.FREE;
}

function Logo() {
  return (
    <svg
      className="logo"
      viewBox="0 0 100 100"
      width="70"
      height="70"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="O‘quvchi AI logotipi"
    >
      <defs>
        <linearGradient id="logoBg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#792cff" />
          <stop offset="100%" stopColor="#2024d8" />
        </linearGradient>
      </defs>

      <rect width="100" height="100" rx="25" fill="url(#logoBg)" />

      <g fill="none" stroke="#a9eaff" strokeWidth="2.5">
        <path d="M50 28 L28 40 L17 52 M50 28 L72 40 L83 52" />
        <path d="M28 40 L50 55 L72 40" />
      </g>

      <g fill="#fff">
        <circle cx="50" cy="28" r="4" />
        <circle cx="28" cy="40" r="4" />
        <circle cx="72" cy="40" r="4" />
        <circle cx="17" cy="52" r="3" />
        <circle cx="83" cy="52" r="3" />
      </g>

      <path
        d="M50 38 L54 49 L65 53 L54 57 L50 68 L46 57 L35 53 L46 49 Z"
        fill="#fff3b0"
      />

      <path
        d="M15 62 Q33 56 50 72 Q67 56 85 62 L85 83 Q66 77 50 91 Q34 77 15 83 Z"
        fill="#fff"
      />

      <path
        d="M50 72 V91"
        stroke="#65dfff"
        strokeWidth="3"
        fill="none"
      />
    </svg>
  );
}

function App() {
  const [foydalanuvchi, setFoydalanuvchi] = useState(null);

  const [token, setToken] = useState(
    () => localStorage.getItem("oqilAiToken") || ""
  );

  const [yuklanmoqda, setYuklanmoqda] = useState(false);
  const [xato, setXato] = useState("");
  const [xabarnoma, setXabarnoma] = useState("");
  const [rejim, setRejim] = useState("login");

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [parolTakror, setParolTakror] = useState("");

  const [parolKorsat, setParolKorsat] = useState(false);
  const [takrorParolKorsat, setTakrorParolKorsat] = useState(false);
  const [yangiParolKorsat, setYangiParolKorsat] = useState(false);

  const [sahifa, setSahifa] = useState("asosiy");
  const [foydalanuvchilar, setFoydalanuvchilar] = useState([]);

  const [yangiUsername, setYangiUsername] = useState("");
  const [yangiPassword, setYangiPassword] = useState("");
  const [ochirilayotganId, setOchirilayotganId] = useState(null);

  const [adminUsername, setAdminUsername] = useState("");
  const [canAddUsers, setCanAddUsers] = useState(true);
  const [canRequestGifts, setCanRequestGifts] = useState(true);

  const [savol, setSavol] = useState("");
  const [javob, setJavob] = useState("");
  const [aiYuklanmoqda, setAiYuklanmoqda] = useState(false);

  const [ovozYozilmoqda, setOvozYozilmoqda] = useState(false);
  const [ovozAylantirilmoqda, setOvozAylantirilmoqda] = useState(false);
  const [ovozliJavob, setOvozliJavob] = useState(false);
  const [ovozYaratilmoqda, setOvozYaratilmoqda] = useState(false);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const mediaStreamRef = useRef(null);
  const audioJavobRef = useRef(null);
  const audioUrlRef = useRef(null);
  const speechAbortRef = useRef(null);

  // Rasm bilan ishlash
  const [rasm, setRasm] = useState(null);
  const [rasmMenyu, setRasmMenyu] = useState(false);

  // Savollar tarixi
  const [tarix, setTarix] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("savollarTarixi")) || [];
    } catch {
      return [];
    }
  });

  const [tanlangan, setTanlangan] = useState(null);

  const [premiumOyna, setPremiumOyna] = useState(false);
  const [tanlanganTarif, setTanlanganTarif] = useState("FREE");
  const [sinf, setSinf] = useState(1);

  const [obuna, setObuna] = useState(() => {
    try {
      return (
        JSON.parse(localStorage.getItem("oqilAiObuna")) || {
          tarif: "FREE",
          tugashVaqti: null,
        }
      );
    } catch {
      return { tarif: "FREE", tugashVaqti: null };
    }
  });

  const rol = String(foydalanuvchi?.role || "user").toLowerCase();
  const ega = rol === "owner";
  const admin = rol === "admin";

  let ruxsat = {};

  try {
    ruxsat = JSON.parse(foydalanuvchi?.permissions || "{}");
  } catch {
    ruxsat = {};
  }

  function authHeaders() {
    return {
      Authorization: `Bearer ${token}`,
    };
  }

  // Rasmni tekshirish, kichraytirish va saqlash
  async function rasmniQabulQilish(fayl) {
    if (!fayl) return;

    const ruxsatEtilganTurlar = [
      "image/jpeg",
      "image/png",
      "image/webp",
    ];

    if (!ruxsatEtilganTurlar.includes(fayl.type)) {
      setXato("Faqat JPG, PNG yoki WEBP formatidagi rasm yuklang.");
      return;
    }

    if (fayl.size > 50 * 1024 * 1024) {
      setXato("Rasm hajmi 50 MB dan oshmasligi kerak.");
      return;
    }

    setXato("");

    let bitmap;

    try {
      bitmap = await createImageBitmap(fayl);

      let scale = Math.min(
        1,
        2200 / Math.max(bitmap.width, bitmap.height)
      );

      let blob = null;

      for (let i = 0; i < 7; i++) {
        const canvas = document.createElement("canvas");

        canvas.width = Math.max(
          1,
          Math.round(bitmap.width * scale)
        );

        canvas.height = Math.max(
          1,
          Math.round(bitmap.height * scale)
        );

        const context = canvas.getContext("2d");

        if (!context) {
          throw new Error("Rasmni qayta ishlash imkoni bo‘lmadi.");
        }

        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);

        context.drawImage(
          bitmap,
          0,
          0,
          canvas.width,
          canvas.height
        );

        const sifat = Math.max(0.45, 0.85 - i * 0.08);

        blob = await new Promise((resolve) => {
          canvas.toBlob(resolve, "image/jpeg", sifat);
        });

        if (blob && blob.size <= 4.5 * 1024 * 1024) {
          break;
        }

        scale *= 0.8;
      }

      bitmap.close();
      bitmap = null;

      if (!blob || blob.size > 4.5 * 1024 * 1024) {
        throw new Error(
          "Rasmni kerakli hajmgacha kichraytirib bo‘lmadi."
        );
      }

      const reader = new FileReader();

      reader.onload = () => {
        const dataUrl = String(reader.result || "");
        const vergulIndex = dataUrl.indexOf(",");

        if (vergulIndex === -1) {
          setXato("Rasmni o‘qishda xatolik yuz berdi.");
          return;
        }

        setRasm({
          nomi: fayl.name || "Rasm",
          mimeType: "image/jpeg",
          data: dataUrl.slice(vergulIndex + 1),
          preview: dataUrl,
        });

        setXato("");
        setJavob("");
        setTanlangan(null);
        setRasmMenyu(false);
      };

      reader.onerror = () => {
        setXato("Rasmni o‘qib bo‘lmadi.");
      };

      reader.readAsDataURL(blob);
    } catch (error) {
      if (bitmap) bitmap.close();

      setXato(
        error.message || "Rasmni qayta ishlashda xatolik yuz berdi."
      );
    }
  }

  // Galereya yoki kameradan rasm tanlash
  function rasmTanlash(e) {
    const fayl = e.target.files?.[0];

    if (!fayl) return;

    e.target.value = "";
    rasmniQabulQilish(fayl);
  }

  // Rasmni o‘chirish
  function rasmniOchirish() {
    setRasm(null);

    const galereyaInput = document.getElementById("savol-rasmi");
    const kameraInput = document.getElementById("kamera-rasmi");

    if (galereyaInput) galereyaInput.value = "";
    if (kameraInput) kameraInput.value = "";
  }

  useEffect(() => {
    localStorage.setItem("savollarTarixi", JSON.stringify(tarix));
  }, [tarix]);

  useEffect(() => {
    localStorage.setItem("oqilAiObuna", JSON.stringify(obuna));
  }, [obuna]);

  useEffect(() => {
    if (!token) return;

    async function tekshirish() {
      try {
        const response = await fetch(`${API}/api/auth/me`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Sessiya tugagan.");
        }

        const user = data.foydalanuvchi || data.user || data;
        setFoydalanuvchi(user);

        const plan = user?.subscription_plan || "FREE";
        const grade = Number(user?.class_level || 1);

        setTanlanganTarif(plan);
        setSinf(Number.isFinite(grade) && grade >= 1 && grade <= 11 ? grade : 1);
        setObuna({
          tarif: plan,
          tugashVaqti: user?.subscription_until || null,
        });
      } catch {
        localStorage.removeItem("oqilAiToken");
        setToken("");
        setFoydalanuvchi(null);
      }
    }

    tekshirish();
  }, [token]);

  async function autentifikatsiya() {
    setXato("");

    if (!username.trim() || !password) {
      setXato("Login va parolni kiriting.");
      return;
    }

    if (rejim === "register" && password !== parolTakror) {
      setXato("Parollar bir xil emas.");
      return;
    }

    if (password.length < 8) {
      setXato("Parol kamida 8 ta belgidan iborat bo‘lsin.");
      return;
    }

    setYuklanmoqda(true);

    try {
      const endpoint =
        rejim === "login"
          ? "/api/auth/login"
          : "/api/auth/register";

      const response = await fetch(`${API}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: username.trim(),
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Xatolik yuz berdi.");
      }

      if (!data.token) {
        throw new Error("Server token yubormadi.");
      }

      localStorage.setItem("oqilAiToken", data.token);

      const user = data.foydalanuvchi || data.user || null;
      setFoydalanuvchi(user);
      setToken(data.token);
      setSinf(Number(user?.class_level || 1));
      setTanlanganTarif(user?.subscription_plan || "FREE");
      setObuna({
        tarif: user?.subscription_plan || "FREE",
        tugashVaqti: user?.subscription_until || null,
      });

      setPassword("");
      setParolTakror("");
      setParolKorsat(false);
      setTakrorParolKorsat(false);
    } catch (error) {
      setXato(error.message);
    } finally {
      setYuklanmoqda(false);
    }
  }

  function chiqish() {
    localStorage.removeItem("oqilAiToken");

    setToken("");
    setFoydalanuvchi(null);
    setFoydalanuvchilar([]);
    setSahifa("asosiy");
    setXato("");
    setXabarnoma("");
    setRasm(null);
    setRasmMenyu(false);
    setSavol("");
    setJavob("");
  }

  async function foydalanuvchilarniYuklash() {
    if (!ega && !admin) return;

    setXato("");

    try {
      const endpoint = ega
        ? "/api/owner/users"
        : "/api/admin/users";

      const response = await fetch(`${API}${endpoint}`, {
        headers: authHeaders(),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Foydalanuvchilar olinmadi."
        );
      }

      setFoydalanuvchilar(
        data.users || data.foydalanuvchilar || []
      );
    } catch (error) {
      setXato(error.message);
    }
  }

  async function yangiFoydalanuvchiQoshish() {
    setXato("");
    setXabarnoma("");

    if (!yangiUsername.trim() || !yangiPassword) {
      setXato("Yangi foydalanuvchi login va parolini kiriting.");
      return;
    }

    if (yangiPassword.length < 8) {
      setXato("Parol kamida 8 ta belgidan iborat bo‘lsin.");
      return;
    }

    try {
      const response = await fetch(`${API}/api/admin/users`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify({
          username: yangiUsername.trim(),
          password: yangiPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Foydalanuvchi qo‘shilmadi."
        );
      }

      setYangiUsername("");
      setYangiPassword("");
      setYangiParolKorsat(false);

      setXabarnoma("Foydalanuvchi muvaffaqiyatli qo‘shildi.");

      await foydalanuvchilarniYuklash();
    } catch (error) {
      setXato(error.message);
    }
  }

  async function foydalanuvchiniOchirish(user) {
    if (!ega || user.role === "owner") {
      setXato("Foydalanuvchilarni faqat EGA o‘chira oladi.");
      return;
    }

    const tasdiq = window.confirm(
      `${user.username} foydalanuvchisini o‘chirmoqchimisiz?`
    );

    if (!tasdiq) return;

    setOchirilayotganId(user.id);
    setXato("");

    try {
      const response = await fetch(
        `${API}/api/owner/users/${user.id}`,
        {
          method: "DELETE",
          headers: authHeaders(),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Foydalanuvchi o‘chirilmadi."
        );
      }

      setXabarnoma(`${user.username} o‘chirildi.`);

      await foydalanuvchilarniYuklash();
    } catch (error) {
      setXato(error.message);
    } finally {
      setOchirilayotganId(null);
    }
  }

  async function adminHuquqiniBerish() {
    setXato("");
    setXabarnoma("");

    if (!adminUsername.trim()) {
      setXato("Admin qilinadigan foydalanuvchi loginini kiriting.");
      return;
    }

    try {
      const response = await fetch(`${API}/api/owner/admins`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify({
          username: adminUsername.trim(),
          canAddUsers,
          canRequestGifts,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Admin huquqi berilmadi."
        );
      }

      setAdminUsername("");
      setXabarnoma("Admin huquqi berildi.");

      await foydalanuvchilarniYuklash();
    } catch (error) {
      setXato(error.message);
    }
  }

  async function adminHuquqiniBekorQilish(user) {
    if (!ega || user.role !== "admin") return;

    const tasdiq = window.confirm(
      `${user.username} adminlik huquqini bekor qilasizmi?`
    );

    if (!tasdiq) return;

    setXato("");

    try {
      const response = await fetch(
        `${API}/api/owner/admins/${user.id}`,
        {
          method: "DELETE",
          headers: authHeaders(),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Admin huquqi bekor qilinmadi."
        );
      }

      setXabarnoma(
        `${user.username} endi oddiy foydalanuvchi.`
      );

      await foydalanuvchilarniYuklash();
    } catch (error) {
      setXato(error.message);
    }
  }

  // Mikrofon orqali ovoz yozish va server orqali matnga aylantirish
  async function ovozliSavol() {
    if (ovozYozilmoqda) {
      ovozniYozishniToxtatish();
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setXato("Brauzeringiz ovoz yozishni qo‘llab-quvvatlamaydi.");
      return;
    }

    try {
      setXato("");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      audioChunksRef.current = [];

      const turlar = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/ogg;codecs=opus",
        "audio/ogg",
        "audio/mp4",
      ];

      const tanlanganTur = turlar.find((tur) =>
        MediaRecorder.isTypeSupported(tur)
      );

      const recorder = tanlanganTur
        ? new MediaRecorder(stream, { mimeType: tanlanganTur })
        : new MediaRecorder(stream);

      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onerror = () => {
        setXato("Ovoz yozishda xatolik yuz berdi. Qayta urinib ko‘ring.");
        setOvozYozilmoqda(false);
        stream.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
      };

      recorder.onstop = async () => {
        setOvozYozilmoqda(false);
        setOvozAylantirilmoqda(true);
        stream.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;

        try {
          const audioBlob = new Blob(audioChunksRef.current, {
            type: recorder.mimeType || "audio/webm",
          });

          if (!audioBlob.size) {
            throw new Error("Ovoz yozilmadi. Mikrofonni tekshiring.");
          }

          if (audioBlob.size > 5 * 1024 * 1024) {
            throw new Error("Ovoz yozuvi 5 MB dan katta. Qisqaroq gapiring.");
          }

          const dataUrl = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result || ""));
            reader.onerror = () => reject(new Error("Ovoz faylini o‘qib bo‘lmadi."));
            reader.readAsDataURL(audioBlob);
          });

          const vergulIndex = dataUrl.indexOf(",");

          if (vergulIndex === -1) {
            throw new Error("Ovoz faylini tayyorlashda xatolik yuz berdi.");
          }

          const audio = dataUrl.slice(vergulIndex + 1);
          const mimeType = (audioBlob.type || "audio/webm").split(";")[0];

          const response = await fetch(`${API}/api/transcribe`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...authHeaders(),
            },
            body: JSON.stringify({ audio, mimeType }),
          });

          const data = await response.json();

          if (!response.ok) {
            throw new Error(data.error || "Ovoz matnga aylantirilmadi.");
          }

          const matn = String(data.matn || "").trim();

          if (!matn) {
            throw new Error("Ovozdan matn aniqlanmadi. Qayta urinib ko‘ring.");
          }

          setSavol((old) => (old ? `${old} ${matn}` : matn));
          setJavob("");
          setTanlangan(null);
          setXato("");
        } catch (error) {
          setXato(error.message || "Ovoz matnga aylantirilmadi.");
        } finally {
          setOvozAylantirilmoqda(false);
          audioChunksRef.current = [];
          mediaRecorderRef.current = null;
        }
      };

      recorder.start();
      setOvozYozilmoqda(true);
    } catch (error) {
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
      setOvozYozilmoqda(false);

      if (
        error.name === "NotAllowedError" ||
        error.name === "PermissionDeniedError"
      ) {
        setXato("Mikrofondan foydalanishga ruxsat bering.");
      } else {
        setXato(error.message || "Mikrofonni ishga tushirib bo‘lmadi.");
      }
    }
  }

  function ovozniYozishniToxtatish() {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
  }

  async function javobniOqish() {
    if (!javob?.trim()) return;

    try {
      setXato("");
      setOvozliJavob(true);
      setOvozYaratilmoqda(true);

      const controller = new AbortController();
      speechAbortRef.current = controller;

      const response = await fetch(`${API}/api/speech`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify({ text: javob.trim() }),
        signal: controller.signal,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Ovoz yaratilmadi.");
      }

      if (!data.audio) {
        throw new Error("Server ovoz faylini qaytarmadi.");
      }

      const audioBytes = Uint8Array.from(
        atob(data.audio),
        (belgi) => belgi.charCodeAt(0)
      );

      const audioBlob = new Blob([audioBytes], {
        type: data.mimeType || "audio/wav",
      });

      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
      }

      const audioUrl = URL.createObjectURL(audioBlob);
      audioUrlRef.current = audioUrl;

      const audio = new Audio(audioUrl);
      audioJavobRef.current = audio;

      audio.onended = () => {
        setOvozliJavob(false);
        audioJavobRef.current = null;

        if (audioUrlRef.current) {
          URL.revokeObjectURL(audioUrlRef.current);
          audioUrlRef.current = null;
        }
      };

      audio.onerror = () => {
        setOvozliJavob(false);
        setXato("Ovoz faylini ijro qilib bo‘lmadi.");
        audioJavobRef.current = null;
      };

      await audio.play();
    } catch (error) {
      if (error.name !== "AbortError") {
        console.error("Ovozli javob xatosi:", error);
        setXato(error.message || "Ovozli javobni yaratib bo‘lmadi.");
      }

      setOvozliJavob(false);
    } finally {
      setOvozYaratilmoqda(false);
      speechAbortRef.current = null;
    }
  }

  // Ovozli javobni to‘xtatish
  function ovozniToxtatish() {
    speechAbortRef.current?.abort();
    speechAbortRef.current = null;

    if (audioJavobRef.current) {
      audioJavobRef.current.pause();
      audioJavobRef.current.currentTime = 0;
      audioJavobRef.current = null;
    }

    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }

    setOvozYaratilmoqda(false);
    setOvozliJavob(false);
  }

  // AI ga savol va rasm yuborish
  async function aiDanSorash() {
    if (!savol.trim() && !rasm) {
      setXato("Savol yozing yoki rasm yuklang!");
      return;
    }

    const currentPlan = String(obuna?.tarif || "FREE").toUpperCase();
    const planLimit = getMaxAllowedClassForPlan(currentPlan);

    if (Number(sinf) > planLimit) {
      setXato(
        `${sinf}-sinf savol uchun ${currentPlan === "FREE" ? "PRO yoki PRO MAX" : currentPlan === "PRO" ? "PRO MAX" : "yangi tarif"} kerak. Tariflarni ko‘rib chiqish uchun yuqoridagi "Tariflarni ko‘rish" tugmasini bosing.`
      );
      setPremiumOyna(true);
      return;
    }

    setAiYuklanmoqda(true);
    setJavob("");
    setXato("");

    try {
      const response = await fetch(`${API}/api/savol`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify({
          savol: savol.trim(),
          class_level: Number(sinf),
          rasm: rasm
            ? {
                mimeType: rasm.mimeType,
                data: rasm.data,
              }
            : undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "AI javob bera olmadi.");
      }

      setJavob(data.javob || "AI javob qaytarmadi.");

      const yangiSavol = {
        id: Date.now(),
        matn: savol.trim() || `Rasm: ${rasm.nomi}`,
        javob: data.javob || "",
        vaqt: new Date().toLocaleString("uz-UZ"),
      };

      setTarix((eski) => [yangiSavol, ...eski]);
    } catch (error) {
      setXato(error.message);
    } finally {
      setAiYuklanmoqda(false);
    }
  }

  function tarixdanOchish(item) {
    setSavol(item.matn);
    setJavob(item.javob || "");
    setTanlangan(item.id);
    setRasm(null);
    setRasmMenyu(false);

    const galereyaInput = document.getElementById("savol-rasmi");
    const kameraInput = document.getElementById("kamera-rasmi");

    if (galereyaInput) galereyaInput.value = "";
    if (kameraInput) kameraInput.value = "";
  }

  function savolniOchirish(id) {
    setTarix((eski) =>
      eski.filter((item) => item.id !== id)
    );

    if (tanlangan === id) {
      setTanlangan(null);
      setJavob("");
    }
  }

  async function demoObuna() {
    if (!token) {
      setXato("Tarifni saqlash uchun avval tizimga kiring.");
      return;
    }

    const planToSave = tanlanganTarif || "FREE";

    if (planToSave !== "FREE") {
      setXato("To‘lov tizimi tez orada ulanadi. Hozircha faqat FREE tarif ishlaydi.");
      return;
    }

    try {
      const response = await fetch(`${API}/api/auth/subscription`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify({
          plan: planToSave,
          class_level: sinf,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Tarifni yangilab bo‘lmadi.");
      }

      setObuna({
        tarif: planToSave,
        tugashVaqti: null,
      });

      setFoydalanuvchi((old) => old ? {
        ...old,
        subscription_plan: planToSave,
        class_level: sinf,
      } : old);

      setPremiumOyna(false);
      setXato("");
      setXabarnoma("FREE tarif faollashtirildi.");
    } catch (error) {
      setXato(error.message);
    }
  }

  const amaldagiObuna =
    obuna.tugashVaqti && Date.now() > obuna.tugashVaqti
      ? { tarif: "FREE", tugashVaqti: null }
      : obuna;

  if (!foydalanuvchi) {
    return (
      <main className="container">
        <section className="panel auth-panel">
          <Logo />

          <h1>O‘quvchi AI</h1>

          <p className="hint">
            {rejim === "login"
              ? "Hisobingizga kiring."
              : "Yangi hisob yarating."}
          </p>

          <input
            type="text"
            placeholder="Login"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />

          <div className="password-box">
            <input
              type={parolKorsat ? "text" : "password"}
              placeholder="Parol"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

            <button
              type="button"
              className="secondary"
              onClick={() => setParolKorsat(!parolKorsat)}
            >
              {parolKorsat ? "Yashirish" : "Ko‘rsatish"}
            </button>
          </div>

          {rejim === "register" && (
            <div className="password-box">
              <input
                type={takrorParolKorsat ? "text" : "password"}
                placeholder="Parolni takrorlang"
                value={parolTakror}
                onChange={(e) => setParolTakror(e.target.value)}
              />

              <button
                type="button"
                className="secondary"
                onClick={() =>
                  setTakrorParolKorsat(!takrorParolKorsat)
                }
              >
                {takrorParolKorsat ? "Yashirish" : "Ko‘rsatish"}
              </button>
            </div>
          )}

          {xato && <p className="error">{xato}</p>}

          <button
            className="primary"
            onClick={autentifikatsiya}
            disabled={yuklanmoqda}
          >
            {yuklanmoqda
              ? "Kuting..."
              : rejim === "login"
                ? "Kirish"
                : "Ro‘yxatdan o‘tish"}
          </button>

          <button
            className="secondary"
            onClick={() => {
              setRejim(
                rejim === "login" ? "register" : "login"
              );
              setXato("");
              setParolKorsat(false);
              setTakrorParolKorsat(false);
            }}
          >
            {rejim === "login"
              ? "Hisob yaratish"
              : "Hisobim bor, kirish"}
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="container">
      <header className="top">
        <Logo />

        <div className="brand-text">
          <h1>O‘quvchi AI</h1>
          <p>
            Assalomu alaykum,{" "}
            {foydalanuvchi.username || "foydalanuvchi"}!
          </p>
          <small>
            Hisob turi:{" "}
            {ega ? "EGA" : admin ? "ADMIN" : "Foydalanuvchi"}
          </small>
        </div>

        <button className="secondary" onClick={chiqish}>
          Chiqish
        </button>
      </header>

      <nav className="panel actions">
        <button
          className="secondary"
          onClick={() => setSahifa("asosiy")}
        >
          AI yordamchi
        </button>

        {admin && (
          <button
            className="secondary"
            onClick={() => {
              setSahifa("admin");
              foydalanuvchilarniYuklash();
            }}
          >
            ADMIN panel
          </button>
        )}

        {ega && (
          <button
            className="secondary"
            onClick={() => {
              setSahifa("ega");
              foydalanuvchilarniYuklash();
            }}
          >
            EGA panel
          </button>
        )}
      </nav>

      {sahifa === "asosiy" && (
        <>
          <section className="premium-banner">
            <div>
              <span className="premium-label">
                SENING TARIFING
              </span>

              <h2>{amaldagiObuna.tarif}</h2>

              <p>
                {amaldagiObuna.tugashVaqti
                  ? `${new Date(
                      amaldagiObuna.tugashVaqti
                    ).toLocaleDateString("uz-UZ")} gacha`
                  : "Bepul tarif"}
              </p>

              {!admin && (
                <button
                  className="premium-button"
                  onClick={() => setPremiumOyna(true)}
                >
                  Tariflarni ko‘rish
                </button>
              )}
            </div>

            <div className="crown">👑</div>
          </section>

          <section className="panel">
            <h2>Yangi savol</h2>

            <div className="grade-picker-wrap">
              <label htmlFor="sinfTanlash">Sinfni tanlang</label>
              <select
                id="sinfTanlash"
                value={sinf}
                onChange={(event) => setSinf(Number(event.target.value))}
              >
                {SINFLAR.map((sinfItem) => (
                  <option key={sinfItem} value={sinfItem}>
                    {sinfItem}-sinf
                  </option>
                ))}
              </select>
            </div>

            <p className="hint">
              {`Sizning hozirgi tarifingiz: ${amaldagiObuna.tarif}. `}
              {`Bu tarifda ${getMaxAllowedClassForPlan(amaldagiObuna.tarif || "FREE")}-sinfgacha savollar qabul qilinadi.`}
            </p>

            <p className="hint">
              Savolingni yoz yoki rasm yukla. AI fanlar,
              ingliz tili va dasturlash bo‘yicha yordam beradi.
            </p>

            <textarea
              value={savol}
              onChange={(e) => {
                setSavol(e.target.value);
                setTanlangan(null);
                setJavob("");
              }}
              onPaste={(e) => {
                const items = Array.from(e.clipboardData.items);

                const rasmItem = items.find((item) =>
                  item.type.startsWith("image/")
                );

                if (rasmItem) {
                  const fayl = rasmItem.getAsFile();

                  if (fayl) {
                    e.preventDefault();
                    rasmniQabulQilish(fayl);
                  }
                }
              }}
              placeholder="Savolingni yoz yoki rasmni Ctrl + V orqali joylashtir..."
            />

            <button
              type="button"
              className="secondary"
              onClick={
                ovozYozilmoqda
                  ? ovozniYozishniToxtatish
                  : ovozliSavol
              }
              disabled={ovozAylantirilmoqda}
            >
              {ovozAylantirilmoqda
                ? "Ovoz matnga aylantirilmoqda..."
                : ovozYozilmoqda
                  ? "Ovoz yozishni tugatish"
                  : "Mikrofon orqali savol berish"}
            </button>

            {/* Rasm yuklash: bitta + tugmasi */}
            <div className="image-upload">
              <button
                type="button"
                className="plus-button"
                onClick={() => setRasmMenyu((old) => !old)}
                aria-label="Rasm qo‘shish"
              >
                +
              </button>

              {rasmMenyu && (
                <div className="image-menu">
                  <label htmlFor="savol-rasmi">
                    Galereyadan rasm tanlash
                  </label>

                  <label htmlFor="kamera-rasmi">
                    Kamera orqali suratga olish
                  </label>
                </div>
              )}

              <input
                id="savol-rasmi"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={rasmTanlash}
                hidden
              />

              <input
                id="kamera-rasmi"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                capture="environment"
                onChange={rasmTanlash}
                hidden
              />

              {rasm && (
                <div className="image-preview">
                  <img
                    src={rasm.preview}
                    alt="Yuklangan rasm"
                    style={{
                      maxWidth: "100%",
                      maxHeight: "300px",
                      objectFit: "contain",
                      display: "block",
                      marginTop: "12px",
                      borderRadius: "12px",
                    }}
                  />

                  <p>{rasm.nomi}</p>

                  <button
                    type="button"
                    className="delete"
                    onClick={rasmniOchirish}
                  >
                    Rasmni o‘chirish
                  </button>
                </div>
              )}

              <small className="hint">
                JPG, PNG yoki WEBP. Maksimal hajmi: 50 MB.
                Rasm AI uchun avtomatik kichraytiriladi.
              </small>
            </div>

            <div className="actions">
              <button
                className="primary"
                onClick={aiDanSorash}
                disabled={
                  aiYuklanmoqda || (!savol.trim() && !rasm)
                }
              >
                {aiYuklanmoqda
                  ? "AI o‘ylayapti..."
                  : "AI dan javob olish"}
              </button>
            </div>

            {xato && <p className="error">{xato}</p>}

            {javob && (
              <div className="ai-answer">
                <h2>AI javobi</h2>
                <div className="answer-text markdown-body">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    rehypePlugins={[rehypeSanitize]}
                  >
                    {javob}
                  </ReactMarkdown>
                </div>

                <button
                  type="button"
                  className="secondary"
                  onClick={
                    ovozliJavob
                      ? ovozniToxtatish
                      : javobniOqish
                  }
                >
                  {ovozYaratilmoqda
                    ? "Ovoz tayyorlanmoqda..."
                    : ovozliJavob
                      ? "Ovozni to‘xtatish"
                      : "Javobni ovoz chiqarib o‘qish"}
                </button>
              </div>
            )}
          </section>

          <section className="panel history">
            <div className="history-title">
              <h2>Oldingi savollar</h2>
              <span>{tarix.length} ta</span>
            </div>

            {tarix.length === 0 ? (
              <p className="hint">
                Hozircha savollar saqlanmagan.
              </p>
            ) : (
              <div className="history-list">
                {tarix.map((item) => (
                  <article
                    className="history-item"
                    key={item.id}
                  >
                    <button
                      className="question-open"
                      onClick={() => tarixdanOchish(item)}
                    >
                      <strong>{item.matn.slice(0, 90)}</strong>
                      <small>{item.vaqt}</small>
                    </button>

                    <button
                      className="delete"
                      onClick={() => savolniOchirish(item.id)}
                    >
                      O‘chirish
                    </button>
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {sahifa === "admin" && admin && (
        <section className="panel">
          <h2>ADMIN panel</h2>

          <p className="hint">
            Bu panelda barcha foydalanuvchilar ro‘yxati ko‘rsatiladi:
            email, ro‘yxatdan o‘tgan sana va joriy tarif.
          </p>

          {ruxsat.canAddUsers === true ? (
            <div className="admin-add">
              <h3>Foydalanuvchi qo‘shish</h3>

              <input
                placeholder="Yangi foydalanuvchi logini"
                value={yangiUsername}
                onChange={(e) =>
                  setYangiUsername(e.target.value)
                }
              />

              <div className="password-box">
                <input
                  type={
                    yangiParolKorsat ? "text" : "password"
                  }
                  placeholder="Yangi foydalanuvchi paroli"
                  value={yangiPassword}
                  onChange={(e) =>
                    setYangiPassword(e.target.value)
                  }
                />

                <button
                  type="button"
                  className="secondary"
                  onClick={() =>
                    setYangiParolKorsat(!yangiParolKorsat)
                  }
                >
                  {yangiParolKorsat
                    ? "Yashirish"
                    : "Ko‘rsatish"}
                </button>
              </div>

              <button
                className="primary"
                onClick={yangiFoydalanuvchiQoshish}
              >
                Foydalanuvchi qo‘shish
              </button>
            </div>
          ) : (
            <p className="hint">
              Sizga foydalanuvchi qo‘shish huquqi berilmagan.
              EGA bilan bog‘laning.
            </p>
          )}

          {xato && <p className="error">{xato}</p>}
          {xabarnoma && (
            <p className="success">{xabarnoma}</p>
          )}

          <button
            className="secondary"
            onClick={foydalanuvchilarniYuklash}
          >
            Ro‘yxatni yangilash
          </button>

          <h3>Foydalanuvchilar</h3>

          {foydalanuvchilar.length === 0 ? (
            <p className="hint">
              Hozircha ro‘yxatda foydalanuvchi yo‘q.
            </p>
          ) : (
            <div className="admin-user-list">
              {foydalanuvchilar.map((user) => (
                <article className="history-item admin-user-row" key={user.id}>
                  <div className="admin-user-meta">
                    <strong>{user.username}</strong>
                    <small>Email: {user.email || user.username}</small>
                    <small>Ro‘yxatdan o‘tgan: {user.created_at ? new Date(user.created_at).toLocaleDateString("uz-UZ") : "-"}</small>
                    <small>Tarif: {user.subscription_plan || "FREE"}</small>
                  </div>
                  <span className="admin-user-role">{user.role}</span>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {sahifa === "ega" && ega && (
        <section className="panel">
          <h2>EGA boshqaruv paneli</h2>

          <p className="hint">
            Barcha foydalanuvchilarni boshqarish faqat EGA
            vakolatida.
          </p>

          <div className="admin-add">
            <h3>Foydalanuvchi qo‘shish</h3>

            <input
              placeholder="Yangi foydalanuvchi logini"
              value={yangiUsername}
              onChange={(e) =>
                setYangiUsername(e.target.value)
              }
            />

            <div className="password-box">
              <input
                type={
                  yangiParolKorsat ? "text" : "password"
                }
                placeholder="Yangi foydalanuvchi paroli"
                value={yangiPassword}
                onChange={(e) =>
                  setYangiPassword(e.target.value)
                }
              />

              <button
                type="button"
                className="secondary"
                onClick={() =>
                  setYangiParolKorsat(!yangiParolKorsat)
                }
              >
                {yangiParolKorsat
                  ? "Yashirish"
                  : "Ko‘rsatish"}
              </button>
            </div>

            <button
              className="primary"
              onClick={yangiFoydalanuvchiQoshish}
            >
              Foydalanuvchi qo‘shish
            </button>
          </div>

          <div className="admin-add">
            <h3>Admin tayinlash</h3>

            <p className="hint">
              Mavjud oddiy foydalanuvchining loginini kiriting.
            </p>

            <input
              placeholder="Admin qilinadigan login"
              value={adminUsername}
              onChange={(e) =>
                setAdminUsername(e.target.value)
              }
            />

            <label className="permission-row">
              <input
                type="checkbox"
                checked={canAddUsers}
                onChange={(e) =>
                  setCanAddUsers(e.target.checked)
                }
              />
              Foydalanuvchi qo‘shish huquqi
            </label>

            <label className="permission-row">
              <input
                type="checkbox"
                checked={canRequestGifts}
                onChange={(e) =>
                  setCanRequestGifts(e.target.checked)
                }
              />
              Sovg‘a obunasi so‘rash huquqi
            </label>

            <button
              className="primary"
              onClick={adminHuquqiniBerish}
            >
              Admin huquqini berish
            </button>
          </div>

          {xato && <p className="error">{xato}</p>}
          {xabarnoma && (
            <p className="success">{xabarnoma}</p>
          )}

          <button
            className="secondary"
            onClick={foydalanuvchilarniYuklash}
          >
            Ro‘yxatni yangilash
          </button>

          <h3>Barcha foydalanuvchilar</h3>

          {foydalanuvchilar.map((user) => {
            let perms = {};

            try {
              perms = JSON.parse(user.permissions || "{}");
            } catch {
              perms = {};
            }

            return (
              <article
                className="history-item"
                key={user.id}
              >
                <div>
                  <strong>{user.username}</strong>

                  <small>
                    Rol: {user.role}
                    {user.created_by
                      ? ` · Qo‘shgan foydalanuvchi ID: ${user.created_by}`
                      : ""}
                  </small>

                  {user.role === "admin" && (
                    <small>
                      Foydalanuvchi qo‘shish:{" "}
                      {perms.canAddUsers ? "Ha" : "Yo‘q"}
                      {" · "}
                      Sovg‘a so‘rash:{" "}
                      {perms.canRequestGifts ? "Ha" : "Yo‘q"}
                    </small>
                  )}
                </div>

                {user.role === "admin" && (
                  <button
                    className="secondary"
                    onClick={() =>
                      adminHuquqiniBekorQilish(user)
                    }
                  >
                    Adminlikni bekor qilish
                  </button>
                )}

                {user.role !== "owner" && (
                  <button
                    className="delete"
                    onClick={() =>
                      foydalanuvchiniOchirish(user)
                    }
                    disabled={ochirilayotganId === user.id}
                  >
                    {ochirilayotganId === user.id
                      ? "O‘chirilmoqda..."
                      : "O‘chirish"}
                  </button>
                )}
              </article>
            );
          })}
        </section>
      )}

      <footer>
        Savollar tarixi ushbu brauzerda saqlanadi.
        <br />
        Tariflar hozircha demo rejimida ishlaydi.
      </footer>

      {premiumOyna && (
        <div
          className="modal-overlay"
          onClick={() => setPremiumOyna(false)}
        >
          <section
            className="premium-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="modal-close"
              onClick={() => setPremiumOyna(false)}
            >
              ×
            </button>

            <p className="premium-label">
              O‘QUVCHI AI TARIFLARI
            </p>

            <h2>O‘zingga mos tarifni tanla</h2>

            <div className="tariff-list">
              {TARIFLAR.map((tarif) => (
                <article
                  key={tarif.nom}
                  className={`tariff-card tariff-${tarif.theme} ${
                    tanlanganTarif === tarif.nom
                      ? "tariff-selected"
                      : ""
                  }`}
                >
                  <div className="tariff-header">
                    <div className={`tariff-icon tariff-${tarif.theme}`}>
                      {tarif.icon}
                    </div>

                    <span className={`tariff-badge tariff-${tarif.theme}`}>
                      {tarif.badge}
                    </span>
                  </div>

                  <h3>{tarif.nom}</h3>
                  <p>{tarif.tavsif}</p>

                  <div className="tariff-price">
                    {tarif.narx.toLocaleString("uz-UZ")} so‘m
                    <small>/ oy</small>
                  </div>

                  <ul>
                    {tarif.imkoniyatlar.map((imkoniyat) => (
                      <li key={imkoniyat}>
                        <span className="check-mark">✓</span> {imkoniyat}
                      </li>
                    ))}
                  </ul>

                  <button
                    className="premium-button"
                    onClick={() => {
                      if (tarif.nom === "FREE") {
                        setTanlanganTarif("FREE");
                        return;
                      }

                      setTanlanganTarif(tarif.nom);
                    }}
                    disabled={tarif.nom !== "FREE"}
                  >
                    {tarif.nom === "FREE"
                      ? tanlanganTarif === tarif.nom
                        ? "Tanlandi"
                        : "Tarifni tanlash"
                      : "Tez orada"}
                  </button>
                </article>
              ))}
            </div>

            {tanlanganTarif === "FREE" && (
              <div className="duration-box">
                <h3>FREE tarif</h3>
                <p>Bu tarif hozircha faqat bepul imkoniyatlar bilan ishlaydi.</p>
              </div>
            )}

            {tanlanganTarif !== "FREE" && (
              <div className="duration-box">
                <h3>To‘lov tizimi</h3>
                <p>Tez orada. Click, Payme yoki plastik karta to‘lovi qo‘shiladi.</p>
              </div>
            )}

            <p className="payment-notice">
              Hozircha faqat FREE tarif faol. Pullik tariflar tez orada ulanadi.
            </p>

            <button
              className="premium-button modal-button"
              onClick={demoObuna}
              disabled={tanlanganTarif !== "FREE"}
            >
              {tanlanganTarif === "FREE"
                ? "FREE tarifini faollashtirish"
                : "Tez orada"}
            </button>

            <button
              className="secondary modal-button"
              onClick={() => setPremiumOyna(false)}
            >
              Yopish
            </button>
          </section>
        </div>
      )}
    </main>
  );
}

export default App;