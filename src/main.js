import "./styles.css";
import { createClient } from "@supabase/supabase-js";

const eventStart = new Date("2026-07-18T16:00:00-03:00");
const eventEnd = new Date("2026-07-18T20:00:00-03:00");
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabaseBucket = import.meta.env.VITE_SUPABASE_BUCKET || "guest-photos";
const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;
const adminUser = "CARLOSHENRIQUE";
const adminPasswordHash = "22ed5a7a4d808106ceedad5208b9d3c2915568b5c7bc6093389b43b8434e77e4";
const adminSessionKey = "ch-gallery-admin";

const units = {
  days: document.querySelector("#days"),
  hours: document.querySelector("#hours"),
  minutes: document.querySelector("#minutes"),
  seconds: document.querySelector("#seconds"),
};
const accessYear = document.querySelector("#accessYear");
const galleryInput = document.querySelector("#galleryInput");
const photoAuthorInput = document.querySelector("#photoAuthor");
const photoMessageInput = document.querySelector("#photoMessage");
const galleryPreview = document.querySelector("#galleryPreview");
const uploadStatus = document.querySelector("#uploadStatus");
const adminLoginForm = document.querySelector("#adminLoginForm");
const adminUserInput = document.querySelector("#adminUser");
const adminPasswordInput = document.querySelector("#adminPassword");
const adminStatus = document.querySelector("#adminStatus");
const adminPending = document.querySelector("#adminPending");
const adminLogout = document.querySelector("#adminLogout");
let galleryPhotoUrls = [];

accessYear.textContent = new Date().getFullYear();

function pad(value) {
  return String(value).padStart(2, "0");
}

function updateCountdown() {
  const now = new Date();
  const distance = Math.max(0, eventStart.getTime() - now.getTime());

  const days = Math.floor(distance / 86400000);
  const hours = Math.floor((distance % 86400000) / 3600000);
  const minutes = Math.floor((distance % 3600000) / 60000);
  const seconds = Math.floor((distance % 60000) / 1000);

  units.days.textContent = pad(days);
  units.hours.textContent = pad(hours);
  units.minutes.textContent = pad(minutes);
  units.seconds.textContent = pad(seconds);
}

function formatCalendarDate(date) {
  return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

function downloadCalendarInvite() {
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//CH 1 Ano//Convite//PT-BR",
    "BEGIN:VEVENT",
    `UID:ch-1-ano-${eventStart.toISOString()}@convite.local`,
    `DTSTAMP:${formatCalendarDate(new Date())}`,
    `DTSTART:${formatCalendarDate(eventStart)}`,
    `DTEND:${formatCalendarDate(eventEnd)}`,
    "SUMMARY:CH 1 Ano - Grande Final",
    "LOCATION:Salao de Festas Infantil da APUSM",
    "DESCRIPTION:Você é nosso convidado para essa grande final!",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "ch-1-ano.ics";
  link.click();
  URL.revokeObjectURL(link.href);
}

function setUploadStatus(message, state = "") {
  uploadStatus.textContent = message;
  uploadStatus.className = `upload-status${state ? ` is-${state}` : ""}`;
}

function setAdminStatus(message, state = "") {
  adminStatus.textContent = message;
  adminStatus.className = `admin-status${state ? ` is-${state}` : ""}`;
}

async function hashText(text) {
  const hashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(hashBuffer)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function isAdminLoggedIn() {
  return localStorage.getItem(adminSessionKey) === "active";
}

function encodePhotoDetails(details) {
  const json = JSON.stringify(details);
  const bytes = new TextEncoder().encode(json);
  const binary = [...bytes].map((byte) => String.fromCharCode(byte)).join("");
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function decodePhotoDetails(encodedDetails) {
  try {
    const base64 = encodedDetails.replace(/-/g, "+").replace(/_/g, "/");
    const paddedBase64 = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    const binary = atob(paddedBase64);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch (error) {
    return null;
  }
}

function getStoredPhotoDetails(storedName) {
  const parts = storedName.split("__");

  if (parts.length >= 4) {
    const details = decodePhotoDetails(parts[2]);

    if (details) {
      return {
        author: details.author || "Convidado",
        message: details.message || "",
        fileName: parts.slice(3).join("__") || storedName,
      };
    }
  }

  return {
    author: "",
    message: "",
    fileName: parts.slice(2).join("__") || storedName.split("-").slice(2).join("-") || storedName,
  };
}

function getStoredPhotoName(storedName) {
  return getStoredPhotoDetails(storedName).fileName;
}

function renderGalleryEmpty(title = "Nenhuma foto enviada ainda", message = "As primeiras memórias da festa aparecerão aqui.") {
  galleryPreview.innerHTML = `
    <div class="gallery-empty">
      <strong>${title}</strong>
      <span>${message}</span>
    </div>
  `;
}

function renderGalleryPhoto({ url, name, author = "", message = "" }) {
  const figure = document.createElement("figure");
  figure.className = "gallery-photo";

  const image = document.createElement("img");
  image.src = url;
  image.alt = `Foto enviada: ${name}`;

  const caption = document.createElement("figcaption");
  const authorLabel = document.createElement("strong");
  authorLabel.textContent = author || "Convidado";

  const messageText = document.createElement("p");
  messageText.textContent = message || name;

  caption.append(authorLabel, messageText);

  figure.append(image, caption);
  galleryPreview.append(figure);
}

async function loadStoredGalleryPhotos() {
  if (!supabase) {
    setUploadStatus("Configure a chave anon do Supabase para ativar o envio.", "error");
    return;
  }

  const { data, error } = await supabase.storage.from(supabaseBucket).list("approved", {
    limit: 100,
    sortBy: { column: "created_at", order: "desc" },
  });

  if (error) {
    setUploadStatus("Não foi possível carregar a galeria do Supabase.", "error");
    renderGalleryEmpty("Galeria indisponível", "Verifique o bucket guest-photos e as políticas públicas.");
    return;
  }

  galleryPreview.replaceChildren();

  if (!data || data.length === 0) {
    renderGalleryEmpty();
    setUploadStatus("Galeria pronta para receber fotos.", "success");
    return;
  }

  data
    .filter((item) => item.name && !item.name.endsWith("/"))
    .forEach((item) => {
      const { data: publicPhoto } = supabase.storage.from(supabaseBucket).getPublicUrl(`approved/${item.name}`);
      const details = getStoredPhotoDetails(item.name);
      renderGalleryPhoto({ url: publicPhoto.publicUrl, name: details.fileName, author: details.author, message: details.message });
    });

  setUploadStatus("Galeria sincronizada com Supabase.", "success");
}

async function uploadGalleryPhotos(photos, details) {
  if (!supabase) {
    setUploadStatus("Prévia local: falta configurar VITE_SUPABASE_ANON_KEY.", "error");
    return false;
  }

  setUploadStatus(`Enviando ${photos.length} foto${photos.length > 1 ? "s" : ""}...`);

  const uploads = photos.map(async (photo) => {
    const safeName = photo.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]/g, "-");
    const encodedDetails = encodePhotoDetails(details);
    const path = `pending/${Date.now()}__${crypto.randomUUID()}__${encodedDetails}__${safeName}`;
    const { error } = await supabase.storage.from(supabaseBucket).upload(path, photo, {
      cacheControl: "3600",
      upsert: false,
    });

    if (error) {
      throw error;
    }
  });

  await Promise.all(uploads);
  setUploadStatus("Fotos enviadas. Elas aparecerão após aprovação do admin.", "success");
  await loadStoredGalleryPhotos();
  setUploadStatus("Fotos enviadas. Elas aparecerão após aprovação do admin.", "success");
  if (isAdminLoggedIn()) {
    await loadPendingPhotos();
  }
  return true;
}

function renderPendingEmpty(message = "Nenhuma foto pendente no momento.") {
  adminPending.innerHTML = `
    <div class="gallery-empty">
      <strong>${message}</strong>
      <span>Novos envios aparecerão aqui para aprovação.</span>
    </div>
  `;
}

function renderPendingPhoto({ item, url }) {
  const details = getStoredPhotoDetails(item.name);
  const figure = document.createElement("figure");
  figure.className = "pending-photo";

  const image = document.createElement("img");
  image.src = url;
  image.alt = `Foto pendente: ${details.fileName}`;

  const caption = document.createElement("figcaption");
  const name = document.createElement("strong");
  name.textContent = details.fileName;

  const author = document.createElement("p");
  author.className = "pending-author";
  author.textContent = details.author ? `Autor: ${details.author}` : "Autor não informado";

  const message = document.createElement("p");
  message.className = "pending-message";
  message.textContent = details.message || "Sem mensagem.";

  const actions = document.createElement("div");
  actions.className = "pending-actions";

  const approveButton = document.createElement("button");
  approveButton.className = "approve";
  approveButton.type = "button";
  approveButton.textContent = "Aprovar";
  approveButton.addEventListener("click", () => approvePendingPhoto(item.name));

  const rejectButton = document.createElement("button");
  rejectButton.className = "reject";
  rejectButton.type = "button";
  rejectButton.textContent = "Reprovar";
  rejectButton.addEventListener("click", () => rejectPendingPhoto(item.name));

  actions.append(approveButton, rejectButton);
  caption.append(name, author, message, actions);
  figure.append(image, caption);
  adminPending.append(figure);
}

async function loadPendingPhotos() {
  if (!supabase || !isAdminLoggedIn()) {
    return;
  }

  setAdminStatus("Carregando fotos pendentes...");

  const { data, error } = await supabase.storage.from(supabaseBucket).list("pending", {
    limit: 100,
    sortBy: { column: "created_at", order: "desc" },
  });

  if (error) {
    setAdminStatus("Não foi possível carregar as pendências.", "error");
    renderPendingEmpty("Erro ao buscar fotos pendentes.");
    return;
  }

  adminPending.replaceChildren();

  const pendingPhotos = (data || []).filter((item) => item.name && !item.name.endsWith("/"));

  if (pendingPhotos.length === 0) {
    renderPendingEmpty();
    setAdminStatus("Admin conectado. Sem fotos pendentes.", "success");
    return;
  }

  pendingPhotos.forEach((item) => {
    const { data: pendingPhoto } = supabase.storage.from(supabaseBucket).getPublicUrl(`pending/${item.name}`);
    renderPendingPhoto({ item, url: pendingPhoto.publicUrl });
  });

  setAdminStatus(`${pendingPhotos.length} foto${pendingPhotos.length > 1 ? "s" : ""} aguardando aprovação.`, "success");
}

async function approvePendingPhoto(name) {
  setAdminStatus("Aprovando foto...");
  const source = `pending/${name}`;
  const destination = `approved/${name}`;
  const { error: copyError } = await supabase.storage.from(supabaseBucket).copy(source, destination);

  if (copyError) {
    setAdminStatus("Erro ao aprovar. Verifique as políticas de copy no bucket.", "error");
    return;
  }

  const { error: removeError } = await supabase.storage.from(supabaseBucket).remove([source]);

  if (removeError) {
    setAdminStatus("Foto aprovada, mas não foi removida dos pendentes.", "error");
    await loadStoredGalleryPhotos();
    await loadPendingPhotos();
    return;
  }

  setAdminStatus("Foto aprovada e publicada.", "success");
  await loadStoredGalleryPhotos();
  await loadPendingPhotos();
}

async function rejectPendingPhoto(name) {
  setAdminStatus("Reprovando foto...");
  const { error } = await supabase.storage.from(supabaseBucket).remove([`pending/${name}`]);

  if (error) {
    setAdminStatus("Erro ao reprovar. Verifique as políticas de delete no bucket.", "error");
    return;
  }

  setAdminStatus("Foto removida dos pendentes.", "success");
  await loadPendingPhotos();
}

function showAdminSession() {
  adminLoginForm.hidden = true;
  adminLogout.hidden = false;
  adminPending.hidden = false;
  setAdminStatus("Admin conectado. Carregando pendências...", "success");
  loadPendingPhotos();
}

function clearAdminSession() {
  localStorage.removeItem(adminSessionKey);
  adminLoginForm.hidden = false;
  adminLogout.hidden = true;
  adminPending.hidden = true;
  adminPending.replaceChildren();
  adminPasswordInput.value = "";
  setAdminStatus("Entre para revisar as fotos pendentes.");
}

document.querySelector("#calendarButton").addEventListener("click", downloadCalendarInvite);

adminLoginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const typedUser = adminUserInput.value.trim().toUpperCase();
  const typedPasswordHash = await hashText(adminPasswordInput.value);

  if (typedUser !== adminUser || typedPasswordHash !== adminPasswordHash) {
    setAdminStatus("Login ou senha inválidos.", "error");
    return;
  }

  localStorage.setItem(adminSessionKey, "active");
  showAdminSession();
});

adminLogout.addEventListener("click", clearAdminSession);

galleryInput.addEventListener("change", async () => {
  galleryPhotoUrls.forEach((url) => URL.revokeObjectURL(url));
  galleryPhotoUrls = [];
  galleryPreview.replaceChildren();

  const selectedPhotos = [...galleryInput.files].filter((file) => file.type.startsWith("image/"));
  const details = {
    author: photoAuthorInput.value.trim().slice(0, 60),
    message: photoMessageInput.value.trim().slice(0, 180),
  };

  if (selectedPhotos.length === 0) {
    renderGalleryEmpty();
    return;
  }

  if (!details.author) {
    galleryInput.value = "";
    renderGalleryEmpty();
    setUploadStatus("Informe o autor das fotos antes de selecionar os arquivos.", "error");
    photoAuthorInput.focus();
    return;
  }

  selectedPhotos.forEach((photo) => {
    const photoUrl = URL.createObjectURL(photo);
    galleryPhotoUrls.push(photoUrl);

    renderGalleryPhoto({ url: photoUrl, name: photo.name, author: details.author, message: details.message });
  });

  try {
    await uploadGalleryPhotos(selectedPhotos, details);
    galleryInput.value = "";
  } catch (error) {
    setUploadStatus("Erro ao enviar. Confira as permissões do bucket no Supabase.", "error");
  }
});

loadStoredGalleryPhotos();
if (isAdminLoggedIn()) {
  showAdminSession();
}
updateCountdown();
setInterval(updateCountdown, 1000);
