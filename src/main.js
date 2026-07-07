import "./styles.css";
import { createClient } from "@supabase/supabase-js";

const eventStart = new Date("2026-07-18T16:00:00-03:00");
const eventEnd = new Date("2026-07-18T20:00:00-03:00");
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabaseBucket = import.meta.env.VITE_SUPABASE_BUCKET || "guest-photos";
const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

const units = {
  days: document.querySelector("#days"),
  hours: document.querySelector("#hours"),
  minutes: document.querySelector("#minutes"),
  seconds: document.querySelector("#seconds"),
};
const accessYear = document.querySelector("#accessYear");
const galleryInput = document.querySelector("#galleryInput");
const galleryPreview = document.querySelector("#galleryPreview");
const uploadStatus = document.querySelector("#uploadStatus");
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

function renderGalleryEmpty(title = "Nenhuma foto enviada ainda", message = "As primeiras memórias da festa aparecerão aqui.") {
  galleryPreview.innerHTML = `
    <div class="gallery-empty">
      <strong>${title}</strong>
      <span>${message}</span>
    </div>
  `;
}

function renderGalleryPhoto({ url, name }) {
  const figure = document.createElement("figure");
  figure.className = "gallery-photo";

  const image = document.createElement("img");
  image.src = url;
  image.alt = `Foto enviada: ${name}`;

  const caption = document.createElement("figcaption");
  caption.textContent = name;

  figure.append(image, caption);
  galleryPreview.append(figure);
}

async function loadStoredGalleryPhotos() {
  if (!supabase) {
    setUploadStatus("Configure a chave anon do Supabase para ativar o envio.", "error");
    return;
  }

  const { data, error } = await supabase.storage.from(supabaseBucket).list("", {
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
      const { data: publicPhoto } = supabase.storage.from(supabaseBucket).getPublicUrl(item.name);
      renderGalleryPhoto({ url: publicPhoto.publicUrl, name: item.name.split("-").slice(2).join("-") || item.name });
    });

  setUploadStatus("Galeria sincronizada com Supabase.", "success");
}

async function uploadGalleryPhotos(photos) {
  if (!supabase) {
    setUploadStatus("Prévia local: falta configurar VITE_SUPABASE_ANON_KEY.", "error");
    return false;
  }

  setUploadStatus(`Enviando ${photos.length} foto${photos.length > 1 ? "s" : ""}...`);

  const uploads = photos.map(async (photo) => {
    const safeName = photo.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]/g, "-");
    const path = `${Date.now()}-${crypto.randomUUID()}-${safeName}`;
    const { error } = await supabase.storage.from(supabaseBucket).upload(path, photo, {
      cacheControl: "3600",
      upsert: false,
    });

    if (error) {
      throw error;
    }
  });

  await Promise.all(uploads);
  setUploadStatus("Fotos enviadas para a galeria.", "success");
  await loadStoredGalleryPhotos();
  return true;
}

async function shareInvite() {
  const shareData = {
    title: "CH 1 Ano",
    text: "Você é nosso convidado para a festa CH 1 Ano, dia 18/07/2026 às 16h.",
    url: window.location.href,
  };

  if (navigator.share) {
    await navigator.share(shareData);
    return;
  }

  await navigator.clipboard.writeText(`${shareData.text} ${shareData.url}`);
  const shareButton = document.querySelector("#shareButton");
  shareButton.textContent = "Link copiado";
  setTimeout(() => {
    shareButton.textContent = "Compartilhar convite";
  }, 2200);
}

document.querySelector("#calendarButton").addEventListener("click", downloadCalendarInvite);
document.querySelector("#shareButton").addEventListener("click", () => {
  shareInvite().catch(() => {});
});

galleryInput.addEventListener("change", async () => {
  galleryPhotoUrls.forEach((url) => URL.revokeObjectURL(url));
  galleryPhotoUrls = [];
  galleryPreview.replaceChildren();

  const selectedPhotos = [...galleryInput.files].filter((file) => file.type.startsWith("image/"));

  if (selectedPhotos.length === 0) {
    renderGalleryEmpty();
    return;
  }

  selectedPhotos.forEach((photo) => {
    const photoUrl = URL.createObjectURL(photo);
    galleryPhotoUrls.push(photoUrl);

    renderGalleryPhoto({ url: photoUrl, name: photo.name });
  });

  try {
    await uploadGalleryPhotos(selectedPhotos);
  } catch (error) {
    setUploadStatus("Erro ao enviar. Confira as permissões do bucket no Supabase.", "error");
  }
});

loadStoredGalleryPhotos();
updateCountdown();
setInterval(updateCountdown, 1000);
