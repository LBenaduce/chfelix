import "./styles.css";

const eventStart = new Date("2026-07-18T16:00:00-03:00");
const eventEnd = new Date("2026-07-18T20:00:00-03:00");

const units = {
  days: document.querySelector("#days"),
  hours: document.querySelector("#hours"),
  minutes: document.querySelector("#minutes"),
  seconds: document.querySelector("#seconds"),
};

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

updateCountdown();
setInterval(updateCountdown, 1000);
