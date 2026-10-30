import { useState, useEffect } from "react";
import "./App.css";

const API = "http://localhost:3001";

const TARIFLAR = [
  {
    nom: "FREE",
    narx: 0,
    tavsif: "Boshlash uchun",
    imkoniyatlar: [
      "AI savol-javob",
      "Savollar tarixi",
      "Oddiy tushuntirishlar",
    ],
  },
  {
    nom: "PRO",
    narx: 15000,
    tavsif: "Ko‘proq imkoniyatlar",
    imkoniyatlar: [
      "FREE imkoniyatlari",
      "Ko‘proq savol berish",
      "Batafsil tushuntirishlar",
    ],
  },
  {
    nom: "PRO MAX",
    narx: 30000,
    tavsif: "To‘liq imkoniyatlar",
    imkoniyatlar: [
      "PRO imkoniyatlari",
      "Kengaytirilgan AI",
      "Ustuvor foydalanish",
      "3 oy olganda 1 oy bonus",
    ],
  },
];

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

  const [tarix, setTarix] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("savollarTarixi")) || [];
    } catch {
      return [];
    }
  });

  const [tanlangan, setTanlangan] = useState(null);

  const [premiumOyna, setPremiumOyna] = useState(false);
  const [tanlanganTarif, setTanlanganTarif] = useState("PRO MAX");
  const [muddat, setMuddat] = useState(1);

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

        setFoydalanuvchi(data.foydalanuvchi || data.user || data);
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

      setFoydalanuvchi(data.foydalanuvchi || data.user || null);
      setToken(data.token);

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

  async function aiDanSorash() {
    if (!savol.trim()) {
      alert("Avval savolni kiriting!");
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
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "AI javob bera olmadi.");
      }

      setJavob(data.javob || "AI javob qaytarmadi.");

      const yangiSavol = {
        id: Date.now(),
        matn: savol.trim(),
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

  function demoObuna() {
    if (tanlanganTarif === "FREE") {
      setObuna({
        tarif: "FREE",
        tugashVaqti: null,
      });

      setPremiumOyna(false);
      return;
    }

    const jamiOy =
      tanlanganTarif === "PRO MAX" && muddat === 3
        ? 4
        : muddat;

    setObuna({
      tarif: tanlanganTarif,
      tugashVaqti:
        Date.now() + jamiOy * 30 * 24 * 60 * 60 * 1000,
    });

    setPremiumOyna(false);

    alert(
      `Demo: ${tanlanganTarif} ${jamiOy} oyga faollashtirildi. Pul yechilmadi.`
    );
  }

  const amaldagiObuna =
    obuna.tugashVaqti && Date.now() > obuna.tugashVaqti
      ? { tarif: "FREE", tugashVaqti: null }
      : obuna;

  if (!foydalanuvchi) {
    return (
      <main className="container">
        <section className="panel auth-panel">
          <div className="logo">AI</div>
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
        <div className="logo">AI</div>

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

              <button
                className="premium-button"
                onClick={() => setPremiumOyna(true)}
              >
                Tariflarni ko‘rish
              </button>
            </div>

            <div className="crown">👑</div>
          </section>

          <section className="panel">
            <h2>Yangi savol</h2>

            <p className="hint">
              Savolingni yoz. AI fanlar, ingliz tili va
              dasturlash bo‘yicha yordam beradi.
            </p>

            <textarea
              value={savol}
              onChange={(e) => {
                setSavol(e.target.value);
                setTanlangan(null);
                setJavob("");
              }}
              placeholder="Savolingni shu yerga yoz..."
            />

            <div className="actions">
              <button
                className="primary"
                onClick={aiDanSorash}
                disabled={aiYuklanmoqda}
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
                <p className="answer-text">{javob}</p>
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
            Bu panelda faqat o‘zingiz qo‘shgan oddiy
            foydalanuvchilar ko‘rsatiladi. Ularni o‘chira
            olmaysiz va boshqa admin tayinlay olmaysiz.
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

          <h3>Siz qo‘shgan foydalanuvchilar</h3>

          {foydalanuvchilar.length === 0 ? (
            <p className="hint">
              Hozircha ro‘yxatda foydalanuvchi yo‘q.
            </p>
          ) : (
            foydalanuvchilar.map((user) => (
              <article
                className="history-item"
                key={user.id}
              >
                <strong>{user.username}</strong>
                <span>Foydalanuvchi</span>
              </article>
            ))
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
                  className={`tariff-card ${
                    tanlanganTarif === tarif.nom
                      ? "tariff-selected"
                      : ""
                  }`}
                >
                  <h3>{tarif.nom}</h3>
                  <p>{tarif.tavsif}</p>

                  <div className="tariff-price">
                    {tarif.narx.toLocaleString("uz-UZ")} so‘m
                    <small>/ oy</small>
                  </div>

                  <ul>
                    {tarif.imkoniyatlar.map((imkoniyat) => (
                      <li key={imkoniyat}>
                        ✓ {imkoniyat}
                      </li>
                    ))}
                  </ul>

                  <button
                    className="premium-button"
                    onClick={() => {
                      setTanlanganTarif(tarif.nom);
                      setMuddat(1);
                    }}
                  >
                    {tanlanganTarif === tarif.nom
                      ? "Tanlandi"
                      : "Tarifni tanlash"}
                  </button>
                </article>
              ))}
            </div>

            {tanlanganTarif !== "FREE" && (
              <div className="duration-box">
                <h3>Obuna muddati</h3>

                <div className="duration-buttons">
                  {[1, 3].map((oy) => (
                    <button
                      key={oy}
                      className={
                        muddat === oy ? "duration-active" : ""
                      }
                      onClick={() => setMuddat(oy)}
                    >
                      {oy} oy
                    </button>
                  ))}
                </div>

                {tanlanganTarif === "PRO MAX" &&
                  muddat === 3 && (
                    <p className="success">
                      3 oy uchun 1 oy bonus! Jami 4 oy.
                    </p>
                  )}

                <p>
                  Demo narx:{" "}
                  <strong>
                    {(
                      TARIFLAR.find(
                        (t) => t.nom === tanlanganTarif
                      ).narx * muddat
                    ).toLocaleString("uz-UZ")}{" "}
                    so‘m
                  </strong>
                </p>
              </div>
            )}

            <p className="payment-notice">
              Bu sinov to‘lovi. Haqiqiy pul yechilmaydi.
            </p>

            <button
              className="premium-button modal-button"
              onClick={demoObuna}
            >
              Demo orqali faollashtirish
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